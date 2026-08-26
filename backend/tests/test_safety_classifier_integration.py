"""Integration tests: the second-layer classifier escalates through the same
endpoints as the deterministic gate when the regex gate misses a paraphrase."""

import json

import pytest_asyncio
from sqlalchemy import select

from app.models.profile import Profile
from app.models.safety_event import SafetyEvent
from app.services.auth import hash_access_code
from app.services.crypto import encrypt


@pytest_asyncio.fixture
async def b2c_profile(db_session):
    profile = Profile(
        access_code_hash=hash_access_code("CLSCODE1"),
        disease_stage="middle",
        behavioral_patterns=encrypt(json.dumps([])),
        calming_strategies=encrypt(json.dumps([])),
        safety_concerns=encrypt(json.dumps([])),
    )
    db_session.add(profile)
    await db_session.commit()
    return profile


async def test_coach_chat_escalates_on_classifier_only_match(app, client, b2c_profile):
    """'hart attak' is a misspelling the deterministic regex won't match, but
    the fuzzy classifier should catch it and still produce a 911 deflection."""
    resp = await client.post(
        "/api/coach/chat",
        json={
            "access_code": "CLSCODE1",
            "patient_name": "Mom",
            "message": "i think mom might be having a hart attak",
        },
    )
    assert resp.status_code == 200
    body = resp.text
    assert "911" in body
    assert "data: [DONE]" in body


async def test_checkin_escalates_on_classifier_only_match(app, client, b2c_profile):
    resp = await client.post(
        "/api/checkin",
        json={"access_code": "CLSCODE1", "message": "i think mom might be having a hart attak"},
    )
    assert resp.status_code == 200
    assert "911" in resp.text


async def test_classifier_escalation_logs_safety_event(app, client, db_session, b2c_profile):
    resp = await client.post(
        "/api/coach/chat",
        json={
            "access_code": "CLSCODE1",
            "patient_name": "Mom",
            "message": "i think mom might be having a hart attak",
        },
    )
    assert resp.status_code == 200

    # Background task needs a moment to flush after the response completes.
    import asyncio
    await asyncio.sleep(0.05)

    result = await db_session.execute(select(SafetyEvent))
    rows = result.scalars().all()
    assert len(rows) == 1
    assert rows[0].source == "classifier"
    assert rows[0].category == "life_threat"
    assert rows[0].confidence is not None
