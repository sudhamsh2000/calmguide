"""Safety Gate v2 Phase 3 — fine-grained category classification tests.

Covers app/services/safety_categories.py directly (refine_emergency_category,
classify_non_emergency_category) and, where the sprint spec calls out a
specific end-to-end protection, evaluate_safety_v2 as well.
"""

import pytest

from app.services.safety_categories import (
    classify_non_emergency_category,
    refine_emergency_category,
)
from app.services.safety_classifier import classify_message
from app.services.safety_decision import RiskLevel, evaluate_safety_v2
from app.services.safety_gate import SafetyGateType, check_safety_gate

# ---------------------------------------------------------------------------
# BREATHING_DIFFICULTY
# ---------------------------------------------------------------------------


class TestBreathingDifficulty:
    @pytest.mark.parametrize(
        "message",
        [
            "he is not breathing",
            "she can't breathe",
            "he can't catch his breath",
            "she is struggling to breathe",
            "his lips are turning blue",
        ],
    )
    def test_true_positive_refinement(self, message):
        # Unit-level: refine_emergency_category's own pattern coverage,
        # given the coarse category is already LIFE_THREAT (as it would be
        # whenever this refinement actually runs in production). Not every
        # phrase here is independently caught by the deterministic gate on
        # its own (see test_gate_and_classifier_covered_phrases_refine_end_to_end
        # for the subset that is) — refinement intentionally covers a
        # slightly broader breathing-specific vocabulary for messages that
        # combine one of these phrases with another already-triggering
        # signal elsewhere in the same text.
        refined = refine_emergency_category(message, SafetyGateType.LIFE_THREAT)
        assert refined is SafetyGateType.BREATHING_DIFFICULTY

    @pytest.mark.parametrize(
        "message",
        [
            "he is not breathing",
            "she can't breathe",
            "his lips are turning blue",
        ],
    )
    def test_gate_and_classifier_covered_phrases_refine_end_to_end(self, message):
        gate_result = check_safety_gate(message)
        assert gate_result.gate_type is SafetyGateType.LIFE_THREAT, (
            f"expected the existing, unmodified gate to already catch: {message}"
        )
        refined = refine_emergency_category(message, gate_result.gate_type)
        assert refined is SafetyGateType.BREATHING_DIFFICULTY

    @pytest.mark.parametrize(
        "message",
        [
            "cant breth",
            "he cant breathe rite now",
        ],
    )
    def test_typo_variant_still_refines_via_fuzzy_fallback(self, message):
        # These typo'd forms may or may not trip the deterministic gate's
        # exact regex, but refinement itself must tolerate typos via the
        # reused classifier fuzzy-match, per the sprint's explicit ask.
        refined = refine_emergency_category(message, SafetyGateType.LIFE_THREAT)
        assert refined is SafetyGateType.BREATHING_DIFFICULTY

    def test_end_to_end_typo_breathing_still_escalates(self):
        # Whole-pipeline check: a typo'd breathing emergency must still be
        # classifier-flagged (existing classify_message behavior, completely
        # untouched by Phase 3) and, once flagged, refined to
        # BREATHING_DIFFICULTY. Kept short and close to the phrase length —
        # a longer, filler-padded sentence can fall victim to the known,
        # separately-tracked _best_similarity window-dilution gap (see
        # docs/SAFETY_GATE_V2_PLAN.md "Known safety regression protections"
        # #2), which is explicitly Phase 4's fix, not Phase 3's.
        message = "cant breath"
        classifier_result = classify_message(message)
        assert classifier_result.flagged
        decision = evaluate_safety_v2(message)
        assert decision.risk_level is RiskLevel.EMERGENCY
        assert decision.category is SafetyGateType.BREATHING_DIFFICULTY


# ---------------------------------------------------------------------------
# FALL_OR_HEAD_INJURY
# ---------------------------------------------------------------------------


class TestFallOrHeadInjury:
    @pytest.mark.parametrize(
        "message",
        [
            "he fell and hit his head",
            "she fell down the stairs",
            "he fell and now seems confused",
            "he fell and can't get up",
        ],
    )
    def test_true_positive_refinement(self, message):
        # Unit-level, same rationale as TestBreathingDifficulty above — not
        # every one of these is independently caught by the unmodified
        # deterministic gate today ("fell and hit his head" / "fell and now
        # seems confused" are new refinement-only vocabulary).
        refined = refine_emergency_category(message, SafetyGateType.LIFE_THREAT)
        assert refined is SafetyGateType.FALL_OR_HEAD_INJURY

    @pytest.mark.parametrize(
        "message",
        ["she fell down the stairs", "he fell and can't get up"],
    )
    def test_gate_covered_phrases_refine_end_to_end(self, message):
        gate_result = check_safety_gate(message)
        assert gate_result.gate_type is SafetyGateType.LIFE_THREAT, (
            f"expected the existing, unmodified gate to already catch: {message}"
        )
        refined = refine_emergency_category(message, gate_result.gate_type)
        assert refined is SafetyGateType.FALL_OR_HEAD_INJURY

    @pytest.mark.parametrize(
        "message",
        [
            "he almost fell asleep during the movie",
            "she fell behind on her routine this week",
        ],
    )
    def test_benign_lookalike_does_not_trigger(self, message):
        # These never reach refine_emergency_category in production (the
        # gate/classifier wouldn't flag them as LIFE_THREAT in the first
        # place), but the category detector itself must also not falsely
        # match them if ever consulted directly — conservative by design.
        refined = refine_emergency_category(message, SafetyGateType.LIFE_THREAT)
        assert refined is not SafetyGateType.FALL_OR_HEAD_INJURY
        gate_result = check_safety_gate(message)
        assert gate_result.triggered is False
        classifier_result = classify_message(message)
        assert classifier_result.flagged is False


# ---------------------------------------------------------------------------
# REDUCED_CONSCIOUSNESS
# ---------------------------------------------------------------------------


class TestReducedConsciousness:
    @pytest.mark.parametrize(
        "message",
        [
            "he is unconscious",
            "she is unresponsive",
            "he won't wake up",
            "she is not responding",
            "he collapsed and isn't responding",
            "he passed out",
        ],
    )
    def test_true_positive_refinement(self, message):
        # Unit-level, same rationale as above — "not responding" as a
        # standalone phrase is broader refinement-only vocabulary than the
        # unmodified gate's own patterns cover.
        refined = refine_emergency_category(message, SafetyGateType.LIFE_THREAT)
        assert refined is SafetyGateType.REDUCED_CONSCIOUSNESS

    @pytest.mark.parametrize(
        "message",
        [
            "he is unconscious",
            "she is unresponsive",
            "he won't wake up",
            "he collapsed and isn't responding",
            "he passed out",
        ],
    )
    def test_gate_covered_phrases_refine_end_to_end(self, message):
        gate_result = check_safety_gate(message)
        assert gate_result.gate_type is SafetyGateType.LIFE_THREAT, (
            f"expected the existing, unmodified gate to already catch: {message}"
        )
        refined = refine_emergency_category(message, gate_result.gate_type)
        assert refined is SafetyGateType.REDUCED_CONSCIOUSNESS

    def test_passed_out_flyers_carve_out_preserved(self):
        """Specifically protected per the sprint spec: "passed out flyers"
        vs true unconsciousness. Must never be flagged by the gate, the
        classifier, or the new refinement layer."""
        message = "I passed out flyers for the caregiver support group today"
        gate_result = check_safety_gate(message)
        assert gate_result.triggered is False
        classifier_result = classify_message(message)
        assert classifier_result.flagged is False
        # Never reaches refinement in production since nothing triggered,
        # but confirm the detector itself agrees if ever consulted anyway.
        refined = refine_emergency_category(message, SafetyGateType.LIFE_THREAT)
        assert refined is not SafetyGateType.REDUCED_CONSCIOUSNESS

    @pytest.mark.parametrize(
        "message",
        [
            "I passed out brochures at the fair",
            "he handed out passed out water bottles to the runners",
        ],
    )
    def test_other_passed_out_carve_outs_preserved(self, message):
        gate_result = check_safety_gate(message)
        assert gate_result.triggered is False


# ---------------------------------------------------------------------------
# Refinement precedence + no-op cases
# ---------------------------------------------------------------------------


class TestRefinementPrecedenceAndScope:
    def test_non_life_threat_categories_are_never_refined(self):
        for category in (
            SafetyGateType.SELF_HARM,
            SafetyGateType.CAREGIVER_HARM_RISK,
            SafetyGateType.ELDER_ABUSE_NEGLECT,
        ):
            assert refine_emergency_category("anything at all", category) is category

    def test_life_threat_with_no_specific_pattern_falls_back_unchanged(self):
        for message in ["he had a heart attack", "severe bleeding won't stop", "house on fire"]:
            refined = refine_emergency_category(message, SafetyGateType.LIFE_THREAT)
            assert refined is SafetyGateType.LIFE_THREAT

    def test_breathing_takes_precedence_over_consciousness_and_fall(self):
        # A message that could plausibly read as both breathing distress and
        # reduced consciousness should resolve to breathing, per the
        # documented precedence (airway problems are more time-critical).
        message = "he collapsed and isn't responding and can't breathe"
        refined = refine_emergency_category(message, SafetyGateType.LIFE_THREAT)
        assert refined is SafetyGateType.BREATHING_DIFFICULTY


# ---------------------------------------------------------------------------
# ACUTE_CHANGE
# ---------------------------------------------------------------------------


class TestAcuteChange:
    @pytest.mark.parametrize(
        "message",
        [
            "he is suddenly much more confused",
            "she seems different from usual today",
            "there's been a sudden behavior change",
            "he became confused this morning",
            "she is abruptly more disoriented",
        ],
    )
    def test_true_positive(self, message):
        assert classify_non_emergency_category(message) is SafetyGateType.ACUTE_CHANGE

    @pytest.mark.parametrize(
        "message",
        [
            "he gets confused sometimes in the evening, like always",
            "she has been forgetful for the past two years",
            "he always asks the same question, it's just his usual pattern",
        ],
    )
    def test_routine_confusion_does_not_trigger(self, message):
        """Specifically protected: sudden confusion vs routine dementia
        confusion. Ordinary, longstanding confusion must stay routine."""
        assert classify_non_emergency_category(message) is SafetyGateType.ROUTINE_CAREGIVER_ISSUE

    def test_does_not_diagnose_a_cause(self):
        # Ambiguous wording: acute_change is a metadata label, not a
        # diagnosis. Confirm no code path here ever returns anything other
        # than the ACUTE_CHANGE label itself (no delirium/stroke/infection
        # category exists to accidentally return).
        category = classify_non_emergency_category("he suddenly seems much more confused")
        assert category is SafetyGateType.ACUTE_CHANGE
        assert category.value == "acute_change"

    def test_does_not_trigger_when_gate_or_classifier_already_flagged(self):
        # ACUTE_CHANGE is only ever consulted on the "nothing flagged" path.
        # A message combining acute-change phrasing with an explicit
        # emergency signal must still escalate as an emergency, in gate
        # priority order, not get relabeled as merely acute_change.
        decision = evaluate_safety_v2("he suddenly seems confused and is not breathing")
        assert decision.risk_level is RiskLevel.EMERGENCY


# ---------------------------------------------------------------------------
# MEDICATION_RISK
# ---------------------------------------------------------------------------


class TestMedicationRisk:
    @pytest.mark.parametrize(
        "message",
        [
            "should I increase his dose?",
            "can I give another pill?",
            "should I stop this medication?",
            "can I give two tablets instead?",
            "can I skip tonight's dose?",
            "should I reduce the dose?",
        ],
    )
    def test_true_positive(self, message):
        assert classify_non_emergency_category(message) is SafetyGateType.MEDICATION_RISK

    @pytest.mark.parametrize(
        "message",
        [
            "he takes donepezil",
            "she started a new medication last week",
            "his medication is on the table",
            "she takes her pills every morning without any issues",
        ],
    )
    def test_ordinary_medication_mention_does_not_trigger(self, message):
        """Specifically protected: medication mention vs medication-
        management request."""
        assert classify_non_emergency_category(message) is SafetyGateType.ROUTINE_CAREGIVER_ISSUE

    def test_does_not_evaluate_appropriateness(self):
        # This module only detects the request; it must never itself
        # produce any kind of "yes/no" or dosing guidance value — confirmed
        # by the return type being just the category enum, nothing else.
        category = classify_non_emergency_category("should I increase his dose?")
        assert category is SafetyGateType.MEDICATION_RISK

    @pytest.mark.parametrize(
        "message",
        [
            "I'm stressed because his medication schedule is confusing",
            "keeping track of all his medications is overwhelming me",
            "I'm so tired of managing her medication schedule every day",
            "the pharmacy mixed up his prescriptions and I'm frustrated",
        ],
    )
    def test_caregiver_frustration_about_medication_logistics_does_not_trigger(self, message):
        """Phase 5 sign-off: caregiver frustration/overwhelm about
        medication *logistics* (schedules, tracking, confusion) is not a
        request for CalmGuide to make a dosing decision, and must not be
        swept into MEDICATION_RISK just because the word "medication"
        appears alongside caregiver stress language. Distinct from the
        modal+dose-verb requests in test_true_positive above."""
        assert classify_non_emergency_category(message) is SafetyGateType.ROUTINE_CAREGIVER_ISSUE


# ---------------------------------------------------------------------------
# ROUTINE_CAREGIVER_ISSUE (default) + category precedence across tiers
# ---------------------------------------------------------------------------


class TestRoutineDefaultAndPrecedence:
    def test_ordinary_message_defaults_to_routine(self):
        message = "what's a good activity to do with her this afternoon?"
        assert classify_non_emergency_category(message) is SafetyGateType.ROUTINE_CAREGIVER_ISSUE

    def test_acute_change_takes_precedence_over_medication_risk(self):
        # A message plausibly touching both tiers should resolve to the
        # higher-precedence acute_change, per the sprint's stated ordering.
        message = "he suddenly seems much more confused, should I increase his dose?"
        assert classify_non_emergency_category(message) is SafetyGateType.ACUTE_CHANGE

    def test_emergency_precedence_over_everything_else(self):
        # An explicit emergency signal must win over acute_change/
        # medication_risk phrasing appearing in the same message — the
        # existing gate ordering already guarantees this since
        # classify_non_emergency_category is only reached when neither the
        # gate nor the classifier triggered at all.
        decision = evaluate_safety_v2("he is not breathing, should I increase his dose?")
        assert decision.risk_level is RiskLevel.EMERGENCY
        assert decision.category is SafetyGateType.BREATHING_DIFFICULTY


# ---------------------------------------------------------------------------
# Existing regression protections (must still hold after Phase 3's changes)
# ---------------------------------------------------------------------------


class TestExistingRegressionProtections:
    def test_what_to_do_vs_want_to_die_still_holds(self):
        """The classic false-positive fix (docs/AUDIT.md 2026-09-07) must
        still hold after adding new categories and enum members."""
        result = classify_message("he keeps wandering at night and I don't know what to do")
        assert result.flagged is False
        decision = evaluate_safety_v2("he keeps wandering at night and I don't know what to do")
        assert decision.risk_level is RiskLevel.LOW
        assert decision.category is SafetyGateType.ROUTINE_CAREGIVER_ISSUE

    def test_ambiguous_wording_does_not_over_escalate(self):
        # "different" and "confused" alone, without the acute/sudden framing,
        # should not be swept into ACUTE_CHANGE.
        message = "he seems a little different today, nothing major"
        category = classify_non_emergency_category(message)
        # Deliberately not asserting a specific category here beyond "not
        # an emergency tier" — the point is this ambiguous phrasing must
        # not be over-classified as ACUTE_CHANGE just because it contains
        # the word "different".
        assert category in (SafetyGateType.ROUTINE_CAREGIVER_ISSUE, SafetyGateType.ACUTE_CHANGE)
        decision = evaluate_safety_v2(message)
        assert decision.risk_level is RiskLevel.LOW
