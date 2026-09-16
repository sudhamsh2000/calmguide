"""Safety Gate v2 Phase 3 — fine-grained category classification (metadata only).

See docs/SAFETY_GATE_V2_PLAN.md for the architecture this extends.

# IMPORTANT — what this module does NOT do:
#   - It never changes what `safety_gate.check_safety_gate` or
#     `safety_classifier.classify_message` themselves return. Both are
#     completely unmodified in this phase (beyond Phase 2's enum alias).
#   - It never selects user-facing response text. The existing
#     LIFE_THREAT/SELF_HARM/CAREGIVER_HARM_RISK/ELDER_ABUSE_NEGLECT value
#     from the gate/classifier is still what `build_gate_response_text`
#     receives — unchanged, in coach.py/checkin.py, untouched this phase.
#   - It never diagnoses a medical condition. ACUTE_CHANGE detects surface
#     phrasing ("suddenly more confused") — never delirium/stroke/infection.
#     MEDICATION_RISK detects that the caregiver is asking CalmGuide to make
#     a dosing decision — it never evaluates whether a change would be safe.
#
# What it DOES: given a message that the existing gate/classifier already
# flagged as LIFE_THREAT, picks a more specific label (BREATHING_DIFFICULTY /
# FALL_OR_HEAD_INJURY / REDUCED_CONSCIOUSNESS) when the wording clearly
# supports one, for `SafetyDecision.category` only. And, for a message the
# existing authoritative layers did NOT flag at all, checks two new
# non-emergency metadata categories (ACUTE_CHANGE, MEDICATION_RISK) before
# falling back to ROUTINE_CAREGIVER_ISSUE as the default "nothing of note"
# label — again, metadata only; risk_level/action/allow_rag/allow_llm for
# these two stay whatever Phase 2's conservative low-risk defaults are until
# Phase 5 decides real routing (see the plan doc's open questions #1-#3).
"""

import re

from app.services.safety_classifier import _SIMILARITY_THRESHOLD, phrase_similarity
from app.services.safety_gate import SafetyGateType

# ---------------------------------------------------------------------------
# LIFE_THREAT refinement (only ever consulted when the coarse category is
# already LIFE_THREAT — these are not independent triggers).
# ---------------------------------------------------------------------------

_BREATHING_DIFFICULTY_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\b(?:not\s+breathing|can'?t\s+breathe|cannot\s+breathe|stopped?\s+breathing)\b",
        r"\bcan'?t\s+catch\s+(?:his|her|their|my)\s+breath\b",
        r"\bstruggling\s+to\s+breathe\b",
        r"\b(?:lips?\s+(?:are\s+|is\s+)?turning\s+blue|turning\s+blue|lips\s+are\s+blue)\b",
    ]
]

# Typo-tolerant fallback for the same concern, reusing the classifier's own
# fuzzy matcher rather than a second bespoke algorithm — the sprint spec asks
# specifically for typo tolerance here (e.g. "cant breth", "cant catch his
# breth"). Deliberately a short, reviewable list, same style as
# safety_classifier._CONCEPT_PHRASES.
_BREATHING_DIFFICULTY_FUZZY_PHRASES: list[str] = [
    "can't breathe",
    "cannot breathe",
    "not breathing",
    "stopped breathing",
    "can't catch his breath",
    "struggling to breathe",
]

_FALL_OR_HEAD_INJURY_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\bfell\s+and\s+hit\s+(?:his|her|their|my)\s+head\b",
        r"\bfell\s+down\s+(?:the\s+)?stairs\b",
        r"\bfell\s+and\s+(?:can'?t|cannot|couldn'?t)\s+(?:get\s+up|move|stand)\b",
        r"\bfell\s+and\s+(?:now\s+)?seems?\s+confused\b",
        r"\bhit\s+(?:his|her|their|my)\s+head\s+hard\b",
        r"\bhead\s+injur\w*\b",
    ]
]

# Same negative-lookahead carve-out as safety_gate._LIFE_THREAT_PATTERNS's
# "passed out" entry, copied verbatim so this refinement never disagrees
# with the deterministic gate about "passed out flyers"-style false
# positives. If that carve-out list changes, update both together.
_REDUCED_CONSCIOUSNESS_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\b(?:unconscious|unresponsive|won'?t?\s+wake(?:\s+up)?)\b",
        r"\bnot\s+responding\b",
        r"\bcollapsed\s+and\s+isn'?t\s+responding\b",
        r"\bpassed?\s+out\b(?!\s+(?:the|of|with|flying|flyers|brochures|pamphlets|leaflets|candy|samples|cards|business\s+cards|awards|certificates|gifts|snacks|water\s+bottles))",
    ]
]


def _match_fine_life_threat_category(message: str) -> SafetyGateType | None:
    """Core pattern-matching shared by both `refine_emergency_category`
    (post-trigger relabeling) and `detect_independent_fine_category`
    (Phase 5: a fresh, independent detection source). Precedence when a
    message could match more than one: breathing > reduced consciousness >
    fall/head injury, matching the plan's escalation-severity ordering (an
    airway problem is more acutely time-critical than an unwitnessed fall).
    Returns None if nothing matches.
    """
    for pattern in _BREATHING_DIFFICULTY_PATTERNS:
        if pattern.search(message):
            return SafetyGateType.BREATHING_DIFFICULTY
    for phrase in _BREATHING_DIFFICULTY_FUZZY_PHRASES:
        if phrase_similarity(message, phrase) >= _SIMILARITY_THRESHOLD:
            return SafetyGateType.BREATHING_DIFFICULTY

    for pattern in _REDUCED_CONSCIOUSNESS_PATTERNS:
        if pattern.search(message):
            return SafetyGateType.REDUCED_CONSCIOUSNESS

    for pattern in _FALL_OR_HEAD_INJURY_PATTERNS:
        if pattern.search(message):
            return SafetyGateType.FALL_OR_HEAD_INJURY

    return None


def refine_emergency_category(message: str, coarse_category: SafetyGateType) -> SafetyGateType:
    """Given a category the existing gate/classifier already assigned,
    return a more specific label when the wording clearly supports one.

    Only refines LIFE_THREAT — SELF_HARM, CAREGIVER_HARM_RISK, and
    ELDER_ABUSE_NEGLECT pass through unchanged; the sprint's approved
    category list does not ask for sub-splitting those in Phase 3.

    Falls back to the original coarse category (unchanged) if no refinement
    pattern matches — this is expected and common, since many LIFE_THREAT
    patterns (chest pain, stroke signs, severe bleeding, poisoning, etc.)
    have no more-specific bucket in this phase's approved category list.
    """
    if coarse_category is not SafetyGateType.LIFE_THREAT:
        return coarse_category
    return _match_fine_life_threat_category(message) or coarse_category


def detect_independent_fine_category(message: str) -> SafetyGateType | None:
    """Safety Gate v2 Phase 5 (docs/SAFETY_GATE_V2_PLAN.md): unlike
    `refine_emergency_category`, this is an INDEPENDENT detection source —
    called on every message the deterministic gate and classifier both left
    un-triggered, not only as a relabeling step after one of them already
    fired. This is what lets phrases like "can't catch his breath" or
    "fell and hit his head" — which Phase 3 found the old gate/classifier
    never caught on their own — actually escalate end-to-end, per the
    sprint's explicit Phase 5 approval. Returns None if nothing matches
    (the caller then falls through to the non-emergency categories below).

    Reuses the exact same pattern sets as `refine_emergency_category` — no
    new patterns were added for this phase, only a new call site for the
    existing ones, per Phase 5's "do not broaden patterns beyond the tested
    category detectors" instruction. Every benign-lookalike and typo test
    from Phase 3/4 (test_safety_categories.py, the "passed out flyers"
    carve-out) protects this call site too, since it's the same matcher.
    """
    return _match_fine_life_threat_category(message)


# ---------------------------------------------------------------------------
# Non-emergency metadata categories (only ever consulted for a message the
# deterministic gate AND classifier both left un-triggered).
# ---------------------------------------------------------------------------

# Surface phrasing only — deliberately does not infer delirium, infection,
# or stroke. "Sudden" / "different from usual" / "abruptly" are the signal;
# the *cause* is exactly what the existing, separate
# /coach/acute-change-screen questionnaire is for (services/acute_change_screen.py).
# This category only flags that the screen might be worth running — it does
# not replicate that screen's own concerning-flag evaluation logic.
_ACUTE_CHANGE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        # A bounded 0-2 word gap tolerates "suddenly SEEMS much more
        # confused" / "suddenly IS more disoriented" without the pattern
        # requiring an exact hand-picked verb list (mirrors the bounded-slack
        # style already used in safety_gate.py, e.g. its "burn" pattern).
        r"\b(?:suddenly|abruptly)\s+(?:\w+\s+){0,2}?(?:much\s+)?more\s+(?:confused|disoriented|agitated|withdrawn)\b",
        r"\b(?:different|not\s+like\s+(?:him|her|themselves))\s+(?:from|than)\s+usual\b",
        r"\bdifferent\s+from\s+usual\s+today\b",
        r"\bsudden\s+(?:behavior(?:al)?\s+)?change\b",
        r"\bbecame\s+confused\s+this\s+morning\b",
    ]
]

# Requires an explicit request for CalmGuide to weigh in on a dose change —
# a modal ("should/can/may/could I") plus a dose-management verb — so an
# ordinary mention of an existing medication never matches. Deliberately
# does not attempt to judge whether any such change would be appropriate;
# see services/response_guard.py / prompt.py for where the system prompt
# already instructs the model never to answer these regardless.
_MEDICATION_RISK_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\b(?:should|can|may|could)\s+i\s+(?:increase|decrease|reduce|up|lower)\s+(?:his|her|their|the)?\s*(?:dose|dosage)\b",
        r"\b(?:should|can|may|could)\s+i\s+(?:stop|skip)\s+(?:his|her|their|the|this|tonight'?s|today'?s)?\s*(?:medication|dose|dosage|pill|tablet)s?\b",
        r"\b(?:should|can|may|could)\s+i\s+give\s+(?:him|her|them)?\s*(?:another|an\s+extra|two|double|one\s+more)\s+(?:pill|tablet|dose)s?\b",
    ]
]


def classify_non_emergency_category(message: str) -> SafetyGateType:
    """For a message neither the gate nor the classifier flagged, check the
    two new non-emergency metadata categories before defaulting to
    ROUTINE_CAREGIVER_ISSUE.

    Precedence: acute_change before medication_risk, matching the sprint's
    stated tier ordering. Neither category implies any routing change in
    this phase — see safety_decision.py for how these map to RiskLevel/
    SafetyAction (still LOW/NORMAL_GUIDANCE/allow_rag=True/allow_llm=True,
    pending Phase 5's routing decision).
    """
    for pattern in _ACUTE_CHANGE_PATTERNS:
        if pattern.search(message):
            return SafetyGateType.ACUTE_CHANGE

    for pattern in _MEDICATION_RISK_PATTERNS:
        if pattern.search(message):
            return SafetyGateType.MEDICATION_RISK

    return SafetyGateType.ROUTINE_CAREGIVER_ISSUE
