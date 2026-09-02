"""Crisis-path reliability: an LLM failure mid-stream must still deliver a safe,
localized static fallback and a clean [DONE] — never silence (REL-1, REL-4)."""

import json
from collections.abc import AsyncGenerator

import pytest_asyncio

from app.models.profile import Profile
from app.services.auth import hash_access_code
from app.services.crypto import encrypt
from app.services.llm_provider import LLMProvider


class FailMidStream(LLMProvider):
    """Yields one chunk, then raises — simulating a provider drop/timeout."""

    async def stream_completion(
        self, system_prompt, messages, model_override=None
    ) -> AsyncGenerator[str, None]:
        yield "Here is what "
        raise RuntimeError("provider connection reset")

    async def completion(self, system_prompt, messages, model_override=None) -> str:
        raise RuntimeError("provider connection reset")


class FailImmediately(LLMProvider):
    """Raises before any chunk is produced."""

    async def stream_completion(
        self, system_prompt, messages, model_override=None
    ) -> AsyncGenerator[str, None]:
        raise RuntimeError("provider 503")
        yield ""  # pragma: no cover

    async def completion(self, system_prompt, messages, model_override=None) -> str:
        raise RuntimeError("provider 503")


@pytest_asyncio.fixture
async def b2c_profile(db_session):
    profile = Profile(
        access_code_hash=hash_access_code("RELCODE1"),
        disease_stage="middle",
        behavioral_patterns=encrypt(json.dumps([])),
        calming_strategies=encrypt(json.dumps([])),
        safety_concerns=encrypt(json.dumps([])),
    )
    db_session.add(profile)
    await db_session.commit()
    return profile


async def _post(client):
    return await client.post(
        "/api/coach/chat",
        json={"access_code": "RELCODE1", "patient_name": "Mom", "message": "She is very agitated."},
    )


async def test_stream_failure_midway_delivers_fallback_and_done(app, client, b2c_profile):
    app.state.llm_provider = FailMidStream()
    resp = await _post(client)
    assert resp.status_code == 200
    body = resp.text
    assert "data: [DONE]" in body, "stream must terminate cleanly"
    # Safe localized coach fallback must reach the caregiver.
    assert "stay with your loved one" in body


async def test_stream_failure_immediately_delivers_fallback(app, client, b2c_profile):
    app.state.llm_provider = FailImmediately()
    resp = await _post(client)
    assert resp.status_code == 200
    body = resp.text
    assert "data: [DONE]" in body
    assert "stay with your loved one" in body
