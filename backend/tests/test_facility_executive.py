"""Tests for GET /api/facility/executive/overview.

Covers the roi_estimate gap fix: incident_reduction_pct is real (computed
from actual incident counts), but estimated_savings_monthly and
prn_reduction_pct had no backing data anywhere in the schema (no cost model,
no PRN administration tracking) and were hardcoded to 0 — decided to remove
both rather than fabricate numbers a facility owner might rely on for ROI
decisions, same precedent as the FAC-6 prn_medications fix.
"""

import json
from datetime import UTC, datetime, timedelta, timezone

import pytest_asyncio

from app.models.facility import Facility
from app.models.facility_patient_link import FacilityPatientLink
from app.models.incident import Incident
from app.models.profile import Profile
from app.models.staff import Staff
from app.services.auth import hash_access_code
from app.services.crypto import encrypt
from app.services.jwt_service import create_token


def _auth(staff):
    return {
        "Authorization": f"Bearer {create_token(staff_id=staff.id, facility_id=staff.facility_id, role=staff.role)}"
    }


def _incident(profile_id, incident_time):
    return Incident(
        profile_id=profile_id,
        source="manual",
        incident_time=incident_time,
        behavior_category="aggression_anger",
        behavior_description=encrypt("x"),
        created_at=incident_time,
    )


@pytest_asyncio.fixture
async def executive_setup(db_session):
    fac = Facility(name="A", facility_code_hash=hash_access_code("FACEXEC1"), is_active=True)
    db_session.add(fac)
    await db_session.flush()

    owner = Staff(facility_id=fac.id, name="Owner", email="owner@a.x", role="owner", is_active=True)
    db_session.add(owner)
    await db_session.flush()

    profile = Profile(
        access_code_hash=hash_access_code("RESIEXE1"),
        disease_stage="middle",
        behavioral_patterns=encrypt(json.dumps([])),
        calming_strategies=encrypt(json.dumps([])),
        safety_concerns=encrypt(json.dumps([])),
    )
    db_session.add(profile)
    await db_session.flush()

    db_session.add(FacilityPatientLink(facility_id=fac.id, profile_id=profile.id, is_active=True))

    now = datetime.now(UTC)
    # previous 30d window (30-60 days ago): 10 incidents
    # current 30d window (0-30 days ago): 5 incidents -> a real 50% reduction
    incidents = [_incident(profile.id, now - timedelta(days=45)) for _ in range(10)]
    incidents += [_incident(profile.id, now - timedelta(days=10)) for _ in range(5)]
    db_session.add_all(incidents)
    await db_session.commit()
    return {"owner": owner}


async def test_executive_overview_roi_estimate_has_no_fabricated_fields(client, executive_setup):
    resp = await client.get(
        "/api/facility/executive/overview",
        headers=_auth(executive_setup["owner"]),
    )
    assert resp.status_code == 200
    roi = resp.json()["roi_estimate"]

    assert roi == {"incident_reduction_pct": 50}
