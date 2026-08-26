"""Integration tests for GET /api/insights/{access_code} endpoint."""
import pytest


@pytest.mark.asyncio
async def test_insights_returns_404_no_sessions(client):
    """Profiles with no sessions have no insights yet."""
    resp = await client.post("/api/profiles", json={
        "disease_stage": "early",
        "behavioral_patterns": ["wandering"],
        "calming_strategies": ["music"],
        "safety_concerns": ["falling"],
    })
    code = resp.json()["access_code"]

    insights_resp = await client.get(f"/api/insights/{code}")
    assert insights_resp.status_code == 404


@pytest.mark.asyncio
async def test_insights_404_for_unknown_profile(client):
    """Non-existent access code returns 404."""
    resp = await client.get("/api/insights/XXXXXXXX")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_insights_response_shape_after_sessions(client, db_session):
    """After sessions trigger insights computation, endpoint returns correct shape."""
    from sqlalchemy import select
    from app.models.profile import Profile
    from app.models.profile_insights import ProfileInsights
    from app.services.insights import compute_profile_insights, upsert_profile_insights
    from app.services.auth import hash_access_code

    # Create profile
    resp = await client.post("/api/profiles", json={
        "disease_stage": "middle",
        "behavioral_patterns": ["wandering"],
        "calming_strategies": ["music"],
        "safety_concerns": ["falling"],
    })
    code = resp.json()["access_code"]

    # Directly seed insights (bypass the ≥3 session threshold for test speed)
    profile_result = await db_session.execute(
        select(Profile).where(Profile.access_code_hash == hash_access_code(code))
    )
    profile = profile_result.scalar_one()
    fake_payload = {
        "crisis_frequency": {"this_week": 3, "last_week": 1, "trend": "increasing", "total_sessions": 4},
        "peak_time": "overnight",
        "drift_alert": {"last_count": 1, "this_count": 3},
        "resolution_rate": 0.75,
        "top_triggers": ["wandering", "sundowning"],
        "effective_strategies": {},
        "ineffective_reasons": {},
        "episode_cycle": {"detected": False},
        "care_score": 0,
        "care_level": None,
        "top_strategies_for_context": [],
    }
    await upsert_profile_insights(profile.id, fake_payload, db_session)

    insights_resp = await client.get(f"/api/insights/{code}")
    assert insights_resp.status_code == 200
    body = insights_resp.json()
    assert "insights" in body
    assert body["insights"]["crisis_frequency"]["this_week"] == 3
    assert body["insights"]["peak_time"] == "overnight"
    assert body["insights"]["top_triggers"] == ["wandering", "sundowning"]
