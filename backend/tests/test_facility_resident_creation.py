"""Tests for the facility resident creation endpoint.

POST /api/facilities/{facility_code}/residents

NOTE: These tests require the full HTTP client fixture and will fail until the
JSONB SQLite incompatibility is resolved. The Facility model uses JSONB
(PostgreSQL-only). All test logic is correct; they need a Postgres test DB or a
JSONB → JSON column migration for the SQLite test environment.

Covers:
- Successful resident creation (minimal and full payloads)
- Returns access_code, profile_id, disease_stage
- FacilityPatientLink is created and linked to correct facility
- Location fields (unit, room, bed) stored on the link
- Admin and owner roles may create residents
- Staff role is rejected with 403
- Unauthenticated request returns 401
- Invalid facility code returns 404
- Generated access code is 8 chars, alphanumeric, no ambiguous characters
"""

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.facility import Facility
from app.models.facility_patient_link import FacilityPatientLink
from app.models.profile import Profile
from app.models.staff import Staff
from app.services.auth import hash_access_code
from app.services.jwt_service import create_token

# ---------------------------------------------------------------------------
# Helper fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def facility(db_session, test_settings):
    """Create a Facility directly in the DB and return (facility, facility_code) tuple."""
    raw_code = "TESTFAC1"
    code_hash = hash_access_code(raw_code)
    fac = Facility(
        name="Sunrise Memory Care",
        facility_code_hash=code_hash,
        is_active=True,
    )
    db_session.add(fac)
    await db_session.commit()
    await db_session.refresh(fac)
    return fac, raw_code


@pytest_asyncio.fixture
async def admin_staff(db_session, facility):
    """Create an admin-role staff member linked to the facility."""
    fac, _ = facility
    staff = Staff(
        facility_id=fac.id,
        name="Alice Admin",
        email="alice@facility.example",
        role="admin",
        is_active=True,
    )
    db_session.add(staff)
    await db_session.commit()
    await db_session.refresh(staff)
    return staff


@pytest_asyncio.fixture
async def owner_staff(db_session, facility):
    """Create an owner-role staff member linked to the facility."""
    fac, _ = facility
    staff = Staff(
        facility_id=fac.id,
        name="Bob Owner",
        email="bob@facility.example",
        role="owner",
        is_active=True,
    )
    db_session.add(staff)
    await db_session.commit()
    await db_session.refresh(staff)
    return staff


@pytest_asyncio.fixture
async def regular_staff(db_session, facility):
    """Create a staff-role (non-admin) member linked to the facility."""
    fac, _ = facility
    staff = Staff(
        facility_id=fac.id,
        name="Carol Staff",
        email="carol@facility.example",
        role="staff",
        is_active=True,
    )
    db_session.add(staff)
    await db_session.commit()
    await db_session.refresh(staff)
    return staff


def _make_auth_headers(staff: Staff) -> dict[str, str]:
    """Generate a valid JWT bearer token for a staff member."""
    token = create_token(
        staff_id=staff.id,
        facility_id=staff.facility_id,
        role=staff.role,
    )
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Successful creation tests
# ---------------------------------------------------------------------------


async def test_create_resident_minimal_payload_admin(client, facility, admin_staff):
    """Admin can create a resident with just disease_stage; returns required fields."""
    fac, facility_code = facility
    headers = _make_auth_headers(admin_staff)

    resp = await client.post(
        f"/api/facilities/{facility_code}/residents",
        json={"disease_stage": "middle"},
        headers=headers,
    )

    assert resp.status_code == 201
    data = resp.json()
    assert "access_code" in data
    assert "profile_id" in data
    assert data["disease_stage"] == "middle"


async def test_create_resident_full_payload_admin(client, facility, admin_staff):
    """Full payload with behavioral patterns, calming strategies, safety concerns, and location."""
    fac, facility_code = facility
    headers = _make_auth_headers(admin_staff)

    resp = await client.post(
        f"/api/facilities/{facility_code}/residents",
        json={
            "disease_stage": "late",
            "behavioral_patterns": ["sundowning", "wandering"],
            "calming_strategies": ["soft music", "warm drink"],
            "safety_concerns": ["fall risk"],
            "unit": "2A",
            "room": "201",
            "bed": "B",
        },
        headers=headers,
    )

    assert resp.status_code == 201
    data = resp.json()
    assert data["disease_stage"] == "late"
    assert data["unit"] == "2A"
    assert data["room"] == "201"
    assert data["bed"] == "B"


async def test_create_resident_owner_role_allowed(client, facility, owner_staff):
    """Owner role can also create residents."""
    fac, facility_code = facility
    headers = _make_auth_headers(owner_staff)

    resp = await client.post(
        f"/api/facilities/{facility_code}/residents",
        json={"disease_stage": "early"},
        headers=headers,
    )

    assert resp.status_code == 201


# ---------------------------------------------------------------------------
# Access code validity
# ---------------------------------------------------------------------------


async def test_created_access_code_is_8_chars(client, facility, admin_staff):
    fac, facility_code = facility
    headers = _make_auth_headers(admin_staff)

    resp = await client.post(
        f"/api/facilities/{facility_code}/residents",
        json={"disease_stage": "middle"},
        headers=headers,
    )

    code = resp.json()["access_code"]
    assert len(code) == 8


async def test_created_access_code_excludes_ambiguous_chars(client, facility, admin_staff):
    """Access codes must not contain 0, O, 1, I, L."""
    fac, facility_code = facility
    headers = _make_auth_headers(admin_staff)

    for _ in range(5):
        resp = await client.post(
            f"/api/facilities/{facility_code}/residents",
            json={"disease_stage": "middle"},
            headers=headers,
        )
        assert resp.status_code == 201
        code = resp.json()["access_code"]
        for char in code:
            assert char not in "0O1IL", f"Ambiguous character '{char}' in code '{code}'"


async def test_created_access_code_is_alphanumeric(client, facility, admin_staff):
    fac, facility_code = facility
    headers = _make_auth_headers(admin_staff)

    resp = await client.post(
        f"/api/facilities/{facility_code}/residents",
        json={"disease_stage": "middle"},
        headers=headers,
    )
    code = resp.json()["access_code"]
    assert code.isalnum()


# ---------------------------------------------------------------------------
# DB state verification
# ---------------------------------------------------------------------------


async def test_create_resident_creates_facility_patient_link(
    client, facility, admin_staff, db_session
):
    """A FacilityPatientLink row must be inserted connecting resident to facility."""
    fac, facility_code = facility
    headers = _make_auth_headers(admin_staff)

    resp = await client.post(
        f"/api/facilities/{facility_code}/residents",
        json={
            "disease_stage": "middle",
            "unit": "3B",
            "room": "305",
            "bed": "A",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    profile_id = resp.json()["profile_id"]

    link_result = await db_session.execute(
        select(FacilityPatientLink).where(
            FacilityPatientLink.facility_id == fac.id,
            FacilityPatientLink.profile_id == profile_id,
        )
    )
    link = link_result.scalar_one_or_none()
    assert link is not None
    assert link.is_active is True


async def test_create_resident_link_stores_location_fields(
    client, facility, admin_staff, db_session
):
    """Unit, room, and bed must be persisted on the FacilityPatientLink."""
    fac, facility_code = facility
    headers = _make_auth_headers(admin_staff)

    resp = await client.post(
        f"/api/facilities/{facility_code}/residents",
        json={
            "disease_stage": "late",
            "unit": "Wing-C",
            "room": "412",
            "bed": "Window",
        },
        headers=headers,
    )
    profile_id = resp.json()["profile_id"]

    link_result = await db_session.execute(
        select(FacilityPatientLink).where(FacilityPatientLink.profile_id == profile_id)
    )
    link = link_result.scalar_one()
    assert link.unit == "Wing-C"
    assert link.room == "412"
    assert link.bed == "Window"


async def test_create_resident_link_records_staff_who_created(
    client, facility, admin_staff, db_session
):
    """linked_by on FacilityPatientLink must be the creating staff member's ID."""
    fac, facility_code = facility
    headers = _make_auth_headers(admin_staff)

    resp = await client.post(
        f"/api/facilities/{facility_code}/residents",
        json={"disease_stage": "middle"},
        headers=headers,
    )
    profile_id = resp.json()["profile_id"]

    link_result = await db_session.execute(
        select(FacilityPatientLink).where(FacilityPatientLink.profile_id == profile_id)
    )
    link = link_result.scalar_one()
    assert link.linked_by == admin_staff.id


async def test_create_resident_profile_accessible_by_access_code(client, facility, admin_staff):
    """The returned access_code must resolve to the resident profile via the profile endpoint."""
    fac, facility_code = facility
    headers = _make_auth_headers(admin_staff)

    create_resp = await client.post(
        f"/api/facilities/{facility_code}/residents",
        json={"disease_stage": "early"},
        headers=headers,
    )
    access_code = create_resp.json()["access_code"]

    profile_resp = await client.get(f"/api/profiles/{access_code}")
    assert profile_resp.status_code == 200
    assert profile_resp.json()["disease_stage"] == "early"


# ---------------------------------------------------------------------------
# Authorization tests
# ---------------------------------------------------------------------------


async def test_create_resident_staff_role_rejected(client, facility, regular_staff):
    """Staff role (non-admin) must receive 403."""
    fac, facility_code = facility
    headers = _make_auth_headers(regular_staff)

    resp = await client.post(
        f"/api/facilities/{facility_code}/residents",
        json={"disease_stage": "middle"},
        headers=headers,
    )

    assert resp.status_code == 403
    assert resp.json()["code"] == "FORBIDDEN"


async def test_create_resident_no_auth_returns_401(client, facility):
    """Unauthenticated request must return 401."""
    fac, facility_code = facility

    resp = await client.post(
        f"/api/facilities/{facility_code}/residents",
        json={"disease_stage": "middle"},
    )

    assert resp.status_code == 401


async def test_create_resident_invalid_token_returns_401(client, facility):
    """Malformed JWT must return 401."""
    fac, facility_code = facility

    resp = await client.post(
        f"/api/facilities/{facility_code}/residents",
        json={"disease_stage": "middle"},
        headers={"Authorization": "Bearer this.is.not.a.valid.jwt"},
    )

    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Invalid facility code
# ---------------------------------------------------------------------------


async def test_create_resident_invalid_facility_code_returns_404(client, admin_staff):
    """Non-existent facility code must return 404."""
    headers = _make_auth_headers(admin_staff)

    resp = await client.post(
        "/api/facilities/BADCODE1/residents",
        json={"disease_stage": "middle"},
        headers=headers,
    )

    assert resp.status_code == 404
    assert resp.json()["code"] == "FACILITY_NOT_FOUND"


# ---------------------------------------------------------------------------
# Disease stage variants
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("stage", ["early", "middle", "late", "unknown"])
async def test_create_resident_all_disease_stages(client, facility, admin_staff, stage):
    """All valid disease_stage values are accepted."""
    fac, facility_code = facility
    headers = _make_auth_headers(admin_staff)

    resp = await client.post(
        f"/api/facilities/{facility_code}/residents",
        json={"disease_stage": stage},
        headers=headers,
    )

    assert resp.status_code == 201
    assert resp.json()["disease_stage"] == stage


# ---------------------------------------------------------------------------
# Location fields — null when not provided
# ---------------------------------------------------------------------------


async def test_create_resident_without_location_fields_returns_nulls(client, facility, admin_staff):
    """Omitting unit/room/bed results in null values in the response."""
    fac, facility_code = facility
    headers = _make_auth_headers(admin_staff)

    resp = await client.post(
        f"/api/facilities/{facility_code}/residents",
        json={"disease_stage": "middle"},
        headers=headers,
    )

    assert resp.status_code == 201
    data = resp.json()
    assert data["unit"] is None
    assert data["room"] is None
    assert data["bed"] is None


# ---------------------------------------------------------------------------
# Multiple residents — unique access codes
# ---------------------------------------------------------------------------


async def test_create_multiple_residents_each_gets_unique_access_code(
    client, facility, admin_staff
):
    """Creating multiple residents must yield distinct access codes."""
    fac, facility_code = facility
    headers = _make_auth_headers(admin_staff)
    codes = set()

    for _ in range(5):
        resp = await client.post(
            f"/api/facilities/{facility_code}/residents",
            json={"disease_stage": "middle"},
            headers=headers,
        )
        assert resp.status_code == 201
        codes.add(resp.json()["access_code"])

    assert len(codes) == 5, "All access codes must be unique"
