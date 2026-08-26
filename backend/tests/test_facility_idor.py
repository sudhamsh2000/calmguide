"""Cross-facility IDOR regression tests (multi-tenancy boundary).

An authenticated staff member of facility B must never be able to read or write
facility A's data by supplying A's facility code (or a profile/assignment id that
belongs to A). Covers BAUTH-3, BAPI-4, BAPI-8.
"""

import json

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


async def _mk_facility(db_session, name, code):
    fac = Facility(name=name, facility_code_hash=hash_access_code(code), is_active=True)
    db_session.add(fac)
    await db_session.commit()
    await db_session.refresh(fac)
    return fac


async def _mk_admin(db_session, fac, email):
    staff = Staff(facility_id=fac.id, name="Admin", email=email, role="admin", is_active=True)
    db_session.add(staff)
    await db_session.commit()
    await db_session.refresh(staff)
    return staff


@pytest_asyncio.fixture
async def facility_a(db_session):
    return await _mk_facility(db_session, "Facility A", "FACAAAA1")


@pytest_asyncio.fixture
async def facility_b(db_session):
    return await _mk_facility(db_session, "Facility B", "FACBBBB2")


@pytest_asyncio.fixture
async def admin_b(db_session, facility_b):
    return await _mk_admin(db_session, facility_b, "admin-b@x.example")


@pytest_asyncio.fixture
async def resident_a(db_session, facility_a):
    profile = Profile(
        access_code_hash=hash_access_code("RESIDEA1"),
        disease_stage="middle",
        behavioral_patterns=encrypt(json.dumps([])),
        calming_strategies=encrypt(json.dumps([])),
        safety_concerns=encrypt(json.dumps([])),
    )
    db_session.add(profile)
    await db_session.flush()
    db_session.add(FacilityPatientLink(facility_id=facility_a.id, profile_id=profile.id, is_active=True))
    await db_session.commit()
    await db_session.refresh(profile)
    return profile


def _auth(staff):
    return {"Authorization": f"Bearer {create_token(staff_id=staff.id, facility_id=staff.facility_id, role=staff.role)}"}


# --- BAUTH-3: cross-facility read/write via the URL code ------------------

async def test_get_facility_cross_facility_forbidden(client, facility_a, admin_b):
    resp = await client.get("/api/facilities/FACAAAA1", headers=_auth(admin_b))
    assert resp.status_code == 403
    assert resp.json()["code"] == "WRONG_FACILITY"


async def test_list_staff_cross_facility_forbidden(client, facility_a, admin_b):
    resp = await client.get("/api/facilities/FACAAAA1/staff", headers=_auth(admin_b))
    assert resp.status_code == 403


async def test_create_resident_cross_facility_forbidden(client, facility_a, admin_b):
    resp = await client.post(
        "/api/facilities/FACAAAA1/residents",
        json={"disease_stage": "middle"},
        headers=_auth(admin_b),
    )
    assert resp.status_code == 403


# --- BAPI-4: deleting another facility's assignment ----------------------

async def test_remove_assignment_cross_facility_scoped_out(client, db_session, facility_a, admin_b, resident_a):
    """admin_b uses their OWN facility code (passes ownership) but targets an
    assignment id that belongs to facility A — must be 404, not deleted."""
    staff_a = Staff(facility_id=facility_a.id, name="Carol", email="c@a.example", role="staff", is_active=True)
    db_session.add(staff_a)
    await db_session.flush()
    assignment = StaffPatientAssignment(staff_id=staff_a.id, profile_id=resident_a.id, facility_id=facility_a.id)
    db_session.add(assignment)
    await db_session.commit()
    await db_session.refresh(assignment)

    resp = await client.delete(
        f"/api/facilities/FACBBBB2/assignments/{assignment.id}",
        headers=_auth(admin_b),
    )
    assert resp.status_code == 404
    # Assignment must remain active (not ended) in facility A.
    await db_session.refresh(assignment)
    assert assignment.ended_at is None


# --- BAPI-8: writing an incident into another facility's patient ---------

async def test_create_incident_by_profile_cross_facility_forbidden(client, facility_a, admin_b, resident_a):
    resp = await client.post(
        f"/api/incidents/by-profile/{resident_a.id}",
        json={
            "source": "manual",
            "incident_time": "2026-05-29T03:00:00+00:00",
            "behavior_category": "aggression_anger",
            "behavior_description": "fabricated",
        },
        headers=_auth(admin_b),
    )
    assert resp.status_code == 403
