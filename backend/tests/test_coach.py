"""Tests for the coach mode streaming endpoint."""

import json

import pytest

VALID_PROFILE = {
    "disease_stage": "middle",
    "behavioral_patterns": ["sundowning", "wandering"],
    "calming_strategies": ["soft music", "photo album"],
    "safety_concerns": ["fall risk"],
}


async def _create_profile(client) -> str:
    """Helper: create a profile and return its access code."""
    resp = await client.post("/api/profiles", json=VALID_PROFILE)
    return resp.json()["access_code"]


# ---------------------------------------------------------------------------
# POST /api/coach/chat -- Streaming SSE
# ---------------------------------------------------------------------------


async def test_coach_chat_streams_response(client):
    code = await _create_profile(client)
    payload = {
        "access_code": code,
        "patient_name": "Mom",
        "message": "She is trying to leave the house at 3am",
    }

    response = await client.post(
        "/api/coach/chat",
        json=payload,
        headers={"Accept": "text/event-stream"},
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")

    # Collect all SSE data events
    chunks = []
    for line in response.text.splitlines():
        if line.startswith("data: "):
            data = line[len("data: ") :]
            if data == "[DONE]":
                break
            parsed = json.loads(data)
            if "text" in parsed:
                chunks.append(parsed["text"])

    # Mock provider yields "This is ", "a test ", "response."
    full_text = "".join(chunks)
    assert full_text == "This is a test response."


async def test_coach_chat_returns_session_id(client):
    code = await _create_profile(client)
    payload = {
        "access_code": code,
        "patient_name": "Mom",
        "message": "She won't eat dinner",
    }

    response = await client.post("/api/coach/chat", json=payload)
    # The first SSE event should contain the session_id
    for line in response.text.splitlines():
        if line.startswith("data: "):
            data = json.loads(line[len("data: ") :])
            if "session_id" in data:
                assert len(data["session_id"]) > 0
                return
    pytest.fail("No session_id found in SSE stream")


async def test_coach_chat_invalid_access_code(client):
    payload = {
        "access_code": "ZZZZZZZZ",
        "patient_name": "Mom",
        "message": "Help!",
    }
    response = await client.post("/api/coach/chat", json=payload)
    assert response.status_code == 404


async def test_coach_chat_missing_message(client):
    code = await _create_profile(client)
    payload = {
        "access_code": code,
        "patient_name": "Mom",
    }
    response = await client.post("/api/coach/chat", json=payload)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/conversations/{access_code} -- Conversation History
# ---------------------------------------------------------------------------


async def _send_coach_message(client, code: str, message: str, session_id: str | None = None):
    """Helper: send a coach chat message and return the response."""
    payload = {
        "access_code": code,
        "patient_name": "Mom",
        "message": message,
    }
    if session_id:
        payload["session_id"] = session_id
    return await client.post("/api/coach/chat", json=payload)


async def test_conversations_empty_list(client):
    """Returns empty list when profile has no conversations."""
    code = await _create_profile(client)
    resp = await client.get(f"/api/conversations/{code}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["conversations"] == []


async def test_conversations_invalid_access_code(client):
    """Returns 404 for an unknown access code."""
    resp = await client.get("/api/conversations/ZZZZZZZZ")
    assert resp.status_code == 404


async def test_conversations_grouped_by_session(client):
    """Returns conversations grouped by session_id with correct counts."""
    code = await _create_profile(client)

    # Send messages in two different sessions
    resp1 = await _send_coach_message(client, code, "First session message 1")
    # Extract session_id from SSE
    session_id_1 = None
    for line in resp1.text.splitlines():
        if line.startswith("data: "):
            parsed = json.loads(line[len("data: ") :])
            if "session_id" in parsed:
                session_id_1 = parsed["session_id"]
                break

    # Send second message in same session
    await _send_coach_message(client, code, "First session message 2", session_id=session_id_1)

    # Send message in a new session
    await _send_coach_message(client, code, "Second session message")

    resp = await client.get(f"/api/conversations/{code}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["conversations"]) == 2

    # Each session should have correct message count (user + assistant per message)
    counts = {c["session_id"]: c["message_count"] for c in data["conversations"]}
    assert counts[session_id_1] == 4  # 2 user + 2 assistant


async def test_conversations_title_truncated(client):
    """Title is the first user message, truncated to 60 characters."""
    code = await _create_profile(client)
    long_message = "A" * 100  # 100 chars, should be truncated to 60
    await _send_coach_message(client, code, long_message)

    resp = await client.get(f"/api/conversations/{code}")
    data = resp.json()
    assert len(data["conversations"]) == 1
    title = data["conversations"][0]["title"]
    assert len(title) <= 63  # 60 chars + "..."
    assert title == "A" * 60 + "..."


async def test_conversations_ordered_most_recent_first(client):
    """Conversations are ordered by most recent session first."""
    code = await _create_profile(client)

    # Create three sessions
    await _send_coach_message(client, code, "First session")
    await _send_coach_message(client, code, "Second session")
    await _send_coach_message(client, code, "Third session")

    resp = await client.get(f"/api/conversations/{code}")
    data = resp.json()
    titles = [c["title"] for c in data["conversations"]]
    assert titles == ["Third session", "Second session", "First session"]


async def test_conversations_limited_to_10(client):
    """Returns at most 10 sessions."""
    code = await _create_profile(client)

    # Create 12 sessions
    for i in range(12):
        await _send_coach_message(client, code, f"Session number {i}")

    resp = await client.get(f"/api/conversations/{code}")
    data = resp.json()
    assert len(data["conversations"]) == 10


# ---------------------------------------------------------------------------
# POST /api/coach/chat -- Patient name privacy
# ---------------------------------------------------------------------------


async def test_coach_chat_patient_name_not_stored(client, db_session):
    """Patient name must never appear in conversation history."""
    from sqlalchemy import select

    from app.models.conversation import Conversation

    code = await _create_profile(client)
    payload = {
        "access_code": code,
        "patient_name": "SecretName",
        "message": "She is upset",
    }
    await client.post("/api/coach/chat", json=payload)

    result = await db_session.execute(select(Conversation))
    conversations = result.scalars().all()
    for conv in conversations:
        assert "SecretName" not in (conv.content or ""), (
            "Patient name must never be stored in conversation history"
        )


@pytest.mark.asyncio
async def test_conversation_content_encrypted_in_db(client, db_session):
    """User and assistant messages must be stored encrypted."""
    from sqlalchemy import select

    from app.models.conversation import Conversation

    # Create profile first
    profile_resp = await client.post(
        "/api/profiles",
        json={
            "disease_stage": "middle",
            "behavioral_patterns": ["wandering"],
            "calming_strategies": ["music"],
            "safety_concerns": ["fall risk"],
        },
    )
    assert profile_resp.status_code == 201
    access_code = profile_resp.json()["access_code"]

    # Send coach message and consume the stream
    resp = await client.post(
        "/api/coach/chat",
        json={
            "access_code": access_code,
            "patient_name": "Dad",
            "message": "Dad is wandering at night",
        },
    )
    assert resp.status_code == 200
    async for _ in resp.aiter_lines():
        pass

    # Check DB — user message content must be encrypted
    await db_session.commit()  # ensure any pending writes are visible
    result = await db_session.execute(select(Conversation).where(Conversation.role == "user"))
    msg = result.scalars().first()
    assert msg is not None
    assert msg.content.startswith("ENC:"), f"Expected ENC: prefix, got: {msg.content[:50]}"


@pytest.mark.asyncio
async def test_conversation_history_decrypted_for_llm(client, mock_llm):
    """Prior messages passed to the LLM must be plaintext, not ciphertext."""
    import json as _json

    profile_resp = await client.post(
        "/api/profiles",
        json={
            "disease_stage": "middle",
            "behavioral_patterns": ["sundowning"],
            "calming_strategies": ["soft music"],
            "safety_concerns": ["fall risk"],
        },
    )
    access_code = profile_resp.json()["access_code"]

    # First message — capture session_id from SSE stream
    resp1 = await client.post(
        "/api/coach/chat",
        json={
            "access_code": access_code,
            "patient_name": "Dad",
            "message": "Dad is confused",
        },
    )
    session_id = None
    async for line in resp1.aiter_lines():
        if line.startswith("data:") and "[DONE]" not in line:
            try:
                data = _json.loads(line[5:])
                if "session_id" in data:
                    session_id = data["session_id"]
            except Exception:
                pass

    assert session_id is not None

    # Second message in same session — LLM should receive plaintext history
    await client.post(
        "/api/coach/chat",
        json={
            "access_code": access_code,
            "patient_name": "Dad",
            "message": "He is calm now",
            "session_id": session_id,
        },
    )

    # The LLM received messages — none should be ENC: blobs
    assert mock_llm.last_messages is not None
    for msg in mock_llm.last_messages:
        assert not msg["content"].startswith("ENC:"), (
            f"LLM received encrypted content: {msg['content'][:60]}"
        )


@pytest.mark.asyncio
async def test_messages_endpoint_returns_decrypted(client):
    """GET /conversations/{code}/{sid}/messages must return decrypted content."""
    import json as _json

    profile_resp = await client.post(
        "/api/profiles",
        json={
            "disease_stage": "middle",
            "behavioral_patterns": ["sundowning"],
            "calming_strategies": ["soft music"],
            "safety_concerns": ["fall risk"],
        },
    )
    access_code = profile_resp.json()["access_code"]

    resp = await client.post(
        "/api/coach/chat",
        json={
            "access_code": access_code,
            "patient_name": "Dad",
            "message": "Dad is wandering",
        },
    )
    session_id = None
    async for line in resp.aiter_lines():
        if line.startswith("data:") and "[DONE]" not in line:
            try:
                data = _json.loads(line[5:])
                if "session_id" in data:
                    session_id = data["session_id"]
            except Exception:
                pass

    assert session_id is not None
    msgs_resp = await client.get(f"/api/conversations/{access_code}/{session_id}/messages")
    assert msgs_resp.status_code == 200
    messages = msgs_resp.json()["messages"]
    assert len(messages) >= 1
    for msg in messages:
        assert not msg["content"].startswith("ENC:"), (
            f"Message content still encrypted: {msg['content'][:60]}"
        )
    user_msg = next(m for m in messages if m["role"] == "user")
    assert user_msg["content"] == "Dad is wandering"


@pytest.mark.asyncio
async def test_locale_code_saved_to_conversation(client, db_session):
    """locale_code must be persisted from the request header."""
    from sqlalchemy import select

    from app.models.conversation import Conversation

    profile_resp = await client.post(
        "/api/profiles",
        json={
            "disease_stage": "middle",
            "behavioral_patterns": ["sundowning"],
            "calming_strategies": ["music"],
            "safety_concerns": ["fall risk"],
        },
    )
    assert profile_resp.status_code == 201
    access_code = profile_resp.json()["access_code"]

    resp = await client.post(
        "/api/coach/chat",
        json={"access_code": access_code, "patient_name": "Dad", "message": "test"},
        headers={"X-App-Locale": "ta"},
    )
    async for _ in resp.aiter_lines():
        pass

    await db_session.commit()
    result = await db_session.execute(select(Conversation).where(Conversation.role == "user"))
    msg = result.scalars().first()
    assert msg is not None
    assert msg.locale_code == "ta"


@pytest.mark.asyncio
async def test_suggested_tags_stored_on_assistant_message(client, db_session):
    """After a coach response, suggested_tags should be stored on the assistant message."""
    from sqlalchemy import select

    from app.models.conversation import Conversation
    from app.services.crypto import decrypt

    profile_resp = await client.post(
        "/api/profiles",
        json={
            "disease_stage": "middle",
            "behavioral_patterns": ["wandering"],
            "calming_strategies": ["music"],
            "safety_concerns": ["falling"],
        },
    )
    access_code = profile_resp.json()["access_code"]

    resp = await client.post(
        "/api/coach/chat",
        json={
            "access_code": access_code,
            "patient_name": "Dad",
            "message": "Dad is wandering at night",
        },
    )
    async for _ in resp.aiter_lines():
        pass

    import asyncio

    await asyncio.sleep(0.5)

    await db_session.commit()
    result = await db_session.execute(select(Conversation).where(Conversation.role == "assistant"))
    assistant_msg = result.scalars().first()
    assert assistant_msg is not None
    assert assistant_msg.suggested_tags is not None
    import json

    tags = json.loads(decrypt(assistant_msg.suggested_tags))
    assert isinstance(tags, list)
    assert "calm_approach" in tags


@pytest.mark.asyncio
async def test_coach_chat_triggers_extraction(client):
    """After a coach chat, extraction pipeline runs without crashing."""
    code = await _create_profile(client)
    resp = await client.post(
        "/api/coach/chat",
        json={
            "access_code": code,
            "patient_name": "Mom",
            "message": "Mom keeps trying to leave at 2am",
        },
    )
    assert resp.status_code == 200
    async for _ in resp.aiter_lines():
        pass

    # Verify the incidents endpoint works (extraction may produce 0 or 1 incidents
    # depending on LLM mock response)
    incidents_resp = await client.get(f"/api/incidents/{code}")
    assert incidents_resp.status_code == 200
