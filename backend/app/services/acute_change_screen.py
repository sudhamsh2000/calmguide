"""Acute behavior-change / delirium screening — runs BEFORE Moment Coach coaching.

This is a caregiver-facing SCREEN, not a diagnostic tool. It asks structured
yes/no/unsure questions about whether the current behavior is new/sudden and
whether common medically-relevant contributing factors are present (infection,
pain, urinary retention, constipation, dehydration, medication changes, falls,
alertness changes). If the pattern looks acute and possibly medically driven,
it routes the caregiver to a "talk to a medical provider" message instead of
(or in addition to) normal behavioral coaching.

# TODO(CLINICAL-REVIEW-REQUIRED): The exact question wording, the specific
# combination of flags treated as "concerning", and the escalation copy below
# are engineering placeholders based only on the contributing factors named in
# the product requirement (infection/fever, pain, urinary retention,
# constipation, dehydration, medication changes, falls, alertness changes).
# None of this has been reviewed by a clinician. Treat every threshold in
# `evaluate_acute_change_screen` as provisional until a clinician signs off.
#
# This module intentionally does NOT diagnose delirium or any other condition.
# It only decides whether to recommend a medical evaluation before continuing
# with behavioral coaching.
"""

from dataclasses import dataclass, field
from enum import Enum


class AcuteChangeScreenOutcome(str, Enum):
    PROCEED_TO_COACHING = "proceed_to_coaching"
    MEDICAL_EVALUATION_RECOMMENDED = "medical_evaluation_recommended"


# Flags that, combined with a new/sudden change, are treated as a possible
# physical/medical contributing factor worth a medical evaluation.
# TODO(CLINICAL-REVIEW-REQUIRED): confirm this list and any weighting with a clinician.
_CONTRIBUTING_FACTOR_FIELDS = (
    "fever_or_infection_signs",
    "pain_signs",
    "urinary_retention_signs",
    "constipation_signs",
    "dehydration_signs",
    "medication_change_recent",
    "fall_recent",
)


@dataclass(frozen=True, slots=True)
class AcuteChangeScreenInput:
    """Caregiver's answers to the acute-change screen.

    `None` on any contributing-factor field means "not asked / not answered".
    `unsure` should be set when the caregiver cannot confidently say whether
    the change is new/sudden — this is treated conservatively (fails toward
    recommending a medical evaluation), not ignored.
    """

    is_new_or_different: bool
    is_sudden_onset: bool
    alertness_change: bool | None = None
    fever_or_infection_signs: bool | None = None
    pain_signs: bool | None = None
    urinary_retention_signs: bool | None = None
    constipation_signs: bool | None = None
    dehydration_signs: bool | None = None
    medication_change_recent: bool | None = None
    fall_recent: bool | None = None
    unsure: bool = False


@dataclass(frozen=True, slots=True)
class AcuteChangeScreenResult:
    outcome: AcuteChangeScreenOutcome
    concerning_flags: list[str] = field(default_factory=list)
    is_uncertain: bool = False
    message: str = ""


# TODO(CLINICAL-REVIEW-REQUIRED): exact wording pending clinician sign-off.
_MEDICAL_EVALUATION_MESSAGE = """## This may need a medical check, not just a coaching strategy.

What you're describing sounds like it could be a **new or sudden change**, and sudden changes in someone with dementia can sometimes be caused by an underlying medical issue (like an infection, pain, constipation, dehydration, a medication side effect, or a recent fall) rather than the dementia itself.

**This is a screening prompt, not a diagnosis.** CalmGuide cannot tell you what is causing this change.

**What we'd recommend:**
- Contact their doctor, nurse line, or care team today to describe what changed and when
- Mention anything unusual you've noticed: fever, pain, urination changes, constipation, low fluid intake, a recent medication change, or a recent fall
- If they seem far less responsive than usual, are very hard to wake, or their symptoms are getting rapidly worse, treat this as urgent and seek medical care right away

Once this has been checked out, coaching strategies for the behavior itself can still help — but ruling out a medical cause first is important for sudden changes."""

_UNCERTAIN_MESSAGE = """## We're not sure if this is a new change — worth a quick check.

You mentioned you're not sure whether this is new or how quickly it started. Because sudden changes in dementia can sometimes have a medical cause, it's worth a quick call to their doctor or nurse line just to be safe, especially if anything else feels "off" physically.

If you're confident this is the same kind of thing they've done before, you can continue on to coaching for this behavior."""


def get_acute_change_advisory_message() -> str:
    """Safety Gate v2 Phase 5 (docs/SAFETY_GATE_V2_PLAN.md): exposes this
    screen's own MEDICAL_EVALUATION_RECOMMENDED message for reuse by the
    main coach flow's free-text ACUTE_CHANGE detection
    (safety_categories.py), which only recognizes surface phrasing
    ("suddenly more confused") and has not run this screen's structured
    concerning-flag evaluation. Reusing this exact, already-existing text
    — rather than inventing new copy or reimplementing the questionnaire
    inside coach_chat — is the explicit Phase 5 instruction. Still carries
    the same TODO(CLINICAL-REVIEW-REQUIRED) status as the rest of this
    module; nothing about that changes by being reused here.
    """
    return _MEDICAL_EVALUATION_MESSAGE


def evaluate_acute_change_screen(answers: AcuteChangeScreenInput) -> AcuteChangeScreenResult:
    """Evaluate the acute-change screen answers and decide whether to route
    the caregiver to a medical-evaluation message before coaching.

    Decision logic (transparent, not a scored clinical algorithm):
    - Recurring/unchanged behavior (not new/different) -> proceed to coaching.
    - New/different but caregiver is unsure whether it's sudden/new -> fail
      toward caution: recommend a quick medical check, but with softer,
      less alarming wording.
    - New/different AND sudden onset, with no contributing factors flagged
      and no alertness change -> proceed to coaching (still logged).
    - New/different AND sudden onset, WITH any contributing factor
      (infection/fever, pain, urinary retention, constipation, dehydration,
      medication change, fall) OR an alertness change -> recommend medical
      evaluation before coaching.
    """
    if not answers.is_new_or_different:
        return AcuteChangeScreenResult(outcome=AcuteChangeScreenOutcome.PROCEED_TO_COACHING)

    if answers.unsure:
        return AcuteChangeScreenResult(
            outcome=AcuteChangeScreenOutcome.MEDICAL_EVALUATION_RECOMMENDED,
            is_uncertain=True,
            message=_UNCERTAIN_MESSAGE,
        )

    concerning_flags: list[str] = []
    for flag_name in _CONTRIBUTING_FACTOR_FIELDS:
        if getattr(answers, flag_name) is True:
            concerning_flags.append(flag_name)
    if answers.alertness_change is True:
        concerning_flags.append("alertness_change")

    if answers.is_sudden_onset and concerning_flags:
        return AcuteChangeScreenResult(
            outcome=AcuteChangeScreenOutcome.MEDICAL_EVALUATION_RECOMMENDED,
            concerning_flags=concerning_flags,
            message=_MEDICAL_EVALUATION_MESSAGE,
        )

    return AcuteChangeScreenResult(
        outcome=AcuteChangeScreenOutcome.PROCEED_TO_COACHING,
        concerning_flags=concerning_flags,
    )
