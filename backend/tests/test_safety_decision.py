"""Safety Gate v2 Phase 2 — structured decision model tests.

Scope per docs/SAFETY_GATE_V2_PLAN.md: verify the new SafetyDecision model
correctly represents *existing* safety behavior (no routing/control-flow
changes yet — that's Phase 5). These tests intentionally do not touch
coach.py/checkin.py, which are unchanged in this phase.
"""

import dataclasses

import pytest

from app.services.safety_classifier import SafetyRiskCategory, classify_message
from app.services.safety_decision import (
    RiskLevel,
    SafetyAction,
    SafetyDecision,
    SafetyDecisionSource,
    decision_from_classifier_result,
    decision_from_gate_result,
    evaluate_safety_v2,
)
from app.services.safety_gate import SafetyGateType, check_safety_gate


class TestEnumConsolidation:
    """Phase 2 item 1: SafetyRiskCategory must be the same type as
    SafetyGateType, not a separately-defined value-equal enum."""

    def test_safety_risk_category_is_safety_gate_type(self):
        assert SafetyRiskCategory is SafetyGateType

    def test_members_are_identical_objects(self):
        assert SafetyRiskCategory.LIFE_THREAT is SafetyGateType.LIFE_THREAT
        assert SafetyRiskCategory.SELF_HARM is SafetyGateType.SELF_HARM
        assert SafetyRiskCategory.CAREGIVER_HARM_RISK is SafetyGateType.CAREGIVER_HARM_RISK
        assert SafetyRiskCategory.ELDER_ABUSE_NEGLECT is SafetyGateType.ELDER_ABUSE_NEGLECT

    def test_classifier_result_category_is_a_safety_gate_type_instance(self):
        # No more `SafetyGateType(classifier_result.category.value)` bridging
        # needed for new code — the value is already the canonical type.
        result = classify_message("I might snap and hurt him, I'm so afraid of what I'll do")
        assert result.flagged
        assert isinstance(result.category, SafetyGateType)


class TestSafetyDecisionSerializationAndEquality:
    def test_two_equivalent_decisions_are_equal(self):
        a = SafetyDecision(
            triggered=True,
            category=SafetyGateType.LIFE_THREAT,
            risk_level=RiskLevel.EMERGENCY,
            action=SafetyAction.EMERGENCY_ESCALATION,
            allow_rag=False,
            allow_llm=False,
            requires_escalation=True,
            source=SafetyDecisionSource.DETERMINISTIC_GATE,
        )
        b = SafetyDecision(
            triggered=True,
            category=SafetyGateType.LIFE_THREAT,
            risk_level=RiskLevel.EMERGENCY,
            action=SafetyAction.EMERGENCY_ESCALATION,
            allow_rag=False,
            allow_llm=False,
            requires_escalation=True,
            source=SafetyDecisionSource.DETERMINISTIC_GATE,
        )
        assert a == b

    def test_differing_confidence_breaks_equality(self):
        base = dict(
            triggered=True,
            category=SafetyGateType.SELF_HARM,
            risk_level=RiskLevel.EMERGENCY,
            action=SafetyAction.EMERGENCY_ESCALATION,
            allow_rag=False,
            allow_llm=False,
            requires_escalation=True,
            source=SafetyDecisionSource.CLASSIFIER,
        )
        a = SafetyDecision(**base, confidence=0.8)
        b = SafetyDecision(**base, confidence=0.9)
        assert a != b

    def test_serializes_via_dataclasses_asdict(self):
        decision = evaluate_safety_v2("he keeps wandering at night, what should I do")
        as_dict = dataclasses.asdict(decision)
        assert as_dict["risk_level"] == "low"
        assert as_dict["action"] == "normal_guidance"
        assert as_dict["allow_rag"] is True
        assert as_dict["allow_llm"] is True
        assert as_dict["matched_concepts"] == ()
        assert as_dict["category"] == "routine_caregiver_issue"

    def test_is_frozen_and_immutable(self):
        decision = evaluate_safety_v2("a calm ordinary caregiving question")
        with pytest.raises(dataclasses.FrozenInstanceError):
            decision.risk_level = RiskLevel.HIGH  # type: ignore[misc]


class TestExistingEmergencyMapping:
    """Every existing gate/classifier category maps to EMERGENCY /
    EMERGENCY_ESCALATION / allow_rag=False / allow_llm=False /
    requires_escalation=True — matching today's actual runtime behavior
    (every trigger bypasses RAG+LLM identically), not inventing tiers.

    Category equality is only asserted for the three categories Phase 3
    does not refine (SELF_HARM, CAREGIVER_HARM_RISK, ELDER_ABUSE_NEGLECT).
    LIFE_THREAT refinement (e.g. "not breathing" -> BREATHING_DIFFICULTY)
    is covered separately in test_safety_categories.py.
    """

    @pytest.mark.parametrize(
        "message,expected_category",
        [
            ("I want to kill myself", SafetyGateType.SELF_HARM),
            (
                "I'm afraid I might hurt him, I feel like I'm going to snap",
                SafetyGateType.CAREGIVER_HARM_RISK,
            ),
            (
                "the aide hits him and I don't know what to do",
                SafetyGateType.ELDER_ABUSE_NEGLECT,
            ),
        ],
    )
    def test_deterministic_gate_trigger_maps_to_emergency(self, message, expected_category):
        gate_result = check_safety_gate(message)
        assert gate_result.triggered, f"expected gate to trigger on: {message}"
        decision = decision_from_gate_result(message, gate_result)
        assert decision.triggered is True
        assert decision.risk_level is RiskLevel.EMERGENCY
        assert decision.action is SafetyAction.EMERGENCY_ESCALATION
        assert decision.allow_rag is False
        assert decision.allow_llm is False
        assert decision.requires_escalation is True
        assert decision.source is SafetyDecisionSource.DETERMINISTIC_GATE
        assert decision.category == expected_category

    def test_life_threat_gate_trigger_without_a_refinable_pattern_stays_life_threat(self):
        # "heart attack" has no breathing/consciousness/fall sub-pattern —
        # refinement must fall back to the original coarse category.
        gate_result = check_safety_gate("he is having a heart attack")
        assert gate_result.gate_type is SafetyGateType.LIFE_THREAT
        decision = decision_from_gate_result("he is having a heart attack", gate_result)
        assert decision.category is SafetyGateType.LIFE_THREAT

    def test_classifier_only_trigger_maps_to_emergency(self):
        # A phrasing that reliably clears the classifier's fuzzy threshold
        # without matching any deterministic-gate regex verbatim.
        message = "afraid of what I'll do, going to lose it"
        result = classify_message(message)
        assert result.flagged, "expected classifier to flag this paraphrase"
        decision = decision_from_classifier_result(message, result)
        assert decision.risk_level is RiskLevel.EMERGENCY
        assert decision.action is SafetyAction.EMERGENCY_ESCALATION
        assert decision.allow_rag is False
        assert decision.allow_llm is False
        assert decision.requires_escalation is True
        assert decision.source is SafetyDecisionSource.CLASSIFIER
        assert decision.confidence == result.confidence
        assert decision.matched_concepts == tuple(result.matched_concepts)

    def test_evaluate_safety_v2_end_to_end_emergency(self):
        decision = evaluate_safety_v2("he is having a heart attack")
        assert decision.triggered is True
        assert decision.risk_level is RiskLevel.EMERGENCY
        assert decision.source is SafetyDecisionSource.DETERMINISTIC_GATE

    def test_gate_takes_priority_over_classifier_when_both_would_match(self):
        # "kill myself" matches the deterministic self-harm regex directly;
        # decision_from_classifier_result must never even be consulted for
        # this input via evaluate_safety_v2 — the gate result wins.
        decision = evaluate_safety_v2("I want to kill myself")
        assert decision.source is SafetyDecisionSource.DETERMINISTIC_GATE


class TestExistingNormalMapping:
    @pytest.mark.parametrize(
        "message",
        [
            "he keeps wandering at night and I don't know what to do",
            "what's the best way to get my mom to take her medication",
            "she keeps asking the same question over and over, it's exhausting",
        ],
    )
    def test_benign_message_maps_to_low_normal(self, message):
        decision = evaluate_safety_v2(message)
        assert decision.triggered is False
        assert decision.category is SafetyGateType.ROUTINE_CAREGIVER_ISSUE
        assert decision.risk_level is RiskLevel.LOW
        assert decision.action is SafetyAction.NORMAL_GUIDANCE
        assert decision.allow_rag is True
        assert decision.allow_llm is True
        assert decision.requires_escalation is False
        assert decision.source is SafetyDecisionSource.NONE
        assert decision.confidence is None
        assert decision.matched_concepts == ()

    def test_empty_message_maps_to_low_normal(self):
        decision = evaluate_safety_v2("")
        assert decision.risk_level is RiskLevel.LOW
        assert decision.action is SafetyAction.NORMAL_GUIDANCE


class TestNoBehavioralRegression:
    """Confirms wrapping the classifier's category enum did not change what
    check_safety_gate/classify_message themselves return — Phase 2 must not
    alter existing safety behavior, only add a model on top of it."""

    def test_known_false_positive_fix_still_holds(self):
        # The "what to do" vs "want to die" fix (docs/AUDIT.md 2026-09-07)
        # must still be intact after the enum consolidation.
        result = classify_message("he keeps wandering at night and I don't know what to do")
        assert result.flagged is False

    def test_known_true_positive_still_flags(self):
        gate_result = check_safety_gate("he had a heart attack")
        assert gate_result.triggered is True
        assert gate_result.gate_type is SafetyGateType.LIFE_THREAT

    def test_passed_out_flyers_carve_out_still_holds(self):
        gate_result = check_safety_gate("I passed out flyers for the caregiver support group today")
        assert gate_result.triggered is False


class TestPhase5IndependentDetectorEmergency:
    """Safety Gate v2 Phase 5: safety_categories.py now acts as an
    independent detection source for BREATHING_DIFFICULTY,
    REDUCED_CONSCIOUSNESS, and FALL_OR_HEAD_INJURY — not merely a
    refinement of an already-triggered LIFE_THREAT. These specific
    phrasings do not trip the deterministic gate or classify_message on
    their own (confirmed in Phase 3), so this is the only path that makes
    them escalate end-to-end at all."""

    @pytest.mark.parametrize(
        "message,expected_category",
        [
            ("can't catch his breath", SafetyGateType.BREATHING_DIFFICULTY),
            ("struggling to breathe", SafetyGateType.BREATHING_DIFFICULTY),
            ("fell and hit his head", SafetyGateType.FALL_OR_HEAD_INJURY),
            ("fell and now seems confused", SafetyGateType.FALL_OR_HEAD_INJURY),
            ("not responding", SafetyGateType.REDUCED_CONSCIOUSNESS),
        ],
    )
    def test_independent_detection_now_escalates(self, message, expected_category):
        decision = evaluate_safety_v2(message)
        assert decision.risk_level is RiskLevel.EMERGENCY
        assert decision.action is SafetyAction.EMERGENCY_ESCALATION
        assert decision.allow_rag is False
        assert decision.allow_llm is False
        assert decision.requires_escalation is True
        assert decision.category is expected_category
        assert decision.source is SafetyDecisionSource.CATEGORY_DETECTOR

    def test_benign_lookalikes_still_do_not_escalate(self):
        for message in [
            "he almost fell asleep during the movie",
            "she fell behind on her routine this week",
            "I passed out flyers for the caregiver support group today",
        ]:
            decision = evaluate_safety_v2(message)
            assert decision.risk_level is RiskLevel.LOW, f"false positive on: {message}"

    def test_gate_and_classifier_still_take_priority(self):
        # An explicit deterministic-gate/classifier match must still win
        # over the independent detector — the detector is only ever
        # consulted when both of those stayed silent.
        decision = evaluate_safety_v2("he is not breathing")
        assert decision.source is SafetyDecisionSource.DETERMINISTIC_GATE


class TestPhase5HighAndModerateRouting:
    """Safety Gate v2 Phase 5: ACUTE_CHANGE -> HIGH (skips RAG/LLM, routes
    to the existing acute-change advisory message); MEDICATION_RISK ->
    MODERATE (proceeds through normal generation — the existing system
    prompt already constrains it, so nothing is skipped)."""

    def test_acute_change_maps_to_high_and_skips_rag_and_llm(self):
        decision = evaluate_safety_v2("he suddenly seems much more confused")
        assert decision.triggered is True
        assert decision.category is SafetyGateType.ACUTE_CHANGE
        assert decision.risk_level is RiskLevel.HIGH
        assert decision.action is SafetyAction.CONTACT_CLINICIAN
        assert decision.allow_rag is False
        assert decision.allow_llm is False
        assert decision.requires_escalation is True
        assert decision.source is SafetyDecisionSource.CATEGORY_DETECTOR

    def test_medication_risk_maps_to_moderate_and_does_not_skip_generation(self):
        decision = evaluate_safety_v2("should I increase his dose?")
        assert decision.triggered is True
        assert decision.category is SafetyGateType.MEDICATION_RISK
        assert decision.risk_level is RiskLevel.MODERATE
        assert decision.action is SafetyAction.CONSTRAINED_GUIDANCE
        assert decision.allow_rag is True
        assert decision.allow_llm is True
        assert decision.requires_escalation is False
        assert decision.source is SafetyDecisionSource.CATEGORY_DETECTOR

    @pytest.mark.parametrize(
        "message",
        [
            "he takes donepezil",
            "she started a new medication last week",
            "his medication is on the table",
        ],
    )
    def test_ordinary_medication_mention_stays_low(self, message):
        decision = evaluate_safety_v2(message)
        assert decision.risk_level is RiskLevel.LOW
        assert decision.category is SafetyGateType.ROUTINE_CAREGIVER_ISSUE

    def test_acute_change_takes_priority_over_medication_risk(self):
        decision = evaluate_safety_v2(
            "he suddenly seems much more confused, should I increase his dose?"
        )
        assert decision.category is SafetyGateType.ACUTE_CHANGE
        assert decision.risk_level is RiskLevel.HIGH

    def test_independent_emergency_detector_takes_priority_over_both(self):
        decision = evaluate_safety_v2("he is not breathing, should I increase his dose?")
        assert decision.risk_level is RiskLevel.EMERGENCY
        assert decision.category is SafetyGateType.BREATHING_DIFFICULTY
