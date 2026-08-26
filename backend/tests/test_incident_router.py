"""Tests for incident CRUD and care change endpoints."""

import pytest
import pytest_asyncio
from httpx import AsyncClient


VALID_PROFILE = {
    "disease_stage": "middle",
    "behavioral_patterns": ["sundowning", "wandering"],
    "calming_strategies": ["soft music", "warm drink"],
    "safety_concerns": ["fall risk"],
}


@pytest_asyncio.fixture
async def seeded_profile_code(client: AsyncClient) -> str:
    resp = await client.post("/api/profiles", json=VALID_PROFILE)
    assert resp.status_code == 201
    return resp.json()["access_code"]


class TestCreateIncident:
    async def test_creates_incident(self, client: AsyncClient, seeded_profile_code: str):
        resp = await client.post(
            f"/api/incidents/{seeded_profile_code}",
            json={
                "behavior_category": "wandering_exit_seeking",
                "behavior_description": "Tried to leave at 2am",
                "incident_time": "2026-04-29T02:00:00Z",
                "severity": "moderate",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"]
        assert data["created_at"]

    async def test_invalid_access_code_returns_404(self, client: AsyncClient):
        resp = await client.post(
            "/api/incidents/BADCODE1",
            json={
                "behavior_category": "other",
                "behavior_description": "test",
                "incident_time": "2026-04-29T02:00:00Z",
            },
        )
        assert resp.status_code == 404

    async def test_invalid_category_returns_422(self, client: AsyncClient, seeded_profile_code: str):
        resp = await client.post(
            f"/api/incidents/{seeded_profile_code}",
            json={
                "behavior_category": "invalid",
                "behavior_description": "test",
                "incident_time": "2026-04-29T02:00:00Z",
            },
        )
        assert resp.status_code == 422

    async def test_computes_time_slot(self, client: AsyncClient, seeded_profile_code: str):
        resp = await client.post(
            f"/api/incidents/{seeded_profile_code}",
            json={
                "behavior_category": "sleep_problems",
                "behavior_description": "Woke up agitated",
                "incident_time": "2026-04-29T03:00:00Z",
            },
        )
        assert resp.status_code == 201
        incident_id = resp.json()["id"]

        detail = await client.get(f"/api/incidents/{seeded_profile_code}/{incident_id}")
        assert detail.json()["time_slot"] == "overnight"


class TestListIncidents:
    async def test_returns_incidents(self, client: AsyncClient, seeded_profile_code: str):
        for desc in ["First incident", "Second incident"]:
            await client.post(
                f"/api/incidents/{seeded_profile_code}",
                json={
                    "behavior_category": "aggression_anger",
                    "behavior_description": desc,
                    "incident_time": "2026-04-29T14:00:00Z",
                },
            )
        resp = await client.get(f"/api/incidents/{seeded_profile_code}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["incidents"]) == 2

    async def test_filters_by_category(self, client: AsyncClient, seeded_profile_code: str):
        await client.post(
            f"/api/incidents/{seeded_profile_code}",
            json={
                "behavior_category": "wandering_exit_seeking",
                "behavior_description": "wandering",
                "incident_time": "2026-04-29T02:00:00Z",
            },
        )
        await client.post(
            f"/api/incidents/{seeded_profile_code}",
            json={
                "behavior_category": "aggression_anger",
                "behavior_description": "anger",
                "incident_time": "2026-04-29T14:00:00Z",
            },
        )
        resp = await client.get(
            f"/api/incidents/{seeded_profile_code}",
            params={"category": "wandering_exit_seeking"},
        )
        data = resp.json()
        assert data["total"] == 1
        assert data["incidents"][0]["behavior_category"] == "wandering_exit_seeking"


class TestGetIncident:
    async def test_returns_detail(self, client: AsyncClient, seeded_profile_code: str):
        create_resp = await client.post(
            f"/api/incidents/{seeded_profile_code}",
            json={
                "behavior_category": "refusing_care",
                "behavior_description": "Refused medication",
                "incident_time": "2026-04-29T18:00:00Z",
                "intervention_description": "Offered tea, tried again after 10 min",
                "intervention_outcome": "resolved",
            },
        )
        incident_id = create_resp.json()["id"]

        resp = await client.get(f"/api/incidents/{seeded_profile_code}/{incident_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["behavior_category"] == "refusing_care"
        assert data["behavior_description"] == "Refused medication"
        assert data["intervention_outcome"] == "resolved"
        assert data["intervention_description"] == "Offered tea, tried again after 10 min"

    async def test_not_found_returns_404(self, client: AsyncClient, seeded_profile_code: str):
        resp = await client.get(
            f"/api/incidents/{seeded_profile_code}/nonexistent-id"
        )
        assert resp.status_code == 404


class TestUpdateIncident:
    async def test_updates_fields(self, client: AsyncClient, seeded_profile_code: str):
        create_resp = await client.post(
            f"/api/incidents/{seeded_profile_code}",
            json={
                "behavior_category": "aggression_anger",
                "behavior_description": "Hit caregiver",
                "incident_time": "2026-04-29T14:00:00Z",
            },
        )
        incident_id = create_resp.json()["id"]

        resp = await client.put(
            f"/api/incidents/{seeded_profile_code}/{incident_id}",
            json={
                "severity": "severe",
                "intervention_outcome": "escalated",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["severity"] == "severe"
        assert data["intervention_outcome"] == "escalated"
        assert data["verified_by_caregiver"] is True

    async def test_encrypted_fields_updated(self, client: AsyncClient, seeded_profile_code: str):
        create_resp = await client.post(
            f"/api/incidents/{seeded_profile_code}",
            json={
                "behavior_category": "other",
                "behavior_description": "Original description",
                "incident_time": "2026-04-29T10:00:00Z",
            },
        )
        incident_id = create_resp.json()["id"]

        resp = await client.put(
            f"/api/incidents/{seeded_profile_code}/{incident_id}",
            json={"behavior_description": "Updated description"},
        )
        assert resp.status_code == 200
        assert resp.json()["behavior_description"] == "Updated description"


class TestVerifyIncident:
    async def test_approve_without_corrections(self, client: AsyncClient, seeded_profile_code: str):
        create_resp = await client.post(
            f"/api/incidents/{seeded_profile_code}",
            json={
                "behavior_category": "confusion_disorientation",
                "behavior_description": "Got lost in house",
                "incident_time": "2026-04-29T08:00:00Z",
            },
        )
        incident_id = create_resp.json()["id"]

        resp = await client.post(
            f"/api/incidents/{seeded_profile_code}/verify/{incident_id}",
            json={"approved": True},
        )
        assert resp.status_code == 200
        assert resp.json()["verified_by_caregiver"] is True

    async def test_approve_with_corrections(self, client: AsyncClient, seeded_profile_code: str):
        create_resp = await client.post(
            f"/api/incidents/{seeded_profile_code}",
            json={
                "behavior_category": "aggression_anger",
                "behavior_description": "Yelled at caregiver",
                "incident_time": "2026-04-29T20:00:00Z",
            },
        )
        incident_id = create_resp.json()["id"]

        resp = await client.post(
            f"/api/incidents/{seeded_profile_code}/verify/{incident_id}",
            json={
                "approved": True,
                "corrections": {"severity": "mild"},
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["severity"] == "mild"
        assert data["verified_by_caregiver"] is True


class TestCareChanges:
    async def test_create_care_change(self, client: AsyncClient, seeded_profile_code: str):
        resp = await client.post(
            f"/api/care-changes/{seeded_profile_code}",
            json={
                "change_date": "2026-04-29",
                "description": "Started donepezil 10mg",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["id"]

    async def test_list_care_changes(self, client: AsyncClient, seeded_profile_code: str):
        await client.post(
            f"/api/care-changes/{seeded_profile_code}",
            json={
                "change_date": "2026-04-25",
                "description": "Increased melatonin to 5mg",
            },
        )
        await client.post(
            f"/api/care-changes/{seeded_profile_code}",
            json={
                "change_date": "2026-04-28",
                "description": "New caregiver started",
                "observation_window_days": 14,
            },
        )

        resp = await client.get(f"/api/care-changes/{seeded_profile_code}")
        assert resp.status_code == 200
        events = resp.json()["events"]
        assert len(events) == 2
        assert events[0]["description"] == "New caregiver started"
        assert events[1]["description"] == "Increased melatonin to 5mg"

    async def test_invalid_code_returns_404(self, client: AsyncClient):
        resp = await client.post(
            "/api/care-changes/BADCODE1",
            json={
                "change_date": "2026-04-29",
                "description": "test",
            },
        )
        assert resp.status_code == 404
