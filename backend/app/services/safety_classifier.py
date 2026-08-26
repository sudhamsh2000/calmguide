"""Lightweight second-layer safety classifier — runs BEHIND the deterministic gate.

# IMPORTANT — WHAT THIS IS NOT: this is NOT a trained machine-learning model.
# CalmGuide has no labeled safety-incident dataset and no ML inference
# infrastructure today. Calling this a "classifier" is a functional
# description (it classifies text into risk categories), not a claim about
# model architecture. It is a fuzzy/heuristic layer using token-overlap and
# approximate string matching against short concept-phrase clusters, meant to
# catch paraphrases and near-misses that the deterministic regex gate in
# `safety_gate.py` doesn't match verbatim.
#
# A real trained classifier (e.g. a fine-tuned small model or an embedding-
# similarity search over a labeled corpus) is a documented future upgrade —
# see docs/SAFETY_ARCHITECTURE.md. Do not represent this module as clinically
# validated or as equivalent to a trained model in any product copy.
#
# Design principle: fail toward escalation under uncertainty. This layer is a
# second opinion behind the deterministic gate — the deterministic gate result
# is authoritative when it fires; this layer only adds coverage the gate
# missed. It never downgrades or suppresses a deterministic-gate trigger.
"""

from dataclasses import dataclass, field
from difflib import SequenceMatcher
from enum import Enum


class SafetyRiskCategory(str, Enum):
    LIFE_THREAT = "life_threat"
    SELF_HARM = "self_harm"
    CAREGIVER_HARM_RISK = "caregiver_harm_risk"
    ELDER_ABUSE_NEGLECT = "elder_abuse_neglect"


@dataclass(frozen=True, slots=True)
class ClassifierResult:
    flagged: bool
    category: SafetyRiskCategory | None = None
    confidence: float = 0.0
    matched_concepts: list[str] = field(default_factory=list)


# Short concept phrases per risk category. Kept intentionally small and
# reviewable rather than an exhaustive corpus — expanding this list is one of
# the documented paths to improving recall (see docs/SAFETY_ARCHITECTURE.md).
_CONCEPT_PHRASES: dict[SafetyRiskCategory, list[str]] = {
    SafetyRiskCategory.LIFE_THREAT: [
        "not breathing",
        "can't breathe",
        "stopped breathing",
        "no pulse",
        "unconscious",
        "unresponsive",
        "won't wake up",
        "passed out",
        "having a seizure",
        "heart attack",
        "chest pain",
        "having a stroke",
        "face drooping",
        "slurred speech",
        "severe bleeding",
        "won't stop bleeding",
        "fell down the stairs",
        "can't get up",
        "house on fire",
        "swallowed pills",
        "drank bleach",
        "electric shock",
        "can't breathe allergic reaction",
        "overdose",
        "turning blue",
        "lips are blue",
        "blue around the lips",
    ],
    SafetyRiskCategory.SELF_HARM: [
        "want to kill myself",
        "want to die",
        "end my life",
        "suicidal thoughts",
        "hurt myself",
        "cutting myself",
        "don't want to be alive",
        "rather be dead",
        "no point in living",
        "no reason to live",
        "thinking about suicide",
    ],
    SafetyRiskCategory.CAREGIVER_HARM_RISK: [
        "scared I might hurt him",
        "afraid I might hurt her",
        "going to snap",
        "lose control",
        "almost hit him",
        "can't control my temper",
        "afraid of what I'll do",
        "going to lose it",
    ],
    SafetyRiskCategory.ELDER_ABUSE_NEGLECT: [
        "leaves her alone for days",
        "hasn't been fed in days",
        "bruises I can't explain",
        "the aide hits him",
        "neglects mom",
        "locks him in his room",
        "withholds his medication",
        "afraid the aide is hurting him",
    ],
}

# Below this similarity score a phrase pair is not considered a match.
# TODO(CLINICAL-REVIEW-REQUIRED / TUNING): threshold chosen conservatively
# (favoring recall over precision) but not validated against a labeled
# dataset. See docs/SAFETY_ARCHITECTURE.md for the red-team evaluation harness
# that should be used to tune this value before relying on it in production.
_SIMILARITY_THRESHOLD = 0.72

# A window of this many words is compared against each concept phrase so that
# a phrase embedded in a longer sentence can still match.
_WINDOW_SLACK_WORDS = 3


def _windows(message_words: list[str], phrase_word_count: int):
    span = phrase_word_count + _WINDOW_SLACK_WORDS
    for start in range(len(message_words)):
        yield " ".join(message_words[start : start + span])


def _best_similarity(message: str, phrase: str) -> float:
    message_words = message.lower().split()
    phrase_word_count = len(phrase.split())
    if len(message_words) <= phrase_word_count + _WINDOW_SLACK_WORDS:
        return SequenceMatcher(None, message.lower(), phrase).ratio()

    best = 0.0
    for window in _windows(message_words, phrase_word_count):
        score = SequenceMatcher(None, window, phrase).ratio()
        if score > best:
            best = score
    return best


def classify_message(message: str) -> ClassifierResult:
    """Run the heuristic fuzzy-match classifier over `message`.

    Returns the highest-confidence match across all risk categories, or an
    unflagged result if nothing clears `_SIMILARITY_THRESHOLD`. Category
    priority on ties follows the same order as the deterministic gate:
    life-threat > self-harm > caregiver-harm-risk > elder-abuse-neglect.
    """
    if not message or not message.strip():
        return ClassifierResult(flagged=False)

    category_priority = [
        SafetyRiskCategory.LIFE_THREAT,
        SafetyRiskCategory.SELF_HARM,
        SafetyRiskCategory.CAREGIVER_HARM_RISK,
        SafetyRiskCategory.ELDER_ABUSE_NEGLECT,
    ]

    best_category: SafetyRiskCategory | None = None
    best_score = 0.0
    best_matches: list[str] = []

    for category in category_priority:
        matches: list[str] = []
        category_best = 0.0
        for phrase in _CONCEPT_PHRASES[category]:
            score = _best_similarity(message, phrase)
            if score >= _SIMILARITY_THRESHOLD:
                matches.append(phrase)
                category_best = max(category_best, score)
        if matches and category_best > best_score:
            best_score = category_best
            best_category = category
            best_matches = matches

    if best_category is None:
        return ClassifierResult(flagged=False)

    return ClassifierResult(
        flagged=True,
        category=best_category,
        confidence=round(best_score, 3),
        matched_concepts=best_matches,
    )
