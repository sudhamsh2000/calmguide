"""Safety Gate v2 Phase 4, step 1 — reproduces the `_best_similarity` window-
dilution bug, then (once the fix below landed) pins down the corrected
behavior as a permanent regression test.

Bug summary (docs/SAFETY_GATE_V2_PLAN.md, "Known safety regression
protections" #2): `_best_similarity` always scores a message against a
phrase using a window PADDED to `len(phrase_words) + _WINDOW_SLACK_WORDS`
words, even when the phrase's actual words sit tightly together in the
message with no need for that padding. The character-level
`SequenceMatcher` ratio is computed over the whole padded window string, so
extra unrelated words the padding pulls in dilute the ratio below
`_SIMILARITY_THRESHOLD` — even though the content-word plausibility gate
(which operates per-word, not on the padded string) correctly recognizes
the phrase is present.

- Input: "he had a hart attak"
- Candidate phrase: "heart attack"
- Expected best-match behavior: should score >= _SIMILARITY_THRESHOLD
  (0.72) and flag LIFE_THREAT — "hart attak" is a plausible, common typo of
  "heart attack", and the message is exactly the kind of short, direct
  caregiver report the classifier exists to catch.
- Original incorrect behavior (pre-fix): `classify_message` did NOT flag
  this message — `_best_similarity` never cleared 0.72 for it.
- Why it happened: `len(phrase_words)` for "heart attack" is 2;
  `_WINDOW_SLACK_WORDS` is 3; every window `_best_similarity` tried was
  forced to a fixed 5 words (or, since the message here IS 5 words, the
  single window tried was the WHOLE message: "he had a hart attak"). The
  content-word gate passed fine ("hart"~"heart", "attak"~"attack" both
  clear 0.72 word-level similarity) — but the character-ratio score was
  then computed over the full 20-character padded string "he had a hart
  attak" against the 12-character phrase "heart attack", measurably less
  similar than the 10-character substring "hart attak" alone. The padding
  was never trimmed even when a tighter, better-matching window existed in
  the same message.
- Fix: `_best_similarity` now tries every window SIZE from
  `len(phrase_words)` up to the original padded size, not just the padded
  size alone, keeping the best-scoring window that still passes the
  unchanged content-word gate. See that function's own docstring in
  safety_classifier.py for the full explanation.

The tests below now assert the FIXED (correct) behavior and serve as the
permanent regression test for this bug going forward.
"""

from difflib import SequenceMatcher

from app.services.safety_classifier import (
    _SIMILARITY_THRESHOLD,
    _best_similarity,
    classify_message,
)


class TestDilutionBugFixed:
    def test_tight_phrase_alone_still_clears_threshold(self):
        """Baseline, unaffected by this fix: the typo'd phrase with no
        surrounding words already scored well above threshold before, and
        must continue to."""
        score = _best_similarity("hart attak", "heart attack")
        assert score >= _SIMILARITY_THRESHOLD, (
            f"expected 'hart attak' alone to clear threshold, got {score}"
        )

    def test_same_phrase_embedded_in_an_ordinary_sentence_now_matches(self):
        """The bug, fixed: identical typo'd content, embedded in a realistic
        5-word caregiver sentence, must now clear threshold via a tighter
        internal window rather than being diluted by the padded one."""
        score = _best_similarity("he had a hart attak", "heart attack")
        assert score >= _SIMILARITY_THRESHOLD, (
            f"dilution bug regressed — got {score}, expected >= {_SIMILARITY_THRESHOLD}"
        )

    def test_classify_message_now_flags_the_embedded_typo(self):
        """End-to-end: classify_message must now flag this realistic
        message as LIFE_THREAT."""
        result = classify_message("he had a hart attak")
        assert result.flagged is True
        assert result.category is not None
        assert result.category.value == "life_threat"

    def test_content_word_gate_itself_was_never_the_problem(self):
        """Isolates the root cause for posterity: the word-level
        plausibility gate correctly recognized 'hart'~'heart' and
        'attak'~'attack' even before the fix — the bug was purely in the
        character-ratio scoring step, confirming the fix correctly targeted
        aggregation/windowing rather than the gate."""
        assert SequenceMatcher(None, "hart", "heart").ratio() >= 0.72
        assert SequenceMatcher(None, "attak", "attack").ratio() >= 0.72

    def test_a_second_realistic_case_with_more_padding_words_now_matches(self):
        """Same bug, worse padding: a longer, still entirely realistic
        sentence with even more surrounding words must now also match."""
        score = _best_similarity("i think he is having a hart attak right now", "heart attack")
        assert score >= _SIMILARITY_THRESHOLD, f"got {score}"
