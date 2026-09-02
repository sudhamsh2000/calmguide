"""System prompt builder using Jinja2 templates."""

from pathlib import Path

from jinja2 import Environment, FileSystemLoader

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"

_env = Environment(
    loader=FileSystemLoader(str(PROMPTS_DIR)),
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
)

LOCALE_TO_LANGUAGE: dict[str, str] = {
    "en": "English",
    "en-us": "English",
    "es": "Spanish",
    "es-es": "Spanish",
    "zh": "Mandarin Chinese",
    "zh-cn": "Mandarin Chinese",
    "hi": "Hindi",
    "hi-in": "Hindi",
    "ta": "Tamil",
    "ta-in": "Tamil",
    "ar": "Arabic",
    "ar-sa": "Arabic",
    "fr": "French",
    "fr-fr": "French",
    "pt-br": "Brazilian Portuguese",
    "ja": "Japanese",
    "ja-jp": "Japanese",
    "de": "German",
    "de-de": "German",
    "ko": "Korean",
    "ko-kr": "Korean",
}

_LANGUAGE_CONSTRAINTS: dict[str, str] = {
    "ar": (
        "Write the entire response in Modern Standard Arabic (فصحى) using Arabic script. "
        "Do not transliterate Arabic into Latin letters. Do not mix with English or any other language. "
        "Use respectful formal Arabic appropriate for addressing a stressed family caregiver."
    ),
    "hi": (
        "Write the entire response in standard Hindi using Devanagari script. "
        "Do not transliterate Hindi into Latin/Roman letters (no 'kya', 'aap' etc.). "
        "Do not mix Hindi with English or any other language. "
        "Use respectful formal Hindi (शुद्ध हिंदी). Use आप (not तुम or तू)."
    ),
    "ja": (
        "Write the entire response in Japanese. Use polite form (です/ます体). "
        "Do not switch to English or any other language."
    ),
    "ko": (
        "Write the entire response in Korean using Hangul. Use polite formal style (합쇼체 or 해요체). "
        "Do not switch to English or any other language."
    ),
    "ta": (
        "Write the entire response in grammatically correct written Tamil (எழுத்துத் தமிழ்).\n"
        "CRITICAL TAMIL RULES — follow every one:\n"
        "1. Use ONLY written Tamil (எழுத்துத் தமிழ்). Do NOT use spoken/colloquial Tamil (பேச்சுத் தமிழ்).\n"
        "2. Do NOT transliterate Tamil into Latin/Roman letters.\n"
        "3. Do NOT mix Tamil with English, Hindi, or any other language.\n"
        "4. Do NOT invent or guess Tamil words. If unsure of a word, rephrase using simpler Tamil you are confident is correct.\n"
        "5. Use consistent respectful register: அவர் (not அவன்/அவள்) for the patient, உங்கள்/நீங்கள் (not உன்/நீ) for the caregiver.\n"
        "6. Use proper Tamil sentence structure (Subject-Object-Verb).\n"
        "7. Common vocabulary:\n"
        "   - Wandering = அலைதல் or சுற்றுதல் (NOT புலம் பெயர்தல் which means 'migrate')\n"
        "   - Caregiver = பராமரிப்பாளர்\n"
        "   - Dementia = மறதி நோய் or அல்சைமர் நோய்\n"
        "   - Agitation = கிளர்ச்சி or பதற்றம்\n"
        "   - Comfort/soothe = ஆறுதல் அளித்தல்\n"
        "   - Approach calmly = அமைதியாக அணுகுங்கள்\n"
        "   - Speak softly = மெதுவாகப் பேசுங்கள்\n"
        "8. After writing each sentence, verify it uses real Tamil words and correct grammar. Rewrite any sentence you are not confident about."
    ),
    "zh": (
        "Write the entire response in Simplified Chinese (简体中文). "
        "Do not switch to English, Traditional Chinese, or any other language. "
        "Use respectful, warm tone appropriate for addressing a family caregiver."
    ),
}

LOCALE_TO_LANGUAGE_CONSTRAINT: dict[str, str] = {}
for _code, _constraint in _LANGUAGE_CONSTRAINTS.items():
    LOCALE_TO_LANGUAGE_CONSTRAINT[_code] = _constraint
    # Map common variant codes to the same constraint
_VARIANT_MAP = {
    "ar": "ar-sa",
    "hi": "hi-in",
    "ja": "ja-jp",
    "ko": "ko-kr",
    "ta": "ta-in",
    "zh": "zh-cn",
}
for _base, _variant in _VARIANT_MAP.items():
    if _base in _LANGUAGE_CONSTRAINTS:
        LOCALE_TO_LANGUAGE_CONSTRAINT[_variant] = _LANGUAGE_CONSTRAINTS[_base]


def _iter_accept_language_codes(accept_language: str | None) -> list[str]:
    if not accept_language:
        return []

    codes: list[str] = []
    for entry in accept_language.split(","):
        code = entry.strip().split(";")[0].strip().replace("_", "-").lower()
        if code:
            codes.append(code)
    return codes


def resolve_locale_code(accept_language: str | None) -> str:
    """Resolve the best supported locale code from an Accept-Language header."""
    for code in _iter_accept_language_codes(accept_language):
        if code in LOCALE_TO_LANGUAGE:
            return code
        if "-" in code:
            base_code = code.split("-", 1)[0]
            if base_code in LOCALE_TO_LANGUAGE:
                return base_code
    return "en"


def resolve_language(accept_language: str | None) -> str:
    """Convert Accept-Language header value to a language name."""
    code = resolve_locale_code(accept_language)
    return LOCALE_TO_LANGUAGE[code]


def resolve_language_constraint(accept_language: str | None) -> str:
    """Return extra script/language constraints for the resolved locale."""
    code = resolve_locale_code(accept_language)
    return LOCALE_TO_LANGUAGE_CONSTRAINT.get(code, "")


def resolve_model_for_locale(locale_code: str) -> str | None:
    """Return the multilingual model override if the locale is non-English.

    Returns None for English (use default model), or the
    OPENAI_MULTILINGUAL_MODEL / ANTHROPIC_MODEL for non-English locales.
    """
    base = locale_code.lower().split("-", 1)[0]
    if base == "en":
        return None
    from app.config import get_settings

    settings = get_settings()
    if settings.LLM_PROVIDER == "openai":
        return settings.OPENAI_MULTILINGUAL_MODEL
    return None  # Anthropic uses a single capable model


def get_request_locale_header(app_locale: str | None, accept_language: str | None) -> str | None:
    """Prefer an explicit app locale header, then fall back to Accept-Language."""
    return app_locale or accept_language


def render_coach_prompt(
    patient_name: str,
    disease_stage: str,
    behavioral_patterns: list[str],
    calming_strategies: list[str],
    safety_concerns: list[str],
    rag_context: str = "",
    language: str = "English",
    language_constraint: str = "",
    cross_patient_strategies: list[dict] | None = None,
    dossier_text: str = "",
    contraindicated: list[dict] | None = None,
    relevant_incidents: list[dict] | None = None,
    delirium_flags: dict | None = None,
    pain_flags: dict | None = None,
    effective_interventions: list[dict] | None = None,
    frequency_trends: dict | None = None,
    care_change: dict | None = None,
) -> str:
    template = _env.get_template("coach_system.jinja2")
    return template.render(
        patient_name=patient_name,
        disease_stage=disease_stage,
        behavioral_patterns=behavioral_patterns,
        calming_strategies=calming_strategies,
        safety_concerns=safety_concerns,
        rag_context=rag_context,
        language=language,
        language_constraint=language_constraint,
        cross_patient_strategies=cross_patient_strategies or [],
        dossier_text=dossier_text,
        contraindicated=contraindicated or [],
        relevant_incidents=relevant_incidents or [],
        delirium_flags=delirium_flags or {},
        pain_flags=pain_flags or {},
        effective_interventions=effective_interventions or [],
        frequency_trends=frequency_trends or {},
        care_change=care_change or None,
    )


def render_learn_prompt(
    disease_stage: str,
    scenario_type: str | None = None,
    rag_context: str = "",
    language: str = "English",
    language_constraint: str = "",
) -> str:
    template = _env.get_template("learn_system.jinja2")
    return template.render(
        disease_stage=disease_stage,
        scenario_type=scenario_type,
        rag_context=rag_context,
        language=language,
        language_constraint=language_constraint,
    )


def render_checkin_prompt(language: str = "English", language_constraint: str = "") -> str:
    template = _env.get_template("checkin_system.jinja2")
    return template.render(language=language, language_constraint=language_constraint)
