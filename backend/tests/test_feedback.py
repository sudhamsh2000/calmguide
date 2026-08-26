"""Integration tests for feedback endpoints."""
import json
import pytest
from sqlalchemy import select

from app.models.conversation import Conversation
from app.models.response_feedback import ResponseFeedback
from app.services.crypto import decrypt, encrypt
from app.services.auth import hash_access_code
from app.models.profile import Profile


async def _create_profile_and_session(client, db_session):
    """Helper: create a profile + a coach session, return (access_code, assistant_conv_id)."""
    resp = await client.post("/api/profiles", json={
        "disease_stage": "middle",
        "behavioral_patterns": ["wandering"],
        "calming_strategies": ["music"],
        "safety_concerns": ["falling"],
    })
    code = resp.json()["access_code"]

    coach_resp = await client.post("/api/coach/chat", json={
        "access_code": code,
        "patient_name": "Dad",
        "message": "Dad is wandering",
    })
    async for _ in coach_resp.aiter_lines():
        pass

    import asyncio
    await asyncio.sleep(0.5)

    await db_session.commit()
    result = await db_session.execute(
        select(Conversation).where(Conversation.role == "assistant")
    )
    assistant = result.scalars().first()
    return code, assistant.id


@pytest.mark.asyncio
async def test_submit_feedback_thumbs_up(client, db_session):
    code, conv_id = await _create_profile_and_session(client, db_session)

    resp = await client.post("/api/feedback", json={
        "access_code": code,
        "conversation_id": conv_id,
        "helpful": True,
        "tags": ["calm_approach", "music"],
        "negative_reasons": [],
    })
    assert resp.status_code == 201
    assert "id" in resp.json()

    await db_session.commit()
    result = await db_session.execute(
        select(ResponseFeedback).where(ResponseFeedback.conversation_id == conv_id)
    )
    fb = result.scalars().first()
    assert fb is not None
    assert fb.helpful is True
    tags = json.loads(decrypt(fb.tags))
    assert "calm_approach" in tags


@pytest.mark.asyncio
async def test_submit_feedback_thumbs_down_with_reasons(client, db_session):
    code, conv_id = await _create_profile_and_session(client, db_session)

    resp = await client.post("/api/feedback", json={
        "access_code": code,
        "conversation_id": conv_id,
        "helpful": False,
        "tags": [],
        "negative_reasons": ["too_generic", "already_tried"],
    })
    assert resp.status_code == 201

    await db_session.commit()
    result = await db_session.execute(
        select(ResponseFeedback).where(ResponseFeedback.conversation_id == conv_id)
    )
    fb = result.scalars().first()
    assert fb.helpful is False
    reasons = json.loads(decrypt(fb.negative_reasons))
    assert "too_generic" in reasons


@pytest.mark.asyncio
async def test_duplicate_feedback_returns_409(client, db_session):
    code, conv_id = await _create_profile_and_session(client, db_session)

    await client.post("/api/feedback", json={
        "access_code": code, "conversation_id": conv_id,
        "helpful": True, "tags": [], "negative_reasons": [],
    })
    resp2 = await client.post("/api/feedback", json={
        "access_code": code, "conversation_id": conv_id,
        "helpful": False, "tags": [], "negative_reasons": [],
    })
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_skip_feedback(client, db_session):
    code, conv_id = await _create_profile_and_session(client, db_session)

    resp = await client.post("/api/feedback/skip", json={
        "access_code": code, "conversation_id": conv_id,
    })
    assert resp.status_code == 201

    await db_session.commit()
    result = await db_session.execute(
        select(ResponseFeedback).where(ResponseFeedback.conversation_id == conv_id)
    )
    fb = result.scalars().first()
    assert fb.helpful is None
    assert fb.source == "home"


@pytest.mark.asyncio
async def test_feedback_wrong_profile_returns_404(client, db_session):
    _, conv_id = await _create_profile_and_session(client, db_session)

    resp = await client.post("/api/feedback", json={
        "access_code": "ZZZZZZZZ",
        "conversation_id": conv_id,
        "helpful": True, "tags": [], "negative_reasons": [],
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_pending_returns_most_recent_unfeedbackd(client, db_session):
    code, conv_id = await _create_profile_and_session(client, db_session)

    resp = await client.get(f"/api/feedback/pending/{code}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["conversation_id"] == conv_id
    assert "title" in body
    assert "suggested_tags" in body


@pytest.mark.asyncio
async def test_pending_returns_204_when_all_feedbackd(client, db_session):
    code, conv_id = await _create_profile_and_session(client, db_session)

    await client.post("/api/feedback", json={
        "access_code": code,
        "conversation_id": conv_id,
        "helpful": True,
        "tags": [],
        "negative_reasons": [],
    })

    resp = await client.get(f"/api/feedback/pending/{code}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_pending_returns_204_when_skipped(client, db_session):
    code, conv_id = await _create_profile_and_session(client, db_session)

    await client.post("/api/feedback/skip", json={
        "access_code": code,
        "conversation_id": conv_id,
    })

    resp = await client.get(f"/api/feedback/pending/{code}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_session_feedback_returns_entries(client, db_session):
    code, conv_id = await _create_profile_and_session(client, db_session)

    await client.post("/api/feedback", json={
        "access_code": code,
        "conversation_id": conv_id,
        "helpful": True,
        "tags": ["music"],
        "negative_reasons": [],
    })

    result = await db_session.execute(
        select(Conversation).where(Conversation.id == conv_id)
    )
    conv = result.scalars().first()

    resp = await client.get(f"/api/feedback/{code}/{conv.session_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["feedback"]) == 1
    assert body["feedback"][0]["helpful"] is True
    assert "music" in body["feedback"][0]["tags"]
