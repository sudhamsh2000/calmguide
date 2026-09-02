"""Registry distinguishing CalmGuide's MVP-validated languages from experimental ones.

"MVP-validated" here is a product-scoping decision (which languages CalmGuide is
committing to support and prioritize for review), not a claim that clinical or
linguistic validation has actually been completed. Whether specific
safety-critical content has been reviewed by a native speaker is tracked
separately per language via `native_review_pending` — see
locales/REVIEW_STATUS.md, which is the source of truth this mirrors.
As of this writing, safety-critical content (crisis guidance) has pending
native review for every non-English language, including the MVP-validated ones.

Scope: CalmGuide supports exactly three languages — English, Spanish and Hindi.
This registry, the translation files under locales/, and SUPPORTED_LOCALES in
both clients all list the same three, and they are meant to stay in step.

This previously also carried eight EXPERIMENTAL entries (zh, ta, ar, fr, pt-BR,
ja, de, ko) left over from a wider scope. Their translation files had already
been removed, so `GET /languages` was advertising languages the product could
not render — English chrome with no explanation. Scope is now three languages,
so the tier split no longer describes anything real; ValidationTier is kept
because `native_review_pending` still varies per language and the endpoint's
shape is part of its contract.
"""

from dataclasses import dataclass
from enum import Enum


class ValidationTier(str, Enum):
    MVP_VALIDATED = "mvp_validated"
    EXPERIMENTAL = "experimental"


@dataclass(frozen=True, slots=True)
class LanguageSupport:
    # BCP-47. The MVP_VALIDATED codes match frontend/src/lib/locale.ts
    # SUPPORTED_LOCALES; the EXPERIMENTAL ones intentionally do not — see the
    # scope note in the module docstring.
    code: str
    name: str
    tier: ValidationTier
    # True if native-speaker review of safety-critical content (e.g. crisis
    # guidance) is not yet complete for this language. See
    # locales/REVIEW_STATUS.md for the file-level detail this summarizes.
    native_review_pending: bool


LANGUAGES: tuple[LanguageSupport, ...] = (
    LanguageSupport("en-US", "English", ValidationTier.MVP_VALIDATED, native_review_pending=False),
    LanguageSupport("es-ES", "Spanish", ValidationTier.MVP_VALIDATED, native_review_pending=True),
    LanguageSupport("hi-IN", "Hindi", ValidationTier.MVP_VALIDATED, native_review_pending=True),
)

_BY_CODE: dict[str, LanguageSupport] = {lang.code.lower(): lang for lang in LANGUAGES}
# Also index by bare base code (e.g. "es" -> es-ES) to match how locale_code
# arrives elsewhere in the codebase (see prompt.py LOCALE_TO_LANGUAGE, which
# accepts both "es" and "es-es").
for _lang in LANGUAGES:
    _BY_CODE.setdefault(_lang.code.split("-", 1)[0].lower(), _lang)


def get_language_support(locale_code: str) -> LanguageSupport | None:
    """Look up a language's validation tier by BCP-47 code or bare base code."""
    return _BY_CODE.get(locale_code.lower())


def is_experimental(locale_code: str) -> bool:
    """True if the locale is unknown or explicitly tiered as experimental.

    Unknown locales default to experimental (fail toward disclosure, not
    silent trust) rather than defaulting to MVP-validated.
    """
    lang = get_language_support(locale_code)
    return lang is None or lang.tier is ValidationTier.EXPERIMENTAL
