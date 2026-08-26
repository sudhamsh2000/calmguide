"""Structural map of Moment Coach's orchestration onto the DICE approach.

DICE (Describe / Investigate / Create / Evaluate) is a caregiver-communication
framework referenced by name here for orientation only — this module does not
reproduce any published DICE curriculum text, and using this structure is not
a claim that CalmGuide is clinically validated against it. Clinician review of
the phase boundaries below (particularly what counts as "Investigate" vs.
"Create") is still pending — see TODO markers on each phase.

Each `DicePhase` below documents where a phase's logic actually lives in the
codebase, so the mapping stays checkable against the code rather than living
only as a diagram in a doc that can drift out of sync.
"""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class DicePhase:
    code: str
    name: str
    summary: str
    # Dotted references to the functions/templates that implement this phase.
    implemented_in: tuple[str, ...]


# TODO(CLINICAL-REVIEW-REQUIRED): a clinician should confirm this phase
# boundary is clinically reasonable, not just an engineering convenience.
DESCRIBE = DicePhase(
    code="D",
    name="Describe",
    summary=(
        "Capture what happened: onset, context, behavior, severity, "
        "environment. For a new/sudden change this happens through the "
        "structured acute-change screen; for an ongoing/routine session the "
        "caregiver's free-text message is the description, consistent with "
        "Moment Coach's existing conversational (not form-based) intake."
    ),
    implemented_in=(
        "app.services.acute_change_screen.evaluate_acute_change_screen",
        "app.routers.coach.coach_chat (payload.message)",
    ),
)

INVESTIGATE = DicePhase(
    code="I",
    name="Investigate",
    summary=(
        "Review the patient profile, prior triggers, behavior history, and "
        "possible environmental/medical contributors, including any recent "
        "care change that would make recent history a weaker signal."
    ),
    implemented_in=(
        "app.routers.coach._db_context",
        "app.services.incident_retriever.get_relevant_incidents",
        "app.services.dossier (behavioral dossier read)",
        "app.services.care_window.pre_change_cutoff",
        "app.services.cross_patient.get_cohort_strategies",
    ),
)

# TODO(CLINICAL-REVIEW-REQUIRED): wording/ordering of the four response
# sections has not been reviewed by a clinician.
CREATE = DicePhase(
    code="C",
    name="Create",
    summary=(
        "Generate non-pharmacologic caregiver actions, structured as four "
        "sections: Right Now, Why This Is Happening, What Not To Do, When To "
        "Call For Help."
    ),
    implemented_in=(
        "app.services.prompt.render_coach_prompt",
        "app.prompts.coach_system.jinja2 (## Response Format)",
    ),
)

EVALUATE = DicePhase(
    code="E",
    name="Evaluate",
    summary=(
        "Use caregiver feedback after the interaction — whether a suggested "
        "strategy helped — and fold that result into future retrieval so "
        "later sessions for the same patient can prioritize what has "
        "actually worked and avoid what hasn't."
    ),
    implemented_in=(
        "app.routers.incidents (intervention_outcome field, caregiver-set)",
        "app.services.dossier.compute_dossier (effective/contraindicated lists)",
        "app.routers.coach._persist_and_learn (incident extraction + dossier refresh)",
    ),
)

DICE_PHASES: tuple[DicePhase, ...] = (DESCRIBE, INVESTIGATE, CREATE, EVALUATE)
