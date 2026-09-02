from datetime import UTC, datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incident import Incident
from app.services.crypto import encrypt
from app.services.dossier import (
    _apply_stage_transition_weight,
    _apply_temporal_weight,
    compute_dossier,
    compute_incident_weight,
)

VALID_PROFILE = {
    "disease_stage": "middle",
    "behavioral_patterns": ["sundowning", "wandering"],
    "calming_strategies": ["soft music", "warm drink"],
    "safety_concerns": ["fall risk"],
}


class TestTemporalWeight:
    def test_recent_gets_full_weight(self):
        now = datetime.now(UTC)
        incident_time = now - timedelta(days=5)
        assert _apply_temporal_weight(incident_time, now) == 1.0

    def test_medium_gets_half_weight(self):
        now = datetime.now(UTC)
        incident_time = now - timedelta(days=90)
        assert _apply_temporal_weight(incident_time, now) == 0.5

    def test_old_gets_low_weight(self):
        now = datetime.now(UTC)
        incident_time = now - timedelta(days=250)
        assert _apply_temporal_weight(incident_time, now) == 0.2

    def test_archive_gets_zero_weight(self):
        now = datetime.now(UTC)
        incident_time = now - timedelta(days=400)
        assert _apply_temporal_weight(incident_time, now) == 0.0


class TestStageTransitionWeight:
    def test_no_transition(self):
        now = datetime.now(UTC)
        assert _apply_stage_transition_weight(now, None) == 1.0

    def test_pre_transition_gets_reduced(self):
        now = datetime.now(UTC)
        stage_changed = now - timedelta(days=5)
        incident_before = now - timedelta(days=10)
        assert _apply_stage_transition_weight(incident_before, stage_changed) == 0.3

    def test_post_transition_gets_full(self):
        now = datetime.now(UTC)
        stage_changed = now - timedelta(days=10)
        incident_after = now - timedelta(days=5)
        assert _apply_stage_transition_weight(incident_after, stage_changed) == 1.0


@pytest.mark.asyncio
async def test_compute_dossier_creates_record(client: AsyncClient, db_session: AsyncSession):
    resp = await client.post("/api/profiles", json=VALID_PROFILE)
    code = resp.json()["access_code"]
    profile_id = resp.json()["id"]

    # Create some incidents
    for i in range(3):
        await client.post(
            f"/api/incidents/{code}",
            json={
                "behavior_category": "wandering_exit_seeking",
                "behavior_description": f"Incident {i}",
                "incident_time": datetime.now(UTC).isoformat(),
                "severity": "moderate",
                "intervention_description": "Played music",
                "intervention_outcome": "resolved" if i < 2 else "escalated",
            },
        )

    dossier = await compute_dossier(profile_id, db_session)
    assert dossier is not None
    assert dossier.is_stale is False
    assert dossier.version >= 1
    assert dossier.computed_at is not None
    assert dossier.contraindicated_json is not None
    assert dossier.effective_json is not None


@pytest.mark.asyncio
async def test_compute_dossier_debounces(client: AsyncClient, db_session: AsyncSession):
    resp = await client.post("/api/profiles", json=VALID_PROFILE)
    profile_id = resp.json()["id"]

    dossier1 = await compute_dossier(profile_id, db_session)
    version1 = dossier1.version

    # Second call should be debounced (same version)
    dossier2 = await compute_dossier(profile_id, db_session)
    assert dossier2.version == version1
