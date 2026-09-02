from app.services.prompt import (
    get_request_locale_header,
    render_checkin_prompt,
    render_coach_prompt,
    render_learn_prompt,
    resolve_language,
    resolve_language_constraint,
)

LANGUAGE_MARKER = "Response Language"


def test_coach_prompt_includes_language_when_provided():
    result = render_coach_prompt(
        patient_name="Test",
        disease_stage="middle",
        behavioral_patterns=[],
        calming_strategies=[],
        safety_concerns=[],
        language="Spanish",
    )
    assert "Response Language — Spanish" in result
    assert "MUST write your entire response in Spanish" in result


def test_coach_prompt_no_language_instruction_when_english():
    result = render_coach_prompt(
        patient_name="Test",
        disease_stage="middle",
        behavioral_patterns=[],
        calming_strategies=[],
        safety_concerns=[],
        language="English",
    )
    assert LANGUAGE_MARKER not in result


def test_coach_prompt_no_language_instruction_when_none():
    result = render_coach_prompt(
        patient_name="Test",
        disease_stage="middle",
        behavioral_patterns=[],
        calming_strategies=[],
        safety_concerns=[],
    )
    assert LANGUAGE_MARKER not in result


def test_checkin_prompt_includes_language():
    result = render_checkin_prompt(language="Arabic")
    assert "Response Language — Arabic" in result


def test_checkin_prompt_no_language_when_english():
    result = render_checkin_prompt(language="English")
    assert LANGUAGE_MARKER not in result


def test_learn_prompt_includes_language():
    result = render_learn_prompt(disease_stage="early", language="Japanese")
    assert "Response Language — Japanese" in result


def test_resolve_language_supports_hindi():
    assert resolve_language("hi") == "Hindi"


def test_resolve_language_supports_hindi_regional_tag():
    assert resolve_language("hi-IN,hi;q=0.9,en-US;q=0.8") == "Hindi"


def test_out_of_scope_languages_resolve_to_english():
    """Scope is English, Spanish, Hindi.

    A browser sending Accept-Language for anything else used to get an AI
    response in that language — safety-critical copy, unreviewed, wrapped in
    English UI because no translations existed for it. Out of scope now means
    answered in English.
    """
    for header in ("ta-IN,ta;q=0.9,en-US;q=0.8", "pt-BR,pt;q=0.9,en;q=0.8", "fr-FR", "zh-CN"):
        assert resolve_language(header) == "English"
        assert resolve_language_constraint(header) == ""


def test_resolve_language_constraint_for_hindi():
    result = resolve_language_constraint("hi-IN,hi;q=0.9")
    assert "देवनागरी" in result or "Devanagari" in result
    assert "Do not mix Hindi with English" in result


def test_render_coach_prompt_includes_language_constraint():
    constraint = resolve_language_constraint("hi")
    result = render_coach_prompt(
        patient_name="Test",
        disease_stage="middle",
        behavioral_patterns=[],
        calming_strategies=[],
        safety_concerns=[],
        language="Hindi",
        language_constraint=constraint,
    )
    assert "Devanagari" in result
    assert "आप" in result  # respectful register guidance


def test_request_locale_header_prefers_explicit_app_locale():
    assert get_request_locale_header("hi-IN", "en-IN,en;q=0.8") == "hi-IN"


def test_coach_prompt_includes_dossier_when_provided():
    result = render_coach_prompt(
        patient_name="Mom",
        disease_stage="middle",
        behavioral_patterns=["wandering"],
        calming_strategies=["music"],
        safety_concerns=["fall risk"],
        dossier_text="Patient has escalating nighttime wandering pattern.",
    )
    assert "Behavioral History Dossier" in result
    assert "escalating nighttime wandering" in result


def test_coach_prompt_includes_contraindicated():
    result = render_coach_prompt(
        patient_name="Mom",
        disease_stage="middle",
        behavioral_patterns=[],
        calming_strategies=[],
        safety_concerns=[],
        contraindicated=[
            {
                "description": "Physical redirection",
                "behavior": "aggression_anger",
                "incident_date": "2026-04-15",
            },
        ],
    )
    assert "CONTRAINDICATED" in result
    assert "Physical redirection" in result


def test_coach_prompt_includes_relevant_incidents():
    result = render_coach_prompt(
        patient_name="Mom",
        disease_stage="middle",
        behavioral_patterns=[],
        calming_strategies=[],
        safety_concerns=[],
        relevant_incidents=[
            {
                "date": "2026-04-22T02:15:00",
                "behavior_category": "wandering_exit_seeking",
                "severity": "moderate",
                "antecedent": "Woke up confused",
                "behavior": "Tried to leave through front door",
                "intervention": "Played Sinatra music",
                "outcome": "resolved",
            },
        ],
    )
    assert "PAST INCIDENT 1" in result
    assert "Played Sinatra music" in result


def test_coach_prompt_includes_domain_knowledge():
    result = render_coach_prompt(
        patient_name="Mom",
        disease_stage="middle",
        behavioral_patterns=[],
        calming_strategies=[],
        safety_concerns=[],
    )
    assert "Clinical Domain Knowledge" in result
    assert "Always-On Screening" in result
    assert "delirium" in result.lower()


def test_coach_prompt_omits_dossier_when_empty():
    result = render_coach_prompt(
        patient_name="Mom",
        disease_stage="middle",
        behavioral_patterns=[],
        calming_strategies=[],
        safety_concerns=[],
    )
    assert "Behavioral History Dossier" not in result
    # The empty contraindicated DATA section must be omitted. (The static
    # self-check still references "the CONTRAINDICATED list above", so assert on
    # the section header, not the bare word.)
    assert "WARNING — CONTRAINDICATED INTERVENTIONS" not in result
    assert "PAST INCIDENT" not in result
