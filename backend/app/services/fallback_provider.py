"""LLM provider wrapper that fails over to a secondary provider on error.

Turns a single-provider outage (rate limit, 5xx, regional incident) into a
transparent degradation instead of a total loss of crisis guidance.
"""

import logging
from collections.abc import AsyncGenerator

from app.services.llm_provider import LLMProvider
from app.services.safety_observability import record_llm_provider_used

logger = logging.getLogger(__name__)


class FallbackLLMProvider(LLMProvider):
    """Try the primary provider; on failure, use the secondary.

    Streaming can only fail over BEFORE the first chunk reaches the client —
    once bytes are on the wire we cannot retransmit, so a later error is
    re-raised for the caller's own fallback handling. Non-streaming completion
    retries fully on the secondary.
    """

    def __init__(self, primary: LLMProvider, secondary: LLMProvider):
        self._primary = primary
        self._secondary = secondary

    async def stream_completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        model_override: str | None = None,
    ) -> AsyncGenerator[str, None]:
        started = False
        try:
            async for chunk in self._primary.stream_completion(
                system_prompt, messages, model_override=model_override
            ):
                started = True
                yield chunk
            record_llm_provider_used(provider=type(self._primary).__name__, failover_used=False)
            return
        except Exception as exc:
            if started:
                # Already streaming to the client — cannot switch providers now.
                raise
            logger.warning("Primary LLM failed before first chunk; failing over: %s", exc)

        # model_override is provider-specific, so the secondary uses its own model.
        async for chunk in self._secondary.stream_completion(system_prompt, messages):
            yield chunk
        record_llm_provider_used(provider=type(self._secondary).__name__, failover_used=True)

    async def completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        model_override: str | None = None,
    ) -> str:
        try:
            result = await self._primary.completion(
                system_prompt, messages, model_override=model_override
            )
            record_llm_provider_used(provider=type(self._primary).__name__, failover_used=False)
            return result
        except Exception as exc:
            logger.warning("Primary LLM completion failed; failing over: %s", exc)
            result = await self._secondary.completion(system_prompt, messages)
            record_llm_provider_used(provider=type(self._secondary).__name__, failover_used=True)
            return result
