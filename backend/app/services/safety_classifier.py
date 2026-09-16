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

import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from app.services.safety_gate import SafetyGateType

# Safety Gate v2 Phase 2 (docs/SAFETY_GATE_V2_PLAN.md): this module used to
# define its own `SafetyRiskCategory(str, Enum)` with values identical to
# `safety_gate.SafetyGateType`, bridged only by string value at each call
# site (`SafetyGateType(classifier_result.category.value)` in coach.py /
# checkin.py). SafetyGateType is the canonical category enum going forward —
# it has far more callers (both routers, safety_redteam.py, most safety
# tests) and is the deterministic gate's own type. This alias keeps every
# existing `SafetyRiskCategory.*` reference (including
# test_safety_classifier.py) working unchanged rather than forcing a rename
# across call sites for no behavioral gain.
SafetyRiskCategory = SafetyGateType


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

# How similar two individual words must be (character-level) to count as the
# "same" word for the content-word gate below. Tolerates typos ("hart attak"
# for "heart attack") without requiring exact spelling.
_WORD_MATCH_THRESHOLD = 0.72

# Function words excluded when picking out a phrase's "content" words for the
# gate. Deliberately short list of near-universal stopwords, not a full NLP
# stopword corpus — the intent is only to strip words with essentially no
# semantic content of their own ("to", "the", "a"), not to be linguistically
# exhaustive.
_STOPWORDS = frozenset(
    {
        "a", "an", "the", "i", "to", "of", "in", "on", "at", "is", "it", "be",
        "do", "does", "did", "and", "or", "my", "he", "she", "him", "her",
        "his", "its", "that", "this", "what", "who", "when", "where", "why",
        "how", "just", "so", "too", "not", "no", "yes", "me", "you", "your",
        "am", "are", "was", "were", "been", "being", "have", "has", "had",
        "will", "would", "can", "could", "should", "might", "may", "must",
        "if", "with", "for", "as", "by", "up", "out", "about", "into", "over",
        "after", "before", "again", "ever", "some",
    }
)


# Safety Gate v2 Phase 4 (docs/SAFETY_GATE_V2_PLAN.md) — see
# `_best_similarity`'s docstring for why this exists: fixing the window-
# dilution bug (trying tighter window sizes) reintroduces a false positive
# the deterministic gate already guards against with a regex negative
# lookahead — "passed out" is a 2-word phrase whose only non-stopword
# content word is "passed" ("out" is in _STOPWORDS), so once tighter
# windows are tried, a window exactly reproducing "passed out" scores a
# perfect 1.0 regardless of what follows it in the message, and a slightly
# larger window that pulls the next word IN (rather than leaving it just
# after the window) still scores high enough to clear threshold either
# way. "I passed out FLYERS for the support group" is a caregiving
# activity, not unconsciousness.
#
# A position-relative check (only looking at the word right after a given
# window) turned out to be both insufficient (a larger window absorbs the
# continuation word instead of leaving it just outside) and, in an earlier
# draft, too broad when generalized (fuzzy-matching arbitrary words against
# "out" produced unrelated false suppressions). Reusing the deterministic
# gate's own mechanism instead avoids all of that: a literal, non-fuzzy
# regex check against the raw message, exactly mirroring
# safety_gate._LIFE_THREAT_PATTERNS's own "passed out" negative lookahead
# list. This only suppresses this one phrase for messages that literally
# spell "passed out" followed by one of these exact words — a typo'd
# continuation ("passed out flyeers") does not match the exclusion and
# still gets scored normally, which is the safe direction per this
# module's "fail toward escalation under uncertainty" principle. Only
# "passed out" needs this today — no other current concept phrase reduces
# to a single content word this short and this ambiguous.
_BENIGN_CONTINUATION_PATTERNS: dict[str, re.Pattern[str]] = {
    "passed out": re.compile(
        r"\bpassed\s+out\s+(?:the|of|with|flying|flyers|brochures|pamphlets|"
        r"leaflets|candy|samples|cards|business\s+cards|awards|certificates|"
        r"gifts|snacks|water\s+bottles)\b",
        re.IGNORECASE,
    ),
}


def _has_benign_continuation(phrase: str, message: str) -> bool:
    """True if `message` literally contains one of `phrase`'s known-benign
    continuations (e.g. "passed out flyers") — the whole phrase's fuzzy
    match is suppressed for this message, exactly as the deterministic
    gate's negative lookahead would exclude it."""
    pattern = _BENIGN_CONTINUATION_PATTERNS.get(phrase)
    return pattern is not None and pattern.search(message) is not None


def _content_words(words: list[str]) -> list[str]:
    filtered = [w for w in words if w not in _STOPWORDS]
    # A phrase made entirely of stopwords (shouldn't happen with the current
    # concept list, but a future addition might) falls back to the full word
    # list rather than gating on nothing.
    return filtered or words


def _best_similarity(message: str, phrase: str) -> float:
    """Similarity between a sliding window of `message` and `phrase`.

    Two things had to both be true, and pulled in opposite directions:

    - Comparing raw characters let short phrases with similar letters but
      opposite meaning collide: "what to do" scored 0.76 against "want to
      die" — sharing most of the same characters despite no shared words —
      so "I don't know what to do" (one of the most common things a
      caregiver says) was misclassified as self-harm.
    - Switching to plain word-level matching (comparing tokenized word
      lists) fixed that, but broke tolerance for typos and paraphrasing:
      "hart attak" no longer matched "heart attack" at all, since the
      tokens are just different strings to a list-based comparison.

    The fix keeps the original character-level score (typo-tolerant) but
    gates it: every content word (phrase words minus _STOPWORDS) must have
    at least one word in the window that's a plausible match for it
    (character-similarity >= _WORD_MATCH_THRESHOLD, so "hart" still matches
    "heart"). A window with no real word-level relationship to the phrase —
    like "what to do" against "want to die", which shares no content words
    at all — never reaches the character-ratio scoring that used to let it
    through on coincidental letter overlap.

    Verified against safety_redteam.py's dataset and test_safety_classifier.py
    to give equivalent detection recall to the original character-level
    version while eliminating that false positive — rerun both before
    changing this again.

    # Safety Gate v2 Phase 4 (docs/SAFETY_GATE_V2_PLAN.md) — windowing fix.
    #
    # The above fixed the false-positive problem but introduced a false-
    # negative one: every window tried was padded to a FIXED size
    # (`len(phrase_words) + _WINDOW_SLACK_WORDS`), even when the phrase's
    # words sit tightly together in the message. E.g. for "heart attack"
    # (2 words), every window was forced to 5 words. In "he had a hart
    # attak" (5 words), the only window tried was the whole 5-word message
    # — so the character ratio was computed as
    # ratio("he had a hart attak", "heart attack"), diluted well below
    # threshold by "he had a ", even though the tight 2-word substring
    # "hart attak" alone scores far above it. The content-word gate never
    # had this problem (it checks each content word independently, not the
    # padded string) — only the character-ratio scoring step did.
    #
    # Fix: try every window SIZE from `len(phrase_words)` (tightest) up to
    # `len(phrase_words) + _WINDOW_SLACK_WORDS` (the original padding, kept
    # as the upper bound so paraphrases genuinely needing that slack still
    # match exactly as before), at every position, and keep the best score
    # among windows that still pass the unchanged content-word gate. This
    # only changes which window WIDTHS get tried — the gate, the threshold,
    # and the character-ratio formula are all untouched.
    """
    if _has_benign_continuation(phrase, message):
        return 0.0

    message_words = message.lower().split()
    phrase_words = phrase.lower().split()
    phrase_content = _content_words(phrase_words)
    min_span = len(phrase_words)
    max_span = min_span + _WINDOW_SLACK_WORDS
    n = len(message_words)

    best = 0.0
    for size in range(min_span, max_span + 1):
        if n == 0:
            break
        if size >= n:
            starts = [0]
            window_size = n
        else:
            starts = list(range(n - size + 1))
            window_size = size

        for start in starts:
            window = message_words[start : start + window_size]
            has_support = all(
                any(
                    SequenceMatcher(None, content_word, w).ratio() >= _WORD_MATCH_THRESHOLD
                    for w in window
                )
                for content_word in phrase_content
            )
            if not has_support:
                continue
            score = SequenceMatcher(None, " ".join(window), phrase).ratio()
            if score > best:
                best = score
    return best


def phrase_similarity(message: str, phrase: str) -> float:
    """Public entry point to `_best_similarity`'s typo-tolerant fuzzy match.

    Safety Gate v2 Phase 3 (docs/SAFETY_GATE_V2_PLAN.md): `safety_categories.py`
    reuses this exact matcher (word-gate + character-ratio) for
    BREATHING_DIFFICULTY sub-classification, rather than duplicating the
    algorithm or importing the private `_best_similarity` directly. Threshold
    decisions stay with the caller — this returns a raw score, same as
    `_best_similarity`.
    """
    return _best_similarity(message, phrase)


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
