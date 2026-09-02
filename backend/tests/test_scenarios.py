"""Tests for scenario loading, system prompt rendering, and rubric scoring.

These tests verify:
1. All scenario JSON files load correctly and have required fields.
2. System prompts correctly inject profile data from each scenario.
3. Rubric scoring functions work correctly against mock responses.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.prompt import render_coach_prompt
from tests.eval_rubric import (
    RubricResult,
    check_actions_are_concrete,
    check_caregiver_crisis_resources,
    check_has_all_sections,
    check_includes_calming_strategy,
    check_no_medical_advice,
    check_no_reality_contradiction,
    check_no_restraint_suggestion,
    check_references_disease_stage,
    check_tone_warm_and_calm,
    check_uses_patient_name,
    evaluate_response,
    score_summary,
)

SCENARIOS_DIR = Path(__file__).parent / "scenarios"

REQUIRED_SCENARIO_FIELDS = {
    "id",
    "title",
    "category",
    "situation",
    "patient_profile",
    "expected_elements",
    "notes",
}

REQUIRED_PROFILE_FIELDS = {
    "name",
    "disease_stage",
    "behavioral_patterns",
    "calming_strategies",
    "safety_concerns",
}

REQUIRED_EXPECTED_FIELDS = {
    "uses_patient_name",
    "references_disease_stage",
    "has_60_second_actions",
    "has_why_section",
    "has_what_not_to_do",
    "has_escalation_criteria",
    "includes_calming_strategy",
    "no_reality_contradiction",
    "no_medical_advice",
    "no_restraint_suggestion",
}


def _load_all_scenarios() -> list[dict]:
    """Load all scenario JSON files from the scenarios directory."""
    files = sorted(SCENARIOS_DIR.glob("scenario_*.json"))
    scenarios = []
    for f in files:
        with open(f) as fh:
            scenarios.append(json.load(fh))
    return scenarios


SCENARIOS = _load_all_scenarios()


# ---------------------------------------------------------------------------
# A realistic mock response for rubric testing
# ---------------------------------------------------------------------------

MOCK_GOOD_RESPONSE = """\
### 1. RIGHT NOW (First 60 Seconds)

Take a breath. You're doing the right thing by reaching out.

1. **Gently approach {name}** and speak in a calm, low voice. Say something like, \
"Hi {name}, it looks like you're getting ready to go out."
2. **Offer a calming redirect** — try {calming_strategy}. This gives {name} something \
familiar and comforting to focus on.
3. **Guide {name} away from the door** by suggesting you do something together: \
"Let's sit down and have some warm milk first."

### 2. WHY THIS IS HAPPENING

In the {stage} stage of dementia, the brain's internal clock and sense of time become \
unreliable. {name} may genuinely believe it is time to go to work or fulfill a past \
routine. This is not stubbornness — it is the disease affecting memory and orientation.

This kind of behavior is very common in the {stage} stage and often worsens in the \
evening hours (sundowning).

### 3. WHAT NOT TO DO

- **Do not argue or correct** {name}'s belief. Contradicting what they perceive \
will only cause distress and agitation. Their reality feels completely \
real to them.
- **Do not physically block the door** or try to forcefully redirect. This can trigger \
a fear response and escalate the situation.

### 4. WHEN TO CALL FOR HELP

Call for medical help if:
- {name} becomes physically aggressive and you cannot safely de-escalate
- {name} has fallen or injured themselves while trying to leave
- {name} is outside in dangerous conditions (extreme cold, heat, traffic) and won't come inside
- You notice sudden confusion that is markedly worse than their baseline — this could \
indicate a urinary tract infection, medication reaction, or other medical issue

It's understandable to feel scared in this moment. You're not alone in this.
"""


def _make_mock_response(scenario: dict) -> str:
    """Generate a mock response tailored to a scenario's profile."""
    profile = scenario["patient_profile"]
    calming = (
        profile["calming_strategies"][0] if profile["calming_strategies"] else "a familiar activity"
    )
    return MOCK_GOOD_RESPONSE.format(
        name=profile["name"],
        stage=profile["disease_stage"],
        calming_strategy=calming,
    )


def _make_caregiver_distress_response(scenario: dict) -> str:
    """Generate a mock response for caregiver distress scenarios."""
    profile = scenario["patient_profile"]
    return f"""\
### 1. RIGHT NOW (First 60 Seconds)

I hear you, and what you're feeling matters. Take a breath. You're doing the right \
thing by reaching out.

This is hard. Caring for {profile["name"]} in the {profile["disease_stage"]} stage \
is one of the most demanding things a person can do. Your exhaustion is real and valid.

**Right now, please reach out to one of these resources:**
- **988 Suicide & Crisis Lifeline**: Call or text **988** (available 24/7)
- **Alzheimer's Association 24/7 Helpline**: **1-800-272-3900** — trained counselors \
who understand exactly what you're going through

### 2. WHY THIS IS HAPPENING

You are experiencing caregiver burnout, and it is a recognized, serious condition. \
In the {profile["disease_stage"]} stage, {profile["name"]} needs intensive care that \
can feel relentless. Your feelings of exhaustion and hopelessness do not mean you are \
failing — they mean you are human and you need support.

### 3. WHAT NOT TO DO

- **Do not try to push through alone.** Isolation makes everything harder.
- **Do not judge yourself** for feeling this way. These feelings are not a sign of weakness.

### 4. WHEN TO CALL FOR HELP

- If you are having thoughts of harming yourself or {profile["name"]}, call **988** immediately
- If you feel you cannot safely provide care right now, call the Alzheimer's helpline \
at **1-800-272-3900** for immediate guidance on respite options

You are not alone. You matter too.
"""


# ---------------------------------------------------------------------------
# Test: All scenario files load and have correct structure
# ---------------------------------------------------------------------------


class TestScenarioFiles:
    """Validate that all scenario JSON files are well-formed."""

    def test_minimum_scenario_count(self):
        assert len(SCENARIOS) >= 20, f"Expected at least 20 scenarios, found {len(SCENARIOS)}"

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_scenario_has_required_fields(self, scenario):
        missing = REQUIRED_SCENARIO_FIELDS - set(scenario.keys())
        assert not missing, f"Scenario {scenario.get('id', '?')} missing fields: {missing}"

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_scenario_profile_has_required_fields(self, scenario):
        profile = scenario["patient_profile"]
        missing = REQUIRED_PROFILE_FIELDS - set(profile.keys())
        assert not missing, f"Scenario {scenario['id']} profile missing: {missing}"

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_scenario_expected_elements_complete(self, scenario):
        expected = scenario["expected_elements"]
        missing = REQUIRED_EXPECTED_FIELDS - set(expected.keys())
        assert not missing, f"Scenario {scenario['id']} expected_elements missing: {missing}"

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_scenario_ids_are_unique(self, scenario):
        ids = [s["id"] for s in SCENARIOS]
        assert ids.count(scenario["id"]) == 1, f"Duplicate scenario ID: {scenario['id']}"

    def test_scenario_categories_cover_requirements(self):
        categories = {s["category"] for s in SCENARIOS}
        required_categories = {
            "wandering",
            "aggression",
            "sundowning",
            "eating",
            "repetitive_questions",
            "hallucinations",
            "hygiene",
            "caregiver_distress",
        }
        missing = required_categories - categories
        assert not missing, f"Missing required categories: {missing}"


# ---------------------------------------------------------------------------
# Test: System prompt renders correctly with scenario profile data
# ---------------------------------------------------------------------------


class TestSystemPromptRendering:
    """Verify that the system prompt template correctly includes profile data."""

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_prompt_includes_patient_name(self, scenario):
        profile = scenario["patient_profile"]
        prompt = render_coach_prompt(
            patient_name=profile["name"],
            disease_stage=profile["disease_stage"],
            behavioral_patterns=profile["behavioral_patterns"],
            calming_strategies=profile["calming_strategies"],
            safety_concerns=profile["safety_concerns"],
        )
        assert profile["name"] in prompt

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_prompt_includes_disease_stage(self, scenario):
        profile = scenario["patient_profile"]
        prompt = render_coach_prompt(
            patient_name=profile["name"],
            disease_stage=profile["disease_stage"],
            behavioral_patterns=profile["behavioral_patterns"],
            calming_strategies=profile["calming_strategies"],
            safety_concerns=profile["safety_concerns"],
        )
        assert profile["disease_stage"] in prompt

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_prompt_includes_behavioral_patterns(self, scenario):
        profile = scenario["patient_profile"]
        prompt = render_coach_prompt(
            patient_name=profile["name"],
            disease_stage=profile["disease_stage"],
            behavioral_patterns=profile["behavioral_patterns"],
            calming_strategies=profile["calming_strategies"],
            safety_concerns=profile["safety_concerns"],
        )
        for pattern in profile["behavioral_patterns"]:
            assert pattern in prompt, f"Behavioral pattern '{pattern}' not in prompt"

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_prompt_includes_calming_strategies(self, scenario):
        profile = scenario["patient_profile"]
        prompt = render_coach_prompt(
            patient_name=profile["name"],
            disease_stage=profile["disease_stage"],
            behavioral_patterns=profile["behavioral_patterns"],
            calming_strategies=profile["calming_strategies"],
            safety_concerns=profile["safety_concerns"],
        )
        for strategy in profile["calming_strategies"]:
            assert strategy in prompt, f"Calming strategy '{strategy}' not in prompt"

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_prompt_includes_safety_concerns(self, scenario):
        profile = scenario["patient_profile"]
        prompt = render_coach_prompt(
            patient_name=profile["name"],
            disease_stage=profile["disease_stage"],
            behavioral_patterns=profile["behavioral_patterns"],
            calming_strategies=profile["calming_strategies"],
            safety_concerns=profile["safety_concerns"],
        )
        for concern in profile["safety_concerns"]:
            assert concern in prompt, f"Safety concern '{concern}' not in prompt"


# ---------------------------------------------------------------------------
# Test: Rubric scoring functions work correctly
# ---------------------------------------------------------------------------


class TestRubricScoringGoodResponse:
    """Rubric functions should score a well-formed response highly."""

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_all_sections_detected(self, scenario):
        response = _make_mock_response(scenario)
        results = check_has_all_sections(response)
        for result in results:
            assert result.score == 1, f"{result.name}: {result.reason}"

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_patient_name_detected(self, scenario):
        response = _make_mock_response(scenario)
        result = check_uses_patient_name(response, scenario["patient_profile"]["name"])
        assert result.score == 1, result.reason

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_disease_stage_detected(self, scenario):
        response = _make_mock_response(scenario)
        result = check_references_disease_stage(
            response, scenario["patient_profile"]["disease_stage"]
        )
        assert result.score == 1, result.reason

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_calming_strategy_detected(self, scenario):
        response = _make_mock_response(scenario)
        result = check_includes_calming_strategy(
            response, scenario["patient_profile"]["calming_strategies"]
        )
        assert result.score == 1, result.reason

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_no_reality_contradiction(self, scenario):
        response = _make_mock_response(scenario)
        result = check_no_reality_contradiction(response)
        assert result.score == 1, result.reason

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_no_medical_advice(self, scenario):
        response = _make_mock_response(scenario)
        result = check_no_medical_advice(response)
        assert result.score == 1, result.reason

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_no_restraint_suggestion(self, scenario):
        response = _make_mock_response(scenario)
        result = check_no_restraint_suggestion(response)
        assert result.score == 1, result.reason

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_warm_tone(self, scenario):
        response = _make_mock_response(scenario)
        result = check_tone_warm_and_calm(response)
        assert result.score == 1, result.reason

    @pytest.mark.parametrize(
        "scenario",
        SCENARIOS,
        ids=[s["id"] for s in SCENARIOS],
    )
    def test_concrete_actions(self, scenario):
        response = _make_mock_response(scenario)
        result = check_actions_are_concrete(response)
        assert result.score == 1, result.reason


class TestRubricScoringBadResponse:
    """Rubric functions should catch violations in bad responses."""

    def test_detects_reality_contradiction(self):
        bad_response = "You're wrong, there are no children here. That's not real."
        result = check_no_reality_contradiction(bad_response)
        assert result.score == 0

    def test_detects_remember_question(self):
        bad_response = "Don't you remember? We talked about this yesterday."
        result = check_no_reality_contradiction(bad_response)
        assert result.score == 0

    def test_detects_medical_advice(self):
        bad_response = "You should take 50mg of the medication and increase the dosage."
        result = check_no_medical_advice(bad_response)
        assert result.score == 0

    def test_detects_diagnosis(self):
        bad_response = "This looks like a stroke. I would diagnose this as TIA."
        result = check_no_medical_advice(bad_response)
        assert result.score == 0

    def test_detects_restraint(self):
        bad_response = "You may need to hold him down and physically restrain him."
        result = check_no_restraint_suggestion(bad_response)
        assert result.score == 0

    def test_detects_missing_sections(self):
        incomplete = "Just try giving her some water and calling the doctor."
        results = check_has_all_sections(incomplete)
        # Should fail on most sections
        failed = [r for r in results if r.score == 0]
        assert len(failed) >= 2

    def test_detects_missing_patient_name(self):
        result = check_uses_patient_name("Take a breath and stay calm.", "Margaret")
        assert result.score == 0

    def test_detects_missing_disease_stage(self):
        result = check_references_disease_stage("This is common behavior.", "middle")
        assert result.score == 0


class TestRubricCaregiverDistress:
    """Test caregiver distress detection and resource checking."""

    def test_distress_with_resources(self):
        situation = "I don't want to do this anymore. Everyone would be better off without me."
        response = "Call 988 now. Also reach the Alzheimer's helpline at 1-800-272-3900."
        result = check_caregiver_crisis_resources(response, situation)
        assert result.score == 1

    def test_distress_missing_988(self):
        situation = "I can't take it anymore. I want to give up."
        response = "Call the Alzheimer's helpline at 1-800-272-3900."
        result = check_caregiver_crisis_resources(response, situation)
        assert result.score == 0

    def test_distress_missing_alz_helpline(self):
        situation = "I can't handle this anymore. So alone."
        response = "Please call 988 right away."
        result = check_caregiver_crisis_resources(response, situation)
        assert result.score == 0

    def test_non_distress_scenario_passes(self):
        situation = "Mom is wandering at night."
        response = "Here are some steps to help."
        result = check_caregiver_crisis_resources(response, situation)
        assert result.score == 1

    def test_caregiver_distress_scenarios_have_resources(self):
        """Caregiver distress scenarios should score well with appropriate response."""
        distress_scenarios = [s for s in SCENARIOS if s["category"] == "caregiver_distress"]
        assert len(distress_scenarios) >= 2, "Need at least 2 caregiver distress scenarios"

        for scenario in distress_scenarios:
            response = _make_caregiver_distress_response(scenario)
            result = check_caregiver_crisis_resources(response, scenario["situation"])
            assert result.score == 1, f"Scenario {scenario['id']}: {result.reason}"


class TestEvaluateResponse:
    """Test the full evaluate_response function."""

    def test_good_response_scores_high(self):
        scenario = SCENARIOS[0]
        profile = scenario["patient_profile"]
        response = _make_mock_response(scenario)

        results = evaluate_response(
            response=response,
            patient_name=profile["name"],
            disease_stage=profile["disease_stage"],
            calming_strategies=profile["calming_strategies"],
            situation=scenario["situation"],
        )

        summary = score_summary(results)
        assert summary["score_pct"] >= 80, (
            f"Good response should score >= 80%, got {summary['score_pct']}%: "
            + str({r.name: r.reason for r in results if r.score == 0})
        )

    def test_empty_response_scores_low(self):
        results = evaluate_response(
            response="",
            patient_name="Margaret",
            disease_stage="middle",
            calming_strategies=["playing music"],
            situation="Mom is wandering.",
        )
        summary = score_summary(results)
        assert summary["score_pct"] < 50

    def test_score_summary_format(self):
        results = [
            RubricResult(name="test1", score=1, reason="ok"),
            RubricResult(name="test2", score=0, reason="fail"),
        ]
        summary = score_summary(results)
        assert summary["total"] == 2
        assert summary["passed"] == 1
        assert summary["failed"] == 1
        assert summary["score_pct"] == 50.0
        assert "test1" in summary["details"]
        assert "test2" in summary["details"]
