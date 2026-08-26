# CalmGuide Memory Graph Design

**Version:** 2026-08-26
**Status:** Living document — formalizes the existing Behavioral Memory Layer as a memory graph; update when computation logic changes
**Audience:** Team, LOF Gate 1 reviewers
**Depends on:** [`docs/domain-catalog.md`](./domain-catalog.md) — entity fields/types are defined there; this doc covers how those entities connect, invalidate, and recompute as a graph of memory.

**DICE cross-reference:** `BehavioralDossier`'s contraindicated/effective lists are the mechanism behind DICE's Evaluate phase — see `app/services/dice_workflow.py` for the phase-to-code mapping. `get_relevant_incidents` (§5.1's sibling in `services/incident_retriever.py`) and `compute_dossier` are the two read paths a caregiver's memory can reach the coach prompt through; `backend/tests/test_behavioral_memory_isolation.py` regression-tests that neither ever returns another profile's data.

**Framing note:** there is no literal graph database here — this is a relational schema (Postgres) that *behaves* like a memory graph: an anchor node per patient, event nodes that accumulate over time, derived nodes that recompute from those events, and one global node shared anonymously across all patients. This doc names that structure explicitly so it can be reasoned about, extended, and reviewed as one system rather than as scattered tables.

---

## 1. Why a Memory Graph

CalmGuide's core differentiator (per the LOF proposal) is that the AI "gets smarter" about one specific patient over time, without ever accumulating identity data. The memory graph is the mechanism: every incident, check-in, and feedback event a caregiver logs becomes part of a growing, encrypted, per-patient memory that is recomputed into a compact narrative and injected into every crisis prompt — plus a separate anonymized layer that lets *other* caregivers benefit from what worked for similar patients, from day one.

Two distinct memory scopes exist, and conflating them would be a design error:
- **Per-patient memory** — everything hangs off one `Profile` node, is fully identifiable within the system (though PII-free), and never crosses to another profile.
- **Global/shared memory** — a single anonymized, k-anonymized aggregate (`CrossPatientStrategies`) with no FK to any profile at all.

---

## 2. Node Types

### 2.1 Anchor node

| Node | Role |
|---|---|
| **Profile** | Root of one patient's memory graph. Every other per-patient node hangs off `profile_id`. Holds the only "cold start" memory — the caregiver-entered disease stage, known behavioral patterns, calming strategies, safety concerns — that seeds the very first crisis prompt before any incidents exist. |

### 2.2 Raw event nodes — the memory graph's write path

These accumulate append-only (mostly) over the life of a profile. They are the *evidence*; derived nodes are computed *from* them.

| Node | What it captures | Write frequency |
|---|---|---|
| **Incident** | One ABC (Antecedent-Behavior-Consequence) episode — auto-extracted from a `Conversation` or logged manually/by voice. The highest-signal event node: has `recall_confidence`, `extraction_confidence`, and a `verified_by_caregiver` flag, all of which feed directly into how much weight the event carries downstream. | Per crisis session (auto-extract) or ad hoc (manual/voice log) |
| **DailyCheckin** | One-tap or three-tap mood log (`severity`, `time_slot`, optional `tags`). Lower-fidelity than `Incident` but higher-frequency — the input that makes episode-cycle detection possible even on days without a full crisis conversation. | Daily, caregiver-initiated |
| **Conversation** | One turn of a crisis chat. Not itself an analytical input to the dossier, but the *source* incidents get auto-extracted from, and the anchor for `ResponseFeedback`. | Per message |
| **ResponseFeedback** | Thumbs up/down + strategy tags on one assistant response. Feeds both `ProfileInsights` (this patient's own `effective_strategies`/`ineffective_reasons`) and, nightly, the global `CrossPatientStrategies` node. | Per response, optional |
| **CareChangeEvent** | Not a behavioral event — a *context* node. Declares an observation window during which incidents are excluded from pattern computation, so a medication change doesn't get misread as a new behavioral cycle. This is the memory graph's one explicit "don't learn from this yet" mechanism. | Ad hoc, caregiver/staff-declared |

### 2.3 Derived nodes — the memory graph's read path

Neither of these is a source of truth; both are recomputed from the raw event nodes above and would be fully reconstructable if dropped and rebuilt.

| Node | Computed from | Consumed by |
|---|---|---|
| **ProfileInsights** | `Conversation` timestamps + `DailyCheckin` (episode dates) → cycle detection (CV of intervals) and risk scoring; `ResponseFeedback` → effective/ineffective strategy counts | Home screen ("Tonight's Outlook", pattern insights cards); contributes `top_strategies_for_context` into crisis prompts |
| **BehavioralDossier** | `Incident` history (temporally + confidence-weighted), `CareChangeEvent` (exclusion windows), `Profile.stage_changed_at` (down-weights pre-stage-change incidents) → contraindicated/effective interventions, 7-day timeline, frequency trends, delirium/pain flags, and an LLM-generated narrative (`dossier_text`) | Every crisis prompt (`crisis_system.jinja2`), facility resident dashboard |

### 2.4 Global/shared node

| Node | Scope | Privacy mechanism |
|---|---|---|
| **CrossPatientStrategies** | Not attached to any `Profile` — keyed by `cohort_key` (`disease_stage:peak_time`, e.g. `"middle:overnight"`) and `strategy_tag` | k-anonymity floor of 5 profiles per cohort before a row is surfaced; only the 12 predefined feedback tags cross patient boundaries (free-text/custom tags never do); strategy order randomized at prompt-injection time to prevent the LLM converging on one always-recommended strategy |

---

## 3. Graph Diagram

```
                      ┌─────────────────────┐
                      │      Profile        │  ← anchor (disease_stage, patterns,
                      │  (per-patient root)  │     strategies — cold-start memory)
                      └──────────┬──────────┘
                                 │
        ┌───────────┬───────────┼───────────┬──────────────┐
        v           v           v           v              v
  ┌───────────┐┌───────────┐┌───────────┐┌───────────┐┌──────────────────┐
  │Conversation││DailyCheckin││ Incident  ││CareChange ││ (facility links, │
  │           ││            ││           ││  Event    ││  see domain-     │
  └─────┬─────┘└─────┬──────┘└─────┬─────┘└─────┬─────┘│  catalog §3)     │
        │            │             │  excludes ─┘       └──────────────────┘
        v            │             │
  ┌───────────┐      │             │
  │ Response  │      │             │
  │ Feedback  │      │             │
  └─────┬─────┘      │             │
        │            │             │
        └─────┬──────┴──────┬──────┘
              v              v
      ┌───────────────┐┌──────────────────┐
      │ ProfileInsights ││ BehavioralDossier │  ← derived (recomputed, not
      │  (cycle detect, ││  (weighted incident │    authoritative — rebuildable
      │   risk score)   ││   history, LLM      │    from raw event nodes)
      └───────┬────────┘│   narrative)        │
              │          └─────────┬──────────┘
              │                    │
              └─────────┬──────────┘
                        v
              ┌───────────────────┐
              │  Crisis Prompt     │  ← where per-patient memory reaches the LLM
              │  (Jinja2 template) │
              └─────────┬─────────┘
                        ^
                        │  (nightly, k-anonymized, no FK to Profile)
              ┌───────────────────┐
              │ CrossPatientStrat- │  ← global/shared node
              │ egies (cohort-keyed)│
              └─────────┬─────────┘
                        ^
        ┌───────────────┴───────────────┐
   ResponseFeedback across ALL profiles in the same cohort
```

---

## 4. Edges — Write Triggers & Invalidation

The memory graph's edges are not FK relationships (see the domain catalog's note that no SQLAlchemy `relationship()` exists anywhere) — they are **invalidation triggers**: application code that marks a derived node dirty or recomputes it in response to a raw-node write. This table is the actual "graph" in code terms:

| Trigger (write to a raw node) | Effect on derived nodes | Where in code |
|---|---|---|
| `Incident` created | `BehavioralDossier.is_stale = True` | `routers/incidents.py::_mark_dossier_stale`, called on create |
| `Incident` updated | `BehavioralDossier.is_stale = True` | same, called on update |
| `Incident` verified by caregiver | `BehavioralDossier.is_stale = True` | same, called on verify |
| `Incident` extracted from a `Conversation` | `BehavioralDossier.is_stale = True` | same, called on auto-extract |
| Crisis chat request (`/api/crisis/chat`) | Reads the stored dossier only — never recomputes inline. Recompute (and `ProfileInsights`) happens in a detached background pass once the response has streamed, so the dossier's LLM narrative call stays off the caregiver's critical path. A dossier can therefore be one session out of date at read time; that is the deliberate trade. | `routers/coach.py::_persist_and_learn` → `services/dossier.py::compute_dossier`, `services/insights.py::compute_profile_insights` |
| Facility resident dashboard viewed | `BehavioralDossier` recomputed if stale | `routers/facility_residents.py` → `compute_dossier` |
| `ResponseFeedback` submitted | Feeds next `ProfileInsights` recompute (effective/ineffective strategy counts); feeds next nightly `CrossPatientStrategies` aggregation | `services/insights.py`, `services/cross_patient.py` (nightly job) |
| `CareChangeEvent` created (active) | No immediate recompute, but changes the *weight function* — any incident inside the observation window is excluded from the next dossier computation | `services/dossier.py::_is_in_observation_window` |
| Nightly, 3am UTC | `CrossPatientStrategies` fully recomputed for every cohort from all profiles' predefined-tag feedback | APScheduler job (per `ARCHITECTURE.md`) |

**There is no push-based invalidation of `ProfileInsights`** the way there is for the dossier (no `is_stale` flag on that table) — it is recomputed opportunistically on the next crisis session. Worth flagging as an inconsistency between the two derived nodes if this doc is used to plan future work: `BehavioralDossier` has an explicit dirty-flag graph edge, `ProfileInsights` does not.

---

## 5. Computation Pipelines

### 5.1 BehavioralDossier — weighted incident synthesis

`services/dossier.py` is the closest thing in the codebase to a "memory consolidation" routine. On each recompute:

1. **Debounce:** skip recompute entirely if the existing dossier is fresh (`is_stale == False`) and `computed_at` is under 60 minutes old — a fixed 3600-second cache, not currently configurable per profile.
2. **Load raw nodes:** all `Incident` rows for the profile (descending by time) + active `CareChangeEvent` rows + the `Profile` row (for `stage_changed_at`).
3. **Weight each incident** — this is the actual "memory decay" function:
   - Temporal decay: age ≤30d → weight 1.0, ≤180d → 0.5, ≤365d → 0.2, older → 0.0 (effectively forgotten)
   - Stage-transition decay: incidents from *before* the last recorded disease-stage change are down-weighted to 0.3× — old-stage behavior shouldn't dominate a new-stage dossier
   - Recall-confidence weight: `high`=1.0, `moderate`=0.8, `low`=0.5, `very_low`=0.3 (self-reported by the caregiver at logging time)
   - Extraction-confidence multiplier: applied only when the incident was LLM-auto-extracted
   - Observation-window exclusion: weight forced to 0.0 if the incident predates the change date of an active `CareChangeEvent` whose window is still open (full exclusion, not partial down-weight). Note the direction — it is *pre-change* data that is held out, per spec S-07b, on the reasoning that behaviour recorded before a medication change is a poor predictor of behaviour after it; incidents recorded *during* the window are exactly what the system is trying to learn from. Shared with `ProfileInsights` via `services/care_window.py`.
4. **Derive structured fields from the weighted set:** `contraindicated` (interventions where `intervention_outcome == "escalated"`), `effective` (where `== "resolved"`), `seven_day_timeline` (raw log of the last 7 days), `frequency_trends` per `behavior_category` (recent-7d vs. prior-7d count → `stable | increasing | decreasing | spike`).
5. **Clinical safety flags, computed heuristically, not by a clinician-authored model:**
   - `delirium_flags.sudden_change` — true if *any* category shows a `spike` trend
   - `pain_flags.suspected` — true if ≥2 incidents in the last 7 days fall into a fixed proxy set (`aggression_anger`, `refusing_care`, `repetitive_behavior`) — these are behaviors associated with undiagnosed pain in dementia literature, used here as a heuristic trigger, not a diagnosis
6. **Narrative generation:** an LLM call (`_generate_dossier_narrative`, separate system prompt) turns the structured output into `dossier_text` — the only field that's prose rather than structured JSON. This step is wrapped in try/except; failure here does not fail the whole recompute, it just leaves `dossier_text` stale/empty while every structured field still updates.
7. **Persist:** all JSON fields individually AES-256-GCM encrypted, `version` incremented, `is_stale = False`, `computed_at = now`.

### 5.2 ProfileInsights — cycle detection & risk scoring

Per `ARCHITECTURE.md`'s Pattern Detector:
1. Collect episode dates from crisis sessions + non-calm check-ins.
2. Compute intervals between consecutive episodes; Coefficient of Variation determines cycle confidence (CV<0.3 high, <0.5 moderate, <0.7 low, >0.7 none) — requires ≥5 episodes across ≥14 days to attempt detection at all.
3. Risk score = base (position within the detected cycle, 0–70) + trend bonus (0–20) + time-of-day bonus (0–10); `risk_level = "elevated"` at ≥50, with hysteresis (appears at 50+, only disappears at <40) to avoid the outlook card flickering.

### 5.3 CrossPatientStrategies — nightly anonymized aggregation

Per `ARCHITECTURE.md`: 3am UTC job groups all profiles into cohorts (`disease_stage:peak_time`), counts thumbs-up feedback per predefined strategy tag per cohort, and only writes/surfaces a `(cohort_key, strategy_tag)` row once `total_profiles >= 5`. Two consumption paths: a "new caregiver boost" (shown even with zero personal history) and direct prompt injection with randomized strategy order.

---

## 6. What Actually Reaches the Prompt

Per `crisis_system.jinja2` assembly (`services/prompt.py`), in order:
1. Patient profile (disease stage, known behaviors/strategies — the cold-start memory)
2. RAG context (see Knowledge Graph design, separate doc)
3. `BehavioralDossier.dossier_text` + structured contraindicated/effective/flags — the per-patient memory graph's output
4. `CrossPatientStrategies` for this profile's cohort — the global memory graph's output, order randomized
5. Conversation history for the current session

This ordering matters for the Gate 1 tech-architecture doc: per-patient memory is asserted *before* cross-patient memory, so cohort-level suggestions read as secondary/supplementary rather than overriding this-patient's own history.

---

## 7. Privacy & Encryption Boundaries

- Every per-patient memory node's free-text/JSON content is AES-256-GCM encrypted at rest (`"ENC:" + base64(nonce||ciphertext||tag)`); `CrossPatientStrategies` is the one node with no encrypted columns because it holds no identifiable content by construction (counts + tags only).
- No node in the per-patient memory graph carries patient name — `CoachRequest.patient_name` is explicitly transient and never persisted (see domain catalog §5).
- The only edge that crosses from per-patient memory into global memory is the nightly aggregation from `ResponseFeedback` → `CrossPatientStrategies`, and it is one-directional, count-only, and gated by the k≥5 floor — there is no path by which a specific patient's data could be reconstructed from the global node.

### 7.1 Deleting a profile

`DELETE /api/profiles/{access_code}` (`app/routers/profile.py`) erases a profile and every raw/derived node keyed to it: `conversations`, `behavioral_dossier`, `incidents`, `care_change_events`, `facility_patient_links`, `safety_events`, `profile_insights`, `daily_checkin`, `staff_patient_assignments`, plus `response_feedback` (deleted via a subquery over the profile's `conversation_id`s, since that table has no direct `profile_id` column). It does not touch `CrossPatientStrategies`, which by design holds no per-patient identifiers to delete. Auth is the same access-code lookup already used by this router's GET/PUT — there is no additional facility-admin authorization layer for facility-linked profiles yet (see §9).

There is no automatic retention sweep. `Settings.DATA_RETENTION_DAYS` (`app/config.py`) is an optional deployment-configurable knob — not a claim about any legal/regulatory retention requirement — that a deployer can set and wire into their own scheduled job calling the delete endpoint for inactive profiles; unset (default), no retention limit is enforced and data persists until explicitly deleted.

---

## 8. Versioning & Staleness Semantics

- `BehavioralDossier.version` increments on every successful recompute — currently write-only (nothing reads old versions), but present for future audit/rollback use.
- `is_stale` + `computed_at` form a two-part freshness check: explicitly dirty (`is_stale=True`) forces recompute; implicitly stale (`computed_at` older than 1 hour) also forces recompute even if never explicitly marked dirty. This means the dossier can go up to ~1 hour without reflecting a just-logged incident if nothing marks it stale in between (in practice this doesn't happen today, since every incident write path does mark it stale — but it's a coupling worth keeping in mind if a new incident-write path is ever added without calling `_mark_dossier_stale`).
- `ProfileInsights` has no staleness flag at all — recomputed in the background pass after each crisis session, with no caching layer. Lower cost to keep simple (no dirty-flag bugs possible) but means it recomputes even when nothing has changed since the last crisis session. Its inputs are bounded to a 90-day window (`insights.ANALYSIS_WINDOW_DAYS`) so that recompute cost stays flat as a family's history grows; lifetime session count is still exact, computed as a `COUNT(DISTINCT session_id)` rather than by loading the rows.

---

## 9. Gaps to Flag for Gate 1 Review

- **No formal eviction/decay beyond the dossier's temporal weight function short of explicit deletion.** Data is never *automatically* removed from `Incident`/`Conversation`/`DailyCheckin` — "memory" here means down-weighted, not forgotten, unless a caregiver/deployer explicitly calls the profile-delete endpoint (§7.1). Worth deciding explicitly whether time-based auto-deletion should exist (relevant to any HIPAA/privacy documentation LOF asks for) — `DATA_RETENTION_DAYS` is a config placeholder for that, not an enforced policy.
- **Profile deletion has no separate facility-admin authorization check.** `DELETE /api/profiles/{access_code}` (§7.1) uses the same bare-access-code auth as GET/PUT on that router, so anyone holding a facility-linked patient's access code can delete that patient's record — there's no additional check against `StaffPatientAssignment`/facility-admin role. Worth deciding whether facility-linked (B2B) profiles need a stronger deletion authorization path before Gate 1.
- **`ProfileInsights` lacks the dirty-flag pattern `BehavioralDossier` has** — inconsistent invalidation strategy between the two derived nodes (see §4). Not a bug today, but a design inconsistency worth resolving or explicitly justifying before this doc is called final. Both are now recomputed by the same background pass, so the practical gap is narrower than it was.
- **Care-change observation windows now apply to both derived nodes.** Spec S-07b requires pre-change data to be held out of cycle detection and risk scoring as well as the dossier; that was previously implemented only in the dossier, so a recently medicated patient could still be risk-scored on pre-change episodes. Both now share `services/care_window.py`, and the crisis prompt carries a "care change recorded N days ago" note so the model stops treating in-flux behaviour as an established pattern.
- **Delirium/pain flags are heuristic proxies, not clinically validated signals** — `dossier.py`'s own logic uses trend spikes and a fixed 3-behavior-category proxy set. This should be described to caregivers/reviewers as a screening heuristic, not a diagnostic signal, consistent with CalmGuide's "never diagnose" safety principle.
- **The 1-hour dossier cache window and the 60-day/180-day/365-day decay bands are hardcoded constants**, not configurable per profile or disease stage — flag if Gate 1 wants tunability documented as a roadmap item rather than assuming it already exists.
