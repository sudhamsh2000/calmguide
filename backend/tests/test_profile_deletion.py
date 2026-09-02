"""Profile deletion (right-to-erasure) tests.

Per docs/memory-graph-design.md privacy section, deleting a profile must
remove every row in the memory graph keyed to it — not just the anchor
Profile row — and the access code must stop authenticating afterward.
"""

from datetime import UTC, datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.behavioral_dossier import BehavioralDossier
from app.models.conversation import Conversation
from app.models.incident import Incident
from app.models.profile import Profile
from app.models.response_feedback import ResponseFeedback

VALID_PROFILE = {
    "disease_stage": "middle",
    "behavioral_patterns": ["sundowning"],
    "calming_strategies": ["soft music"],
    "safety_concerns": ["fall risk"],
}


@pytest.mark.asyncio
async def test_delete_profile_removes_profile_and_returns_404_after(
    client: AsyncClient,
):
    resp = await client.post("/api/profiles", json=VALID_PROFILE)
    code = resp.json()["access_code"]

    delete_resp = await client.delete(f"/api/profiles/{code}")
    assert delete_resp.status_code == 204

    get_resp = await client.get(f"/api/profiles/{code}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_profile_cascades_across_memory_graph(
    client: AsyncClient, db_session: AsyncSession
):
    resp = await client.post("/api/profiles", json=VALID_PROFILE)
    body = resp.json()
    code, profile_id = body["access_code"], body["id"]

    await client.post(
        f"/api/incidents/{code}",
        json={
            "behavior_category": "sundowning",
            "behavior_description": "Restless in the evening",
            "incident_time": datetime.now(UTC).isoformat(),
            "intervention_description": "Played familiar music",
            "intervention_outcome": "resolved",
        },
    )

    conversation = Conversation(
        profile_id=profile_id,
        session_id="test-session",
        role="user",
        content="ENC:not-real-ciphertext",
    )
    db_session.add(conversation)
    await db_session.commit()
    await db_session.refresh(conversation)

    feedback = ResponseFeedback(
        conversation_id=conversation.id,
        helpful=True,
        source="mobile",
    )
    db_session.add(feedback)
    await db_session.commit()

    delete_resp = await client.delete(f"/api/profiles/{code}")
    assert delete_resp.status_code == 204

    assert (
        await db_session.execute(select(Profile).where(Profile.id == profile_id))
    ).scalar_one_or_none() is None
    assert (
        await db_session.execute(select(Incident).where(Incident.profile_id == profile_id))
    ).scalars().all() == []
    assert (
        await db_session.execute(select(Conversation).where(Conversation.profile_id == profile_id))
    ).scalars().all() == []
    assert (
        await db_session.execute(
            select(ResponseFeedback).where(ResponseFeedback.conversation_id == conversation.id)
        )
    ).scalar_one_or_none() is None
    assert (
        await db_session.execute(
            select(BehavioralDossier).where(BehavioralDossier.profile_id == profile_id)
        )
    ).scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_delete_unknown_access_code_returns_404(client: AsyncClient):
    resp = await client.delete("/api/profiles/NOTAREALCODE")
    assert resp.status_code == 404
