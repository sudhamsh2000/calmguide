from collections.abc import AsyncGenerator
from unittest.mock import patch

from app.services.llm_provider import LLMProvider
from app.services.retrieval_query import (
    build_english_rag_query,
    build_rewrite_prompt,
    should_rewrite_for_english_corpus,
)


class FakeLLM(LLMProvider):
    def __init__(self, completion_text: str):
        self._completion_text = completion_text
        self.calls = 0

    async def stream_completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        model_override: str | None = None,
    ) -> AsyncGenerator[str, None]:
        yield self._completion_text

    async def completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        model_override: str | None = None,
    ) -> str:
        self.calls += 1
        return self._completion_text


def test_should_rewrite_for_english_corpus():
    assert should_rewrite_for_english_corpus("ta-IN") is True
    assert should_rewrite_for_english_corpus("en-US") is False


def test_build_rewrite_prompt_includes_context():
    prompt = build_rewrite_prompt(
        locale_code="ta-IN",
        user_text="எப்படி இருக்கீங்க",
        context="Nighttime agitation",
    )
    assert "Original locale: ta-IN" in prompt
    assert "Context: Nighttime agitation" in prompt


@patch("app.services.retrieval_query._is_rag_configured", return_value=True)
async def test_build_english_rag_query_rewrites_non_english_requests(_mock_rag):
    llm = FakeLLM("nighttime agitation asking if caregiver is okay")
    result = await build_english_rag_query(
        llm,
        locale_code="ta-IN",
        user_text="எப்படி இருக்கீங்க நல்லா இருக்கீங்களா",
    )
    assert result == "nighttime agitation asking if caregiver is okay"
    assert llm.calls == 1


async def test_build_english_rag_query_skips_rewrite_for_english():
    llm = FakeLLM("unused")
    result = await build_english_rag_query(
        llm,
        locale_code="en-US",
        user_text="Dad is restless at night",
    )
    assert result == "Dad is restless at night"
    assert llm.calls == 0


@patch("app.services.retrieval_query._is_rag_configured", return_value=True)
async def test_build_english_rag_query_falls_back_to_original_if_empty(_mock_rag):
    llm = FakeLLM("   ")
    result = await build_english_rag_query(
        llm,
        locale_code="ta-IN",
        user_text="அப்பா நடக்கிறார்",
    )
    assert result == "அப்பா நடக்கிறார்"


@patch("app.services.retrieval_query._is_rag_configured", return_value=False)
async def test_build_english_rag_query_skips_rewrite_when_rag_not_configured(_mock_rag):
    llm = FakeLLM("should not be called")
    result = await build_english_rag_query(
        llm,
        locale_code="ta-IN",
        user_text="எப்படி இருக்கீங்க",
    )
    # Should return sanitized input without calling LLM
    assert result == "எப்படி இருக்கீங்க"
    assert llm.calls == 0
