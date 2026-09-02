"""Language registry correctness, and that /api/languages exposes it without
overclaiming validation.

CalmGuide supports exactly three languages. The registry, the translation files
under locales/, and SUPPORTED_LOCALES in both clients must agree on that — a
registry wider than the shipped translations means the endpoint advertises
languages whose UI silently falls back to English.
"""

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
    validated = {lang.code for lang in LANGUAGES if lang.tier is ValidationTier.MVP_VALIDATED}
    assert validated == MVP_VALIDATED_CODES


def test_registry_contains_only_the_three_supported_languages():
    """Guards the gap this closed: the registry used to carry eight extra
    EXPERIMENTAL languages whose translation files had already been deleted, so
    /languages advertised languages the product could not render."""
    assert {lang.code for lang in LANGUAGES} == MVP_VALIDATED_CODES


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
    # Dropped from scope, so it is now simply unknown — and unknown must fail
    # toward disclosure rather than being silently trusted.
    assert is_experimental("zh-CN") is True


@pytest.mark.asyncio
async def test_languages_endpoint_lists_every_registered_language(client: AsyncClient):
    resp = await client.get("/api/languages")
    assert resp.status_code == 200
    body = resp.json()["languages"]
    assert len(body) == len(LANGUAGES)

    by_code = {entry["code"]: entry for entry in body}
    assert set(by_code) == MVP_VALIDATED_CODES
    assert by_code["en-US"]["tier"] == "mvp_validated"
    assert by_code["en-US"]["native_review_pending"] is False
    # Non-English still carries a pending native review of safety-critical copy.
    assert by_code["es-ES"]["native_review_pending"] is True
    assert by_code["hi-IN"]["native_review_pending"] is True
