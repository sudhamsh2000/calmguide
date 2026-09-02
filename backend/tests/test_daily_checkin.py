"""Integration tests for daily behavioral check-in endpoints."""

import pytest


@pytest.mark.asyncio
async def test_submit_checkin_calm(client):
    resp = await client.post(
        "/api/profiles",
        json={
            "disease_stage": "middle",
            "behavioral_patterns": ["wandering"],
            "calming_strategies": ["music"],
            "safety_concerns": ["falling"],
        },
    )
    code = resp.json()["access_code"]

    checkin_resp = await client.post(
        "/api/checkin/daily",
        json={
            "access_code": code,
            "severity": "calm",
        },
    )
    assert checkin_resp.status_code == 201
    assert "id" in checkin_resp.json()


@pytest.mark.asyncio
async def test_submit_checkin_tough_with_tags(client):
    resp = await client.post(
        "/api/profiles",
        json={
            "disease_stage": "middle",
            "behavioral_patterns": ["wandering"],
            "calming_strategies": ["music"],
            "safety_concerns": ["falling"],
        },
    )
    code = resp.json()["access_code"]

    checkin_resp = await client.post(
        "/api/checkin/daily",
        json={
            "access_code": code,
            "severity": "tough",
            "time_slot": "overnight",
            "tags": ["music", "calm_approach"],
        },
    )
    assert checkin_resp.status_code == 201


@pytest.mark.asyncio
async def test_checkin_status_today(client):
    resp = await client.post(
        "/api/profiles",
        json={
            "disease_stage": "middle",
            "behavioral_patterns": ["wandering"],
            "calming_strategies": ["music"],
            "safety_concerns": ["falling"],
        },
    )
    code = resp.json()["access_code"]

    status_resp = await client.get(f"/api/checkin/daily/{code}/today")
    assert status_resp.status_code == 200
    assert status_resp.json()["checked_in"] is False

    await client.post(
        "/api/checkin/daily",
        json={
            "access_code": code,
            "severity": "calm",
        },
    )
    status_resp2 = await client.get(f"/api/checkin/daily/{code}/today")
    assert status_resp2.status_code == 200
    assert status_resp2.json()["checked_in"] is True
    assert len(status_resp2.json()["entries"]) >= 1


@pytest.mark.asyncio
async def test_multiple_checkins_same_day(client):
    resp = await client.post(
        "/api/profiles",
        json={
            "disease_stage": "middle",
            "behavioral_patterns": ["wandering"],
            "calming_strategies": ["music"],
            "safety_concerns": ["falling"],
        },
    )
    code = resp.json()["access_code"]

    await client.post(
        "/api/checkin/daily",
        json={
            "access_code": code,
            "severity": "calm",
        },
    )
    await client.post(
        "/api/checkin/daily",
        json={
            "access_code": code,
            "severity": "tough",
            "time_slot": "evening",
        },
    )

    status_resp = await client.get(f"/api/checkin/daily/{code}/today")
    assert len(status_resp.json()["entries"]) == 2


@pytest.mark.asyncio
async def test_checkin_invalid_severity(client):
    resp = await client.post(
        "/api/profiles",
        json={
            "disease_stage": "middle",
            "behavioral_patterns": ["wandering"],
            "calming_strategies": ["music"],
            "safety_concerns": ["falling"],
        },
    )
    code = resp.json()["access_code"]

    checkin_resp = await client.post(
        "/api/checkin/daily",
        json={
            "access_code": code,
            "severity": "terrible",
        },
    )
    assert checkin_resp.status_code == 422
