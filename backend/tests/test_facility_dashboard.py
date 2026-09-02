"""Correctness tests for GET /api/facility/dashboard/*.

staff-activity tests lock behavior before the 3N+1 -> bulk GROUP BY refactor
(SCALE-5/DBPERF-4). summary tests cover the escalating_residents computation
(FAC-6 gap fix) and confirm prn_medications is no longer returned.
"""

import json
from datetime import UTC, datetime, timedelta, timezone

import pytest_asyncio

from app.models.conversation import Conversation
from app.models.facility import Facility
from app.models.facility_patient_link import FacilityPatientLink
from app.models.incident import Incident
from app.models.profile import Profile
from app.models.staff import Staff
from app.models.staff_patient_assignment import StaffPatientAssignment
from app.services.auth import hash_access_code
from app.services.crypto import encrypt
from app.services.jwt_service import create_token


def _auth(staff):
    return {
        "Authorization": f"Bearer {create_token(staff_id=staff.id, facility_id=staff.facility_id, role=staff.role)}"
    }


def _profile(**overrides):
    defaults = dict(
        disease_stage="middle",
        behavioral_patterns=encrypt(json.dumps([])),
        calming_strategies=encrypt(json.dumps([])),
        safety_concerns=encrypt(json.dumps([])),
    )
    defaults.update(overrides)
    return Profile(**defaults)


def _incident(profile_id, incident_time, category="aggression_anger"):
    return Incident(
        profile_id=profile_id,
        source="manual",
        incident_time=incident_time,
        behavior_category=category,
        behavior_description=encrypt("x"),
    )


@pytest_asyncio.fixture
async def setup(db_session):
    fac = Facility(name="A", facility_code_hash=hash_access_code("FACAAAA1"), is_active=True)
    db_session.add(fac)
    await db_session.flush()

    admin = Staff(facility_id=fac.id, name="Admin", email="a@a.x", role="admin", is_active=True)
    nurse_a = Staff(
        facility_id=fac.id, name="A Nurse", email="na@a.x", role="staff", is_active=True
    )
    nurse_b = Staff(
        facility_id=fac.id, name="B Nurse", email="nb@a.x", role="staff", is_active=True
    )
    db_session.add_all([admin, nurse_a, nurse_b])
    await db_session.flush()

    profile = Profile(
        access_code_hash=hash_access_code("RESIDEA1"),
        disease_stage="middle",
        behavioral_patterns=encrypt(json.dumps([])),
        calming_strategies=encrypt(json.dumps([])),
        safety_concerns=encrypt(json.dumps([])),
    )
    db_session.add(profile)
    await db_session.flush()

    now = datetime.now(UTC)
    # nurse_a: 2 incidents, 1 conversation session (2 msgs), 1 assignment
    db_session.add_all(
        [
            Incident(
                profile_id=profile.id,
                source="manual",
                incident_time=now,
                time_slot="evening",
                behavior_category="aggression_anger",
                behavior_description=encrypt("x"),
                staff_id=nurse_a.id,
            ),
            Incident(
                profile_id=profile.id,
                source="manual",
                incident_time=now,
                time_slot="evening",
                behavior_category="wandering_exit_seeking",
                behavior_description=encrypt("y"),
                staff_id=nurse_a.id,
            ),
            Conversation(
                profile_id=profile.id,
                session_id="sess-1",
                role="user",
                content=encrypt("hi"),
                staff_id=nurse_a.id,
            ),
            Conversation(
                profile_id=profile.id,
                session_id="sess-1",
                role="assistant",
                content=encrypt("ok"),
                staff_id=nurse_a.id,
            ),
            StaffPatientAssignment(staff_id=nurse_a.id, profile_id=profile.id, facility_id=fac.id),
        ]
    )
    await db_session.commit()
    return {"admin": admin, "nurse_a": nurse_a, "nurse_b": nurse_b}


async def test_staff_activity_counts(client, setup):
    resp = await client.get("/api/facility/dashboard/staff-activity", headers=_auth(setup["admin"]))
    assert resp.status_code == 200
    by_id = {s["id"]: s for s in resp.json()["staff"]}

    a = by_id[setup["nurse_a"].id]
    assert a["incidents_logged"] == 2
    assert a["sessions_this_week"] == 1  # distinct session_id
    assert a["assigned_patients_count"] == 1

    b = by_id[setup["nurse_b"].id]
    assert b["incidents_logged"] == 0
    assert b["sessions_this_week"] == 0
    assert b["assigned_patients_count"] == 0


@pytest_asyncio.fixture
async def escalation_setup(db_session):
    fac = Facility(name="A", facility_code_hash=hash_access_code("FACBBBB1"), is_active=True)
    db_session.add(fac)
    await db_session.flush()

    admin = Staff(facility_id=fac.id, name="Admin", email="admin@a.x", role="admin", is_active=True)
    db_session.add(admin)
    await db_session.flush()

    # spiking: 0 incidents in the prior 24h window, 2 in the current 24h window
    spiking = _profile(access_code_hash=hash_access_code("RESISPK1"))
    # steady: 1 incident in each window — not a spike
    steady = _profile(access_code_hash=hash_access_code("RESISTD1"))
    db_session.add_all([spiking, steady])
    await db_session.flush()

    db_session.add_all(
        [
            FacilityPatientLink(facility_id=fac.id, profile_id=spiking.id, is_active=True),
            FacilityPatientLink(facility_id=fac.id, profile_id=steady.id, is_active=True),
        ]
    )

    now = datetime.now(UTC)
    db_session.add_all(
        [
            _incident(spiking.id, now - timedelta(hours=1)),
            _incident(spiking.id, now - timedelta(hours=2)),
            _incident(steady.id, now - timedelta(hours=1)),
            _incident(steady.id, now - timedelta(hours=30)),
        ]
    )
    await db_session.commit()
    return {"admin": admin, "spiking": spiking, "steady": steady}


async def test_dashboard_summary_escalating_residents(client, escalation_setup):
    resp = await client.get(
        "/api/facility/dashboard/summary?hours=24",
        headers=_auth(escalation_setup["admin"]),
    )
    assert resp.status_code == 200
    body = resp.json()

    escalating_ids = {r["profile_id"] for r in body["escalating_residents"]}
    assert escalating_ids == {escalation_setup["spiking"].id}

    spiking_entry = next(
        r for r in body["escalating_residents"] if r["profile_id"] == escalation_setup["spiking"].id
    )
    assert spiking_entry["category"] == "aggression_anger"
    assert spiking_entry["trend"] == "spike"


async def test_dashboard_summary_no_prn_medications_key(client, escalation_setup):
    resp = await client.get(
        "/api/facility/dashboard/summary?hours=24",
        headers=_auth(escalation_setup["admin"]),
    )
    assert resp.status_code == 200
    assert "prn_medications" not in resp.json()
