"""Safety Gate v2 — structured safety decision model (Phase 2, extended Phase 3).

See docs/SAFETY_GATE_V2_PLAN.md for the full architecture inspection this
is built on. This module is additive scaffolding: it maps the *existing*
deterministic gate (`safety_gate.check_safety_gate`) and heuristic
classifier (`safety_classifier.classify_message`) outputs into one
structured `SafetyDecision`, without changing what either of them actually
does, and without being wired into `coach.py` / `checkin.py` yet — that
routing change is Phase 5.

Phase 2 introduced the model with the 4 original categories, always mapping
a trigger to EMERGENCY. Phase 3 adds category *refinement* on top — a
message already flagged LIFE_THREAT may get a more specific `category`
(BREATHING_DIFFICULTY / FALL_OR_HEAD_INJURY / REDUCED_CONSCIOUSNESS) via
`safety_categories.refine_emergency_category`, and a message the gate AND
classifier both left untouched gets checked against two new non-emergency
metadata categories (ACUTE_CHANGE / MEDICATION_RISK) before falling back to
ROUTINE_CAREGIVER_ISSUE, via `safety_categories.classify_non_emergency_category`.
Neither of these changes risk_level/action/allow_rag/allow_llm — only the
`category` field gets more specific. See safety_categories.py's own
docstring for exactly what it does and does not do.

Still explicitly NOT done, in either phase:
  - reorder coach.py's request flow (still Phase 5)
  - change RAG or DB-loading behavior (still Phase 5)
  - implement any new HIGH/MODERATE routing behavior (still Phase 5, and
    only after the open questions in the plan doc are resolved)
  - touch `safety_classifier._best_similarity`'s known dilution gap
    (Phase 4's job, deliberately left alone here)
  - implement any clinician-reviewed governance (blocked pending LOF)

Today, every one of the four original gate/classifier categories
(LIFE_THREAT, SELF_HARM, CAREGIVER_HARM_RISK, ELDER_ABUSE_NEGLECT) is
handled identically at runtime: a trigger bypasses RAG and the LLM
entirely and returns a static/templated deflection. So the *behavior-
preserving* mapping is that any trigger — from either layer — still maps to
RiskLevel.EMERGENCY / SafetyAction.EMERGENCY_ESCALATION, regardless of
which specific category `refine_emergency_category` picks. The model can
represent MODERATE/HIGH and the other SafetyAction values, but nothing in
this module produces them yet; real HIGH/MODERATE routing is Phase 3+ work
pending the plan doc's open questions (unresolved: what HIGH's action
concretely does).
"""

from dataclasses import dataclass, field
from enum import Enum

from app.services.safety_categories import (
    classify_non_emergency_category,
    detect_independent_fine_category,
    refine_emergency_category,
)
from app.services.safety_classifier import ClassifierResult, classify_message
from app.services.safety_gate import SafetyGateResult, SafetyGateType, check_safety_gate


class RiskLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    EMERGENCY = "emergency"


class SafetyAction(str, Enum):
    NORMAL_GUIDANCE = "normal_guidance"
    CONSTRAINED_GUIDANCE = "constrained_guidance"
    CONTACT_CLINICIAN = "contact_clinician"
    URGENT_EVALUATION = "urgent_evaluation"
    EMERGENCY_ESCALATION = "emergency_escalation"


# Where a decision's trigger came from — mirrors the `safety_source` string
# already used inline in coach.py/checkin.py ("deterministic_gate" /
# "classifier"), plus "none" for an unflagged message. Kept as a plain
# str-Enum here rather than reusing a routers-level constant, since neither
# router currently exports one — the routers still own their own local
# `safety_source` variable, unchanged, until Phase 5.
class SafetyDecisionSource(str, Enum):
    DETERMINISTIC_GATE = "deterministic_gate"
    CLASSIFIER = "classifier"
    # Safety Gate v2 Phase 5: a decision produced by safety_categories.py's
    # independent fine-category detector or its non-emergency category
    # classifier — neither the deterministic gate nor classify_message
    # itself flagged this message, but safety_categories.py found something
    # anyway. Distinct from CLASSIFIER (safety_classifier.classify_message)
    # so observability can tell which layer actually produced a decision.
    CATEGORY_DETECTOR = "category_detector"
    NONE = "none"


@dataclass(frozen=True, slots=True)
class SafetyDecision:
    """Structured result of running Safety Gate v2 over one message.

    Every safety-relevant field is required (no default) so a construction
    site can never silently fall back to an implicit, potentially-unsafe
    value — the only fields with defaults are the ones that are genuinely
    optional metadata (`confidence`, `matched_concepts`), not ones that
    affect routing.
    """

    triggered: bool
    category: SafetyGateType | None
    risk_level: RiskLevel
    action: SafetyAction
    allow_rag: bool
    allow_llm: bool
    requires_escalation: bool
    source: SafetyDecisionSource
    confidence: float | None = None
    matched_concepts: tuple[str, ...] = field(default_factory=tuple)


def _low_risk_decision(
    category: SafetyGateType = SafetyGateType.ROUTINE_CAREGIVER_ISSUE,
) -> SafetyDecision:
    """The "nothing flagged by the gate/classifier" outcome.

    `category` defaults to ROUTINE_CAREGIVER_ISSUE (Phase 3) — the explicit
    "normal" label, replacing Phase 2's bare `None`. Routing fields
    (risk_level/action/allow_rag/allow_llm/requires_escalation) are
    unchanged from Phase 2 and identical for ROUTINE_CAREGIVER_ISSUE,
    ACUTE_CHANGE, and MEDICATION_RISK in this phase — see module docstring
    for why real differentiation is deferred to Phase 5.
    """
    return SafetyDecision(
        triggered=False,
        category=category,
        risk_level=RiskLevel.LOW,
        action=SafetyAction.NORMAL_GUIDANCE,
        allow_rag=True,
        allow_llm=True,
        requires_escalation=False,
        source=SafetyDecisionSource.NONE,
    )


def _emergency_decision(
    category: SafetyGateType,
    source: SafetyDecisionSource,
    confidence: float | None = None,
    matched_concepts: tuple[str, ...] = (),
) -> SafetyDecision:
    """The "something flagged" outcome. Deliberately identical regardless of
    which of the 4 categories triggered — that mirrors current behavior
    exactly (every category bypasses RAG/LLM today). See module docstring."""
    return SafetyDecision(
        triggered=True,
        category=category,
        risk_level=RiskLevel.EMERGENCY,
        action=SafetyAction.EMERGENCY_ESCALATION,
        allow_rag=False,
        allow_llm=False,
        requires_escalation=True,
        source=source,
        confidence=confidence,
        matched_concepts=matched_concepts,
    )


def _high_risk_decision(category: SafetyGateType) -> SafetyDecision:
    """Safety Gate v2 Phase 5: HIGH tier. Skips RAG and unrestricted LLM
    generation, same as EMERGENCY, but routes to an existing advisory
    message (see coach.py) rather than a 911/988-style deflection — this is
    "you should get this checked out," not "call emergency services now."
    Only ACUTE_CHANGE produces this today. `requires_escalation=True`
    because it does need something beyond CalmGuide's own coaching (a
    clinician), distinguishing it from LOW/MODERATE's False.
    """
    return SafetyDecision(
        triggered=True,
        category=category,
        risk_level=RiskLevel.HIGH,
        action=SafetyAction.CONTACT_CLINICIAN,
        allow_rag=False,
        allow_llm=False,
        requires_escalation=True,
        source=SafetyDecisionSource.CATEGORY_DETECTOR,
    )


def _moderate_risk_decision(category: SafetyGateType) -> SafetyDecision:
    """Safety Gate v2 Phase 5: MODERATE tier. Only MEDICATION_RISK produces
    this today. Deliberately does NOT set allow_rag/allow_llm to False:
    Phase 5's own instructions make skipping normal generation conditional
    on "current product rules" requiring it, and today's actual product
    rule is a prompt-level one — app/prompts/coach_system.jinja2 already
    instructs the model to never give medication/dosing advice and to
    redirect to the patient's doctor for any such question. There is no
    existing hard-boundary static response to reuse instead (only the
    generic LLM-failure fallback exists, which would be the wrong message
    for a request the LLM is perfectly able to answer correctly via its
    existing instructions). So this tier is metadata-and-observability
    only in this phase: the request proceeds through the exact same
    RAG+LLM path as any LOW-risk request, `action=CONSTRAINED_GUIDANCE`
    just labels that the *existing* system-prompt constraint applies.
    `requires_escalation=False` — nothing here requires CalmGuide to hand
    the caregiver off to anyone; the model's own answer already does that.

    # TODO(LOF-APPROVAL): this mapping (MODERATE / allow_rag=True /
    # allow_llm=True, relying entirely on the existing system-prompt
    # refusal) is a temporary product rule for this sprint, signed off
    # pending LOF/clinical review — not a permanent design decision. Do
    # not strengthen or broaden medication guidance in this module or the
    # prompt without that review; if a clinician-approved static
    # medication-boundary response is defined later, MEDICATION_RISK
    # should very likely move to skipping RAG/LLM (allow_rag=False,
    # allow_llm=False) in favor of that response instead of this one.
    """
    return SafetyDecision(
        triggered=True,
        category=category,
        risk_level=RiskLevel.MODERATE,
        action=SafetyAction.CONSTRAINED_GUIDANCE,
        allow_rag=True,
        allow_llm=True,
        requires_escalation=False,
        source=SafetyDecisionSource.CATEGORY_DETECTOR,
    )


def _decision_when_gate_and_classifier_silent(message: str) -> SafetyDecision:
    """Shared fallback for when neither the deterministic gate nor the
    classifier flagged a message — the live path for every LOW/MODERATE/
    HIGH-via-independent-detector decision. Precedence, matching
    docs/SAFETY_GATE_V2_PLAN.md: an independent fine-category emergency
    (Phase 5's new detection source) outranks the two non-emergency
    metadata categories, which in turn outrank plain ROUTINE_CAREGIVER_ISSUE.
    """
    independent_category = detect_independent_fine_category(message)
    if independent_category is not None:
        return _emergency_decision(
            category=independent_category, source=SafetyDecisionSource.CATEGORY_DETECTOR
        )

    category = classify_non_emergency_category(message)
    if category is SafetyGateType.ACUTE_CHANGE:
        return _high_risk_decision(category)
    if category is SafetyGateType.MEDICATION_RISK:
        return _moderate_risk_decision(category)
    return _low_risk_decision(category)


def decision_from_gate_result(message: str, gate_result: SafetyGateResult) -> SafetyDecision:
    """Map an already-computed `SafetyGateResult` to a `SafetyDecision`.

    Exposed separately from `evaluate_safety_v2` so callers that already ran
    `check_safety_gate` themselves (as coach.py/checkin.py do today) can
    reuse that result without a second gate evaluation, once Phase 5 wires
    this in. Not called by either router yet.

    `message` is needed (new in Phase 3) so `refine_emergency_category` can
    pick a more specific LIFE_THREAT sub-category where the wording
    supports one — see safety_categories.py. This changes only
    `SafetyDecision.category`; `gate_result.gate_type` itself, and the
    response text coach.py/checkin.py build from it, are untouched.
    """
    if not gate_result.triggered or gate_result.gate_type is None:
        return _decision_when_gate_and_classifier_silent(message)
    return _emergency_decision(
        category=refine_emergency_category(message, gate_result.gate_type),
        source=SafetyDecisionSource.DETERMINISTIC_GATE,
    )


def decision_from_classifier_result(
    message: str, classifier_result: ClassifierResult
) -> SafetyDecision:
    """Map an already-computed `ClassifierResult` to a `SafetyDecision`.

    Only meaningful when the deterministic gate did NOT already trigger —
    exactly the existing `if not safety.triggered:` guard in coach.py/
    checkin.py. Calling this after a gate trigger would be a misuse; this
    function does not itself re-check gate state.

    `message` is used the same way as in `decision_from_gate_result` — for
    category refinement only.
    """
    if not classifier_result.flagged or classifier_result.category is None:
        return _decision_when_gate_and_classifier_silent(message)
    return _emergency_decision(
        category=refine_emergency_category(message, classifier_result.category),
        source=SafetyDecisionSource.CLASSIFIER,
        confidence=classifier_result.confidence,
        matched_concepts=tuple(classifier_result.matched_concepts),
    )


def evaluate_safety_v2(message: str, locale_code: str = "en") -> SafetyDecision:
    """Run the existing two-layer safety pipeline and return one structured
    decision, replicating today's coach.py/checkin.py logic exactly:
    deterministic gate first (authoritative if it fires), classifier second
    (only consulted when the gate didn't trigger, never suppressing it).
    Phase 3 additionally runs category refinement (see module docstring).

    This function is not called from either router yet — Phase 5 is where
    `coach.py`/`checkin.py` are changed to use it (and to act on
    `allow_rag`/`allow_llm` to skip the expensive normal-request path for
    EMERGENCY). Today, calling this changes nothing about request handling;
    it only gives Phase 5 one tested entry point to wire in later, and gives
    Phase 4 one place to extend once the classifier dilution fix lands.
    """
    gate_result = check_safety_gate(message, locale_code=locale_code)
    if gate_result.triggered:
        return decision_from_gate_result(message, gate_result)

    classifier_result = classify_message(message)
    return decision_from_classifier_result(message, classifier_result)
