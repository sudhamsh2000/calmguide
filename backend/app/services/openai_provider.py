"""OpenAI LLM provider implementation using SDK v2.11+ streaming."""

from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.config import get_settings
from app.services.llm_provider import LLMProvider

# Matches the Anthropic provider's ceiling so a provider failover doesn't
# change how long a response can run. Comfortably above a four-part crisis
# answer; without it a runaway generation is unbounded in both time and cost.
_MAX_OUTPUT_TOKENS = 2048


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        # Bound every request so a stalled provider can't hang the crisis path.
        self._client = AsyncOpenAI(
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
        all_messages = [{"role": "system", "content": system_prompt}] + messages

        async with self._client.chat.completions.stream(
            model=model,
            messages=all_messages,
            max_tokens=_MAX_OUTPUT_TOKENS,
        ) as stream:
            async for event in stream:
                if event.type == "content.delta":
                    yield event.delta

    async def completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        model_override: str | None = None,
    ) -> str:
        model = model_override or self._model
        all_messages = [{"role": "system", "content": system_prompt}] + messages

        response = await self._client.chat.completions.create(
            model=model,
            messages=all_messages,
            max_tokens=_MAX_OUTPUT_TOKENS,
            stream=False,
        )
        return response.choices[0].message.content or ""
