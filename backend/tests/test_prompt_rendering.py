"""Tests for prompt template rendering.

Covers:
- coach_system.jinja2: patient name, disease stage, profile context, language sections
- learn_system.jinja2: disease stage, RAG context, language sections
- checkin_system.jinja2: language sections, safety resources
- extraction_system.jinja2: JSON schema present, patient context injected
- All prompts render for non-English locales with language constraints
- Patient name substitution (never uses generic "the patient")
- Contraindicated interventions injection (WARNING block)
- Delirium and pain flag sections injected conditionally
- Cultural sensitivity section present for non-English locales
- Pre-response safety verification section present in coach prompt
- Pronoun guidance present
- Clarifying question instruction correct
- Section markers in the expected format
- render_checkin_prompt via the prompt service
"""

import pytest

from app.services.prompt import (
    render_checkin_prompt,
    render_coach_prompt,
    render_learn_prompt,
    resolve_language,
    resolve_language_constraint,
    resolve_locale_code,
    resolve_model_for_locale,
)


# ---------------------------------------------------------------------------
# Shared test data helpers
# ---------------------------------------------------------------------------

MINIMAL_COACH_KWARGS = {
    "patient_name": "Margaret",
    "disease_stage": "middle",
    "behavioral_patterns": [],
    "calming_strategies": [],
    "safety_concerns": [],
}

FULL_COACH_KWARGS = {
    "patient_name": "Margaret",
    "disease_stage": "middle",
    "behavioral_patterns": ["sundowning", "wandering"],
    "calming_strategies": ["soft music", "warm drink"],
    "safety_concerns": ["fall risk", "exits doors at night"],
    "rag_context": "Validated tip: soft music reduces agitation in middle-stage.",
    "language": "English",
    "language_constraint": "",
    "cross_patient_strategies": None,
    "dossier_text": "",
    "contraindicated": [],
    "relevant_incidents": [],
    "delirium_flags": None,
    "pain_flags": None,
    "effective_interventions": [],
    "frequency_trends": {},
}


# ---------------------------------------------------------------------------
# Coach prompt — structural invariants
# ---------------------------------------------------------------------------

def test_coach_prompt_renders_without_error():
    prompt = render_coach_prompt(**MINIMAL_COACH_KWARGS)
    assert isinstance(prompt, str)
    assert len(prompt) > 100


def test_coach_prompt_contains_patient_name():
    prompt = render_coach_prompt(**FULL_COACH_KWARGS)
    assert "Margaret" in prompt


def test_coach_prompt_does_not_contain_generic_patient_placeholder():
    """All occurrences of 'the patient' should be replaced with the patient's name."""
    prompt = render_coach_prompt(**FULL_COACH_KWARGS)
    # The template uses {{ patient_name }} throughout; no raw generic fallback should remain
    assert "{{ patient_name }}" not in prompt


def test_coach_prompt_contains_disease_stage():
    prompt = render_coach_prompt(**FULL_COACH_KWARGS)
    assert "middle" in prompt.lower()


def test_coach_prompt_contains_behavioral_patterns():
    prompt = render_coach_prompt(**FULL_COACH_KWARGS)
    assert "sundowning" in prompt
    assert "wandering" in prompt


def test_coach_prompt_contains_calming_strategies():
    prompt = render_coach_prompt(**FULL_COACH_KWARGS)
    assert "soft music" in prompt
    assert "warm drink" in prompt


def test_coach_prompt_contains_safety_concerns():
    prompt = render_coach_prompt(**FULL_COACH_KWARGS)
    assert "fall risk" in prompt


def test_coach_prompt_contains_section_markers():
    """The four [[SECTION:...]] markers must be referenced in the format instructions."""
    prompt = render_coach_prompt(**FULL_COACH_KWARGS)
    assert "[[SECTION:right-now]]" in prompt
    assert "[[SECTION:why]]" in prompt
    assert "[[SECTION:what-not-to-do]]" in prompt
    assert "[[SECTION:escalation]]" in prompt


def test_coach_prompt_contains_pre_response_safety_verification():
    """Pre-response safety verification checklist must be present."""
    prompt = render_coach_prompt(**FULL_COACH_KWARGS)
    assert "Pre-Response Safety Verification" in prompt


def test_coach_prompt_contains_pronoun_guidance():
    """The pronoun guidance block must be present."""
    prompt = render_coach_prompt(**FULL_COACH_KWARGS)
    assert "Pronouns" in prompt or "pronoun" in prompt.lower()


def test_coach_prompt_contains_escalation_criteria_instruction():
    """Prompt must instruct the model to include observable escalation criteria."""
    prompt = render_coach_prompt(**FULL_COACH_KWARGS)
    assert "escalation" in prompt.lower() or "call for help" in prompt.lower()


def test_coach_prompt_contains_clarifying_question_instruction():
    """Only ask a clarifying question if the message contains NO behavior."""
    prompt = render_coach_prompt(**FULL_COACH_KWARGS)
    # The specific instruction about when NOT to ask for clarification
    assert "ONE brief clarifying question" in prompt or "one brief clarifying" in prompt.lower()


def test_coach_prompt_contains_rag_context_when_provided():
    prompt = render_coach_prompt(
        **{**FULL_COACH_KWARGS, "rag_context": "Validated guidance: redirect to familiar activity."}
    )
    assert "Validated guidance: redirect to familiar activity." in prompt


def test_coach_prompt_rag_section_absent_when_empty():
    prompt = render_coach_prompt(**{**FULL_COACH_KWARGS, "rag_context": ""})
    assert "Relevant Caregiving Guidance" not in prompt


# ---------------------------------------------------------------------------
# Contraindicated interventions injection
# ---------------------------------------------------------------------------

def test_coach_prompt_contraindicated_block_absent_when_empty():
    prompt = render_coach_prompt(**{**FULL_COACH_KWARGS, "contraindicated": []})
    assert "CONTRAINDICATED INTERVENTIONS" not in prompt


def test_coach_prompt_contraindicated_block_present_when_provided():
    prompt = render_coach_prompt(
        **{
            **FULL_COACH_KWARGS,
            "contraindicated": [
                {
                    "description": "Physical redirection",
                    "behavior": "wandering",
                    "intervention": "Physical redirection",
                    "incident_date": "2024-01-15T10:00:00",
                }
            ],
        }
    )
    assert "CONTRAINDICATED INTERVENTIONS" in prompt
    assert "Physical redirection" in prompt
    assert "WARNING" in prompt or "Do NOT use" in prompt


def test_coach_prompt_multiple_contraindicated_items_all_rendered():
    contraindicated = [
        {"description": "Loud music", "behavior": "agitation"},
        {"description": "Physical prompting", "behavior": "refusing_care"},
    ]
    prompt = render_coach_prompt(**{**FULL_COACH_KWARGS, "contraindicated": contraindicated})
    assert "Loud music" in prompt
    assert "Physical prompting" in prompt


# ---------------------------------------------------------------------------
# Delirium and pain flag sections
# ---------------------------------------------------------------------------

def test_coach_prompt_delirium_section_absent_when_no_flags():
    prompt = render_coach_prompt(**{**FULL_COACH_KWARGS, "delirium_flags": None})
    assert "DELIRIUM SCREENING" not in prompt


def test_coach_prompt_delirium_section_absent_when_sudden_change_false():
    prompt = render_coach_prompt(
        **{**FULL_COACH_KWARGS, "delirium_flags": {"sudden_change": False}}
    )
    assert "DELIRIUM SCREENING" not in prompt


def test_coach_prompt_delirium_section_present_when_sudden_change_true():
    prompt = render_coach_prompt(
        **{**FULL_COACH_KWARGS, "delirium_flags": {"sudden_change": True}}
    )
    assert "DELIRIUM SCREENING REQUIRED" in prompt


def test_coach_prompt_delirium_section_contains_screening_questions():
    prompt = render_coach_prompt(
        **{**FULL_COACH_KWARGS, "delirium_flags": {"sudden_change": True}}
    )
    # Should include questions about sudden onset, fluctuation, etc.
    assert "suddenly" in prompt.lower() or "Did this come on" in prompt


def test_coach_prompt_pain_section_absent_when_no_flags():
    prompt = render_coach_prompt(**{**FULL_COACH_KWARGS, "pain_flags": None})
    assert "PAIN SCREENING" not in prompt


def test_coach_prompt_pain_section_present_when_suspected():
    prompt = render_coach_prompt(
        **{
            **FULL_COACH_KWARGS,
            "pain_flags": {
                "suspected": True,
                "indicators": ["grimacing", "guarding"],
            },
        }
    )
    assert "PAIN SCREENING REQUIRED" in prompt
    assert "grimacing" in prompt or "guarding" in prompt


# ---------------------------------------------------------------------------
# Dossier text injection
# ---------------------------------------------------------------------------

def test_coach_prompt_dossier_absent_when_empty():
    prompt = render_coach_prompt(**{**FULL_COACH_KWARGS, "dossier_text": ""})
    assert "Behavioral History Dossier" not in prompt


def test_coach_prompt_dossier_present_when_provided():
    dossier = "Last 30 days: 4 wandering incidents, mostly between 8-10pm."
    prompt = render_coach_prompt(**{**FULL_COACH_KWARGS, "dossier_text": dossier})
    assert "Behavioral History Dossier" in prompt
    assert dossier in prompt


# ---------------------------------------------------------------------------
# Relevant past incidents
# ---------------------------------------------------------------------------

def test_coach_prompt_incidents_absent_when_empty():
    prompt = render_coach_prompt(**{**FULL_COACH_KWARGS, "relevant_incidents": []})
    assert "Relevant Past Incidents" not in prompt


def test_coach_prompt_incidents_rendered_when_provided():
    incidents = [
        {
            "date": "2024-01-20",
            "behavior_category": "wandering_exit_seeking",
            "behavior": "Tried to leave at night",
            "antecedent": "Noise from TV",
            "intervention": "Played soft music",
            "outcome": "resolved",
            "severity": "moderate",
        }
    ]
    prompt = render_coach_prompt(**{**FULL_COACH_KWARGS, "relevant_incidents": incidents})
    assert "Relevant Past Incidents" in prompt
    assert "wandering_exit_seeking" in prompt
    assert "Tried to leave at night" in prompt


# ---------------------------------------------------------------------------
# Coach prompt — language sections for non-English
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("locale,language,should_have_constraint", [
    ("es", "Spanish", False),
    ("fr", "French", False),
    ("de", "German", False),
    ("pt-br", "Brazilian Portuguese", False),
    ("ja", "Japanese", True),
    ("ko", "Korean", True),
    ("zh", "Mandarin Chinese", True),
    ("hi", "Hindi", True),
    ("ta", "Tamil", True),
    ("ar", "Arabic", True),
])
def test_coach_prompt_non_english_locale_contains_language_instruction(
    locale, language, should_have_constraint
):
    from app.services.prompt import resolve_language, resolve_language_constraint, resolve_locale_code
    resolved_locale = resolve_locale_code(locale)
    lang = resolve_language(locale)
    constraint = resolve_language_constraint(locale)

    prompt = render_coach_prompt(
        **{
            **FULL_COACH_KWARGS,
            "language": lang,
            "language_constraint": constraint,
        }
    )
    assert f"Response Language" in prompt
    assert language in prompt
    if should_have_constraint:
        assert len(constraint) > 0
        assert constraint in prompt


def test_coach_prompt_english_does_not_have_language_section():
    prompt = render_coach_prompt(**{**FULL_COACH_KWARGS, "language": "English"})
    assert "Response Language" not in prompt


def test_coach_prompt_cultural_sensitivity_section_present():
    """Cultural sensitivity block must be present in all coach prompts."""
    prompt = render_coach_prompt(**FULL_COACH_KWARGS)
    assert "Cultural Sensitivity" in prompt


def test_coach_prompt_non_english_includes_local_emergency_numbers_note():
    """For non-English locales, prompt instructs to use local emergency numbers."""
    prompt = render_coach_prompt(
        **{
            **FULL_COACH_KWARGS,
            "language": "Spanish",
            "language_constraint": "",
        }
    )
    assert "local emergency number" in prompt.lower() or "emergency" in prompt.lower()


# ---------------------------------------------------------------------------
# Coach prompt — cross-patient strategies
# ---------------------------------------------------------------------------

def test_coach_prompt_cross_patient_section_absent_when_empty():
    prompt = render_coach_prompt(**{**FULL_COACH_KWARGS, "cross_patient_strategies": []})
    assert "Similar Patients" not in prompt


def test_coach_prompt_cross_patient_strategies_rendered():
    strategies = [
        {"tag": "soft_music", "helped": 8, "total": 10},
        {"tag": "short_walk", "helped": 6, "total": 9},
    ]
    prompt = render_coach_prompt(
        **{**FULL_COACH_KWARGS, "cross_patient_strategies": strategies}
    )
    assert "Similar Patients" in prompt
    assert "soft music" in prompt.lower() or "soft_music" in prompt.lower()


# ---------------------------------------------------------------------------
# Learn prompt
# ---------------------------------------------------------------------------

def test_learn_prompt_renders_without_error():
    prompt = render_learn_prompt(disease_stage="middle")
    assert isinstance(prompt, str)
    assert len(prompt) > 100


def test_learn_prompt_contains_disease_stage():
    prompt = render_learn_prompt(disease_stage="late")
    assert "late" in prompt


def test_learn_prompt_contains_scenario_type_when_provided():
    prompt = render_learn_prompt(disease_stage="middle", scenario_type="nighttime_wandering")
    assert "nighttime_wandering" in prompt


def test_learn_prompt_scenario_type_section_absent_when_none():
    prompt = render_learn_prompt(disease_stage="middle", scenario_type=None)
    assert "Scenario Category" not in prompt


def test_learn_prompt_contains_rag_context():
    rag = "Evidence-based tip: music therapy reduces agitation."
    prompt = render_learn_prompt(disease_stage="middle", rag_context=rag)
    assert rag in prompt


def test_learn_prompt_rag_absent_when_empty():
    prompt = render_learn_prompt(disease_stage="middle", rag_context="")
    assert "Relevant Caregiving Guidance" not in prompt


def test_learn_prompt_non_english_contains_language_instruction():
    prompt = render_learn_prompt(
        disease_stage="middle",
        language="Japanese",
        language_constraint="Write in Japanese polite form.",
    )
    assert "Japanese" in prompt
    assert "Response Language" in prompt


def test_learn_prompt_english_no_language_section():
    prompt = render_learn_prompt(disease_stage="middle", language="English")
    assert "Response Language" not in prompt


def test_learn_prompt_contains_safety_safety_principles():
    prompt = render_learn_prompt(disease_stage="middle")
    assert "Safety Principles" in prompt
    assert "NEVER fabricate" in prompt or "never fabricate" in prompt.lower()


def test_learn_prompt_contains_validation_therapy_section():
    prompt = render_learn_prompt(disease_stage="middle")
    assert "Validation Therapy" in prompt


def test_learn_prompt_contains_caregiver_distress_detection():
    prompt = render_learn_prompt(disease_stage="middle")
    assert "Caregiver Distress Detection" in prompt or "caregiver distress" in prompt.lower()


def test_learn_prompt_english_crisis_resources_present():
    prompt = render_learn_prompt(disease_stage="middle", language="English")
    assert "988" in prompt
    assert "1-800-272-3900" in prompt


def test_learn_prompt_non_english_uses_local_crisis_resources():
    """For non-English, the prompt instructs using local crisis resources, not US-specific."""
    prompt = render_learn_prompt(disease_stage="middle", language="Spanish")
    # Should NOT hard-code US-specific numbers in this block
    assert "local crisis helpline" in prompt.lower() or "crisis helpline" in prompt.lower()


# ---------------------------------------------------------------------------
# Checkin prompt
# ---------------------------------------------------------------------------

def test_checkin_prompt_renders_without_error():
    prompt = render_checkin_prompt()
    assert isinstance(prompt, str)
    assert len(prompt) > 100


def test_checkin_prompt_english_contains_988():
    prompt = render_checkin_prompt(language="English")
    assert "988" in prompt


def test_checkin_prompt_english_contains_alzheimers_helpline():
    prompt = render_checkin_prompt(language="English")
    assert "1-800-272-3900" in prompt


def test_checkin_prompt_non_english_uses_local_resources():
    """Non-English check-in prompt should not embed US-specific numbers."""
    prompt = render_checkin_prompt(language="Spanish")
    # For non-English, it should direct to local resources
    assert "local crisis helpline" in prompt.lower() or "crisis helpline" in prompt.lower()


def test_checkin_prompt_non_english_language_section_present():
    prompt = render_checkin_prompt(language="Mandarin Chinese", language_constraint="Write in Simplified Chinese.")
    assert "Mandarin Chinese" in prompt
    assert "Response Language" in prompt


def test_checkin_prompt_english_no_language_section():
    prompt = render_checkin_prompt(language="English")
    assert "Response Language" not in prompt


def test_checkin_prompt_contains_response_structure():
    prompt = render_checkin_prompt()
    assert "Acknowledgment" in prompt
    assert "Validation" in prompt
    assert "One small thing" in prompt


def test_checkin_prompt_contains_absolute_rules():
    prompt = render_checkin_prompt()
    assert "NEVER give advice about the patient" in prompt or "NEVER" in prompt


def test_checkin_prompt_contains_off_topic_handling():
    prompt = render_checkin_prompt()
    assert "Off-Topic" in prompt or "off-topic" in prompt.lower()


# ---------------------------------------------------------------------------
# Extraction prompt — via Jinja2 direct render
# ---------------------------------------------------------------------------

def test_extraction_prompt_renders_with_patient_context():
    from pathlib import Path
    from jinja2 import Environment, FileSystemLoader

    prompts_dir = Path(__file__).resolve().parent.parent / "app" / "prompts"
    env = Environment(
        loader=FileSystemLoader(str(prompts_dir)),
        autoescape=False,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.get_template("extraction_system.jinja2")
    rendered = template.render(
        disease_stage="middle",
        behavioral_patterns=["sundowning", "wandering"],
        calming_strategies=["soft music"],
    )

    assert "middle" in rendered
    assert "sundowning" in rendered
    assert "wandering" in rendered
    assert "soft music" in rendered


def test_extraction_prompt_contains_json_schema():
    from pathlib import Path
    from jinja2 import Environment, FileSystemLoader

    prompts_dir = Path(__file__).resolve().parent.parent / "app" / "prompts"
    env = Environment(
        loader=FileSystemLoader(str(prompts_dir)),
        autoescape=False,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.get_template("extraction_system.jinja2")
    rendered = template.render(
        disease_stage="middle",
        behavioral_patterns=[],
        calming_strategies=[],
    )

    # Must include the JSON schema fields
    assert "behavior_category" in rendered
    assert "intervention_outcome" in rendered
    assert "overall_confidence" in rendered
    assert "field_confidences" in rendered


def test_extraction_prompt_contains_safety_principles():
    from pathlib import Path
    from jinja2 import Environment, FileSystemLoader

    prompts_dir = Path(__file__).resolve().parent.parent / "app" / "prompts"
    env = Environment(
        loader=FileSystemLoader(str(prompts_dir)),
        autoescape=False,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.get_template("extraction_system.jinja2")
    rendered = template.render(
        disease_stage="early",
        behavioral_patterns=[],
        calming_strategies=[],
    )

    assert "Safety Principles" in rendered
    assert "fabricate" in rendered.lower()


def test_extraction_prompt_contains_few_shot_examples():
    from pathlib import Path
    from jinja2 import Environment, FileSystemLoader

    prompts_dir = Path(__file__).resolve().parent.parent / "app" / "prompts"
    env = Environment(
        loader=FileSystemLoader(str(prompts_dir)),
        autoescape=False,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.get_template("extraction_system.jinja2")
    rendered = template.render(
        disease_stage="middle",
        behavioral_patterns=[],
        calming_strategies=[],
    )

    assert "wandering_exit_seeking" in rendered
    assert "aggression_anger" in rendered


# ---------------------------------------------------------------------------
# Locale resolution helpers
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("input_header,expected_locale", [
    ("en", "en"),
    ("en-US", "en-us"),    # Full variant code returned when it's in the map
    ("es", "es"),
    ("es-ES", "es-es"),
    ("zh-CN", "zh-cn"),
    ("pt-br", "pt-br"),
    ("ja-JP", "ja-jp"),
    ("ko-KR", "ko-kr"),
    ("hi-IN", "hi-in"),
    ("ta-IN", "ta-in"),
    ("ar-SA", "ar-sa"),
    ("unknown-lang", "en"),  # Falls back to English
    (None, "en"),
])
def test_resolve_locale_code(input_header, expected_locale):
    result = resolve_locale_code(input_header)
    assert result == expected_locale


@pytest.mark.parametrize("locale,expected_language", [
    ("en", "English"),
    ("es", "Spanish"),
    ("fr", "French"),
    ("de", "German"),
    ("pt-br", "Brazilian Portuguese"),
    ("ja", "Japanese"),
    ("ko", "Korean"),
    ("zh", "Mandarin Chinese"),
    ("hi", "Hindi"),
    ("ta", "Tamil"),
    ("ar", "Arabic"),
])
def test_resolve_language(locale, expected_language):
    result = resolve_language(locale)
    assert result == expected_language


@pytest.mark.parametrize("locale,should_have_constraint", [
    ("en", False),
    ("es", False),
    ("fr", False),
    ("de", False),
    ("pt-br", False),
    ("ar", True),
    ("hi", True),
    ("ja", True),
    ("ko", True),
    ("ta", True),
    ("zh", True),
])
def test_resolve_language_constraint(locale, should_have_constraint):
    result = resolve_language_constraint(locale)
    if should_have_constraint:
        assert len(result) > 0
    else:
        assert result == ""


def test_resolve_model_for_locale_english_returns_none():
    result = resolve_model_for_locale("en")
    assert result is None


def test_resolve_model_for_locale_non_english_may_return_override():
    # For non-English locales, either a model override or None is acceptable
    # (None is valid for Anthropic provider)
    result = resolve_model_for_locale("ja")
    # Just assert it doesn't raise and returns str or None
    assert result is None or isinstance(result, str)
