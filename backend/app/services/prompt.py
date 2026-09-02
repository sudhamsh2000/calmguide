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

# The languages CalmGuide answers in. Exactly three, matching locales/ and
# SUPPORTED_LOCALES in both clients.
#
# This map is also what resolve_locale_code() matches Accept-Language against,
# so it is the gate on response language for *browser* traffic too, not just
# in-app locale switching. It previously listed eleven languages, which meant a
# visitor whose browser sent `Accept-Language: fr` received a French AI response
# — safety-critical copy, in a language with no reviewed translations and no
# translated UI around it. Anything outside these three now resolves to English.
LOCALE_TO_LANGUAGE: dict[str, str] = {
    "en": "English",
    "en-us": "English",
    "es": "Spanish",
    "es-es": "Spanish",
    "hi": "Hindi",
    "hi-in": "Hindi",
}

# Per-language delivery rules. Rules for the eight dropped languages were
# removed with them — keeping unreachable prompt text invites it being
# re-enabled without the translation review that would have to come with it.
#
# Only Hindi carries one, as before: it needs an explicit script instruction
# because the model will otherwise transliterate into Latin letters. Spanish
# deliberately has none, which is the behaviour that shipped — adding one here
# would change Spanish output, and that is a prompt-tuning decision with its own
# review, not part of narrowing scope.
_LANGUAGE_CONSTRAINTS: dict[str, str] = {
    "hi": (
        "Write the entire response in standard Hindi using Devanagari script. "
        "Do not transliterate Hindi into Latin/Roman letters (no 'kya', 'aap' etc.). "
        "Do not mix Hindi with English or any other language. "
        "Use respectful formal Hindi (शुद्ध हिंदी). Use आप (not तुम or तू)."
    ),
}

LOCALE_TO_LANGUAGE_CONSTRAINT: dict[str, str] = {}
for _code, _constraint in _LANGUAGE_CONSTRAINTS.items():
    LOCALE_TO_LANGUAGE_CONSTRAINT[_code] = _constraint
    # Map common variant codes to the same constraint
_VARIANT_MAP = {
    "hi": "hi-in",
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
