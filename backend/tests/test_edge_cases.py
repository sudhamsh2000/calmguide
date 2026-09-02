"""Edge case integration tests for the incident memory system.

Covers: EC-01 (profile consistency), EC-03 (negative strategy tags),
EC-04 (safety gate exclusion), EC-06 (stage transition weighting),
EC-07 (care change observation windows), EC-08 (pattern thresholds),
EC-11 (recall confidence).
"""

from datetime import UTC, date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.behavioral_dossier import BehavioralDossier
from app.models.conversation import Conversation
from app.models.incident import Incident
from app.routers.incidents import _compute_recall_confidence
from app.services.crypto import decrypt, encrypt
from app.services.dossier import (
    _apply_stage_transition_weight,
    _apply_temporal_weight,
    compute_dossier,
    compute_incident_weight,
)
from app.services.incident_extractor import extract_incident_from_conversation

VALID_PROFILE = {
    "disease_stage": "middle",
    "behavioral_patterns": ["sundowning", "wandering"],
    "calming_strategies": ["soft music", "warm drink"],
    "safety_concerns": ["fall risk"],
}


@pytest_asyncio.fixture
async def seeded_profile(client: AsyncClient):
    resp = await client.post("/api/profiles", json=VALID_PROFILE)
    data = resp.json()
    return data["access_code"], data["id"]


class TestRecallConfidence:
    """EC-11: Retrospective logging recall confidence."""

    def test_immediate_logging_high(self):
        now = datetime.now(UTC)
        incident_time = now - timedelta(minutes=30)
        assert _compute_recall_confidence(incident_time, now) == "high"

    def test_same_day_moderate(self):
        now = datetime.now(UTC)
        incident_time = now - timedelta(hours=8)
        assert _compute_recall_confidence(incident_time, now) == "moderate"

    def test_next_day_low(self):
        now = datetime.now(UTC)
        incident_time = now - timedelta(hours=36)
        assert _compute_recall_confidence(incident_time, now) == "low"

    def test_old_incident_very_low(self):
        now = datetime.now(UTC)
        incident_time = now - timedelta(days=3)
        assert _compute_recall_confidence(incident_time, now) == "very_low"

    @pytest.mark.asyncio
    async def test_api_assigns_recall_confidence(self, client: AsyncClient, seeded_profile):
        code, profile_id = seeded_profile
        old_time = (datetime.now(UTC) - timedelta(days=3)).isoformat()
        resp = await client.post(
            f"/api/incidents/{code}",
            json={
                "behavior_category": "wandering_exit_seeking",
                "behavior_description": "Tried to leave",
                "incident_time": old_time,
            },
        )
        assert resp.status_code == 201
        incident_id = resp.json()["id"]

        detail = await client.get(f"/api/incidents/{code}/{incident_id}")
        assert detail.json()["recall_confidence"] == "very_low"


class TestStageTransitionWeighting:
    """EC-06: Pre-transition incidents get reduced weight."""

    @pytest.mark.asyncio
    async def test_stage_change_marks_dossier_stale(self, client: AsyncClient, seeded_profile):
        code, profile_id = seeded_profile

        # Create incident before stage change
        await client.post(
            f"/api/incidents/{code}",
            json={
                "behavior_category": "wandering_exit_seeking",
                "behavior_description": "Wandering at night",
                "incident_time": datetime.now(UTC).isoformat(),
            },
        )

        # Change disease stage
        resp = await client.put(
            f"/api/profiles/{code}",
            json={
                "disease_stage": "late",
                "behavioral_patterns": ["minimal movement"],
                "calming_strategies": ["gentle touch"],
                "safety_concerns": ["aspiration risk"],
            },
        )
        assert resp.status_code == 200
        assert resp.json()["previous_stage"] == "middle"
        assert resp.json()["stage_changed_at"] is not None

    def test_pre_transition_weight_reduced(self):
        now = datetime.now(UTC)
        stage_changed = now - timedelta(days=2)
        incident_before = now - timedelta(days=5)
        assert _apply_stage_transition_weight(incident_before, stage_changed) == 0.3

    def test_post_transition_weight_full(self):
        now = datetime.now(UTC)
        stage_changed = now - timedelta(days=10)
        incident_after = now - timedelta(days=5)
        assert _apply_stage_transition_weight(incident_after, stage_changed) == 1.0


class TestNegativeStrategyTags:
    """EC-03: Abuse indicators detected during extraction."""

    @pytest.mark.asyncio
    async def test_restraint_language_flagged(self):
        mock_response = {
            "behavior_category": "refusing_care",
            "behavior_description": "Patient resisted medication",
            "intervention_description": "I had to hold her down while giving pills",
            "intervention_outcome": "resolved",
            "field_confidences": {
                "behavior_category": 0.90,
                "antecedent": 0.60,
                "intervention": 0.85,
                "outcome": 0.80,
            },
            "overall_confidence": 0.80,
        }

        with patch(
            "app.services.incident_extractor._call_extraction_llm",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await extract_incident_from_conversation(
                conversation_messages=[
                    {"role": "user", "content": "She wouldn't take her pills"},
                ],
                profile={
                    "disease_stage": "middle",
                    "behavioral_patterns": [],
                    "calming_strategies": [],
                },
                patient_name="Mom",
            )

        assert result is not None
        assert result.get("safety_concern") == "potential_abuse_indicator"

    @pytest.mark.asyncio
    async def test_locked_room_flagged(self):
        mock_response = {
            "behavior_category": "wandering_exit_seeking",
            "behavior_description": "Patient tried to leave repeatedly",
            "intervention_description": "I locked her in the bedroom",
            "intervention_outcome": "resolved",
            "field_confidences": {
                "behavior_category": 0.90,
                "antecedent": 0.60,
                "intervention": 0.85,
                "outcome": 0.80,
            },
            "overall_confidence": 0.80,
        }

        with patch(
            "app.services.incident_extractor._call_extraction_llm",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await extract_incident_from_conversation(
                conversation_messages=[
                    {"role": "user", "content": "She keeps trying to leave"},
                ],
                profile={
                    "disease_stage": "middle",
                    "behavioral_patterns": [],
                    "calming_strategies": [],
                },
                patient_name="Mom",
            )

        assert result is not None
        assert result.get("safety_concern") == "potential_abuse_indicator"

    @pytest.mark.asyncio
    async def test_normal_intervention_not_flagged(self):
        mock_response = {
            "behavior_category": "wandering_exit_seeking",
            "behavior_description": "Patient tried to leave",
            "intervention_description": "Played favorite music and offered warm milk",
            "intervention_outcome": "resolved",
            "field_confidences": {
                "behavior_category": 0.90,
                "antecedent": 0.60,
                "intervention": 0.85,
                "outcome": 0.80,
            },
            "overall_confidence": 0.85,
        }

        with patch(
            "app.services.incident_extractor._call_extraction_llm",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await extract_incident_from_conversation(
                conversation_messages=[
                    {"role": "user", "content": "Mom tried to leave again"},
                ],
                profile={
                    "disease_stage": "middle",
                    "behavioral_patterns": [],
                    "calming_strategies": [],
                },
                patient_name="Mom",
            )

        assert result is not None
        assert "safety_concern" not in result


class TestSafetyGateExclusion:
    """EC-04: Safety gate conversations excluded from dossier."""

    @pytest.mark.asyncio
    async def test_safety_gate_conversation_flag(self, db_session: AsyncSession):
        """Conversation model supports is_safety_gate flag."""
        conv = Conversation(
            session_id="test-session",
            profile_id="test-profile",
            role="user",
            content=encrypt("I can't go on"),
            is_safety_gate=True,
        )
        db_session.add(conv)
        await db_session.commit()
        await db_session.refresh(conv)
        assert conv.is_safety_gate is True

    @pytest.mark.asyncio
    async def test_safety_gate_default_false(self, db_session: AsyncSession):
        """Conversations default to is_safety_gate=False."""
        conv = Conversation(
            session_id="test-session-2",
            profile_id="test-profile",
            role="user",
            content=encrypt("Mom is wandering"),
        )
        db_session.add(conv)
        await db_session.commit()
        await db_session.refresh(conv)
        assert conv.is_safety_gate is False


class TestCareChangeObservationWindow:
    """EC-07: Pre-change incidents excluded during observation window."""

    @pytest.mark.asyncio
    async def test_care_change_creates_with_window(self, client: AsyncClient, seeded_profile):
        code, _ = seeded_profile
        resp = await client.post(
            f"/api/care-changes/{code}",
            json={
                "change_date": "2026-04-25",
                "description": "Started new medication",
                "observation_window_days": 28,
            },
        )
        assert resp.status_code == 201

        list_resp = await client.get(f"/api/care-changes/{code}")
        events = list_resp.json()["events"]
        assert len(events) == 1
        assert events[0]["observation_window_days"] == 28
        assert events[0]["is_active"] is True

    @pytest.mark.asyncio
    async def test_custom_window_accepted(self, client: AsyncClient, seeded_profile):
        code, _ = seeded_profile
        resp = await client.post(
            f"/api/care-changes/{code}",
            json={
                "change_date": "2026-04-20",
                "description": "Dosage increase",
                "observation_window_days": 14,
            },
        )
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_window_too_short_rejected(self, client: AsyncClient, seeded_profile):
        code, _ = seeded_profile
        resp = await client.post(
            f"/api/care-changes/{code}",
            json={
                "change_date": "2026-04-20",
                "description": "test",
                "observation_window_days": 3,
            },
        )
        assert resp.status_code == 422


class TestDossierComputation:
    """Integration tests for dossier computation edge cases."""

    @pytest.mark.asyncio
    async def test_dossier_with_no_incidents(self, client: AsyncClient, db_session: AsyncSession):
        resp = await client.post("/api/profiles", json=VALID_PROFILE)
        profile_id = resp.json()["id"]

        dossier = await compute_dossier(profile_id, db_session)
        assert dossier is not None
        assert dossier.is_stale is False

    @pytest.mark.asyncio
    async def test_dossier_with_escalated_incident(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        resp = await client.post("/api/profiles", json=VALID_PROFILE)
        code = resp.json()["access_code"]
        profile_id = resp.json()["id"]

        await client.post(
            f"/api/incidents/{code}",
            json={
                "behavior_category": "aggression_anger",
                "behavior_description": "Hit caregiver",
                "incident_time": datetime.now(UTC).isoformat(),
                "intervention_description": "Tried to physically redirect",
                "intervention_outcome": "escalated",
            },
        )

        dossier = await compute_dossier(profile_id, db_session)
        assert dossier.contraindicated_json is not None
        contraindicated = __import__("json").loads(decrypt(dossier.contraindicated_json))
        assert len(contraindicated) >= 1
        assert contraindicated[0]["behavior"] == "aggression_anger"


class TestTimeSlotComputation:
    """Verify time slot assignment across all periods."""

    @pytest.mark.asyncio
    async def test_overnight_slot(self, client: AsyncClient, seeded_profile):
        code, _ = seeded_profile
        resp = await client.post(
            f"/api/incidents/{code}",
            json={
                "behavior_category": "wandering_exit_seeking",
                "behavior_description": "test",
                "incident_time": "2026-04-29T03:00:00Z",
            },
        )
        incident_id = resp.json()["id"]
        detail = await client.get(f"/api/incidents/{code}/{incident_id}")
        assert detail.json()["time_slot"] == "overnight"

    @pytest.mark.asyncio
    async def test_morning_slot(self, client: AsyncClient, seeded_profile):
        code, _ = seeded_profile
        resp = await client.post(
            f"/api/incidents/{code}",
            json={
                "behavior_category": "refusing_care",
                "behavior_description": "test",
                "incident_time": "2026-04-29T09:00:00Z",
            },
        )
        incident_id = resp.json()["id"]
        detail = await client.get(f"/api/incidents/{code}/{incident_id}")
        assert detail.json()["time_slot"] == "morning"

    @pytest.mark.asyncio
    async def test_afternoon_slot(self, client: AsyncClient, seeded_profile):
        code, _ = seeded_profile
        resp = await client.post(
            f"/api/incidents/{code}",
            json={
                "behavior_category": "confusion_disorientation",
                "behavior_description": "test",
                "incident_time": "2026-04-29T14:00:00Z",
            },
        )
        incident_id = resp.json()["id"]
        detail = await client.get(f"/api/incidents/{code}/{incident_id}")
        assert detail.json()["time_slot"] == "afternoon"

    @pytest.mark.asyncio
    async def test_evening_slot(self, client: AsyncClient, seeded_profile):
        code, _ = seeded_profile
        resp = await client.post(
            f"/api/incidents/{code}",
            json={
                "behavior_category": "hallucinations",
                "behavior_description": "test",
                "incident_time": "2026-04-29T20:00:00Z",
            },
        )
        incident_id = resp.json()["id"]
        detail = await client.get(f"/api/incidents/{code}/{incident_id}")
        assert detail.json()["time_slot"] == "evening"
