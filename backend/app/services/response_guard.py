"""Response quality guardrails for multilingual LLM output."""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass

from app.services.llm_provider import LLMProvider


@dataclass(frozen=True)
class ValidationResult:
    is_valid: bool
    reason: str = ""


@dataclass(frozen=True)
class ScriptRule:
    pattern: re.Pattern[str]
    min_letters: int
    min_ratio: float


# Script checks for the non-Latin languages CalmGuide answers in. Hindi is the
# only one — Devanagari, because the model will otherwise transliterate into
# Latin letters and the response guard is what catches that.
#
# Unlike the emergency-number map in safety_gate.py, this follows the language
# scope rather than geography: a rule can only ever fire for a locale we asked
# the model to answer in, so rules for dropped languages were unreachable.
SCRIPT_RULES: dict[str, ScriptRule] = {
    "hi": ScriptRule(re.compile(r"[\u0900-\u097F]"), min_letters=100, min_ratio=0.65),
}

LATIN_SCRIPT_LOCALES = {"en", "es"}

KNOWN_BAD_PHRASES = (
    "i am designed specifically for dementia caregiving support",
    "if you need help with a caregiving situation",
    "please share, and i'll do my best to assist you",
)

_DISRESPECTFUL_WORD_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\bcrazy\b",
        r"\bcraziness\b",
        r"\bsenil\w*\b",
        r"\bmake\s+(?:him|her|them)\s+obey\b",
        r"\battention\s*seek\w*\b",
        r"\bmanipulat\w+\b",
        r"\b(?:such\s+a\s+|what\s+a\s+|just\s+a\s+)burden\b",
        r"\bdifficult\s+patient\b",
        r"\bdemented\b",
        r"\bvegetable\b",
        r"\bgone\s+(?:in\s+the\s+head|mental)\b",
    ]
]

_NEGATION_PREFIX = re.compile(
    r"\b(?:don'?t|do\s+not|never|avoid|stop)\b",
    re.IGNORECASE,
)
_DIRECTIVE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\bcontrol\s+(?:him|her|them)\b",
        r"\bforce\s+(?:him|her|them)\b",
        r"\bshut\s+(?:him|her|them)\s+up\b",
    ]
]

# Non-English disrespectful phrases — keyed by base locale.
#
# Hindi only, matching the languages CalmGuide answers in. Entries for Tamil,
# Arabic, Chinese, Japanese and Korean were removed with those languages: the
# guard is only ever called with a locale the model was asked to answer in, so
# they could not fire. They are recoverable from git history if scope widens,
# and would need native-speaker review before being trusted again anyway.
LOCALIZED_DISRESPECTFUL_PHRASES: dict[str, tuple[str, ...]] = {
    "hi": (
        "पागल",  # crazy
        "बोझ",  # burden
        "बूढ़ा",  # old (pejorative)
        "चुप करो",  # shut up
        "काबू करो",  # control
        "जबरदस्ती",  # force
    ),
}

LOCALIZED_FALLBACKS: dict[str, dict[str, str]] = {
    "coach": {
        "en": "I’m sorry — I didn’t generate that correctly. Please ask again. If this is urgent, stay with your loved one, lower noise, and use a calm voice.",
        "es": "Lo siento, no generé esa respuesta correctamente. Vuelve a intentarlo. Si es urgente, quédate con tu ser querido, reduce el ruido y habla con calma.",
        "hi": "क्षमा करें, मैं सही उत्तर नहीं दे पाया। कृपया फिर से पूछें। अगर स्थिति तुरंत ध्यान मांगती है, तो अपने प्रियजन के पास रहें, आसपास का शोर कम करें और शांत स्वर में बात करें।",
    },
    "checkin": {
        "en": "I’m sorry — I didn’t generate that correctly. Please try again and tell me how you’re feeling right now.",
        "es": "Lo siento, no generé esa respuesta correctamente. Inténtalo de nuevo y cuéntame cómo te sientes ahora mismo.",
        "hi": "क्षमा करें, मैं सही उत्तर नहीं दे पाया। कृपया फिर से बताइए कि आप अभी कैसा महसूस कर रहे हैं।",
    },
    "learn": {
        "en": "I’m sorry — I didn’t generate that feedback correctly. Please try again with your response.",
        "es": "Lo siento, no generé esa retroalimentación correctamente. Vuelve a intentarlo con tu respuesta.",
        "hi": "क्षमा करें, मैं सही प्रतिक्रिया नहीं दे पाया। कृपया अपने उत्तर के साथ फिर से प्रयास करें।",
    },
}


def get_localized_fallback(mode: str, locale_code: str) -> str:
    """Safe static fallback text for a mode + locale.

    Used when the LLM call fails entirely (no model output to repair), so a
    caregiver mid-crisis always receives a calm, actionable message instead of
    silence or a stack trace.
    """
    fallback_map = LOCALIZED_FALLBACKS.get(mode, LOCALIZED_FALLBACKS["coach"])
    lc = (locale_code or "en").lower()
    if lc in fallback_map:
        return fallback_map[lc]
    base = lc.split("-", 1)[0]
    if base == "pt":
        base = "pt-br"
    return fallback_map.get(base, fallback_map["en"])


def _strip_machine_markers(text: str) -> str:
    return re.sub(r"\[\[SECTION:[a-z-]+\]\]", "", text, flags=re.IGNORECASE)


def _meaningful_letters(text: str) -> str:
    cleaned = _strip_machine_markers(text)
    cleaned = re.sub(r"```.*?```", " ", cleaned, flags=re.DOTALL)
    cleaned = re.sub(r"https?://\S+", " ", cleaned)
    cleaned = re.sub(r"[#*_>\-\d\[\]\(\)\{\}:/\\|]", " ", cleaned)
    cleaned = re.sub(r"\s+", "", cleaned)
    return cleaned


def validate_response_language(text: str, locale_code: str) -> ValidationResult:
    base_locale = locale_code.lower().split("-", 1)[0]
    cleaned = _meaningful_letters(text)
    lowered = cleaned.lower()

    for phrase in KNOWN_BAD_PHRASES:
        if phrase.replace(" ", "") in lowered:
            return ValidationResult(False, "known_english_boilerplate")

    if base_locale in LATIN_SCRIPT_LOCALES:
        return ValidationResult(True)

    rule = SCRIPT_RULES.get(base_locale)
    if rule is None:
        return ValidationResult(True)

    letters = [char for char in cleaned if char.isalpha()]
    if len(letters) < rule.min_letters:
        return ValidationResult(False, "response_too_short")

    matching_letters = sum(1 for char in letters if rule.pattern.match(char))
    ratio = matching_letters / max(len(letters), 1)
    if ratio < rule.min_ratio:
        return ValidationResult(False, f"script_ratio:{ratio:.2f}")

    # Detect romanised output for non-Latin locales:
    # if >20% of word-like tokens are pure ASCII, the LLM is likely
    # transliterating instead of using the correct script
    ascii_word_pattern = re.compile(r"^[a-zA-Z]+$")
    words = re.findall(r"\S+", _strip_machine_markers(text))
    if len(words) >= 10:
        ascii_words = sum(1 for w in words if ascii_word_pattern.match(w))
        ascii_ratio = ascii_words / len(words)
        if ascii_ratio > 0.20:
            return ValidationResult(False, f"romanised_output:{ascii_ratio:.2f}")

    return ValidationResult(True)


def validate_response_respect(text: str, locale_code: str = "en") -> ValidationResult:
    cleaned = _strip_machine_markers(text)

    for pattern in _DISRESPECTFUL_WORD_PATTERNS:
        match = pattern.search(cleaned)
        if match:
            return ValidationResult(False, f"disrespectful_phrase:{match.group()}")

    for pattern in _DIRECTIVE_PATTERNS:
        match = pattern.search(cleaned)
        if match:
            window = cleaned[max(0, match.start() - 60) : match.start()]
            last_sentence = re.split(r"[.!?]", window)[-1]
            if not _NEGATION_PREFIX.search(last_sentence):
                return ValidationResult(False, f"disrespectful_phrase:{match.group()}")

    lowered = cleaned.lower()
    normalized = re.sub(r"\s+", " ", lowered)

    # Check locale-specific phrases
    base_locale = locale_code.lower().split("-", 1)[0]
    localized_phrases = LOCALIZED_DISRESPECTFUL_PHRASES.get(base_locale, ())
    for phrase in localized_phrases:
        if phrase in normalized:
            return ValidationResult(False, f"disrespectful_phrase_localized:{phrase}")

    return ValidationResult(True)


# Dosing language that must never sit next to one of the patient's own
# medications (from the linked OpenMRS record). English-only for now; the
# prompt's no-medication-advice rule remains the primary control.
_DOSING_ACTION = re.compile(
    r"\b(increase|increasing|reduce|reducing|lower|raise|stop|stopping|skip|skipping|"
    r"double|halve|cut back|discontinue|hold off|extra dose|another dose|extra one|"
    r"another one|more of|less of|give (?:him|her|them|\w+) (?:an? )?(?:extra|another|more)|"
    r"take (?:an? )?(?:extra|another|more))\b",
    re.IGNORECASE,
)
_DOSING_UNIT = re.compile(
    r"\b(?:\d+(?:\.\d+)?\s*(?:mg|mcg|ml)|milligrams?|tablets?|pills?|capsules?)\b", re.IGNORECASE
)
_CLINICIAN_REFERRAL = re.compile(
    r"\b(doctor|pharmacist|nurse|clinician|prescriber|care team)\b", re.I
)
_NEGATED = re.compile(r"\b(don't|do not|never|shouldn't|should not|without)\b", re.IGNORECASE)


def validate_medication_safety(text: str, medication_names: Sequence[str]) -> ValidationResult:
    """Flag a sentence that pairs a listed medication with dosing language.

    "Give Frank an extra 5 mg of donepezil" fails. "Ask Frank's doctor about
    his donepezil" passes, as does a negated referral like "don't stop his
    donepezil without asking his doctor".
    """
    names = [n.strip() for n in medication_names if n and len(n.strip()) >= 3]
    if not names:
        return ValidationResult(True)
    name_pattern = re.compile(r"\b(" + "|".join(re.escape(n) for n in names) + r")\b", re.I)
    for sentence in re.split(r"(?<=[.!?])\s+|\n+", _strip_machine_markers(text)):
        medication = name_pattern.search(sentence)
        if not medication:
            continue
        if _DOSING_UNIT.search(sentence):
            return ValidationResult(False, f"medication_dosing:{medication.group()}")
        if _DOSING_ACTION.search(sentence) and not (
            _NEGATED.search(sentence) and _CLINICIAN_REFERRAL.search(sentence)
        ):
            return ValidationResult(False, f"medication_dosing:{medication.group()}")
    return ValidationResult(True)


def validate_response_quality(
    text: str, locale_code: str, medication_names: Sequence[str] = ()
) -> ValidationResult:
    language_validation = validate_response_language(text, locale_code)
    if not language_validation.is_valid:
        return language_validation

    respect_validation = validate_response_respect(text, locale_code)
    if not respect_validation.is_valid:
        return respect_validation

    medication_validation = validate_medication_safety(text, medication_names)
    if not medication_validation.is_valid:
        return medication_validation

    return ValidationResult(True)


def build_repair_prompt(
    language: str,
    locale_code: str,
    mode: str,
    original_text: str,
    medication_names: Sequence[str] = (),
) -> str:
    from app.services.prompt import LOCALE_TO_LANGUAGE_CONSTRAINT

    constraint = LOCALE_TO_LANGUAGE_CONSTRAINT.get(locale_code.lower(), "")
    constraint_block = f"\n\nLanguage-specific rules:\n{constraint}\n" if constraint else ""
    medication_block = (
        "Remove any suggestion to start, stop, skip, change, or time a medication, and any "
        "dose or amount. Replace it with advice to contact the doctor or pharmacist.\n"
        if medication_names
        else ""
    )

    return (
        f"You are repairing a CalmGuide {mode} response.\n"
        f"Rewrite the assistant response so it is entirely in {language} for locale {locale_code}.\n"
        "Keep the meaning, keep markdown structure, and keep any [[SECTION:...]] markers exactly.\n"
        "Remove every sentence or fragment written in the wrong language or script.\n"
        "Do NOT translate word-by-word from English. Write naturally as a native speaker would.\n"
        "Do NOT invent words. If unsure of a word, rephrase the sentence simply.\n"
        "Use respectful, dignity-preserving language for both the caregiver and the person receiving care.\n"
        "Do not use insulting, coercive, belittling, or blameful wording.\n"
        f"{medication_block}"
        f"{constraint_block}\n"
        f"Original response:\n{original_text}"
    )


async def guard_response_text(
    llm: LLMProvider,
    *,
    mode: str,
    locale_code: str,
    language: str,
    text: str,
    medication_names: Sequence[str] = (),
) -> str:
    validation = validate_response_quality(text, locale_code, medication_names)
    if validation.is_valid:
        return text

    repair_prompt = build_repair_prompt(language, locale_code, mode, text, medication_names)
    repaired_text = await llm.completion(
        "You fix multilingual output quality issues for CalmGuide.",
        [{"role": "user", "content": repair_prompt}],
    )
    repaired_validation = validate_response_quality(repaired_text, locale_code, medication_names)
    if repaired_validation.is_valid:
        return repaired_text

    base_locale = locale_code.lower().split("-", 1)[0]
    fallback_map = LOCALIZED_FALLBACKS.get(mode, LOCALIZED_FALLBACKS["coach"])
    return fallback_map.get(base_locale, fallback_map["en"])


def chunk_text_for_sse(text: str, chunk_size: int = 40) -> list[str]:
    words = re.findall(r"\S+\s*|\n", text)
    if not words:
        return [text] if text else []

    chunks: list[str] = []
    current = ""
    for token in words:
        if len(current) + len(token) > chunk_size and current:
            chunks.append(current)
            current = token
        else:
            current += token
    if current:
        chunks.append(current)
    return chunks
