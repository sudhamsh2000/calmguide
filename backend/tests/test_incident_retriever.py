from datetime import UTC, datetime, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.incident_retriever import detect_behavior_categories, get_relevant_incidents

VALID_PROFILE = {
    "disease_stage": "middle",
    "behavioral_patterns": ["sundowning", "wandering"],
    "calming_strategies": ["soft music", "warm drink"],
    "safety_concerns": ["fall risk"],
}


class TestDetectBehaviorCategories:
    def test_detect_wandering(self):
        categories = detect_behavior_categories("Mom keeps trying to leave the house")
        assert "wandering_exit_seeking" in categories

    def test_detect_aggression(self):
        categories = detect_behavior_categories("Dad hit me when I tried to help him shower")
        assert "aggression_anger" in categories

    def test_detect_refusing_care(self):
        categories = detect_behavior_categories("She won't take her medication tonight")
        assert "refusing_care" in categories

    def test_detect_confusion(self):
        categories = detect_behavior_categories("He's very confused and doesn't know where he is")
        assert "confusion_disorientation" in categories

    def test_detect_sleep(self):
        categories = detect_behavior_categories("She was up all night pacing")
        assert "sleep_problems" in categories

    def test_detect_multiple(self):
        categories = detect_behavior_categories("He's confused and keeps trying to leave")
        assert len(categories) >= 1

    def test_unknown_returns_other(self):
        categories = detect_behavior_categories("Something happened today")
        assert categories == ["other"]


@pytest.mark.asyncio
async def test_get_relevant_incidents_by_category(client: AsyncClient, db_session: AsyncSession):
    resp = await client.post("/api/profiles", json=VALID_PROFILE)
    code = resp.json()["access_code"]
    profile_id = resp.json()["id"]

    await client.post(
        f"/api/incidents/{code}",
        json={
            "behavior_category": "wandering_exit_seeking",
            "behavior_description": "Tried to leave at 2am",
            "incident_time": datetime.now(UTC).isoformat(),
        },
    )
    await client.post(
        f"/api/incidents/{code}",
        json={
            "behavior_category": "aggression_anger",
            "behavior_description": "Hit caregiver",
            "incident_time": datetime.now(UTC).isoformat(),
        },
    )

    incidents = await get_relevant_incidents(profile_id, "Mom is trying to leave again", db_session)
    assert len(incidents) >= 1
    categories = [i.behavior_category for i in incidents]
    assert "wandering_exit_seeking" in categories
