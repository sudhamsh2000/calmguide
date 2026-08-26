"""Authorization tests for POST /api/coach/chat (B2B profile_id path).

SECURITY INVARIANT: the facility (profile_id) path must require a valid staff
JWT AND verify the authenticated staff is authorized for that specific profile
(an active StaffPatientAssignment for `staff` role, or an active
FacilityPatientLink to the staff's facility for `admin`/`owner`). The B2C
access_code path stays unauthenticated by design — the 8-char code is the secret.

Regression guard for the critical IDOR where any caller could load and write to
any patient's clinical profile by supplying a raw profile_id.
"""

import json

import pytest_asyncio
from sqlalchemy import select

from app.models.conversation import Conversation
from app.models.facility import Facility
from app.models.facility_patient_link import FacilityPatientLink
from app.models.profile import Profile
from app.models.staff import Staff
from app.models.staff_patient_assignment import StaffPatientAssignment
from app.services.auth import hash_access_code
from app.services.crypto import encrypt
from app.services.jwt_service import create_token


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def facility(db_session):
    fac = Facility(name="Sunrise Memory Care", facility_code_hash=hash_access_code("FACAAAA1"), is_active=True)
    db_session.add(fac)
    await db_session.commit()
    await db_session.refresh(fac)
    return fac


@pytest_asyncio.fixture
async def other_facility(db_session):
    fac = Facility(name="Other Home", facility_code_hash=hash_access_code("FACBBBB2"), is_active=True)
    db_session.add(fac)
    await db_session.commit()
    await db_session.refresh(fac)
    return fac


@pytest_asyncio.fixture
async def admin_staff(db_session, facility):
    staff = Staff(facility_id=facility.id, name="Alice Admin", email="alice@f.example", role="admin", is_active=True)
    db_session.add(staff)
    await db_session.commit()
    await db_session.refresh(staff)
    return staff


@pytest_asyncio.fixture
async def regular_staff(db_session, facility):
    staff = Staff(facility_id=facility.id, name="Carol Staff", email="carol@f.example", role="staff", is_active=True)
    db_session.add(staff)
    await db_session.commit()
    await db_session.refresh(staff)
    return staff


@pytest_asyncio.fixture
async def other_admin(db_session, other_facility):
    staff = Staff(facility_id=other_facility.id, name="Dave Admin", email="dave@b.example", role="admin", is_active=True)
    db_session.add(staff)
    await db_session.commit()
    await db_session.refresh(staff)
    return staff


@pytest_asyncio.fixture
async def linked_profile(db_session, facility):
    """A resident profile linked to `facility`."""
    profile = Profile(
        access_code_hash=hash_access_code("RESIDENT1"),
        disease_stage="middle",
        behavioral_patterns=encrypt(json.dumps(["sundowning"])),
        calming_strategies=encrypt(json.dumps(["music"])),
        safety_concerns=encrypt(json.dumps(["wandering"])),
    )
    db_session.add(profile)
    await db_session.flush()
    db_session.add(FacilityPatientLink(facility_id=facility.id, profile_id=profile.id, is_active=True))
    await db_session.commit()
    await db_session.refresh(profile)
    return profile


def _auth(staff: Staff) -> dict[str, str]:
    token = create_token(staff_id=staff.id, facility_id=staff.facility_id, role=staff.role)
    return {"Authorization": f"Bearer {token}"}


def _b2b_payload(profile_id: str, **extra) -> dict:
    base = {"profile_id": profile_id, "patient_name": "Eleanor", "message": "She is agitated."}
    base.update(extra)
    return base


# ---------------------------------------------------------------------------
# Authentication required on the B2B path
# ---------------------------------------------------------------------------

async def test_coach_b2b_no_auth_returns_401(client, linked_profile):
    resp = await client.post("/api/coach/chat", json=_b2b_payload(linked_profile.id))
    assert resp.status_code == 401


async def test_coach_b2b_invalid_token_returns_401(client, linked_profile):
    resp = await client.post(
        "/api/coach/chat",
        json=_b2b_payload(linked_profile.id),
        headers={"Authorization": "Bearer not.a.valid.jwt"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Object-level authorization
# ---------------------------------------------------------------------------

async def test_coach_b2b_admin_linked_profile_ok(client, admin_staff, linked_profile):
    resp = await client.post("/api/coach/chat", json=_b2b_payload(linked_profile.id), headers=_auth(admin_staff))
    assert resp.status_code == 200


async def test_coach_b2b_admin_unlinked_profile_forbidden(client, db_session, admin_staff):
    """Admin requesting a profile NOT linked to their facility must get 403, not data."""
    orphan = Profile(
        access_code_hash=hash_access_code("ORPHAN01"),
        disease_stage="late",
        behavioral_patterns=encrypt(json.dumps([])),
        calming_strategies=encrypt(json.dumps([])),
        safety_concerns=encrypt(json.dumps([])),
    )
    db_session.add(orphan)
    await db_session.commit()
    await db_session.refresh(orphan)
    resp = await client.post("/api/coach/chat", json=_b2b_payload(orphan.id), headers=_auth(admin_staff))
    assert resp.status_code == 403


async def test_coach_b2b_cross_facility_forbidden(client, other_admin, linked_profile):
    """Admin of facility B must NOT reach a profile linked to facility A."""
    resp = await client.post("/api/coach/chat", json=_b2b_payload(linked_profile.id), headers=_auth(other_admin))
    assert resp.status_code == 403


async def test_coach_b2b_staff_without_assignment_forbidden(client, regular_staff, linked_profile):
    """A staff-role user with no assignment to the profile must get 403."""
    resp = await client.post("/api/coach/chat", json=_b2b_payload(linked_profile.id), headers=_auth(regular_staff))
    assert resp.status_code == 403


async def test_coach_b2b_staff_with_assignment_ok(client, db_session, regular_staff, linked_profile, facility):
    db_session.add(StaffPatientAssignment(
        staff_id=regular_staff.id, profile_id=linked_profile.id, facility_id=facility.id,
    ))
    await db_session.commit()
    resp = await client.post("/api/coach/chat", json=_b2b_payload(linked_profile.id), headers=_auth(regular_staff))
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Audit trail must come from the token, not the request body (anti-spoofing)
# ---------------------------------------------------------------------------

async def test_coach_b2b_audit_ids_derived_from_token_not_body(client, db_session, admin_staff, linked_profile):
    resp = await client.post(
        "/api/coach/chat",
        json=_b2b_payload(linked_profile.id, staff_id="spoofed-staff", facility_id="spoofed-facility"),
        headers=_auth(admin_staff),
    )
    assert resp.status_code == 200
    rows = (await db_session.execute(
        select(Conversation).where(Conversation.profile_id == linked_profile.id, Conversation.role == "user")
    )).scalars().all()
    assert rows, "user message should be persisted"
    for row in rows:
        assert row.staff_id == admin_staff.id
        assert row.facility_id == admin_staff.facility_id
        assert row.staff_id != "spoofed-staff"
        assert row.facility_id != "spoofed-facility"


# ---------------------------------------------------------------------------
# B2C access_code path stays unauthenticated (regression)
# ---------------------------------------------------------------------------

async def test_coach_b2c_access_code_no_auth_still_works(client, db_session):
    profile = Profile(
        access_code_hash=hash_access_code("B2CCODE1"),
        disease_stage="early",
        behavioral_patterns=encrypt(json.dumps(["repeats questions"])),
        calming_strategies=encrypt(json.dumps(["reassure"])),
        safety_concerns=encrypt(json.dumps([])),
    )
    db_session.add(profile)
    await db_session.commit()
    resp = await client.post(
        "/api/coach/chat",
        json={"access_code": "B2CCODE1", "patient_name": "Mom", "message": "She keeps asking the same thing."},
    )
    assert resp.status_code == 200
