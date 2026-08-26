"""Correctness + isolation tests for GET /api/facility/my-residents.

Locks the behavior before the N+1 → bulk-query refactor (DBPERF-3) and covers
the previously-untested cross-tenant isolation (TEST-6).
"""

import json
from datetime import datetime, timedelta, timezone

import pytest_asyncio

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
    return {"Authorization": f"Bearer {create_token(staff_id=staff.id, facility_id=staff.facility_id, role=staff.role)}"}


async def _profile(db_session, code, stage="middle"):
    p = Profile(
        access_code_hash=hash_access_code(code),
        disease_stage=stage,
        behavioral_patterns=encrypt(json.dumps([])),
        calming_strategies=encrypt(json.dumps([])),
        safety_concerns=encrypt(json.dumps([])),
    )
    db_session.add(p)
    await db_session.flush()
    return p


@pytest_asyncio.fixture
async def setup(db_session):
    fac = Facility(name="A", facility_code_hash=hash_access_code("FACAAAA1"), is_active=True)
    other = Facility(name="B", facility_code_hash=hash_access_code("FACBBBB2"), is_active=True)
    db_session.add_all([fac, other])
    await db_session.flush()

    admin = Staff(facility_id=fac.id, name="Admin", email="a@a.x", role="admin", is_active=True)
    nurse = Staff(facility_id=fac.id, name="Nurse", email="n@a.x", role="staff", is_active=True)
    db_session.add_all([admin, nurse])
    await db_session.flush()

    p1 = await _profile(db_session, "RESONE01", "early")
    p2 = await _profile(db_session, "RESTWO02", "late")
    other_p = await _profile(db_session, "OTHERP03")

    db_session.add_all([
        FacilityPatientLink(facility_id=fac.id, profile_id=p1.id, unit="U1", room="101", bed="A", is_active=True),
        FacilityPatientLink(facility_id=fac.id, profile_id=p2.id, unit="U2", room="202", bed="B", is_active=True),
        FacilityPatientLink(facility_id=other.id, profile_id=other_p.id, is_active=True),
    ])

    # p1 has 5 recent incidents -> high risk; p2 has none -> low
    now = datetime.now(timezone.utc)
    for i in range(5):
        db_session.add(Incident(
            profile_id=p1.id, source="manual", incident_time=now - timedelta(days=1, hours=i),
            time_slot="evening", behavior_category="aggression_anger",
            behavior_description=encrypt("x"), intervention_outcome="resolved",
        ))
    # nurse is assigned only to p1
    db_session.add(StaffPatientAssignment(staff_id=nurse.id, profile_id=p1.id, facility_id=fac.id))
    await db_session.commit()
    return {"admin": admin, "nurse": nurse, "p1": p1, "p2": p2, "other_p": other_p}


async def test_admin_sees_all_facility_residents(client, setup):
    resp = await client.get("/api/facility/my-residents", headers=_auth(setup["admin"]))
    assert resp.status_code == 200
    residents = {r["profile_id"]: r for r in resp.json()["residents"]}
    assert set(residents) == {setup["p1"].id, setup["p2"].id}
    assert residents[setup["p1"].id]["unit"] == "U1"
    assert residents[setup["p1"].id]["room"] == "101"
    assert residents[setup["p1"].id]["disease_stage"] == "early"
    # 5 incidents in last 7 days -> high
    assert residents[setup["p1"].id]["risk_level"] == "high"
    assert residents[setup["p2"].id]["risk_level"] == "low"


async def test_admin_does_not_see_other_facility_residents(client, setup):
    resp = await client.get("/api/facility/my-residents", headers=_auth(setup["admin"]))
    ids = {r["profile_id"] for r in resp.json()["residents"]}
    assert setup["other_p"].id not in ids


async def test_staff_sees_only_assigned(client, setup):
    resp = await client.get("/api/facility/my-residents", headers=_auth(setup["nurse"]))
    assert resp.status_code == 200
    ids = {r["profile_id"] for r in resp.json()["residents"]}
    assert ids == {setup["p1"].id}
