"""OpenAI LLM provider implementation using SDK v2.11+ streaming."""

import logging
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.config import get_settings
from app.services.llm_provider import LLMProvider
from app.services.token_usage import record_usage

logger = logging.getLogger(__name__)

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
            # Without this the provider omits usage from streamed responses,
            # so the accumulated completion would carry no token counts.
            stream_options={"include_usage": True},
        ) as stream:
            async for event in stream:
                if event.type == "content.delta":
                    yield event.delta

            # Usage only exists once the stream has completed, so this runs
            # after the loop. Best-effort by design: token accounting is
            # observability and must never be able to fail a caregiver's
            # response that has already been delivered in full.
            try:
                final = await stream.get_final_completion()
            except Exception as exc:  # pragma: no cover - defensive only
                logger.debug("token usage unavailable for model=%s: %s", model, exc)
            else:
                self._record_usage(final, model)

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
        self._record_usage(response, model)
        return response.choices[0].message.content or ""

    @staticmethod
    def _record_usage(completion: object, model: str) -> None:
        """Record token usage from a completed (or accumulated) completion.

        Best-effort by design. `cached_tokens` only appears once a prompt is
        large enough for OpenAI's automatic caching to engage, and the exact
        usage shape varies across SDK versions — so every step is guarded and
        a miss is logged at debug level rather than raised. Losing a metric
        sample is acceptable; failing a request that already succeeded is not.
        """
        try:
            usage = getattr(completion, "usage", None)
            if usage is None:
                logger.debug("token usage unavailable for model=%s", model)
                return

            details = getattr(usage, "prompt_tokens_details", None)
            record_usage(
                model=model,
                prompt_tokens=getattr(usage, "prompt_tokens", 0) or 0,
                completion_tokens=getattr(usage, "completion_tokens", 0) or 0,
                cached_tokens=getattr(details, "cached_tokens", 0) or 0,
            )
        except Exception as exc:  # pragma: no cover - defensive only
            logger.debug("token usage capture failed for model=%s: %s", model, exc)
