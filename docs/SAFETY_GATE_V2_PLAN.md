# Safety Gate v2 — Phase 1: Current Architecture

Inspection only. No production code was modified while producing this
document. Commit at inspection time: `3b405ce` (branch `main`).

## Current request flow (as verified in code, not assumed)

### Moment Coach (`POST /api/coach/chat`, `backend/app/routers/coach.py`)

The actual order is **not** what a "safety screening happens first" mental
model would predict:

```text
1. Resolve profile (B2C access_code or B2B profile_id + authz)
2. Resolve locale / emergency_locale / language
3. build_english_rag_query()          — may call the LLM to translate the query
4. asyncio.gather(
     _rag_pipeline()                  — vector store retrieval (RAG)
     _db_context()                    — dossier, incidents, cross-patient,
                                         care-change window (sequential DB reads)
   )
5. render_coach_prompt()              — builds the full system prompt
6. _get_conversation_history()        — DB read, up to _MAX_HISTORY_MESSAGES
7. check_safety_gate()                — deterministic regex gate
8. classify_message()                 — heuristic fuzzy classifier (only if
                                         step 7 didn't trigger)
9. IF triggered: return safety_stream() (steps 3-6's work is discarded)
   ELSE: call llm.stream_completion() with the prompt built in step 5
10. validate_response_quality() → guard_response_text() if invalid
11. _spawn_persistence() — background write of message/incident/insights
```

**Finding — this is the sprint's actual starting problem, more concretely
than the spec's diagram states it:** steps 3-6 (RAG retrieval, an LLM call to
translate the query, dossier/incident/cross-patient DB reads, and full
prompt construction) all run **before** the safety gate (step 7) even
executes. Every Moment Coach message pays for RAG + DB context + prompt
building, including messages that turn out to be life-threat or self-harm
and get their result thrown away at step 9. This is the concrete target for
Phase 5's "bypass RAG/DB for emergency" — today there is no bypass at all;
safety runs last, not first.

### Daily Check-In (`POST /api/checkin`, `backend/app/routers/checkin.py`)

```text
1. Resolve profile (access_code only, no B2B mode)
2. Resolve locale / emergency_locale / language
3. check_safety_gate()
4. classify_message() (only if step 3 didn't trigger)
5. IF triggered: return safety_stream()
   ELSE: render_checkin_prompt() → llm.stream_completion()
6. validate_response_quality() → guard_response_text() if invalid
```

Check-in has **no RAG step at all** and already runs the safety gate before
any LLM call. It is already close to the "safety first" shape Phase 5 wants
for Coach — the gap here is smaller, and mostly about sharing whatever new
decision model Phase 2 introduces rather than restructuring control flow.

### Acute-change screen (`POST /api/coach/acute-change-screen`)

A **separate, optional endpoint** (`app/services/acute_change_screen.py`),
not invoked automatically inside `coach_chat`. The client is expected to
call it first for a new/sudden behavior change; it is a structured
yes/no/unsure questionnaire, not free text, and returns
`PROCEED_TO_COACHING` or `MEDICAL_EVALUATION_RECOMMENDED`. It has its own
`TODO(CLINICAL-REVIEW-REQUIRED)` markers on every threshold. This is the
existing, working precedent for an "escalate before generation" pattern —
Safety Gate v2's `acute_change` category should route to this same
philosophy (recommend evaluation, do not diagnose), not invent new copy.

## Relevant files

| File | Role |
|---|---|
| `backend/app/services/safety_gate.py` | Deterministic regex gate. 4 categories: `LIFE_THREAT`, `SELF_HARM`, `CAREGIVER_HARM_RISK`, `ELDER_ABUSE_NEGLECT`. Authoritative when it fires. Builds locale-aware deflection response text (911/988/elder-abuse/caregiver-harm copy) via `_GATE_RESPONSE_BUILDERS`. Also owns `LOCALE_EMERGENCY_NUMBERS` and `resolve_emergency_locale()` — deliberately wider than the 3 shipped UI languages. |
| `backend/app/services/safety_classifier.py` | Heuristic fuzzy second layer, runs only if the gate didn't trigger. Explicitly documented as **not a trained ML model**. Same 4 categories (`SafetyRiskCategory`, structurally identical values to `SafetyGateType`, but a separate enum). Never suppresses a gate trigger — only adds coverage. |
| `backend/app/services/acute_change_screen.py` | Separate structured screen, own outcome enum (`PROCEED_TO_COACHING` / `MEDICAL_EVALUATION_RECOMMENDED`), own `TODO(CLINICAL-REVIEW-REQUIRED)` markers. |
| `backend/app/services/response_guard.py` | Post-generation output guard: `validate_response_quality()` (language/script + respect checks), `guard_response_text()` (LLM repair), `get_localized_fallback()` (static fallback if repair fails). Independent of Safety Gate — this guards LLM *output*, gate guards *input*. |
| `backend/app/services/safety_log.py` | `log_safety_event()` — categorical-only structured logging (event_type, source, category, confidence — explicitly forbids raw free text in `details`). Already the shape Phase 7 observability should extend. |
| `backend/app/services/safety_redteam.py` | `RedTeamCase` / `ExpectedLabel` (`TRIGGER` / `NO_TRIGGER`) / `run_evaluation()` → `EvaluationReport` (sensitivity, specificity, FPR, category-match). Existing regression-metric infrastructure Phase 8 should extend, not replace. |
| `backend/app/routers/coach.py` | Moment Coach SSE endpoint. Safety check at lines 701-722, inside `coach_chat()`. |
| `backend/app/routers/checkin.py` | Check-in SSE endpoint. Safety check at lines 94-108. |
| `backend/app/services/retrieval_query.py` | `build_english_rag_query()` — LLM call to translate non-English messages before RAG/incident matching. Currently runs unconditionally, before safety. |
| `backend/app/routers/health.py` | Existing per-process observability pattern (`availability.py` LLM status, `response_timing.py` p50/p95, `token_usage.py` cache stats) — Phase 7 should extend this shape, not redesign it. |

## Current safety categories and enums

Two **separately defined but value-identical** enums exist today:

```python
# safety_gate.py
class SafetyGateType(str, Enum):
    LIFE_THREAT = "life_threat"
    SELF_HARM = "self_harm"
    CAREGIVER_HARM_RISK = "caregiver_harm_risk"
    ELDER_ABUSE_NEGLECT = "elder_abuse_neglect"

# safety_classifier.py
class SafetyRiskCategory(str, Enum):
    LIFE_THREAT = "life_threat"
    SELF_HARM = "self_harm"
    CAREGIVER_HARM_RISK = "caregiver_harm_risk"
    ELDER_ABUSE_NEGLECT = "elder_abuse_neglect"
```

`coach.py`/`checkin.py` currently bridge them by value at the call site:
`SafetyGateType(classifier_result.category.value)`. Any new shared category
set (Phase 3) should resolve this duplication rather than adding a third
parallel enum.

None of the sprint's proposed new categories (`acute_change`,
`medication_risk`, `fall_or_head_injury`, `breathing_difficulty`,
`reduced_consciousness`, `routine_caregiver_issue`) exist as first-class
categories today. Some already have partial coverage as *regex patterns
inside* `LIFE_THREAT` (e.g. `head_injur`, breathing patterns, `unconscious`)
without being their own routable category — Phase 3 needs to decide whether
these become genuinely separate categories (changing routing) or stay as
`LIFE_THREAT` sub-signals (changing only observability granularity). This is
listed as an open decision below.

## Current return values

- `SafetyGateResult(triggered: bool, gate_type: SafetyGateType | None, response_text: str)`
- `ClassifierResult(flagged: bool, category: SafetyRiskCategory | None, confidence: float, matched_concepts: list[str])`

Both are boolean-triggered, not risk-leveled — there is no `LOW` /
`MODERATE` / `HIGH` / `EMERGENCY` gradient today. Everything is either "the
4 hard-coded categories fire and bypass the LLM entirely" or "nothing fires
and the message goes through the full normal pipeline." This is the actual
gap Phase 2's `RiskLevel`/`SafetyAction` model is meant to fill — today
there is no MODERATE or HIGH tier between "normal" and "hard bypass."

## Existing fuzzy-classifier thresholds

- `_SIMILARITY_THRESHOLD = 0.72` — final match threshold (marked
  `TODO(CLINICAL-REVIEW-REQUIRED / TUNING)`, not validated against a labeled
  dataset).
- `_WORD_MATCH_THRESHOLD = 0.72` — per-word content-gate threshold (same
  value, different purpose — gates which windows are even scored).
- `_WINDOW_SLACK_WORDS = 3` — sliding-window padding size.

## Known safety regression protections already in place

1. **"what to do" vs. "want to die" false positive** (fixed, `safety_classifier.py`
   `_best_similarity`, documented in the docstring and
   `docs/AUDIT.md` 2026-09-07 entry): word-level content-gate added ahead of
   the character-level `SequenceMatcher` score. Covered by
   `test_safety_classifier.py` and the red-team dataset.
2. **A second, related, currently-UNFIXED gap found in a prior session**
   (not yet in `docs/AUDIT.md` as a fix — flagging here since it's directly
   relevant to Phase 4): the content-word gate checks whole-window
   similarity against the padded window, not the best-aligned sub-window.
   A correctly-typo'd phrase embedded in a longer sentence can still score
   below threshold due to dilution from the padding words — e.g. `"hart
   attak"` alone scores ~0.91, but `"he had a hart attak"` scores ~0.71
   (below the 0.72 threshold) and is missed. Verified empirically earlier
   this project against the red-team harness; also verified that simply
   lowering `_SIMILARITY_THRESHOLD` to fix it introduces a new false
   positive ("I passed out flyers for the caregiver support group today"),
   dropping specificity from 1.0 to 0.909 with zero sensitivity gain. Phase
   4 should fix the dilution bug properly (score the best-aligned
   sub-window, not the whole padded window) rather than touch the
   threshold.
3. **Deterministic gate is always authoritative** — the classifier
   (`classify_message`) is only consulted `if not safety.triggered`, and
   never overrides or downgrades a gate result. Phase 2/5 must preserve
   this ordering exactly.
4. **Regex carve-outs for known false-positive phrasing**, e.g.
   `passed?\s+out\b(?!\s+(?:the|of|with|flying|flyers|brochures|...))` in
   `safety_gate.py` — "passed out flyers" must not fire `LIFE_THREAT`. Any
   refactor of pattern storage (Phase 3) must preserve these negative
   lookaheads verbatim, not just the positive patterns.
5. **Cross-language coverage regardless of declared UI locale** — both
   `_LIFE_THREAT_PATTERNS`/`_SELF_HARM_PATTERNS` (English) and their
   `_MULTILINGUAL_*` counterparts (ES/FR/DE/PT/JA/KO/ZH/HI/TA/AR) run on
   every message unconditionally, not gated by the caller's locale header.
6. **`safety_redteam.py` regression floor**, enforced by
   `test_safety_redteam_harness.py`: sensitivity ≥ 0.9, specificity == 1.0,
   FPR == 0.0, category-match == 1.0 on the current 27-case dataset. Any
   Phase 3/4 change must keep this suite green.

## Where RAG starts

`backend/app/routers/coach.py`, inside `_rag_pipeline()` (line 545),
calling `_fetch_rag_context()` (line 68), which lazily imports
`rag.retrieve.get_rag_context()`. This import is function-scoped
specifically so RAG's scraping dependencies never need to be installed in
production — Phase 5's "skip RAG for emergency" should preserve this lazy
import, i.e. skip calling `_rag_pipeline()` entirely for emergency-routed
messages rather than calling it and discarding the result.

## Where patient/context DB loading starts

`_db_context()` (coach.py line 550) — dossier, cross-patient strategies,
care-change window, and relevant-incident retrieval, all sharing the
request's `AsyncSession` (sequential, not concurrent, within that function).
Profile lookup itself (access_code/profile_id resolution) happens earlier
and is **not** skippable — the safety gate check itself currently runs
after profile resolution and needs `emergency_locale` (from request
headers, not the profile) but does not need profile data. This means an
emergency short-circuit could run *before* profile resolution if we only
need locale headers to build the escalation response — worth flagging as a
design option for Phase 5 review, not deciding here.

## Where LLM generation starts

- Coach: `llm.stream_completion(system_prompt, messages, model_override=...)`,
  `coach.py` line 854, inside `event_stream()`.
- Check-in: same call shape, `checkin.py` line 154.
- Both go through `request.app.state.llm_provider` (the
  `FallbackLLMProvider` wrapping OpenAI/Anthropic, per `llm_provider.py`).
- `build_english_rag_query()` (coach.py line 539) **also calls the LLM**,
  before the main generation call — this is a second LLM round-trip that
  currently happens unconditionally, before safety, and would also be
  waste on an emergency-routed message.

## Existing tests (all currently passing, verified this session)

Ran directly, not assumed: `528 passed` across
`test_safety_gate.py`, `test_safety_classifier.py`,
`test_safety_classifier_integration.py`, `test_safety_gate_multilingual.py`,
`test_safety_redteam_harness.py`, `test_acute_change_screen.py`,
`test_acute_change_screen_endpoint.py`, `test_response_guard.py`,
`test_response_guard_enhanced.py`, `test_rag.py`.

These are the suites any Phase 2-5 change must keep green, plus whatever
new tests Phases 2-4 add.

## Potential implementation risks

1. **Reordering coach.py's control flow is the highest-risk part of this
   sprint.** Moving the safety check ahead of `build_english_rag_query()` /
   `asyncio.gather(_rag_pipeline(), _db_context())` changes real request
   timing and touches the function's busiest, most carefully-commented
   section (the concurrency comments about `max(rag, db)` timing exist for
   a reason — a naive reorder could silently reintroduce the
   sum-instead-of-max latency the current code deliberately avoids for the
   *non-emergency* path). This needs care, not a rewrite: emergency
   detection needs to happen before the gather, non-emergency needs to keep
   the existing concurrent shape exactly as-is.
2. **Two parallel category enums** (`SafetyGateType` vs.
   `SafetyRiskCategory`) already exist and are bridged by string value at
   the call site. Introducing a third (Phase 2/3's shared category model)
   without resolving this risks a three-way drift. Recommend Phase 3
   consolidates to one category enum used by both the gate and classifier,
   rather than adding a new one alongside the existing two.
3. **The dilution bug in `_best_similarity`** (see "Known safety regression
   protections," #2) is real and unfixed. Phase 4 should fix it, but the
   fix must be verified against the red-team harness before/after, exactly
   as the original "what to do" fix was — a similarity-scoring change is
   exactly the kind of edit that silently shifts recall/precision on
   categories it wasn't targeting.
4. **`RiskLevel`/`SafetyAction` is a genuinely new data model**, not a
   rename of existing fields. `allow_rag`/`allow_llm`/`requires_escalation`
   don't exist anywhere in the current code as booleans — they're implicit
   in control flow (an `if safety.triggered: return ...` early-return).
   Making them explicit fields is the right direction per the spec, but
   means Phase 2's dataclass is additive scaffolding until Phase 5 actually
   wires routing decisions to read from it — until then it risks becoming
   dead code that duplicates the real (`if triggered`) control flow. Phase
   2's tests should assert the model's *values* are correct for representative
   inputs; Phase 5 is what makes those values load-bearing.
5. **`MODERATE`/`HIGH` risk tiers have no home in the current pipeline.**
   The spec's Phase 5 instructions for `HIGH` say "use the safest currently
   approved existing escalation behavior... if the codebase does not
   already support constrained guidance for this category, preserve
   existing behavior and create a TODO rather than fabricating clinical
   content." Given the current pipeline is binary (bypass-LLM-entirely or
   full-normal-flow), there is **no existing "constrained guidance" mode to
   fall back to** — `CONSTRAINED_GUIDANCE`/`CONTACT_CLINICIAN`/
   `URGENT_EVALUATION` as actions have no current implementation to reuse.
   This is a concrete question for the Phase 1 review, not something to
   guess at in Phase 5: see Questions below.
6. **`acute_change` as a routing category overlaps a working, separate
   endpoint** (`/coach/acute-change-screen`). Phase 3 needs to decide
   whether `acute_change` triggers from free-text pattern matching inside
   Safety Gate v2 (new), or whether it stays exclusively the structured
   screen's job (existing) and Safety Gate v2 only recommends the caregiver
   *run* that screen. Building a second, free-text path to the same
   conclusion risks duplicated, drifting logic.

## Recommended implementation sequence

1. **Phase 2** — Add `RiskLevel`, `SafetyAction`, and a consolidated result
   dataclass (resolving the `SafetyGateType`/`SafetyRiskCategory` duplication
   per risk #2 above) in a new module (e.g. `safety_decision.py`), built as
   a pure mapping layer on top of the *existing* `SafetyGateResult`/
   `ClassifierResult` outputs — additive, no control-flow changes yet.
   Unit tests only.
2. **Phase 3** — Introduce the explicit category set. For the categories
   that already exist as sub-patterns inside `LIFE_THREAT`
   (breathing/head-injury/unconsciousness), decide once (see Questions)
   whether they split into first-class categories now or stay as
   `LIFE_THREAT` with richer `matched_rule` metadata for observability —
   don't let this decision block on a false binary of "add everything" vs.
   "add nothing." New categories with no existing pattern coverage
   (`medication_risk`, `routine_caregiver_issue`) get category *labels* and
   routing behavior but explicitly no new detection patterns beyond what's
   asked for — regression tests per category.
3. **Phase 4** — Fix the known dilution bug in `_best_similarity` (best-
   aligned sub-window scoring instead of whole-padded-window scoring),
   verified against the red-team harness before/after exactly as the
   original fix was. Add the typo/speech-to-text/ambiguous-phrase regression
   tests the spec asks for.
4. **Phase 5** — Wire the Phase 2 decision model into `coach.py`'s control
   flow: compute the safety decision immediately after locale resolution
   (before `build_english_rag_query()`), skip `_rag_pipeline()`/
   `_db_context()`/the LLM call entirely for `EMERGENCY`, and preserve the
   existing `asyncio.gather` concurrency shape unchanged for every other
   tier. Apply the identical decision point to `checkin.py` (smaller change
   there, since it already runs safety first and has no RAG step).

## Questions requiring a decision before Phase 2 proceeds

1. **Do the sub-patterns currently embedded in `LIFE_THREAT`**
   (breathing difficulty, head injury/fall, reduced consciousness) **become
   their own first-class routable categories, or stay `LIFE_THREAT` with
   richer metadata?** This changes what Phase 3's category refactor
   actually touches — splitting them means new regex groups and new
   `SafetyGateType`/category enum members; keeping them merged means only
   `matched_rule`/observability granularity changes. The spec lists them as
   separate categories but the current authoritative deterministic gate
   already treats them as one bucket for routing purposes (all → 911
   response) — a split changes response *text* selection, not just
   labels, unless every sub-category still resolves to the same escalation
   response.
2. **What should `SafetyAction.CONSTRAINED_GUIDANCE`/`CONTACT_CLINICIAN`/
   `URGENT_EVALUATION` actually *do* today**, given no such mode exists in
   the current pipeline? The spec explicitly says not to fabricate a new
   clinical protocol and to leave a TODO if nothing safe already exists.
   Confirming this now avoids Phase 5 inventing behavior mid-implementation:
   proposed default is that `HIGH` reuses the acute-change-screen's
   existing `MEDICAL_EVALUATION_RECOMMENDED` message pattern/tone (already
   reviewed-as-a-placeholder, already carries its own
   `TODO(CLINICAL-REVIEW-REQUIRED)`) rather than a new message, with actual
   RAG+LLM generation still skipped. Needs sign-off before Phase 5.
3. **Does `medication_risk` as a category include dose-change *requests*
   directed at CalmGuide** (e.g. "should I give her an extra dose of..."),
   which the engineering rules explicitly forbid answering? If so, Phase 3
   needs at least one pattern/concept-phrase for this, scoped narrowly
   enough not to over-trigger on caregivers merely *describing* an existing
   medication routine. Needs a decision on scope before Phase 3's category
   patterns are written, not left implicit.
4. **Should `acute_change` (Safety Gate v2, free-text) and the existing
   `/coach/acute-change-screen` (structured questionnaire) converge, or
   stay deliberately separate** (gate only *recommends* running the
   screen; screen remains the only place that actually evaluates
   concerning-flag combinations)? Recommend the latter to avoid duplicated,
   independently-drifting clinical-adjacent logic — but this is a product
   call, not an engineering default to assume silently.
5. **Where exactly does the Phase 5 short-circuit sit relative to profile
   resolution?** (See "Where patient/context DB loading starts" above.)
   Running emergency detection before the DB profile lookup would save a
   query but means the safety response can't be persisted against a
   `profile_id` the way `_save_safety_turn()` currently does. Recommend
   keeping profile resolution before the safety check (minimal change,
   preserves persistence), and only skip `_rag_pipeline()`/`_db_context()`/
   the LLM call — but flagging this as a design choice worth confirming
   rather than assuming.
