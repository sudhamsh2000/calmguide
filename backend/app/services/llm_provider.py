"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator


class LLMProvider(ABC):
    """Contract that all LLM providers must implement."""

    @abstractmethod
    async def stream_completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        model_override: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Yield text chunks as they arrive from the LLM."""
        ...  # pragma: no cover

    @abstractmethod
    async def completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        model_override: str | None = None,
    ) -> str:
        """Return the full completion as a single string."""
        ...  # pragma: no cover
