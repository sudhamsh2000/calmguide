"""Validated-vs-experimental language tiering: registry correctness, and that
the /api/languages endpoint exposes it without overclaiming validation."""

import pytest
from httpx import AsyncClient

from app.services.language_support import (
    LANGUAGES,
    ValidationTier,
    get_language_support,
    is_experimental,
)

MVP_VALIDATED_CODES = {"en-US", "es-ES", "hi-IN"}


def test_mvp_validated_languages_are_exactly_english_spanish_hindi():
    validated = {
        lang.code for lang in LANGUAGES if lang.tier is ValidationTier.MVP_VALIDATED
    }
    assert validated == MVP_VALIDATED_CODES


def test_every_non_english_mvp_validated_language_still_has_pending_native_review():
    for lang in LANGUAGES:
        if lang.tier is ValidationTier.MVP_VALIDATED and lang.code != "en-US":
            assert lang.native_review_pending is True


def test_lookup_by_full_code_and_bare_base_code():
    assert get_language_support("es-ES").tier is ValidationTier.MVP_VALIDATED
    assert get_language_support("es").tier is ValidationTier.MVP_VALIDATED
    assert get_language_support("ES-es").tier is ValidationTier.MVP_VALIDATED


def test_is_experimental_defaults_unknown_locales_to_experimental():
    assert is_experimental("xx-XX") is True
    assert is_experimental("en-US") is False
    assert is_experimental("zh-CN") is True


@pytest.mark.asyncio
async def test_languages_endpoint_lists_every_registered_language(client: AsyncClient):
    resp = await client.get("/api/languages")
    assert resp.status_code == 200
    body = resp.json()["languages"]
    assert len(body) == len(LANGUAGES)

    by_code = {entry["code"]: entry for entry in body}
    assert by_code["en-US"]["tier"] == "mvp_validated"
    assert by_code["en-US"]["native_review_pending"] is False
    assert by_code["zh-CN"]["tier"] == "experimental"
