"""Tests for tag generation from coach responses."""

from unittest.mock import AsyncMock

import pytest

from app.schemas.feedback import PREDEFINED_TAGS


@pytest.mark.asyncio
async def test_generate_tags_returns_predefined_plus_custom():
    from app.services.tag_generator import generate_suggested_tags

    mock_llm = AsyncMock()
    mock_llm.completion.return_value = '["show photo album", "play Frank Sinatra"]'

    tags = await generate_suggested_tags(
        "1. Approach slowly\n2. Play Frank Sinatra\n3. Show him the photo album",
        mock_llm,
    )
    for t in PREDEFINED_TAGS:
        assert t in tags
    assert "show photo album" in tags
    assert "play frank sinatra" in tags


@pytest.mark.asyncio
async def test_generate_tags_llm_failure_returns_predefined_only():
    from app.services.tag_generator import generate_suggested_tags

    mock_llm = AsyncMock()
    mock_llm.completion.side_effect = Exception("LLM down")

    tags = await generate_suggested_tags("some response text", mock_llm)
    assert tags == PREDEFINED_TAGS


@pytest.mark.asyncio
async def test_generate_tags_llm_returns_invalid_json():
    from app.services.tag_generator import generate_suggested_tags

    mock_llm = AsyncMock()
    mock_llm.completion.return_value = "not valid json"

    tags = await generate_suggested_tags("some response text", mock_llm)
    assert tags == PREDEFINED_TAGS


@pytest.mark.asyncio
async def test_generate_tags_llm_returns_empty_array():
    from app.services.tag_generator import generate_suggested_tags

    mock_llm = AsyncMock()
    mock_llm.completion.return_value = "[]"

    tags = await generate_suggested_tags("some response text", mock_llm)
    assert tags == PREDEFINED_TAGS
