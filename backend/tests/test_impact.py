"""Tests for GET /api/impact public endpoint."""
import pytest


@pytest.fixture(autouse=True)
def clear_impact_cache():
    """Reset the in-memory cache before each test."""
    import app.routers.impact as impact_module
    impact_module._cache["data"] = None
    impact_module._cache["expires_at"] = None
    yield


@pytest.mark.asyncio
async def test_impact_returns_200_no_auth(client):
    """Impact endpoint is public — no access code required."""
    resp = await client.get("/api/impact")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_impact_zero_when_no_data(client):
    """All counters are zero when there are no conversations."""
    resp = await client.get("/api/impact")
    body = resp.json()
    assert body["families_supported"] == 0
    assert body["coached_sessions"] == 0
    assert body["sessions_this_week"] == 0


@pytest.mark.asyncio
async def test_impact_counts_sessions(client):
    """After coach sessions, impact counts reflect real data."""
    resp = await client.post("/api/profiles", json={
        "disease_stage": "middle",
        "behavioral_patterns": ["wandering"],
        "calming_strategies": ["music"],
        "safety_concerns": ["falling"],
    })
    code = resp.json()["access_code"]

    for msg in ["Dad is wandering", "He is confused"]:
        r = await client.post("/api/coach/chat", json={
            "access_code": code,
            "patient_name": "Dad",
            "message": msg,
        })
        async for _ in r.aiter_lines():
            pass

    impact_resp = await client.get("/api/impact")
    body = impact_resp.json()
    assert body["families_supported"] >= 1
    assert body["coached_sessions"] >= 2
    assert body["sessions_this_week"] >= 2


@pytest.mark.asyncio
async def test_impact_response_shape(client):
    """Response has all required fields."""
    body = (await client.get("/api/impact")).json()
    for field in ["families_supported", "coached_sessions", "languages_served",
                  "overnight_pct", "sessions_this_week"]:
        assert field in body, f"Missing field: {field}"
