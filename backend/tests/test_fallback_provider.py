"""Tests for FallbackLLMProvider (REL-3 provider failover)."""

from collections.abc import AsyncGenerator

import pytest

from app.services.fallback_provider import FallbackLLMProvider
from app.services.llm_provider import LLMProvider


class _Ok(LLMProvider):
    def __init__(self, chunks):
        self.chunks = chunks

    async def stream_completion(self, system_prompt, messages, model_override=None) -> AsyncGenerator[str, None]:
        for c in self.chunks:
            yield c

    async def completion(self, system_prompt, messages, model_override=None) -> str:
        return "".join(self.chunks)


class _FailBeforeChunk(LLMProvider):
    async def stream_completion(self, system_prompt, messages, model_override=None) -> AsyncGenerator[str, None]:
        raise RuntimeError("503")
        yield ""  # pragma: no cover

    async def completion(self, system_prompt, messages, model_override=None) -> str:
        raise RuntimeError("503")


class _FailMidChunk(LLMProvider):
    async def stream_completion(self, system_prompt, messages, model_override=None) -> AsyncGenerator[str, None]:
        yield "partial "
        raise RuntimeError("reset")

    async def completion(self, system_prompt, messages, model_override=None) -> str:
        raise RuntimeError("reset")


async def _collect(gen):
    return [c async for c in gen]


@pytest.mark.asyncio
async def test_failover_before_first_chunk_uses_secondary():
    fb = FallbackLLMProvider(_FailBeforeChunk(), _Ok(["from ", "secondary"]))
    out = await _collect(fb.stream_completion("s", [{"role": "user", "content": "x"}]))
    assert "".join(out) == "from secondary"


@pytest.mark.asyncio
async def test_no_failover_after_streaming_started_reraises():
    fb = FallbackLLMProvider(_FailMidChunk(), _Ok(["unused"]))
    with pytest.raises(RuntimeError):
        await _collect(fb.stream_completion("s", [{"role": "user", "content": "x"}]))


@pytest.mark.asyncio
async def test_completion_fails_over():
    fb = FallbackLLMProvider(_FailBeforeChunk(), _Ok(["ok"]))
    assert await fb.completion("s", [{"role": "user", "content": "x"}]) == "ok"


@pytest.mark.asyncio
async def test_primary_success_does_not_call_secondary():
    fb = FallbackLLMProvider(_Ok(["primary"]), _FailBeforeChunk())
    out = await _collect(fb.stream_completion("s", [{"role": "user", "content": "x"}]))
    assert "".join(out) == "primary"
