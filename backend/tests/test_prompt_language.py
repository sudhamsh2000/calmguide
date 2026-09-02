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


def test_resolve_language_supports_tamil():
    assert resolve_language("ta") == "Tamil"


def test_resolve_language_supports_tamil_regional_tag():
    assert resolve_language("ta-IN,ta;q=0.9,en-US;q=0.8") == "Tamil"


def test_resolve_language_supports_brazilian_portuguese_regional_tag():
    assert resolve_language("pt-BR,pt;q=0.9,en;q=0.8") == "Brazilian Portuguese"


def test_resolve_language_constraint_for_tamil():
    result = resolve_language_constraint("ta-IN,ta;q=0.9")
    assert "எழுத்துத் தமிழ்" in result
    assert "Do NOT mix Tamil with English" in result


def test_render_coach_prompt_includes_language_constraint():
    constraint = resolve_language_constraint("ta")
    result = render_coach_prompt(
        patient_name="Test",
        disease_stage="middle",
        behavioral_patterns=[],
        calming_strategies=[],
        safety_concerns=[],
        language="Tamil",
        language_constraint=constraint,
    )
    assert "எழுத்துத் தமிழ்" in result
    assert "அவர்" in result  # respectful register guidance


def test_request_locale_header_prefers_explicit_app_locale():
    assert get_request_locale_header("ta-IN", "en-IN,en;q=0.8") == "ta-IN"


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
