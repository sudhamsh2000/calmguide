"""Integration tests for POST /api/coach/acute-change-screen."""

import json

import pytest_asyncio

from app.models.profile import Profile
from app.services.auth import hash_access_code
from app.services.crypto import encrypt


@pytest_asyncio.fixture
async def b2c_profile(db_session):
    profile = Profile(
        access_code_hash=hash_access_code("SCRNCODE"),
        disease_stage="middle",
        behavioral_patterns=encrypt(json.dumps([])),
        calming_strategies=encrypt(json.dumps([])),
        safety_concerns=encrypt(json.dumps([])),
    )
    db_session.add(profile)
    await db_session.commit()
    return profile


async def test_recurring_behavior_proceeds_to_coaching(client, b2c_profile):
    resp = await client.post(
        "/api/coach/acute-change-screen",
        json={
            "access_code": "SCRNCODE",
            "is_new_or_different": False,
            "is_sudden_onset": False,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["outcome"] == "proceed_to_coaching"


async def test_fever_plus_change_recommends_medical_evaluation(client, b2c_profile):
    resp = await client.post(
        "/api/coach/acute-change-screen",
        json={
            "access_code": "SCRNCODE",
            "is_new_or_different": True,
            "is_sudden_onset": True,
            "fever_or_infection_signs": True,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["outcome"] == "medical_evaluation_recommended"
    assert "fever_or_infection_signs" in body["concerning_flags"]
    assert body["message"]


async def test_unsure_response_is_conservative(client, b2c_profile):
    resp = await client.post(
        "/api/coach/acute-change-screen",
        json={
            "access_code": "SCRNCODE",
            "is_new_or_different": True,
            "is_sudden_onset": False,
            "unsure": True,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["outcome"] == "medical_evaluation_recommended"
    assert body["is_uncertain"] is True


async def test_missing_identifier_returns_400(client):
    resp = await client.post(
        "/api/coach/acute-change-screen",
        json={"is_new_or_different": False, "is_sudden_onset": False},
    )
    assert resp.status_code == 400


async def test_unknown_access_code_returns_404(client):
    resp = await client.post(
        "/api/coach/acute-change-screen",
        json={
            "access_code": "NOPE0000",
            "is_new_or_different": False,
            "is_sudden_onset": False,
        },
    )
    assert resp.status_code == 404
