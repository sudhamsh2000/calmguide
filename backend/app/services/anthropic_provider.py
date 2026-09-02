"""Anthropic Claude LLM provider implementation."""

from collections.abc import AsyncGenerator

import anthropic

from app.config import get_settings
from app.services.llm_provider import LLMProvider


def _cacheable_system(system_prompt: str) -> list[dict]:
    """Wrap the system prompt in a cache_control block so Anthropic reuses the
    cached prefix across turns (lower latency + cost). No-op when the prefix
    doesn't repeat — purely additive."""
    return [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}]


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        # Bound every request so a stalled provider can't hang the crisis path.
        self._client = anthropic.AsyncAnthropic(
            api_key=api_key, timeout=get_settings().LLM_TIMEOUT_SECONDS
        )
        self._model = model

    async def stream_completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        model_override: str | None = None,
    ) -> AsyncGenerator[str, None]:
        model = model_override or self._model
        async with self._client.messages.stream(
            model=model,
            max_tokens=2048,
            system=_cacheable_system(system_prompt),
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        model_override: str | None = None,
    ) -> str:
        model = model_override or self._model
        response = await self._client.messages.create(
            model=model,
            max_tokens=2048,
            system=_cacheable_system(system_prompt),
            messages=messages,
        )
        return response.content[0].text if response.content else ""
