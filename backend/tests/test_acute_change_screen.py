"""Tests for the acute behavior-change / delirium screen (runs before coaching)."""

from app.services.acute_change_screen import (
    AcuteChangeScreenInput,
    AcuteChangeScreenOutcome,
    evaluate_acute_change_screen,
)


def test_unchanged_recurring_behavior_proceeds_to_coaching():
    answers = AcuteChangeScreenInput(
        is_new_or_different=False,
        is_sudden_onset=False,
    )
    result = evaluate_acute_change_screen(answers)
    assert result.outcome == AcuteChangeScreenOutcome.PROCEED_TO_COACHING
    assert result.concerning_flags == []


def test_sudden_new_confusion_recommends_medical_evaluation():
    answers = AcuteChangeScreenInput(
        is_new_or_different=True,
        is_sudden_onset=True,
        alertness_change=True,
    )
    result = evaluate_acute_change_screen(answers)
    assert result.outcome == AcuteChangeScreenOutcome.MEDICAL_EVALUATION_RECOMMENDED
    assert "alertness_change" in result.concerning_flags
    assert result.message


def test_sudden_excessive_sleepiness_recommends_medical_evaluation():
    answers = AcuteChangeScreenInput(
        is_new_or_different=True,
        is_sudden_onset=True,
        alertness_change=True,
        fever_or_infection_signs=False,
    )
    result = evaluate_acute_change_screen(answers)
    assert result.outcome == AcuteChangeScreenOutcome.MEDICAL_EVALUATION_RECOMMENDED


def test_fever_plus_behavior_change_recommends_medical_evaluation():
    answers = AcuteChangeScreenInput(
        is_new_or_different=True,
        is_sudden_onset=True,
        fever_or_infection_signs=True,
    )
    result = evaluate_acute_change_screen(answers)
    assert result.outcome == AcuteChangeScreenOutcome.MEDICAL_EVALUATION_RECOMMENDED
    assert "fever_or_infection_signs" in result.concerning_flags


def test_medication_change_plus_agitation_recommends_medical_evaluation():
    answers = AcuteChangeScreenInput(
        is_new_or_different=True,
        is_sudden_onset=True,
        medication_change_recent=True,
    )
    result = evaluate_acute_change_screen(answers)
    assert result.outcome == AcuteChangeScreenOutcome.MEDICAL_EVALUATION_RECOMMENDED
    assert "medication_change_recent" in result.concerning_flags


def test_ambiguous_unsure_response_fails_toward_caution():
    answers = AcuteChangeScreenInput(
        is_new_or_different=True,
        is_sudden_onset=False,
        unsure=True,
    )
    result = evaluate_acute_change_screen(answers)
    assert result.outcome == AcuteChangeScreenOutcome.MEDICAL_EVALUATION_RECOMMENDED
    assert result.is_uncertain is True


def test_new_but_gradual_no_flags_proceeds_to_coaching():
    answers = AcuteChangeScreenInput(
        is_new_or_different=True,
        is_sudden_onset=False,
        pain_signs=False,
        fever_or_infection_signs=False,
    )
    result = evaluate_acute_change_screen(answers)
    assert result.outcome == AcuteChangeScreenOutcome.PROCEED_TO_COACHING


def test_sudden_onset_with_no_contributing_factors_proceeds_to_coaching():
    answers = AcuteChangeScreenInput(
        is_new_or_different=True,
        is_sudden_onset=True,
        fever_or_infection_signs=False,
        pain_signs=False,
        urinary_retention_signs=False,
        constipation_signs=False,
        dehydration_signs=False,
        medication_change_recent=False,
        fall_recent=False,
        alertness_change=False,
    )
    result = evaluate_acute_change_screen(answers)
    assert result.outcome == AcuteChangeScreenOutcome.PROCEED_TO_COACHING
    assert result.concerning_flags == []


def test_fall_recent_recommends_medical_evaluation():
    answers = AcuteChangeScreenInput(
        is_new_or_different=True,
        is_sudden_onset=True,
        fall_recent=True,
    )
    result = evaluate_acute_change_screen(answers)
    assert result.outcome == AcuteChangeScreenOutcome.MEDICAL_EVALUATION_RECOMMENDED
    assert "fall_recent" in result.concerning_flags
