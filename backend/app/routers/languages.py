"""Exposes CalmGuide's validated-vs-experimental language tiering.

Lets clients (e.g. a language switcher) show which languages are
MVP-validated vs. experimental, and whether native-speaker review of
safety-critical content is still pending, without hardcoding that
information client-side. See app.services.language_support for what
"MVP-validated" does and doesn't claim.
"""

from fastapi import APIRouter

from app.services.language_support import LANGUAGES

router = APIRouter(tags=["languages"])


@router.get("/languages")
async def list_languages():
    return {
        "languages": [
            {
                "code": lang.code,
                "name": lang.name,
                "tier": lang.tier.value,
                "native_review_pending": lang.native_review_pending,
            }
            for lang in LANGUAGES
        ]
    }
