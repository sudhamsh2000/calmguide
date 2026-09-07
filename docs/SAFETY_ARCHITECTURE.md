# Safety Architecture

This document describes how CalmGuide detects potential life-threat,
self-harm, caregiver-harm-risk, and elder-abuse/neglect signals in user
messages, and how that detection is evaluated. It exists primarily to give
`backend/app/services/safety_classifier.py` and
`backend/app/services/safety_redteam.py` a stable home for the caveats their
docstrings already point at.

**What this document is not:** a claim of clinical validation, a substitute
for a clinician-reviewed safety corpus, or a guarantee that these layers
catch every real-world phrasing of risk. Read the caveats in each section
before citing any number from this doc.

## 1. Two-layer detection pipeline

Every inbound coach/check-in message runs through two layers, in order,
mirroring `app.routers.coach.coach_chat`:

1. **Deterministic gate** — `app/services/safety_gate.py`, `check_safety_gate()`.
   A curated set of `re.IGNORECASE` regex patterns (English plus
   Spanish/French/German/... multilingual patterns) matched directly against
   the raw message, independent of the caller's declared locale — patterns
   for every supported language are checked regardless of `locale_code`,
   which only affects which localized deflection copy (911/988/etc. numbers
   and phrasing) is returned. If a pattern matches, `SafetyGateResult.triggered`
   is `True` and the gate is **authoritative**: the LLM is bypassed entirely
   and a structured deflection response is returned instead.

2. **Heuristic classifier (fallback only)** — `app/services/safety_classifier.py`,
   `classify_message()`. Runs **only if the gate did not fire**. This is
   *not* a trained ML model — CalmGuide has no labeled safety-incident
   dataset or ML inference infrastructure today. It is a fuzzy/heuristic
   layer: short curated concept phrases per risk category (`_CONCEPT_PHRASES`),
   compared against sliding windows of the message. As of 2026-09-07 this is a
   two-step check, not a single similarity score: a window must first clear a
   **word-level content-word gate** (every non-stopword word in the concept
   phrase needs a plausible character-similarity match, `>= 0.72`, among the
   window's words) before the original `difflib.SequenceMatcher` character-level
   ratio against the full phrase is even computed, flagged when that ratio
   clears `_SIMILARITY_THRESHOLD` (currently `0.72`, chosen conservatively to
   favor recall over precision, not validated against a labeled dataset). The
   gate exists because pure character-level comparison let short phrases with
   overlapping letters but opposite meaning collide (see §3's resolved-gaps
   note); the char-level score is kept behind it rather than replaced, so
   typo tolerance ("hart attak" → "heart attack") still works.
   This layer never downgrades or suppresses a gate trigger — it only adds
   coverage the gate missed.

Four risk categories are shared by both layers (`SafetyGateType` /
`SafetyRiskCategory`, kept as parallel enums with the same string values):
`life_threat`, `self_harm`, `caregiver_harm_risk`, `elder_abuse_neglect`.

A message is considered a "trigger" for evaluation purposes if either layer
flags it; the detection layer that caught it (`"deterministic_gate"` or
`"classifier"`) is recorded for analysis.

## 2. Red-team evaluation harness

`app/services/safety_redteam.py` provides a lightweight regression harness
for the two-layer pipeline above.

### 2.1 What `REDTEAM_DATASET` is — and isn't

`REDTEAM_DATASET` is a list of `RedTeamCase` entries, **engineering-authored**
synthetic paraphrases and adversarial near-misses written to exercise the
gate and classifier, not sourced from real safety incidents and not
reviewed by a clinician. Every case's `reviewed_status` field is
`"unreviewed"` until an actual clinician/domain review has happened — that
field must never be flipped to `"reviewed"` without a real review taking
place.

Do not cite metrics produced by this harness as evidence of clinical
sensitivity/specificity. They measure regression against a labeled set this
project wrote for itself, nothing more.

### 2.2 Dataset structure

Each `RedTeamCase` has:

| Field | Meaning |
|---|---|
| `text` | The message to evaluate. |
| `language` | Bare locale code (`"en"`, `"es"`, ...), matching `safety_gate`'s locale bases. |
| `expected_label` | `ExpectedLabel.TRIGGER` or `ExpectedLabel.NO_TRIGGER`. |
| `risk_category` | Expected `SafetyGateType` if `TRIGGER`, else `None`. |
| `source` | Provenance string, e.g. `"synthetic_engineering"`. |
| `reviewed_status` | `"unreviewed"` or `"reviewed"`. |

`evaluate_case()` runs a case through the exact same gate → classifier
fallback used in production (`app.routers.coach.coach_chat`) and returns a
`CaseResult` (actual trigger state, actual category, which layer caught it).

### 2.3 Metrics

`run_evaluation()` runs every case and computes a confusion matrix and
derived metrics on `EvaluationReport`:

- `true_positives` / `false_negatives` / `false_positives` / `true_negatives`
- `sensitivity` (recall): `TP / (TP + FN)`
- `specificity`: `TN / (TN + FP)`
- `precision`: `TP / (TP + FP)`
- `false_positive_rate`: `FP / (FP + TN)`
- `category_match_rate`: of the true positives, the fraction whose actual
  category exactly matched the case's expected `risk_category` (a trigger
  that fires under the wrong category is not counted as a full match)
- `false_negatives_detail` / `false_positives_detail`: the underlying
  `CaseResult`s for manual inspection

### 2.4 Tests and regression floors

`backend/tests/test_safety_redteam_harness.py` covers three things:

1. **Confusion-matrix math correctness** — a small, hand-picked, independent
   case list with a known, manually-verified outcome, so this test doesn't
   get brittle as `REDTEAM_DATASET` grows.
2. **Dataset well-formedness** — every case has non-empty text/language/source,
   a valid `expected_label`, a `risk_category` iff `TRIGGER`, and a valid
   `reviewed_status`.
3. **Regression floor on `REDTEAM_DATASET`** — asserts sensitivity ≥ 0.9,
   specificity == 1.0, false-positive rate == 0.0, and category-match-rate
   == 1.0. These are **today's measured values on this synthetic set**, not
   validated clinical targets. Raise them as coverage improves; a drop below
   them signals an actual regression in `safety_gate.py` /
   `safety_classifier.py` that needs investigation before merge.

## 3. Known gaps (flagged for future clinician / native-speaker review)

- **~~Character-level collisions on short, unrelated phrases.~~ RESOLVED
  2026-09-07.** A production message — "he keeps wandering at night and I
  don't know what to do," an extremely common, benign caregiver question —
  was misclassified as self-harm risk and routed to the crisis fallback
  instead of an actual answer. Root cause: `_best_similarity`'s
  character-level `SequenceMatcher` scored the substring "what to do" at
  0.762 against the self-harm concept phrase "want to die" — the two strings
  share most of their characters (w, a, t, o, d) despite opposite meaning,
  and the old implementation had no word-level check to catch that. Fixed by
  gating the character-level score behind the word-level content-word check
  described in §1 above (`backend/app/services/safety_classifier.py`); the
  exact production phrase was added to `REDTEAM_DATASET` as a permanent
  regression case (`source="production_incident"`). Verified against the
  full red-team dataset (0 false positives, same detection recall as before)
  and the full backend suite (1572 passed). This is a specific, resolved
  false-positive class — it is not a claim that the classifier is free of
  other false positives; `_SIMILARITY_THRESHOLD` and `_CONCEPT_PHRASES`
  remain untuned against a labeled dataset, per the gaps below.
- **Spanish progressive-tense drowning/breathing phrasing.** The message
  "No está respirando, creo que se está ahogando" ("He's not breathing, I
  think he's drowning") is a false negative: the multilingual life-threat
  pattern `no\s+respira` matches the simple present ("no respira") but not
  the progressive construction "no está respirando". This was deliberately
  **not** guess-patched — expanding Spanish-language regex coverage without
  a native speaker confirming the fix doesn't introduce false positives
  elsewhere in Spanish grammar is exactly the kind of change
  `mobile/locales/REVIEW_STATUS.md` and
  `app/services/language_support.py` (`native_review_pending`) already flag
  as pending for Spanish. Tracked here so it isn't lost; see
  `REDTEAM_DATASET`'s Spanish life-threat case, and the regression floor
  (`sensitivity >= 0.9`, not `== 1.0`) that currently accommodates it.
- **`_SIMILARITY_THRESHOLD = 0.72` in `safety_classifier.py`** is a
  conservative, engineering-chosen value, not tuned against a labeled
  dataset. Use this harness to evaluate threshold changes before adjusting
  it.
- **Concept-phrase lists are intentionally small.** Expanding
  `_CONCEPT_PHRASES` in `safety_classifier.py` and the pattern lists in
  `safety_gate.py` — under red-team-harness regression coverage — is the
  primary path to improving recall over time.
- **No real trained classifier.** A fine-tuned model or embedding-similarity
  search over a labeled corpus is a documented future upgrade, contingent on
  CalmGuide acquiring a labeled safety-incident dataset it does not have
  today.
- **The two-layer gate does not run at all while the client is offline.**
  Both layers described in §1 are server-side only — there is no client-side
  regex/heuristic mirror in the mobile app or web frontend. The P2-12
  offline/degraded-mode work (`mobile/src/lib/network.ts`,
  `frontend/src/hooks/useNetworkStatus.ts`, and each app's `OfflineBanner`)
  detects connectivity and shows a generic "you're offline" message, but a
  caregiver who types a life-threat message (e.g. "he's not breathing")
  while offline gets only that generic banner/error — not the 911/988
  deflection response the gate would have returned if the request had
  reached the backend. This was deliberately **not** patched by porting
  `safety_gate.py`'s regex patterns to the client: duplicating a
  safety-critical detection layer across three codebases (Python backend,
  TypeScript mobile, TypeScript web) risks the copies silently drifting out
  of sync, which is worse than having no offline coverage and a clear
  online-only guarantee. See `docs/DEFERRED.md`'s "Full Offline Support"
  entry for why this also blocks building offline request queueing. Tracked
  here as a known, deliberate gap rather than a silent one — flagging for
  future design work on a minimal, explicitly-synced client-side tripwire
  (e.g. always surfacing crisis resources when offline, independent of
  message content) rather than a full client-side gate port.

## 4. How to run the harness

```bash
cd backend
.venv/bin/python -m pytest tests/test_safety_redteam_harness.py -v
```

To inspect false negatives/positives interactively:

```python
from app.services.safety_redteam import REDTEAM_DATASET, run_evaluation

report = run_evaluation(REDTEAM_DATASET)
print(report.sensitivity, report.specificity, report.false_positive_rate)
for r in report.false_negatives_detail:
    print("FN:", r.case.text)
```
