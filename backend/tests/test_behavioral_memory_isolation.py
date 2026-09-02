"""Cross-patient isolation regression tests for the per-patient memory graph.

Per docs/memory-graph-design.md, per-patient memory (Incident retrieval,
BehavioralDossier) must never leak across profiles — only the separate,
k-anonymized CrossPatientStrategies layer is deliberately shared. These tests
guard that boundary for the two read paths that feed the coach prompt:
get_relevant_incidents (keyword-matched incident recall) and compute_dossier
(weighted contraindicated/effective/trend synthesis).
"""

from datetime import UTC, datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.dossier import compute_dossier
from app.services.incident_retriever import get_relevant_incidents

VALID_PROFILE = {
    "disease_stage": "middle",
    "behavioral_patterns": ["sundowning"],
    "calming_strategies": ["soft music"],
    "safety_concerns": ["fall risk"],
}


async def _create_profile_with_incident(
    client: AsyncClient, *, behavior_category: str, description: str, outcome: str
) -> tuple[str, str]:
    resp = await client.post("/api/profiles", json=VALID_PROFILE)
    body = resp.json()
    code, profile_id = body["access_code"], body["id"]

    await client.post(
        f"/api/incidents/{code}",
        json={
            "behavior_category": behavior_category,
            "behavior_description": description,
            "incident_time": datetime.now(UTC).isoformat(),
            "intervention_description": description,
            "intervention_outcome": outcome,
        },
    )
    return code, profile_id


@pytest.mark.asyncio
async def test_relevant_incidents_do_not_cross_profiles(
    client: AsyncClient, db_session: AsyncSession
):
    _code_a, profile_a = await _create_profile_with_incident(
        client,
        behavior_category="wandering_exit_seeking",
        description="Tried to leave at 2am",
        outcome="resolved",
    )
    _code_b, profile_b = await _create_profile_with_incident(
        client,
        behavior_category="wandering_exit_seeking",
        description="Tried the back door at midnight",
        outcome="resolved",
    )

    incidents_a = await get_relevant_incidents(profile_a, "trying to leave again", db_session)
    incidents_b = await get_relevant_incidents(profile_b, "trying to leave again", db_session)

    assert all(i.profile_id == profile_a for i in incidents_a)
    assert all(i.profile_id == profile_b for i in incidents_b)
    assert not ({i.id for i in incidents_a} & {i.id for i in incidents_b})


@pytest.mark.asyncio
async def test_dossier_contraindicated_and_effective_do_not_cross_profiles(
    client: AsyncClient, db_session: AsyncSession
):
    _code_a, profile_a = await _create_profile_with_incident(
        client,
        behavior_category="aggression_anger",
        description="Tried arguing about reality — made it worse",
        outcome="escalated",
    )
    _code_b, profile_b = await _create_profile_with_incident(
        client,
        behavior_category="aggression_anger",
        description="Played familiar music — calmed down",
        outcome="resolved",
    )

    dossier_a = await compute_dossier(profile_a, db_session)
    dossier_b = await compute_dossier(profile_b, db_session)

    import json

    from app.services.crypto import decrypt

    contraindicated_a = json.loads(decrypt(dossier_a.contraindicated_json))
    effective_a = json.loads(decrypt(dossier_a.effective_json))
    contraindicated_b = json.loads(decrypt(dossier_b.contraindicated_json))
    effective_b = json.loads(decrypt(dossier_b.effective_json))

    # Profile A's escalated intervention must not appear as B's contraindicated
    # entry, and B's resolved intervention must not leak into A's effective list.
    assert not effective_a
    assert len(contraindicated_a) == 1
    assert "arguing about reality" in contraindicated_a[0]["description"]

    assert not contraindicated_b
    assert len(effective_b) == 1
    assert "familiar music" in effective_b[0]["intervention"]
