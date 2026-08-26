"""Tests for the LLM provider abstraction layer."""

import pytest
from unittest.mock import patch

from app.services.llm_provider import LLMProvider
from app.services.llm import get_llm_provider


# ---------------------------------------------------------------------------
# Abstract base class contract
# ---------------------------------------------------------------------------


def test_llm_provider_is_abstract():
    """Cannot instantiate LLMProvider directly."""
    with pytest.raises(TypeError):
        LLMProvider()


def test_llm_provider_requires_stream_completion():
    """Subclass must implement stream_completion."""

    class Incomplete(LLMProvider):
        async def completion(self, system_prompt, messages):
            return ""

    with pytest.raises(TypeError):
        Incomplete()


def test_llm_provider_requires_completion():
    """Subclass must implement completion."""

    class Incomplete(LLMProvider):
        async def stream_completion(self, system_prompt, messages):
            yield ""

    with pytest.raises(TypeError):
        Incomplete()


# ---------------------------------------------------------------------------
# Factory function
# ---------------------------------------------------------------------------


def test_factory_returns_openai_provider():
    provider = get_llm_provider(provider_name="openai", api_key="test-key", model="gpt-4o-mini")
    from app.services.openai_provider import OpenAIProvider
    assert isinstance(provider, OpenAIProvider)


def test_factory_returns_anthropic_provider():
    provider = get_llm_provider(provider_name="anthropic", api_key="test-key", model="claude-sonnet-4-20250514")
    from app.services.anthropic_provider import AnthropicProvider
    assert isinstance(provider, AnthropicProvider)


def test_factory_raises_on_unknown_provider():
    with pytest.raises(ValueError, match="Unknown LLM provider"):
        get_llm_provider(provider_name="gemini", api_key="k", model="m")


# ---------------------------------------------------------------------------
# Mock provider (from conftest) contract
# ---------------------------------------------------------------------------


async def test_mock_provider_streams(mock_llm):
    chunks = []
    async for chunk in mock_llm.stream_completion("system", [{"role": "user", "content": "hi"}]):
        chunks.append(chunk)
    assert "".join(chunks) == "This is a test response."


async def test_mock_provider_completion(mock_llm):
    result = await mock_llm.completion("system", [{"role": "user", "content": "hi"}])
    assert result == "This is a test response."


async def test_mock_provider_captures_inputs(mock_llm):
    await mock_llm.completion("my system prompt", [{"role": "user", "content": "hello"}])
    assert mock_llm.last_system_prompt == "my system prompt"
    assert mock_llm.last_messages == [{"role": "user", "content": "hello"}]
