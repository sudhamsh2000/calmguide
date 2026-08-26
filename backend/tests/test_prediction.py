"""Integration tests for care pattern and cross-patient strategy endpoints."""
import pytest


@pytest.mark.asyncio
async def test_care_patterns_204_insufficient_data(client):
    resp = await client.post("/api/profiles", json={
        "disease_stage": "middle",
        "behavioral_patterns": ["wandering"],
        "calming_strategies": ["music"],
        "safety_concerns": ["falling"],
    })
    code = resp.json()["access_code"]
    pattern_resp = await client.get(f"/api/care-patterns/{code}")
    assert pattern_resp.status_code == 204


@pytest.mark.asyncio
async def test_strategies_204_small_cohort(client):
    resp = await client.post("/api/profiles", json={
        "disease_stage": "middle",
        "behavioral_patterns": ["wandering"],
        "calming_strategies": ["music"],
        "safety_concerns": ["falling"],
    })
    code = resp.json()["access_code"]
    strat_resp = await client.get(f"/api/strategies/{code}")
    assert strat_resp.status_code == 204


@pytest.mark.asyncio
async def test_care_patterns_endpoint_exists(client):
    resp = await client.post("/api/profiles", json={
        "disease_stage": "middle",
        "behavioral_patterns": ["wandering"],
        "calming_strategies": ["music"],
        "safety_concerns": ["falling"],
    })
    code = resp.json()["access_code"]
    pattern_resp = await client.get(f"/api/care-patterns/{code}")
    assert pattern_resp.status_code in (200, 204)
