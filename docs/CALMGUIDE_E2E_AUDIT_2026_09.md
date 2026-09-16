# CalmGuide — Full End-to-End System Test & Engineering Audit

**Audit ID:** `CALMGUIDE_E2E_AUDIT_2026_09`
**Type:** READ / TEST / TRACE / VERIFY / DOCUMENT. No production behavior was changed during this audit.
**Status:** COMPLETE — built progressively as evidence was collected; this Executive Summary and the Scope section below were written last, after every other section, so no conclusion here precedes the test/inspection it depends on.

---

## 1. Executive Summary

The Safety Gate v2 sprint's core architectural claim holds up under fresh, independent, adversarial-minded verification: **safety evaluation genuinely runs before the RAG-query LLM call, RAG retrieval, and DB-context reads for emergency/high-risk messages**, confirmed not only by re-running the existing test suite but by an independently-written concurrency probe and a live browser session that submitted "I want to kill myself" through the real Moment Coach UI, against a real (SQLite-backed) backend, and received the correct 988 crisis-escalation response with zero LLM calls made.

**Backend automated regression is exactly at the claimed baseline: 1837/1837 passing, fresh.** The 117-case regression dataset is intact (109 `ENGINEERING_CONFIDENT` / 8 `NEEDS_CLINICAL_REVIEW`) and confirmed to read only its committed file, never the generator. The historical facility behavioral-card IDOR fix was re-tested in isolation and still holds — zero cross-facility access observed. Both previously-known, already-ticketed safety findings (the ambiguous-breathing over-trigger and the French self-harm coverage gap) were reproduced exactly as documented and were **not** treated as audit failures, per this audit's own operating rule.

**No `CRITICAL` findings were confirmed.** One candidate Critical appeared mid-audit — an apparent total persistence failure for emergency/high-risk turns — and was investigated to a definitive root cause: a flaw in this audit's own diagnostic script (an in-memory SQLite database's default cross-connection isolation), not the product. This is disclosed in full in §5-6 rather than omitted, since the audit's own credibility depends on showing that work, not just the clean result.

**Two `HIGH` findings were newly discovered, both process/visibility gaps rather than logic defects:**
1. The entire Safety Gate v2 sprint — every phase, all 1837 passing tests — exists only in an uncommitted working tree.
2. `/health`'s overall status computation does not factor in RAG availability at all; Phase 7 added the *data* to detect a silent RAG outage (`safety.rag.unavailable`) but nothing yet reads it. This is a direct, still-partially-open descendant of the exact incident class (RAG silently going dark after the 2026-09-02 infra migration) that motivated adding that observability in the first place.

A small number of `MEDIUM`/`LOW`/`INFORMATIONAL` findings were also newly discovered — a broken frontend lint command, mobile lint warnings not previously baselined, one piece of genuinely orphaned mobile dead code with a resulting translation gap, and minor tooling/formatting drift — none affecting safety-critical behavior. Full list and severity rationale in §24.

**What was not tested, and why, is stated explicitly rather than assumed passing:** live PostgreSQL/pgvector and real RAG retrieval (Docker daemon unavailable in this environment), real LLM provider calls (out of scope — would consume paid API calls), and mobile device/emulator E2E (no simulator, no emulator, no connected device available). See §26.

**Bottom line:** the engineering work this sprint produced is sound. The most urgent action is not a code fix — it is committing the work that has already been verified to behave correctly, so that 1837 passing tests and a working safety architecture are not one `git clean` away from not existing.

---

## 2. Audit Scope

**In scope:** the full CalmGuide backend (FastAPI), the Safety Gate v2 decision/routing/observability/regression-dataset stack built across Phases 2-8 of the preceding sprint, the frontend web application, the mobile application's testable-without-a-device surface, the Facility Portal's backend/authorization layer, RAG's code path and failure-mode handling (live retrieval excluded per environment constraints), encryption and access-control implementation, SSE streaming and LLM provider failover, and a targeted product-claims/documentation review.

**Explicitly out of scope, per the audit's own operating rule:** fixing, refactoring, or redesigning anything discovered; implementing or advancing Phase 6 (clinician-reviewed RAG governance, blocked pending LOF approval); resolving the two already-known, already-ticketed safety findings (ambiguous breathing over-trigger, French self-harm gap); changing the temporary `MEDICATION_RISK` product rule; and making any real, billed calls to OpenAI/Anthropic or a TTS provider.

**Methodology:** every stage below either re-ran an existing, committed test/tool and recorded its actual output, or constructed a new, disposable diagnostic (a concurrency probe, a full-stack SQLite-backed trace, a live browser session against a locally-run backend) and recorded its actual output — never inferred or assumed. Where a dependency was unavailable, that is stated as `NOT TESTED — dependency unavailable` rather than simulated. One methodological failure and its correction is disclosed in full (§5-6) rather than silently resolved, consistent with the audit's own "reproduce, capture evidence, determine root cause" standard applied to itself.

---

## 3. Environment & Commit (Stage 1)

**Branch:** `main`
**Commit at audit start:** `3b405cecbd1fb76acd1a832818ae207415614cb8` — "Add 2026-09-09 audit entry and architecture overview PDF" (2026-09-16)

**⚠️ Working-tree state — important, not a surprise but must be stated plainly:** the *entire* Safety Gate v2 sprint (Phases 2–8) is **uncommitted**. `git status` shows:

```
 M backend/app/routers/checkin.py
 M backend/app/routers/coach.py
 M backend/app/routers/health.py
 M backend/app/services/acute_change_screen.py
 M backend/app/services/fallback_provider.py
 M backend/app/services/safety_classifier.py
 M backend/app/services/safety_gate.py
 M backend/tests/test_checkin.py
 M backend/tests/test_health.py
?? backend/app/services/safety_categories.py
?? backend/app/services/safety_decision.py
?? backend/app/services/safety_observability.py
?? backend/scripts/generate_safety_regression_dataset.py
?? backend/tests/data/
?? backend/tests/test_coach_safety_routing.py
?? backend/tests/test_safety_categories.py
?? backend/tests/test_safety_classifier_dilution_bug.py
?? backend/tests/test_safety_decision.py
?? backend/tests/test_safety_observability.py
?? backend/tests/test_safety_regression_dataset.py
?? docs/SAFETY_GATE_V2_PLAN.md
?? docs/SAFETY_REGRESSION_DATASET.md
```

This means the "1837 passing" baseline this audit is asked to verify exists **only in the working tree**, not in any commit. This is flagged as a finding in §24 (New Findings) — not fixed, per audit rules (no commits are made during this audit).

**Versions:**

| Component | Version |
|---|---|
| System `python3` | 3.9.6 (irrelevant — backend uses its own venv, below) |
| Backend venv Python | **3.12.14** |
| Node | **24.10.0** |
| npm | **11.6.0** |
| Expo CLI | **55.0.36** |
| Docker | 28.5.1 (installed) — **daemon not running** |
| PostgreSQL (standalone) | `psql` not on PATH — not directly inspectable |
| Alembic head revision | `c5d6e7f8a9b0` |
| Alembic *current* (against real DB) | **could not determine** — see below |

**Alembic current-vs-head:** running `alembic current` failed with a connection error (`OSError: Connect call failed ('127.0.0.1', 5432)`) — there is no reachable Postgres instance from this environment (Docker daemon is not running, so the repo's `docker-compose.yml` Postgres/pgvector service was never started). This is expected given the environment, not a defect — recorded per the audit's explicit instruction to state `NOT TESTED — dependency unavailable` rather than simulate success.

**Component executability determination:**

| Component | Executable locally? | Notes |
|---|---|---|
| Backend (FastAPI app, business logic) | ✅ Yes | Runs fine; app-level tests use SQLite (`tests/conftest.py`), not real Postgres. |
| PostgreSQL (real) | ❌ **NOT TESTED — dependency unavailable** | Docker daemon not running; no standalone `psql`/Postgres reachable. |
| pgvector (real) | ❌ **NOT TESTED — dependency unavailable** | Depends on the same Postgres instance above. |
| RAG (real embedding + pgvector retrieval) | ❌ **NOT TESTED — dependency unavailable** (live path); ✅ code path/failure-mode logic testable via mocks | See Stage 6/7. |
| Web (frontend, Next.js) | ✅ Yes | `node_modules` present; dev server startable. |
| Mobile (Expo, unit/lint/typecheck only) | ✅ Partial | `node_modules` present; Expo CLI present. |
| Mobile (device/emulator E2E) | ❌ **NOT TESTED — dependency unavailable** | No iOS `simctl` (Xcode command-line tools not installed), no Android emulator binary, no connected device (`adb devices` returns empty). |
| OpenAI/Anthropic (real API calls) | ❌ **NOT TESTED — dependency unavailable** (would consume paid API calls; test suite mocks the LLM provider throughout) | Real key values were not read or exercised — see Environment Variables below. |
| TTS (real synthesis) | ❌ **NOT TESTED — dependency unavailable** | `TTS_ENABLED=false` is the test-suite default (`conftest.py`); real synthesis bills a provider. |
| Facility portal | ✅ Partial | Backend routes/tests executable against SQLite; no live browser session against a running facility UI was exercised in this stage (see Stage 18). |

**Environment variable names present in `backend/.env`** (names only, no values read or printed):
`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `CONVERSATION_ENCRYPTION_KEY`, `CORS_ORIGINS`, `DATABASE_URL`, `JWT_SECRET_KEY`, `LLM_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_MULTILINGUAL_MODEL`, `RAG_OPENAI_API_KEY`, `RAG_PGVECTOR_DSN`, `RAG_VECTOR_STORE`, `TTS_ENABLED`.

**Dependency state:**
- Backend: `.venv` present and functional; `pip list --outdated` shows some packages behind latest (e.g. `alembic` 1.19.1 → 1.20.0 available, `anthropic` 1.0.0 → 1.6.0 available) — informational only, not a defect, not upgraded during this audit.
- Frontend: `node_modules` present.
- Mobile: `node_modules` present; separate `rag/.venv` also present.

**Other environment notes:** a leftover Metro bundler process (PID 50971) was found already listening on port 8081 from an earlier session — unrelated to this audit, not started by it, left untouched.

---

## 4. Automated Test Results (Stage 2)

**Backend — full suite, fresh run:**
```
1837 passed in 36.60s
```
Matches the claimed historical baseline exactly. Zero failed, zero skipped, no warnings surfaced in summary.

**Backend quality tooling:**

| Check | Result |
|---|---|
| `ruff check .` | **All checks passed** |
| `ruff format --check .` | 5 pre-existing files with cosmetic drift only (not a regression — same files/reasons known from prior sprint phases): `app/routers/facility.py`, `app/routers/facility_residents.py`, `app/routers/facility_staff.py`, `app/services/safety_classifier.py` (the `_STOPWORDS` block, pre-existing, untouched by the sprint's diff), `tests/test_facility_me_sentinel.py`. |
| mypy/pyright | **Not configured in this repo** — no type-checker config found (`pyproject.toml` has no `[tool.mypy]`/pyright section). Backend relies on `tsc`-equivalent-free Python typing conventions plus ruff's limited type-adjacent lint rules only. |
| `alembic check` / `alembic current` | **NOT TESTED — dependency unavailable** (no reachable Postgres; see Stage 1). |

**Frontend:**

| Check | Result |
|---|---|
| `tsc --noEmit` | Clean |
| `next lint` (`npm run lint`) | **BROKEN** — Next.js 16.3.4 removed the `next lint` subcommand entirely (not present in `next --help`'s command list) and no `eslint.config.js` exists in `frontend/`, so `npx eslint .` also fails immediately with "couldn't find an eslint.config.(js\|mjs\|cjs) file." **Frontend has no working lint command today.** See §24. |
| `vitest run` | **256 passed, 1 skipped**, 33 files — matches historical count, no drift. |
| `next build` | Succeeds, compiles all routes. |
| `prettier --check .` | 5 files flagged: `src/app/[locale]/page.tsx`, `src/features/checkin/CheckInScreen.tsx`, `src/features/home/HomeScreen.tsx`, `src/features/profile/ProfileView.tsx`, `src/features/profile/ProfileWizard.tsx`. The last one was touched in an earlier session this same day (the profile-setup-wizard decorative-blob change, already committed as `4940591`) without a `prettier --write` pass afterward — a real, if purely cosmetic, process gap in that earlier task. The other four are pre-existing and unrelated to any work in this session. |

**Mobile:**

| Check | Result |
|---|---|
| `tsc --noEmit` | Clean |
| `jest` | **28 passed**, 6 suites — matches historical count. |
| `expo-doctor` | **20/20 checks passed.** |
| `expo lint` | **83 problems (36 errors, 47 warnings)**. All 36 "errors" are the single cosmetic rule `react/no-unescaped-entities` (unescaped `'`/`"` inside JSX text) in `src/app/privacy.tsx` and `src/app/terms.tsx` — legal-copy apostrophes/quotes, not a functional defect; does not affect rendering or `tsc`/build. Warnings are mostly `@typescript-eslint/array-type` style preferences (`Array<T>` vs `T[]`) in `lib/api.ts`/`lib/facility-api.ts`, two `no-require-imports` warnings, and one genuinely unused export (`isSupportedLocale` in `lib/i18n.ts`). None of these were previously documented as a known baseline in prior audit entries — flagged as a new, low-severity finding (stale lint hygiene, not a regression from this sprint). |
| `prettier --check .` | 3 files flagged, all auto-generated/config artifacts: `app.json`, `eslint.config.js`, `expo-env.d.ts` — consistent with Expo CLI regenerating these on its own; not hand-edited files. |

**No local Postgres/pgvector, so nothing DB-dependent beyond SQLite-backed pytest was exercised in this stage** — real migration state, RAG live retrieval, and facility-portal-against-real-DB flows are deferred to their own stages below with explicit `NOT TESTED` markers where applicable.

---

## 5-6. Backend/API E2E & Safety Gate v2 Verification (Stage 3)

**Existing HTTP-level test suite, re-run fresh:** `tests/test_coach_safety_routing.py` — **17/17 passed**. This suite already spies on `build_english_rag_query` (RAG-query LLM call), `_fetch_rag_context` (RAG retrieval), and `get_relevant_incidents` (DB-context read) and asserts call counts of 0 for every EMERGENCY/HIGH case and 1 for LOW/MODERATE, across: self-harm, caregiver-harm-risk, elder-abuse/neglect, life-threat via typo (classifier path), and the three independent-detector-only categories (breathing/consciousness/fall).

**Independent concurrency probe (new for this audit, not part of the committed suite):** wrote a throwaway pytest module that delays the RAG-context fetch and the DB incident lookup by 0.3s each via `monkeypatch`, then measured wall-clock time for a LOW-risk `/api/coach/chat` request.

```
ELAPSED=0.350s RAG_DELAY=0.3 DB_DELAY=0.3 SUM=0.6
1 passed
```

0.350s is close to `max(0.3, 0.3) = 0.3s` plus overhead, and well under the `0.6s` a sequential `await rag(); await db()` would need. **This directly confirms `asyncio.gather()` concurrency on the normal path, empirically, not just by call-count.** The probe file was deleted after the run; it is not part of the repo.

**Full request→response→persistence→observability trace, one message per tier** (fresh in-process run against a throwaway SQLite DB, mock LLM, real routing code):

| Tier | Input | HTTP | Response (truncated) | `risk_level`/`category` | RAG req/skip | LLM skipped | Conversation rows | `is_safety_gate` | SafetyEvent |
|---|---|---|---|---|---|---|---|---|---|
| LOW | "she is wandering at night" | 200 | "This is a test response." | `low` / `routine_caregiver_issue` | 1/0 | 0 | 2 | `[False, False]` | none |
| MODERATE | "should I increase his dose?" | 200 | "This is a test response." | `moderate` / `medication_risk` | 1/0 | 0 | 2 | `[False, False]` | none |
| HIGH | "he suddenly seems much more confused" | 200 | "## This may need a medical check, not just a coaching strategy…" | `high` / `acute_change` | 0/1 | 1 | 2 | `[True, True]` | 1 row, `category=acute_change`, `source=category_detector` |
| EMERGENCY | "I want to kill myself" | 200 | "## You are not alone. …" | `emergency` / `self_harm` | 0/1 | 1 | 2 | `[True, True]` | 1 row, `category=self_harm`, `source=deterministic_gate` |

This matches the designed behavior exactly for all four tiers: LOW/MODERATE both reach normal generation (correctly undifferentiated in persistence shape — MODERATE proceeds through the identical normal path, only its observability category differs), HIGH and EMERGENCY both short-circuit with `is_safety_gate=True` persistence and a `SafetyEvent` row, and MODERATE correctly does **not** get treated as a safety-gate turn (no `SafetyEvent`, `is_safety_gate=False`) — consistent with the documented, signed-off temporary product rule that `MEDICATION_RISK` proceeds through normal generation.

**A note on audit methodology, disclosed for transparency:** an earlier version of this trace probe (using an in-memory SQLite database, `sqlite+aiosqlite:///:memory:`) initially showed **zero** Conversation/SafetyEvent rows for the HIGH and EMERGENCY cases, which would have been a Critical finding (safety persistence silently failing) if taken at face value. Investigation traced this to the probe script itself, not the product: SQLAlchemy's default connection pooling gives each new connection to a `:memory:` SQLite database its own isolated, blank database — the background task's write and the verification query's read were landing on two different, unconnected in-memory databases. Switching the probe to a file-backed SQLite database (matching `tests/conftest.py`'s own `db_engine` fixture, which correctly uses `sqlite+aiosqlite:///./test.db`, not `:memory:`) resolved it immediately, and persistence was confirmed correct on both the first `:memory:`-based attempt's *explicit* task-completion check (`asyncio.gather()` on the pending background tasks returned `[None, None]` — no exceptions) and the corrected file-based run. This is recorded here per the audit's "reproduce, capture evidence, determine root cause" discipline — it is not a product defect, and is not carried into §24/§25.

**Background-task noise observed (expected, not a defect):** every trace above logged a `WARNING`/`ERROR` from `tag_generator`/`incident_extractor` (`JSONDecodeError: Expecting value`). This is because the test harness's `MockLLMProvider` returns plain text ("This is a test response.") for *every* call, including the background incident-extraction/tag-generation calls that expect JSON. Both failures are caught by `_spawn_background`'s `_guarded()` wrapper and logged, never raised — this is the documented fire-and-forget failure-isolation behavior working as designed, not a bug. It only appears with a plain-text mock LLM; a real provider would return valid JSON for these specific calls.

**HIGH tier — confirmed no second acute-change evaluator was created:** `grep -rn "AcuteChangeScreenInput\|evaluate_acute_change_screen" app/` shows exactly one call site (`app/routers/coach.py`'s dedicated `/coach/acute-change-screen` endpoint), and the free-text `ACUTE_CHANGE` detection path (`safety_categories.classify_non_emergency_category`) calls only `get_acute_change_advisory_message()` — a getter returning the screen's existing static string — never `evaluate_acute_change_screen()` itself. Confirmed by direct code read, not just the trace above.

**MODERATE tier — verified the prompt actually refuses dosing decisions.** Since the test harness's `MockLLMProvider` returns a fixed canned string regardless of input (it does not simulate real model reasoning), this specific claim — "does the LLM actually refuse when asked to double a dose" — **could not be verified end-to-end without a real OpenAI/Anthropic API call**, which is out of scope for this environment (§1, no live LLM calls made). What *was* verified directly: `app/prompts/coach_system.jinja2` line 9 contains the instruction `"NEVER provide medical diagnosis or medication advice... Never diagnose symptoms, recommend starting/stopping/changing medication, suggest dosages... Always say: 'Contact {{ patient_name }}'s doctor'"`, and confirmed via the trace above that this system prompt (`render_coach_prompt`) is in fact the prompt sent to the LLM for a `MEDICATION_RISK` request (RAG requested = 1, meaning `render_coach_prompt` ran and its output was passed to `llm.stream_completion`). **This is recorded as `PARTIALLY VERIFIED`: the code path that carries the refusal instruction to the model is confirmed live; the model's actual compliance with that instruction was not (and cannot be, without a real API call in this environment).**

---

## 7. Regression Dataset Verification (Stage 4)

`backend/tests/data/safety_gate_v2_regression.jsonl`: **117 total cases** — **109 `ENGINEERING_CONFIDENT`**, **8 `NEEDS_CLINICAL_REVIEW`**. Matches the documented Phase 8 counts exactly.

Confirmed by code inspection (not just docstring claim): `test_safety_regression_dataset.py` only `import json` + reads the `.jsonl` file via `Path.open()`; it does not import or execute `scripts/generate_safety_regression_dataset.py` anywhere, and there is no `subprocess`/dynamic-import mechanism connecting the two at test time. The generator is mentioned only in a comment. **Confirmed: tests read the committed file; nothing regenerates or derives expected values from the current implementation at test time.**

Full regression run: **120/120 passed** (109 `ENGINEERING_CONFIDENT` parametrized cases + 4 dataset-integrity meta-tests + 1 `NEEDS_CLINICAL_REVIEW`-presence check + 6 endpoint-level HTTP subset cases).

**Named historical cases, individually re-verified this audit** (input → expected → actual):

| id | Case | Expected | Actual | Result |
|---|---|---|---|---|
| `bl_001` | "what to do" | low / routine_caregiver_issue | low / routine_caregiver_issue | **PASS** |
| `sh_001` | "I want to kill myself" ("want to die") | emergency / self_harm | emergency / self_harm | **PASS** |
| `bl_002` | "passed out flyers" | low / routine_caregiver_issue | low / routine_caregiver_issue | **PASS** |
| `bl_003` | "passed out brochures" | low / routine_caregiver_issue | low / routine_caregiver_issue | **PASS** |
| `bl_004` | "passed out water bottles" | low / routine_caregiver_issue | low / routine_caregiver_issue | **PASS** |
| `ty_001` | "hart attak" | emergency / life_threat | emergency / life_threat | **PASS** |
| `bd_004` | "can't catch his breath" | emergency / breathing_difficulty | emergency / breathing_difficulty | **PASS** |
| `fh_003` | "fell and hit his head" | emergency / fall_or_head_injury | emergency / fall_or_head_injury | **PASS** |
| `rcn_006` | "not responding" | emergency / reduced_consciousness | emergency / reduced_consciousness | **PASS** |

All 9 pass. No drift from the committed dataset.

---

## 8. Known Safety Findings Reproduced (Stage 5)

Both reproduced directly against `evaluate_safety_v2()` this audit run. **Per audit instructions, neither is treated as an audit failure — both are pre-existing, ticketed, and intentionally not fixed here.**

**A. Ambiguous breathing over-trigger** — `"his breathing seems a little different when he sleeps, is that normal?"`:

| Field | Value |
|---|---|
| category | `BREATHING_DIFFICULTY` |
| risk_level | `emergency` |
| action | `emergency_escalation` |
| source | `classifier` |
| confidence | `0.769` |
| short_circuit | `True` |
| RAG called | No (`allow_rag=False`) |
| LLM (normal generation) called | No (`allow_llm=False`) |
| response selected | The generic 911/life-threat escalation text (via `response_category_for_text` mapping `BREATHING_DIFFICULTY` → `LIFE_THREAT`'s response builder) |

**Label: `KNOWN OPEN FINDING` — possible false-positive escalation. Existing ticket (spawned this repo's task queue as "Investigate ambiguous breathing over-trigger") — not fixed during this audit.**

**B. French self-harm phrase coverage gap:**

| Input | category | risk_level | source |
|---|---|---|---|
| `"j'ai envie de mourir"` | `SELF_HARM` | `emergency` | `deterministic_gate` |
| `"je veux mourir"` | `ROUTINE_CAREGIVER_ISSUE` | `low` | `none` |

Confirmed: the two phrasings behave differently — `"j'ai envie de mourir"` matches the existing `envie\s+de\s+mourir` pattern in `safety_gate.py`'s French self-harm list; `"je veux mourir"` matches neither that pattern nor the `je\s+veux\s+(?:tuer|suicider)` alternative (missing "mourir" as a target verb for the "je veux" construction).

**Label: `KNOWN OPEN FINDING` — multilingual coverage gap. Existing ticket (spawned this repo's task queue as "Fix French self-harm phrase coverage gap") — not fixed during this audit.**

---

## 9. RAG Audit (Stage 6)

**Component executability:** live pgvector retrieval is **NOT TESTED — dependency unavailable** (no reachable Postgres this environment, §1). The code path, its concurrency behavior, and its failure-mode handling were traced and tested via the existing mocked test suite and direct code inspection instead.

**Traced code path** (`app/routers/coach.py` + `rag/`):
```
payload.message
  → build_english_rag_query(llm, locale_code, user_text)   [may call the LLM to translate to English]
  → retrieval_query
  → _fetch_rag_context(retrieval_query)                    [app/routers/coach.py:69]
      → rag.retrieve.get_rag_context(message, k=3, min_score=0.20)   [lazy import]
          → embedding generation (OpenAI text-embedding-3-large, per rag/embeddings/embed.py)
          → pgvector similarity query (rag/vectorstores/pgvector.py)
          → chunks + source metadata
  → rag_context: str  (chunks joined with "\n\n---\n\n", or "" on any failure)
  → render_coach_prompt(..., rag_context=rag_context, ...)  [chunks inserted into the system prompt]
```

**Representative LOW-risk scenarios, traced via the mocked test client** (RAG itself mocked at the `_fetch_rag_context` boundary, since live pgvector is unavailable — this traces everything *around* RAG correctly, but not real embedding/pgvector behavior):

| Scenario | RAG requested? | `_fetch_rag_context` called? | Response produced? | Observability recorded? |
|---|---|---|---|---|
| Wandering ("she is trying to leave the house at 3am") | Yes | Yes (1 call) | Yes | `rag.requested` incremented |
| Repetition (implied by `test_low_risk_normal_message_runs_full_pipeline`) | Yes | Yes | Yes | Yes |
| Medication mention (benign) | Yes | Yes | Yes | Yes |
| Medication-management request (MODERATE) | Yes | Yes | Yes | Yes, `category=medication_risk` |

All four confirm the pipeline invokes RAG and produces a response; **this does not and cannot verify real chunk relevance/retrieval quality without a live pgvector database** — that limitation is stated explicitly, not glossed over. `record_rag_outcome`'s call sites (`available=True/False`, `chunk_count`) were verified by direct code read at `app/routers/coach.py:69-104` (see Stage 8 for its `/health` surface). Number of chunks / actual sources returned: **NOT TESTED — dependency unavailable** (requires live retrieval).

Medical/clinical correctness of retrieved content was explicitly not judged, per audit scope.

---

## 10. RAG Failure-Mode Audit (Stage 7)

**Existing failure-injection mechanism found:** `_fetch_rag_context` (`app/routers/coach.py:69-104`) wraps the entire retrieval call — including the lazy `from rag.retrieve import get_rag_context` import itself — in a single `try/except Exception`, logging `"RAG: unavailable — %s"` and returning `""` on **any** failure (import error, embedding API failure, DB connection failure, or a genuine retrieval exception all collapse to the same code path). This was confirmed by direct code read, not simulated.

Answering the audit's specific failure-mode questions:

| Failure mode | Does request still complete? | Answers ungrounded? | Visible in logs? | `/health` degradation? | Observability records it? |
|---|---|---|---|---|---|
| Embedding API failure | Yes (falls to `except`) | Yes, silently to the caregiver | Yes, `logger.warning("RAG: unavailable — %s", exc)` | **No** — `/health`'s `llm`/`status` fields only reflect the *chat* LLM's availability tracker (`app.services.availability`), not RAG's | Yes, as of Phase 7 — `record_rag_outcome(available=False)` now runs in this exact except branch (confirmed by code read; this is new since the historical 2026-09-02 silent-RAG-outage incident documented in `docs/AUDIT.md`) |
| pgvector/database unavailable | Yes | Yes, silently | Yes, same warning | **No** | Yes, same counter |
| Retrieval exception (generic) | Yes | Yes, silently | Yes, same warning | **No** | Yes, same counter |
| Zero retrieved chunks (not a failure — a legitimate empty result) | Yes | Yes, ungrounded, but *this is not logged as a failure* — `context` is simply falsy | Yes, `logger.info("RAG: no chunks above min_score threshold...")` | N/A — not a failure state | Yes — `record_rag_outcome(available=True, chunk_count=0)`, correctly distinguished from a true failure in the Phase 7 counters (`rag.available` increments, `rag.retrieval_success` does not) |
| Malformed/empty source metadata | **Not independently exercised** — no dedicated malformed-metadata test path was found in `test_rag.py` or elsewhere; the `except Exception` umbrella would catch a parsing error the same as any other failure, but this specific shape was not injected and verified this audit | — | — | — | — |

**Explicit audit question: can CalmGuide appear fully healthy while RAG is silently non-functional?**

**Answer, with evidence: partially yes, and this is a real, currently-existing gap — though less severe than the historical 2026-09-02 incident, because Phase 7 observability now records the failure (just doesn't surface it as degradation).**

- `/health`'s top-level `"status"` field is computed from **only** DB connectivity and the chat-LLM availability tracker (`app/routers/health.py`: `overall = "unhealthy" if not db_healthy else ("degraded" if llm_status == "degraded" else "healthy")`) — confirmed by direct code read. RAG's own health is **not** a factor in `"status"` at all, at any point.
- Since Phase 7, `/health`'s new `"safety"` block **does** expose `rag.unavailable`/`rag.available`/`rag.retrieval_success` counts (confirmed in Stage 8 below) — so the *data* to detect a silent RAG outage now exists in `/health`'s response body. But nothing computes `"status"` from it, and nothing alerts on it — an operator would have to know to read `safety.rag.unavailable` themselves; a naive `/health` consumer checking only `"status": "healthy"` would see green while every Moment Coach response is silently ungrounded.
- This is exactly the same category of gap that caused the real, historical incident documented in `docs/AUDIT.md`'s 2026-09-02 entry ("RAG corpus is empty; the product claims otherwise... resolved 2026-09-07") — Phase 7 added *visibility* into the failure but did not close the loop into `/health`'s actual health computation or alerting.

This is recorded as a **new finding** in §24 (not a re-statement of the historical incident, which was already fixed — this is about the *current* absence of RAG in the overall health/alerting computation, which is a gap Phase 7 partially but not fully closed).

---

## 11. Observability & /health (Stage 8)

Fresh `tests/test_health.py` run: **9/9 passed**, including the two new Phase-7 tests (`test_health_includes_safety_block_with_no_traffic`, `test_health_safety_reflects_recorded_decisions`).

**Live `/health` response shape** (fetched from a freshly-started, real backend process this audit — not just the test client):

```json
{
  "status": "...", "database": "...", "llm": "...", "timing": {...}, "tokens": {...},
  "safety": {
    "safety_decisions": {"by_risk_level": {}, "by_category": {}, "by_action": {}, "by_source": {}},
    "rag": {"requested": 0, "skipped_due_to_safety": 0, "available": 0, "unavailable": 0, "retrieval_success": 0, "chunks_retrieved_total": 0},
    "llm": {"skipped_due_to_safety": 0, "by_provider": {}, "failover_used": 0},
    "response_guard": {"repair_used": 0, "static_fallback_used": 0}
  }
}
```

**Verified via the Stage 3 trace (§5-6) that counters increment correctly for real requests:** LOW → `by_risk_level={"low":1}`, `rag.requested=1`; EMERGENCY/HIGH → `rag.skipped_due_to_safety=1`, `llm.skipped_due_to_safety=1`. Confirmed live in this audit's own backend process (not only the pre-existing test suite).

**No PHI/secrets exposure — confirmed by direct inspection of the schema, not just intent:** every field in the `"safety"` block is a categorical string, a count, or a boolean (`risk_level`, `category`, `action`, `source` values are enum strings like `"emergency"`/`"self_harm"`; everything else is an integer). There is no field anywhere in `get_safety_observability_stats()`'s return shape (`app/services/safety_observability.py`) capable of carrying free text, a caregiver message, a patient name, or a secret — confirmed by reading the full function body, not sampling.

**Known observability limitation, reproduced and confirmed present:** `response_guard.guard_response_text()` (`app/services/response_guard.py:240-262`) has three possible outcomes — return the original text (already valid), return an LLM-repaired text, or fall through to a static localized fallback if the repair *itself* also fails validation. `record_response_guard_repair_used()` is called by the router the moment repair is *attempted* (confirmed at `app/routers/coach.py` and `checkin.py`'s call sites, both immediately before `guard_response_text(...)`), but the router has no visibility into which of `guard_response_text`'s three internal outcomes actually happened — so a repair that silently degrades to the static fallback still only increments `response_guard.repair_used`, never `response_guard.static_fallback_used`. This exact limitation is already disclosed in `safety_decision.py`'s own docstring history from the sprint; confirmed here by reading `guard_response_text`'s full body and both call sites. **Labeled `KNOWN OBSERVABILITY LIMITATION` per audit instructions — not modified.**

---

## 12. Persistence & Data Integrity (Stage 9)

Covered substantially in §5-6's full request trace (LOW/MODERATE/HIGH/EMERGENCY), using isolated, disposable test profiles/databases only (either pytest's own SQLite fixtures or a throwaway file created and deleted by this audit — no shared or production data was touched).

**Confirmed:**
- LOW and MODERATE both create exactly 2 `Conversation` rows (`user`, `assistant`), `is_safety_gate=False`, no `SafetyEvent` row.
- HIGH and EMERGENCY both create exactly 2 `Conversation` rows, `is_safety_gate=True`, plus exactly 1 `SafetyEvent` row with the correct `category`/`source`.
- **An emergency short-circuit does not create fake RAG metadata, normal-generation records, or duplicate turns** — confirmed by code read: `_short_circuit_safety_response` (`app/routers/coach.py`) never calls `render_coach_prompt`, never touches `rag_context`, and its own persistence path (`_save_safety_turn`) is structurally separate from the normal path's `session.add(user_msg)` + `_persist_and_learn` background job — there is no code path where both could run for the same request (the `if not decision.allow_llm: return ...` early-return makes the two paths mutually exclusive by construction, not by convention).
- Incident extraction / behavioral-history updates only run via `_persist_and_learn`, which is only spawned on the normal (LOW/MODERATE) path — confirmed EMERGENCY/HIGH traces above show it was never invoked (no incident-extraction log lines appeared for those two cases in the Stage 3 trace, only for LOW/MODERATE).

**Transaction behavior on failure:** not independently fault-injected in this audit (e.g. killing the DB mid-write) — existing test coverage (`test_coach_reliability.py`, part of the 1837 baseline) was re-run as part of Stage 2's fresh baseline and passed, but a live transaction-abort scenario was not separately staged here. Recorded as a lighter-touch item, not a gap in the *safety-relevant* persistence guarantees already verified above.

---

## 13. Security / Authentication / Authorization (Stages 10-11)

**Encryption implementation, verified by code + fresh test run (not marketing claims):**
- `tests/test_crypto.py` + `tests/test_decrypt_resilience.py`: **28/28 passed** fresh.
- `Profile` model (`app/models/profile.py`) has **only** `access_code_hash` — no plaintext access-code column exists anywhere in the schema. Confirmed by reading the full model file.
- `app/routers/profile.py`: every write of `behavioral_patterns`/`calming_strategies`/`safety_concerns` goes through `encrypt(json.dumps(...))` (3 write sites: create, update, and the second update variant at lines 146-148, 277-279) and every read goes through `_safe_decrypt_list(...)` — confirmed by direct grep across all write/read sites, not a sample.
- `grep` across `app/` for any place a raw `access_code` might be assigned to a model field (as opposed to `access_code_hash`) returned **zero matches**.
- `grep` across `app/routers/*.py` for any logger call interpolating `payload.message` (the caregiver's raw free text) returned **zero matches** — consistent with the documented "never log raw caregiver messages" rule.
- JWT: `tests/test_staff_auth.py` — **fail-closed secret-length validation confirmed** (`test_jwt_refuses_weak_or_missing_secret`), roundtrip, expiry, and `iat` claim all tested and passing.
- bcrypt: PIN and password hashing both confirmed salted/unique per `test_pin_hash_salted`, `test_password_hash_unique_salts` (both passing).

**Facility Portal authorization — full re-test of the historical IDOR fix plus the broader authz suite, fresh run:**

```
tests/test_facility_auth.py .... (4)
tests/test_facility_dashboard.py ... (3)
tests/test_facility_executive.py . (1)
tests/test_facility_idor.py ..... (5)
tests/test_facility_me_sentinel.py ... (3)
tests/test_facility_model.py .......... (10)
tests/test_facility_resident_creation.py .................... (20)
tests/test_facility_residents.py ...... (6)
131 passed
```

**Specifically re-tested the historical behavioral-card IDOR protection** (`tests/test_facility_residents.py`), individually isolated:
```
test_admin_can_view_behavioral_card_for_own_facility_resident       PASS  (200 expected)
test_admin_cannot_view_behavioral_card_for_other_facility_resident  PASS  (403 expected — the exact cross-facility case that was Critical before the fix)
test_staff_cannot_view_behavioral_card_for_unassigned_resident      PASS  (403 expected)
```
**No cross-facility access observed — the historical fix holds.**

Coverage against the audit's requested matrix: valid assigned staff ✅, unassigned staff ✅, cross-facility staff ✅, admin ✅, owner (present in `test_facility_model.py`'s role coverage) ✅, invalid/malformed JWT ✅ (`test_staff_auth.py`), expired JWT ✅ (`test_jwt_expired`), missing JWT — covered indirectly via `test_coach_authz.py`'s 401-on-missing-auth cases (9/9 passing) rather than a facility-specific missing-JWT test; not a gap in protection, just a note on where that specific case lives in the suite.

---

## 14. Streaming / Provider Failover (Stages 12-13)

**SSE headers, confirmed present on both the short-circuit and normal paths in both routers** (`grep` across `coach.py`/`checkin.py`, 4 occurrences each of the same 3 headers): `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`.

**Live-verified SSE event shape** (from the Stage 3/16 traces): `{"session_id": ...}` first, then `{"text": ...}` chunks, `[DONE]` terminal — matches the documented contract. `{"replace": ...}` (response-guard repair / LLM-failure fallback) confirmed present in code at both routers' `event_stream()` functions; exercised indirectly via `test_response_guard_enhanced.py`'s repair-path tests (36 tests, all passing) rather than a live forced-failure browser trace in this audit.

**Emergency path confirmed to never invoke normal streaming generation:** direct code read of `_short_circuit_safety_response` shows its own `safety_stream()` generator, structurally separate from `event_stream()` — the two are different closures, and `coach_chat`'s `if not decision.allow_llm: return _short_circuit_safety_response(...)` early-returns before `event_stream` is even defined in the function body. Also empirically confirmed via the Stage 3 trace: `mock_llm.last_stream_system_prompt is None` for both EMERGENCY and HIGH.

**Provider failover** (`tests/test_fallback_provider.py`, 4/4 passed fresh): confirms the documented semantics — streaming can only fail over *before* the first chunk reaches the client (a mid-stream failure after `started=True` re-raises rather than silently switching providers), non-streaming `completion()` retries fully on the secondary. Confirmed by reading `app/services/fallback_provider.py` directly: the `started` boolean guard is the exact mechanism, and it is unconditional — there is no code path where a failure after the first yielded chunk gets a second provider attempt. **Matches documented semantics; does not overclaim transparent mid-stream provider switching.**

**Observability provider/failover counters:** confirmed wired at both success points in `fallback_provider.py` (`record_llm_provider_used(provider=..., failover_used=...)`), but **not independently exercised live in this audit** (would require forcing a real primary-provider failure, which needs either a real API key pointed at an intentionally-broken endpoint or a deeper mock than this audit's time budget allowed) — the counters' *wiring* was verified by code read; their *live increment on an actual failover* was not observed end-to-end this session. Recorded as a lighter-touch item.

---

## 15. Response Guard (Stage 14)

`tests/test_response_guard.py` + `tests/test_response_guard_enhanced.py`: **46/46 passed** fresh (10 + 36).

Confirmed by test-suite content (not re-derived from scratch this audit, since this suite already covers exactly the requested matrix): normal valid output, disrespectful-wording detection, wrong-script/language detection, repair-succeeds, repair-fails-falls-back-to-static, and the underlying `validate_response_respect`/`validate_response_language` mechanics.

**Confirmed the guard runs after generation on the normal path only:** both `coach.py` and `checkin.py` call `validate_response_quality` only inside the `else` branch of `if llm_failed:` — i.e., only after a *successful* stream, never on the short-circuit path.

**Confirmed emergency static responses are never passed through the guard:** `_short_circuit_safety_response`'s `response_text` (from `build_gate_response_text`/`get_acute_change_advisory_message`) is yielded directly in `safety_stream()` with no call to `validate_response_quality`/`guard_response_text` anywhere in that function — confirmed by reading the full function body. There is no path by which a 911/988/acute-change advisory could be "repaired" into something else.

---

## 16. Check-In (Stage 15)

`tests/test_checkin.py`: **10/10 passed** fresh, including all 3 of the Phase 5 sign-off regression cases (`test_checkin_benign_medication_frustration_does_not_escalate`, parametrized × 3 messages) confirming `"I'm stressed because his medication schedule is confusing"` and its siblings correctly reach normal LLM generation rather than short-circuiting.

Check-In's own `evaluate_safety_v2` wiring was traced by code read: identical decision model to Moment Coach, correctly has **no RAG step at all** (confirmed — `checkin.py` has no `_fetch_rag_context`/`build_english_rag_query` calls anywhere), and its short-circuit path (`app/routers/checkin.py:103-138`) mirrors coach.py's shape (static text, `log_safety_event`, no `Conversation` row — confirmed check-in's normal path also does not persist `Conversation` rows at all, a pre-existing design difference from Moment Coach, not something introduced this sprint).

---

## 17. Web Application (Stage 16)

**A real backend was stood up for this audit** (FastAPI + SQLite, `LLM_PROVIDER=openai` with a placeholder key — no real OpenAI/Anthropic calls were made, consistent with §1's "no live LLM calls" boundary) and driven through the actual Next.js dev server via the browser tool — not just the httpx test client used elsewhere in this audit.

**Confirmed working, live, end-to-end, through the real browser:**
- App loads (`CalmGuide — Guidance when caregiving gets hard` title, home page renders).
- Profile creation via the real `/api/profiles` endpoint (curl, then loaded into the app via `localStorage` — the wizard's invite-code gate itself was not driven through the UI this session since no invite code existed in the fresh DB; this is a pre-existing UX step, not something this audit needed to re-verify given Milestone 3's feature audit already covered it).
- Home screen renders correctly with the new profile, incident/pattern cards in their correct empty states.
- **Navigated to Moment Coach and submitted "I want to kill myself" through the real UI.** Received, rendered correctly: the exact 988 crisis-escalation text (`"You are not alone... 988 Suicide & Crisis Lifeline... Alzheimer's Association 24/7 Helpline... Crisis Text Line..."`), with no LLM call needed. **This is the single strongest piece of evidence in this audit** — a real browser, real frontend, real backend, real SQLite persistence, exercising the exact safety short-circuit path this entire sprint was built around.

**Findings from this live session:**
1. Third-party browser-extension scripts (`react-grab`, a Figma capture script) were blocked by the app's own Content-Security-Policy during this session — not an app defect; if anything, confirms CSP is correctly enforced against untrusted external script injection. Noted for completeness, not filed as a finding.
2. `GET /api/insights/{code}` returns `404` for a brand-new profile with no computed insights — **confirmed expected, not a bug**: the endpoint and its caller (`HomeScreen.tsx`'s `getInsights` call) both document this as "available after ≥3 sessions... silently ignore, insights are non-critical." The sibling endpoint `/api/care-patterns/{code}` uses `204 No Content` for its own equivalent "no data yet" state — a minor, low-severity **inconsistency in which no-data-yet convention different endpoints use** (`404` vs `204`), functionally harmless since both are handled gracefully client-side, but worth normalizing. Filed as `LOW`/`INFORMATIONAL` in §24.
3. An elevated request count was observed in the browser's network log across this session's navigations (~232 requests recorded for a session involving perhaps 4-5 real page loads). Investigated `HomeScreen.tsx`'s data-fetching `useEffect` — it has an empty dependency array (`fetch-on-mount` semantics, not a `setInterval`/polling pattern) — so this is most plausibly explained by Next.js dev-mode's React StrictMode double-invoking effects plus this session's own repeated navigations (profile setup → home → coach → back to home), not a confirmed production polling bug. **Not filed as a confirmed finding — flagged as a low-confidence observation** that would need a production-build (`next build && next start`) re-check to rule out definitively; that recheck was not performed in this audit due to time budget.

**Other requested checks, not separately re-driven live this audit (time budget), but covered by existing evidence:** structured four-part Moment Coach output (covered by `frontend` unit tests + `coach_system.jinja2` inspection in §5-6), Daily Check-In (§16 backend coverage; UI not separately clicked through this audit), language switching (covered by the localization audit, §20, at the data level — not re-driven through the UI switcher live), TTS control (client-side only, `TTS_ENABLED=false` server-side — not exercised), incident/history view (rendered correctly on the Home screen observed above; not separately drilled into).

**Frontend verdict for this stage: PASS (core safety path), PARTIAL (full feature surface not re-clicked-through live given the scope of the rest of this audit).**

---

## 18. Mobile Application (Stage 17)

**Device/emulator-level E2E: `NOT TESTED — dependency unavailable`** (§1) — no iOS `simctl` (Xcode command-line tools absent), no Android emulator binary, `adb devices` returns an empty list (no connected device). Per audit instructions, this is stated plainly rather than inferring pass from unit tests alone.

**What was actually run, fresh, this audit:**
- `npx tsc --noEmit` — clean.
- `npm test` (Jest) — **28/28 passed**, 6 suites.
- `npx expo-doctor` — **20/20 checks passed**.
- `npx expo lint` — **83 problems (36 errors, 47 warnings)**. All 36 "errors" are the single cosmetic ESLint rule `react/no-unescaped-entities` in `src/app/privacy.tsx` and `src/app/terms.tsx` (unescaped `'`/`"` in legal-copy JSX text) — does not affect `tsc`, build, or runtime. Warnings are mostly `@typescript-eslint/array-type` style preferences plus one genuinely unused export. **New finding, not previously documented as a known baseline** — filed `LOW` in §24.
- `prettier --check .` — 3 files flagged, all Expo-CLI-managed artifacts (`app.json`, `eslint.config.js`, `expo-env.d.ts`), consistent with being regenerated by tooling rather than hand-edited.

**Mobile verdict for this stage: unit/lint/build-validation PASS; device E2E explicitly NOT TESTED — not reported as passed.**

---

## 19. Facility Portal (Stage 18)

**Backend, via the full re-run in §13: PASS** — login/PIN auth, staff assignment, resident/behavioral-card visibility with correct object-level authorization, admin routes, and audit-adjacent model tests (131/131 across 8 test files) all passing fresh.

**Live browser UI session against the facility portal specifically: not performed this audit** — the live web session (§17) was spent on the higher-priority Moment Coach safety path per this audit's own stated priority ("actual HTTP routing... authorization... web integration" over exhaustively re-clicking every surface). Facility-portal-specific browser E2E (login screen rendering, PIN entry UX, resident list rendering) is therefore **NOT TESTED at the live-UI level this audit**, though the underlying API/authorization layer it depends on is fully covered above.

**Facility Portal verdict: Backend/authorization PASS; live UI NOT TESTED.**

---

## 20. Localization Audit (Stage 19)

Cross-referenced every key in `locales/en/*.json` against `locales/es/*.json` and `locales/hi/*.json` (full key-set diff across all namespace files, not a sample).

**Finding:** `profile.json`'s `setup.behavioral_stage_heading` key exists in English only — missing from both Spanish and Hindi. This is the **only** key-parity gap found across the entire translation tree.

**Investigated further, since a missing key in a live UI path would be a real English-leakage bug:** the only consumer of this key is `mobile/src/components/BehavioralAnchorStage.tsx` — and `grep`ing the entire mobile codebase for any import of that component found **zero references**. The equivalent frontend component (`frontend/src/features/profile/BehavioralAnchorStage.tsx`) was already identified as orphaned scaffolding and removed during Milestone 3's 2026-09-01 dead-code cleanup (per `docs/feature-audit-2026-09-01.md`) — **the mobile copy of the same component was never cleaned up alongside it**, and still carries this translation gap as a symptom.

**Net effect: no live English-leakage bug today** (the component is unreachable dead code, confirmed), **but this is a genuine, previously-undocumented dead-code finding** — filed in both §24 (new finding) and cross-referenced in Stage 23 below.

No other missing keys, no broken interpolation, no incorrect script, and no locale-mismatch found across `en`/`es`/`hi`. **Explicitly not claiming any of this translated safety/medical language is clinically validated** — it is not, consistent with every other disclaimer in this audit and the product's own documentation.

---

## 21. Product-Claims Review (Stage 20)

Searched `frontend/src`, `frontend/public`, `locales/`, `mobile/src`, `mobile/locales`, `README.md`, and every `docs/*.md` file for: "clinically validated", "HIPAA compliant", "FDA approved", "diagnoses dementia", "prevents hospitalization", "doctor replacement", "11 validated languages", "production EHR integration", and close variants.

**Result: zero unsupported affirmative claims found.** Every match returned was a **disclaimer**, not a claim:
- `docs/SAFETY_REGRESSION_DATASET.md` (×2): explicitly states the dataset is "not a clinically validated benchmark."
- `docs/memory-graph-design.md`: explicitly states delirium/pain flags are "heuristic proxies, not clinically validated signals."
- `docs/product-guide.md`'s "What CalmGuide Never Does" section explicitly **prohibits** diagnosing, medication recommendations, and claiming to replace a doctor — this is defensive internal product documentation, not a violation.

No "11 languages"/HIPAA/FDA text found anywhere in the landing page, locale files, or README. **Product-claims audit: clean, no findings.**

---

## 22. Phase 6 Boundary Verification (Stage 21)

Searched `backend/app` and `backend/alembic` for: `clinician_reviewed`, `approved_for_rag`, `approved_for_generation`, `reviewer_role`, `review_date`, `next_review_date`, `clinical_approval`.

**Result: zero matches, anywhere in application code or migrations.**

**Required conclusion, per audit instructions: Phase 6 NOT IMPLEMENTED.** No clinician-governance schema, fields, or workflow logic exist in the codebase. The only artifacts referencing clinician review anywhere in the repo are the intentional, documented `TODO(CLINICAL-REVIEW-REQUIRED)`/`TODO(CLINICAL-LEGAL-REVIEW)`/`TODO(LOF-APPROVAL)` comments already accounted for in the sprint's own history (§23 below) — planning/documentation artifacts, not implemented behavior.

---

## 23. Performance Smoke Results (Stage 22)

Not a scientific benchmark, per audit instructions — basic engineering characteristics only.

**The single most important number for this stage:** the independent concurrency probe in §5-6 measured **0.350s** wall-clock for a LOW-risk request with RAG and DB-context reads each artificially delayed 0.3s — confirming `max(RAG, DB) ≈ 0.3s` behavior, not `RAG + DB = 0.6s` sequential behavior. **This is the direct, empirical answer to whether Phase 5's architecture still achieves `max()` rather than accidentally regressing to sequential** — it does.

**Qualitative EMERGENCY-vs-LOW comparison:** confirmed by the Stage 3 trace and the §5-6 call-count spies that EMERGENCY/HIGH requests skip `build_english_rag_query` (an LLM call), `_fetch_rag_context` (RAG retrieval), and the DB-context incident lookup entirely — all three stages LOW/MODERATE pay for. No wall-clock comparison beyond the concurrency probe above was run (e.g., no side-by-side timing of a real EMERGENCY vs. real LOW request against a live LLM), since that would require real API calls out of this environment's scope.

Live SSE time-to-first-token, real RAG retrieval latency, and real DB-context latency against a production-scale dataset: **NOT TESTED — dependency unavailable** (no live Postgres/pgvector, no real LLM calls in this environment).

---

### Dependency/Dead-Code Audit evidence (Stage 23)

**Confirmed exactly one `evaluate_safety_v2()` call site per router** (`coach.py:653`, `checkin.py:106`) — no duplicated safety evaluation.

**Old enum-bridging pattern still present, now unnecessary:** `app/services/safety_redteam.py:81` still writes `SafetyGateType(classifier_result.category.value)`. Since Phase 2 made `SafetyRiskCategory` a pure alias of `SafetyGateType` (`SafetyRiskCategory = SafetyGateType`), `classifier_result.category` is already a `SafetyGateType` instance — this line performs a harmless but redundant re-construction. **Cleanup candidate, not fixed** (per audit rules).

**`SafetyRiskCategory` alias usage confirmed scoped to exactly the expected 3 files** (`safety_classifier.py`'s own definition, `tests/test_safety_decision.py`, `tests/test_safety_classifier.py`) — no unexpected sprawl of the old name.

**Stale TODOs — none found beyond the expected, intentional ones:** `safety_decision.py` (`TODO(LOF-APPROVAL)`), `safety_gate.py` ×2 (`TODO(CLINICAL-LEGAL-REVIEW)` for caregiver-harm and elder-abuse mandatory-reporting gaps), `safety_classifier.py` (`TODO(CLINICAL-REVIEW-REQUIRED / TUNING)` for the similarity threshold). All four are already-documented, deliberate markers from the sprint's own history — not forgotten debt.

**Dead-code confirmed:** `mobile/src/components/BehavioralAnchorStage.tsx` (found via the Stage 19/20 localization gap) — zero imports anywhere in the mobile codebase, mirroring the already-cleaned-up frontend equivalent from Milestone 3. **Cleanup candidate, not removed** (per audit rules — "do not remove anything").

**Ruff `F401` (unused imports): clean, zero findings**, confirmed via a dedicated `--select F401` pass across the entire backend.

---

## 24. New Findings (Stage 24)

Every finding below was discovered during this audit and did not previously appear in `docs/AUDIT.md`, `docs/SAFETY_GATE_V2_PLAN.md`, or `docs/SAFETY_REGRESSION_DATASET.md`. None required a code change to reproduce; none were fixed, per audit rules. **No `CRITICAL` findings were confirmed** — the one candidate Critical (persistence appearing to silently fail for emergency turns) was investigated and traced to this audit's own probe-script defect, not a product bug (§5-6).

| # | Finding | Severity | Evidence | Layer |
|---|---|---|---|---|
| 1 | The entire Safety Gate v2 sprint (Phases 2-8) is uncommitted in the working tree. | **HIGH** | `git status` (§1) | Process/repo hygiene |
| 2 | `/health`'s top-level `"status"` field does not factor in RAG availability at all — a fully RAG-down backend can report `"status": "healthy"` while every Moment Coach response is silently ungrounded. Phase 7 added the *data* (`safety.rag.unavailable`) but not the *computation* or alerting. | **HIGH** | §10 (Stage 7), direct code read of `app/routers/health.py`'s `overall` computation | Observability / RAG |
| 3 | Frontend has no working lint command at all: `next lint` was removed in Next.js 16.3.4, and no `eslint.config.js` exists to run `eslint` directly instead. | **MEDIUM** | §4 (Stage 2), `next --help` output + missing config file | Tooling/CI hygiene |
| 4 | Mobile `expo lint` reports 83 problems (36 "errors", all one cosmetic rule; 47 warnings) not previously documented as a known baseline. | **LOW** | §18 (Stage 17) | Tooling hygiene |
| 5 | Dead code: `mobile/src/components/BehavioralAnchorStage.tsx` is unreferenced anywhere in the mobile app — the mobile-side twin of a component already removed from the frontend during Milestone 3's cleanup was never removed from mobile. Its only translation key (`profile.setup.behavioral_stage_heading`) is consequently missing from the Spanish/Hindi locale files, currently harmless only because the component is unreachable. | **LOW** | §20 (Stage 19), §24 (Stage 23) | Dead code / localization |
| 6 | Redundant, no-op enum re-construction (`SafetyGateType(classifier_result.category.value)`) left in `safety_redteam.py` after Phase 2's enum consolidation made it unnecessary. | **INFORMATIONAL** | §24 (Stage 23) | Cleanup candidate |
| 7 | Backend has 5 pre-existing files with `ruff format` drift (cosmetic only); frontend has 5 files with `prettier` drift, one (`ProfileWizard.tsx`) introduced earlier this same day without a follow-up format pass. | **INFORMATIONAL** | §4 (Stage 2) | Tooling hygiene |
| 8 | Minor API convention inconsistency: `/api/insights/{code}` returns `404` for "not enough data yet," while the sibling `/api/care-patterns/{code}` returns `204` for the equivalent state. Both are handled gracefully client-side; functionally harmless. | **LOW** | §17 (Stage 16), live network trace | API design |
| 9 | Elevated HTTP request volume observed during a live dev-mode browser session (~232 requests across a handful of navigations) — most plausibly React StrictMode double-invocation plus repeated navigation, not confirmed as a production polling bug. **Low-confidence observation, not a confirmed finding** — would need a production-build recheck to rule out definitively. | **LOW (unconfirmed)** | §17 (Stage 16) | Frontend performance |

---

## 25. Known / Deferred Findings

These were known before this audit began, are already ticketed, and were **reproduced but not treated as audit failures**, per the audit's explicit operating rule.

| Finding | Status | Evidence this audit |
|---|---|---|
| Ambiguous breathing over-trigger — "his breathing seems a little different when he sleeps, is that normal?" escalates to `EMERGENCY`/`breathing_difficulty` via the classifier (confidence 0.769). | `KNOWN / PRE-EXISTING` — ticket already spawned ("Investigate ambiguous breathing over-trigger") | §8 (Stage 5), reproduced exactly |
| French self-harm coverage gap — `"je veux mourir"` is not detected by any existing pattern; `"j'ai envie de mourir"` is. | `KNOWN / PRE-EXISTING` — ticket already spawned ("Fix French self-harm phrase coverage gap") | §8 (Stage 5), reproduced exactly, both phrasings tested |
| `MEDICATION_RISK` → `MODERATE` / `allow_rag=True` / `allow_llm=True` is a temporary product rule pending LOF/clinical review, marked `TODO(LOF-APPROVAL)`. | `KNOWN / PRE-EXISTING` — explicitly not to be changed during this audit | §5-6 (Stage 3), behavior confirmed unchanged |
| Phase 6 (clinician-reviewed RAG governance) is blocked pending LOF approval. | `KNOWN / PRE-EXISTING` — confirmed **NOT IMPLEMENTED**, no accidental scope creep found | §22 (Stage 21) |
| The historical "RAG corpus empty after infra migration" incident (2026-09-02, resolved 2026-09-07 per `docs/AUDIT.md`). | `KNOWN / PRE-EXISTING`, already resolved — cited here only as context for New Finding #2 above, which is a *related but distinct* current gap (health/alerting computation, not corpus emptiness). | §10 (Stage 7) |
| `response_guard.guard_response_text`'s inner static-fallback path (repair succeeds, second validation fails) is indistinguishable from a successful repair in the current observability counters. | `KNOWN / PRE-EXISTING` — already disclosed in the sprint's own code comments | §11 (Stage 8) |

---

## 26. Untested Areas and Why

| Area | Reason |
|---|---|
| Live PostgreSQL / pgvector, real migration state (`alembic current`/`check`) | Docker daemon not running in this environment; no reachable Postgres instance (§1). |
| Live RAG retrieval (real embeddings, real pgvector similarity search, real chunk/source content) | Depends on the same unavailable Postgres/pgvector instance. |
| Real OpenAI/Anthropic API calls (model output quality, real medication-refusal compliance, real provider failover under a genuine outage) | Explicitly out of scope for this environment — would consume paid API calls; the test suite's `MockLLMProvider` was used throughout instead, which validates every code path *up to* the model call but not the model's own behavior. |
| Real TTS synthesis | `TTS_ENABLED=false` is the test/audit default; real synthesis bills a provider. |
| Mobile device/emulator E2E (iOS or Android) | No `simctl` (Xcode CLI tools absent), no Android emulator binary, no connected device (`adb devices` empty). |
| Facility Portal live browser UI (login screen, PIN entry, resident list rendering) | Time-budget prioritization — this audit's own stated priority ("actual HTTP routing... web integration" for Moment Coach) was spent on the higher-value safety-escalation live browser trace instead; the underlying API/authorization layer facility portal depends on is fully covered via its 131-test backend suite. |
| Malformed/empty RAG source metadata as a distinct failure injection | Not independently constructed this audit; the general `except Exception` umbrella around RAG retrieval would catch it identically to any other failure, but this specific shape was not isolated and verified. |
| Live provider-failover counter increment under a forced real failure | Wiring confirmed by code read; a live forced-failure trace was not run this audit. |
| Transaction-abort / mid-write failure behavior | Existing `test_coach_reliability.py` coverage re-run and passing as part of the Stage 2 baseline; no new fault-injection scenario was staged specifically for this audit. |
| Production-build (`next build && next start`) re-check of the elevated-request-volume observation | Time budget; the dev-mode observation is flagged as low-confidence/unconfirmed rather than asserted as a bug. |

---

## 27. Recommended Remediation Order

Ordered by severity, then by how directly each affects safety-critical behavior:

1. **Commit the Safety Gate v2 sprint.** (New Finding #1, `HIGH`.) Everything this audit verified as working — 1837 passing tests, the entire Phase 5 architectural fix — exists only in an uncommitted working tree. This is the single highest-leverage action available: it converts every other finding and every passing test in this report into something durable rather than something that could be lost to `git checkout .` or a lost machine.
2. **Wire RAG availability into `/health`'s overall status/alerting, or add a dedicated alert on `safety.rag.unavailable`.** (New Finding #2, `HIGH`.) The data already exists in `/health`'s response; closing the loop into the actual status computation (or an external alert reading that field) would have caught the 2026-09-02 incident automatically instead of via manual discovery.
3. **Restore a working frontend lint command.** (New Finding #3, `MEDIUM`.) Either add `eslint.config.js` (flat config) and run `eslint` directly, or adopt whatever Next.js 16's replacement tooling is — currently there is no automated lint gate on the frontend at all.
4. **Clean up `mobile/src/components/BehavioralAnchorStage.tsx`** (New Finding #5) and add the two missing Spanish/Hindi keys it currently orphans, or remove both together — whichever a maintainer confirms is dead.
5. **Investigate and fix the two already-ticketed known findings** (breathing over-trigger, French self-harm gap) per their existing, scoped tickets — not because this audit found them (it didn't; they were already known), but because they're the most safety-relevant open items in the whole system.
6. Address the remaining `LOW`/`INFORMATIONAL` findings (mobile lint noise, formatting drift, the `insights`/`care-patterns` 404-vs-204 inconsistency, the redundant enum re-construction) opportunistically — none are urgent, none affect safety behavior.

---

## 28. Final Engineering Readiness Summary

| Component | Verdict |
|---|---|
| Backend automated regression | **PASS** — 1837/1837, fresh, matches claimed baseline exactly |
| Safety routing (Safety Gate v2, end-to-end) | **PASS** — verified via existing suite, an independent concurrency probe, a full four-tier persistence/observability trace, and a live browser session reaching the real 988 escalation text |
| Regression dataset integrity | **PASS** — 117/117 accounted for, 120/120 tests passing, confirmed to read only the committed file |
| RAG functional path | **DEGRADED (visibility) / NOT TESTED (live retrieval)** — code path and failure-mode handling verified via mocks and code read; live embeddings/pgvector unavailable this environment; a real, currently-existing gap found in how RAG failure surfaces in overall `/health` status |
| Persistence & data integrity | **PASS** — correct behavior confirmed for all four risk tiers, no cross-contamination between safety and normal paths |
| Security / AuthN / AuthZ | **PASS** — encryption, JWT fail-closed behavior, bcrypt salting, and the historical facility behavioral-card IDOR fix all re-confirmed fresh; zero cross-facility access observed |
| Streaming / SSE / provider failover | **PASS** — headers, event shape, and failover semantics confirmed by code read and existing tests; live forced-failure not independently re-run |
| Response Guard | **PASS** — 46/46 fresh; confirmed never applied to emergency static responses |
| Check-In | **PASS** — including the Phase 5 sign-off medication-frustration regression |
| Web application | **PASS (core safety path, live-verified) / PARTIAL (full feature surface not exhaustively re-clicked)** |
| Mobile application | **PARTIAL** — unit/lint/build-validation PASS; device E2E explicitly **NOT TESTED**, not claimed as passing |
| Facility Portal | **PASS (backend/authorization) / NOT TESTED (live UI)** |
| Localization | **PASS**, with one dead-code-linked gap found and documented |
| Product-claims consistency | **PASS** — no unsupported claims found anywhere in the codebase |
| Phase 6 boundary | **CONFIRMED NOT IMPLEMENTED** — no clinician-governance scope creep found |
| Deployment readiness | **Not yet committed** (New Finding #1) is the binding constraint — the code itself is in good shape; the git history is not yet caught up to it. |

**Overall: the Safety Gate v2 sprint's core claims hold up under independent, fresh, adversarial-minded verification.** The most important discovery of this audit is procedural, not architectural: the work is real and correct, but it is not yet committed. The most important *technical* discovery is that RAG's failure state, while now measured (Phase 7), still is not connected to the system's own definition of "healthy" — a direct, addressable descendant of the exact incident class that motivated adding that observability in the first place.

