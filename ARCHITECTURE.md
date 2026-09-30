# CalmGuide Architecture

Detailed architecture, data flows, and system design for CalmGuide.

---

## System Overview

```
                          +-----------------------+
                          |      Caregiver        |
                          |   (Browser, 3am)      |
                          +-----------+-----------+
                                      |
                                      | HTTPS
                                      v
                          +-----------+-----------+
                          |    Next.js Frontend    |
                          |    (App Router, TS)    |
                          |                       |
                          |  localStorage:        |
                          |   - patient_name      |
                          |   - access_code       |
                          +-----------+-----------+
                                      |
                                      | REST + SSE
                                      v
+-------------------------+-----------+-----------+---------------------------+
|                         |    FastAPI Backend     |                          |
|                         |                       |                          |
|  +-------------------+  |  +----------------+   |  +-------------------+   |
|  | Profile Router    |  |  | Coach Router   |   |  | Learn Router     |   |
|  | /api/profiles     |  |  | /api/coach     |   |  | /api/learn       |   |
|  +-------------------+  |  +-------+--------+   |  +-------------------+   |
|                         |          |             |                          |
|                         |  +-------v--------+   |                          |
|                         |  | RAG Retrieve   |   |                          |
|                         |  | (hybrid search)|   |                          |
|                         |  +-------+--------+   |                          |
|                         |          |             |                          |
+-------------------------+----------+-------------+--------------------------+
                                     |
                    +----------------+----------------+
                    |                                  |
           +--------v---------+              +---------v--------+
           |  PostgreSQL 16   |              |  OpenAI API      |
           |  + pgvector      |              |                  |
           |                  |              |  - Chat (LLM)    |
           |  Tables:         |              |  - Embeddings    |
           |  - profiles      |              +------------------+
           |  - conversations |
           |  - rag_chunks    |
           +------------------+
```

---

## Moment Coach Data Flow

The most important flow in CalmGuide. This is what happens when a caregiver types "Dad woke up screaming at midnight" and taps "Get Guidance". Updated 2026-09-30 to show the safety-first ordering, the parallel context fetch (including OpenMRS), the response guard, and the background memory pass.

```
Step 1: CLIENT (web CoachPage / mobile coach.tsx)
+------------------------------------------------------------------+
|  useStreamingChat -> POST /api/coach/chat  (SSE response)         |
|  Body: { access_code, patient_name, message, session_id? }        |
|  Header: X-App-Locale                                             |
+--------------------------------+---------------------------------+
                                 |
                                 v
Step 2: PROFILE + LOCALE
+------------------------------------------------------------------+
|  coach_chat(): hash access code -> load profile; resolve locale,  |
|  response language and model (gpt-4o for es/hi, else default)     |
+--------------------------------+---------------------------------+
                                 |
                                 v
Step 3: SAFETY GATE v2  (before any RAG, DB context, OpenMRS or LLM)
+------------------------------------------------------------------+
|  evaluate_safety_v2(message):                                     |
|    deterministic regex gate (authoritative) -> fuzzy classifier   |
|    -> category refinement                                         |
|                                                                   |
|  EMERGENCY / HIGH ──► fixed, locale-aware escalation text          |
|                       SSE {"safety": {"emergency": true}} -> red   |
|                       alert on web and mobile. No LLM, no RAG,     |
|                       no OpenMRS. Turn logged as is_safety_gate.   |
|  MODERATE (medication risk) / LOW ──► continue                     |
+--------------------------------+---------------------------------+
                                 |
                                 v
Step 4: CONTEXT, fetched in parallel (asyncio.gather)
+---------------------+----------------------+---------------------+
| RAG                 | CalmGuide DB (DICE   | OpenMRS (optional)  |
|                     | "Investigate")       |                     |
| English retrieval   | dossier, relevant    | only if enabled AND |
| query (translated   | past incidents,      | profile is linked.  |
| for non-English)    | contraindicated +    | FHIR R4 summary from|
| -> embed (text-     | effective            | warm SWR cache;     |
| embedding-3-large)  | interventions,       | 1.5 s budget, else  |
| -> pgvector hybrid  | frequency trends,    | coach continues     |
| search -> rerank -> | delirium/pain flags, | without it          |
| top 3 >= 0.20       | cross-patient, care  |                     |
|                     | change               |                     |
+---------------------+----------------------+---------------------+
                                 |
                                 v
Step 5: PROMPT ASSEMBLY  (render_coach_prompt, coach_system.jinja2)
+------------------------------------------------------------------+
|  Safety principles -> domain knowledge -> contraindicated list    |
|  -> patient context -> clinical record block (if linked) ->        |
|  memory/trend/delirium/pain blocks -> RAG guidance ->              |
|  four-section response format with [[SECTION:...]] markers ->      |
|  tone, distress, abuse and injection rules -> few-shot examples    |
+--------------------------------+---------------------------------+
                                 |
                                 v
Step 6: LLM STREAM  (OpenAI / Anthropic via LLMProvider)
+------------------------------------------------------------------+
|  system prompt + conversation history + new message               |
|  chunks -> SSE data: {"text": ...}                                |
|  provider failure -> localized static fallback                    |
+--------------------------------+---------------------------------+
                                 |
                                 v
Step 7: RESPONSE GUARD  (post-stream)
+------------------------------------------------------------------+
|  validate_response_quality: language/script, respect, medication  |
|  dosing next to a linked record's medication                      |
|  fail -> one LLM repair pass -> still failing -> static fallback   |
|  SSE data: {"replace": ...} swaps the text on web and mobile       |
+--------------------------------+---------------------------------+
                                 |
                                 v
Step 8: DONE + BACKGROUND MEMORY PASS  (DICE "Evaluate", off the
        critical path, runs even if the caregiver closes the app)
+------------------------------------------------------------------+
|  save encrypted assistant turn -> tags -> incident extraction ->   |
|  insights -> dossier refresh                                       |
+--------------------------------+---------------------------------+
                                 |
                                 v
Step 9: CLIENT RENDERING
+------------------------------------------------------------------+
|  parseCoachResponse() splits on [[SECTION:...]] markers            |
|  CoachResponseRenderer: RIGHT NOW (primary) · WHY · WHAT NOT TO DO |
|  (red border) · WHEN TO CALL FOR HELP                             |
|  Read-aloud: web speaks sentence by sentence as text streams;      |
|  mobile speaks once the reply is complete                         |
+------------------------------------------------------------------+
```

Evaluation of this flow's output is described in
[`docs/clinical-evaluation/EVALUATION_FRAMEWORK.md`](docs/clinical-evaluation/EVALUATION_FRAMEWORK.md).

---

## OpenMRS Clinical Context

Optional, off unless `OPENMRS_ENABLED` is set. A caregiver links a Care Profile to an OpenMRS patient (`clinical_links` table; the patient UUID is AES-256-GCM encrypted; no name or identity field is stored). Linking is two-step: `POST /api/profiles/{code}/clinical-link/preview` returns the patient's given name once for a "Link to <name>?" confirmation, then `PUT` stores the link. `GET` returns status (last 4 UUID characters at most), `POST …/test` returns section counts, `DELETE` unlinks. All four 404 with `FEATURE_DISABLED` when the feature is off. Profile erasure deletes the link.

In `coach_chat`, the link row is read only **after** Safety Gate v2 has allowed the LLM, and the OpenMRS fetch is a third branch of the existing `asyncio.gather(_rag_pipeline(), _db_context(), …)`. EMERGENCY/HIGH turns never touch OpenMRS (enforced by `tests/test_openmrs_integration.py` against every short-circuited regression case).

```
message → Safety Gate v2 ──EMERGENCY/HIGH──▶ escalation (no OpenMRS, RAG or LLM)
                │ allow_llm
                ▼
         read clinical link row
                ▼
   gather( RAG │ CalmGuide DB │ OpenMRS FHIR R4 summary )
                ▼
   render_coach_prompt → LLM stream → response guard (+ medication dosing check)
```

`app/services/openmrs_client.py` reads FHIR R4 (`Condition`, `MedicationRequest`, `AllergyIntolerance`, `Observation`) with a shared `httpx.AsyncClient` on `app.state.openmrs`; response bodies are never logged. `app/services/clinical_context.py` turns them into a capped `ClinicalSummary` (active conditions ≤8, active medications ≤10 as name + frequency with doses stripped, allergies ≤6, whitelisted vitals from the last 14 days keyed by CIEL code ≤8). The four fetches share one `OPENMRS_TIMEOUT_SECONDS` budget; failures give `partial`/`unavailable` and the coach carries on. OpenMRS FHIR is slow (a warm Observation search takes ~9 s on the test instance), so the per-profile cache is stale-while-revalidate: a summary younger than `OPENMRS_CACHE_TTL_SECONDS` is served as-is, an older one (up to 24 h) is served immediately while one background refresh runs, and a fetch that overruns the chat budget keeps running (up to 30 s) and fills the cache for the next message. Linking, "Test connection" and app startup warm the cache. The cache is in-process and per instance — move it to Redis if the backend scales out. The prompt block tells the model to use the record as background, route plausibly related changes to "contact the doctor", and never advise on medications; `validate_medication_safety` in the response guard flags replies that pair a listed medication with dosing language and sends them through the existing repair path.

---

## RAG Pipeline Architecture

```
                    ┌─────────────────────────────┐
                    │      Seed URLs (41 pages)    │
                    │  alz.org, Mayo, HelpGuide,   │
                    │  caregiver.org, CDC           │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────v──────────────┐
                    │  scraper/crawl.py            │
                    │                              │
                    │  - httpx async HTTP client   │
                    │  - BeautifulSoup HTML parse  │
                    │  - html2text -> markdown     │
                    │  - Boilerplate removal       │
                    │  - Source domain allowlist    │
                    │  - 1.5s polite delay         │
                    └──────────────┬──────────────┘
                                   │ ScrapedPage[]
                    ┌──────────────v──────────────┐
                    │  scraper/chunk.py            │
                    │                              │
                    │  - tiktoken (o200k_base)     │
                    │  - 400 tokens per chunk      │
                    │  - 50 token overlap          │
                    │  - Title prepended to each   │
                    │    chunk for semantic anchor  │
                    └──────────────┬──────────────┘
                                   │ Chunk[]
                    ┌──────────────v──────────────┐
                    │  embeddings/embed.py         │
                    │                              │
                    │  - OpenAI text-embedding-    │
                    │    3-large (3072 dims)        │
                    │  - Batched (100 per call)    │
                    └──────────────┬──────────────┘
                                   │ float[][]
                    ┌──────────────v──────────────┐
                    │  vectorstores/pgvector.py    │
                    │                              │
                    │  PostgreSQL table:            │
                    │  ┌─────────────────────────┐ │
                    │  │ rag_chunks              │ │
                    │  │ - id (BIGSERIAL)        │ │
                    │  │ - chunk_id (TEXT, UQ)    │ │
                    │  │ - content (TEXT)         │ │
                    │  │ - source_url (TEXT)      │ │
                    │  │ - source_title (TEXT)    │ │
                    │  │ - source_name (TEXT)     │ │
                    │  │ - source_domain (TEXT)   │ │
                    │  │ - embedding vector(3072) │ │
                    │  │ - search_vector tsvector │ │
                    │  │   (auto-generated)       │ │
                    │  └─────────────────────────┘ │
                    │                              │
                    │  Indexes:                     │
                    │  - GIN on search_vector       │
                    │  - UNIQUE on chunk_id          │
                    │  - ivfflat on embedding        │
                    │    (dims <= 2000 only)         │
                    └─────────────────────────────┘
```

### Hybrid Search Detail

```
Caregiver query: "Dad is screaming at midnight, doesn't know who I am"
                                   │
                    ┌──────────────v──────────────┐
                    │  1. Embed query via OpenAI   │
                    │     -> 3072-dim vector        │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────v──────────────┐
                    │  2. PostgreSQL hybrid query   │
                    │                              │
                    │  score =                      │
                    │    cosine_similarity(q, chunk) │
                    │    + IF keyword_match THEN     │
                    │        0.15                    │
                    │      ELSE 0                    │
                    │                              │
                    │  Keyword match uses tsvector:  │
                    │  plainto_tsquery('english',    │
                    │    'screaming midnight...')     │
                    │  matched against chunk's       │
                    │  search_vector (title+content)  │
                    └──────────────┬──────────────┘
                                   │ top 9 candidates
                    ┌──────────────v──────────────┐
                    │  3. Python reranking          │
                    │                              │
                    │  Boost chunks whose title     │
                    │  shares words with query:      │
                    │  +0.05 per overlapping word    │
                    │                              │
                    │  Sort by boosted score         │
                    │  Return top 3 above 0.20       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────v──────────────┐
                    │  Injected into Jinja2 prompt │
                    │                              │
                    │  **Hallucinations**           │
                    │  When a person hallucinates..  │
                    │  ---                          │
                    │  **Dementia Behaviors Guide** │
                    │  Nighttime confusion is...    │
                    │  ---                          │
                    │  **Suspicions & Delusions**   │
                    │  Paranoia in dementia...      │
                    └─────────────────────────────┘
```

---

## Database Schema

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│ profiles                     │     │ conversations                │
│──────────────────────────────│     │──────────────────────────────│
│ id            VARCHAR(36) PK │◄────│ profile_id   VARCHAR(36) FK  │
│ access_code_hash VARCHAR(64) │     │ id           VARCHAR(36) PK  │
│ disease_stage VARCHAR(20)    │     │ session_id   VARCHAR(36)     │
│ behavioral_patterns TEXT ENC │     │ role         VARCHAR(10)     │
│ calming_strategies  TEXT ENC │     │ locale_code  VARCHAR(10)     │
│ safety_concerns     TEXT ENC │     │ suggested_tags TEXT ENC      │
│ created_at   TIMESTAMPTZ    │     │ content      TEXT ENC        │
│ updated_at   TIMESTAMPTZ    │     │ created_at   TIMESTAMPTZ    │
└──────────────────────────────┘     └──────────────────────────────┘

┌──────────────────────────────┐     ┌──────────────────────────────┐
│ profile_insights             │     │ response_feedback            │
│──────────────────────────────│     │──────────────────────────────│
│ id           VARCHAR(36) PK  │     │ id           VARCHAR(36) PK  │
│ profile_id   VARCHAR(36) FK  │     │ conversation_id VARCHAR(36)  │
│              (UQ, indexed)   │     │              FK (UQ, indexed)│
│ computed_at  TIMESTAMPTZ     │     │ helpful      BOOLEAN (null=  │
│ insights_json TEXT ENC       │     │              skipped)        │
└──────────────────────────────┘     │ tags         TEXT ENC        │
                                     │ negative_reasons TEXT ENC    │
┌──────────────────────────────┐     │ source       VARCHAR(10)    │
│ daily_checkin                │     │ created_at   TIMESTAMPTZ    │
│──────────────────────────────│     └──────────────────────────────┘
│ id           VARCHAR(36) PK  │
│ profile_id   VARCHAR(36) FK  │     ┌──────────────────────────────┐
│ check_date   DATE            │     │ cross_patient_strategies     │
│ time_slot    VARCHAR(10)     │     │──────────────────────────────│
│ severity     VARCHAR(10)     │     │ id           VARCHAR(36) PK  │
│ tags         TEXT ENC        │     │ cohort_key   VARCHAR(30)     │
│ created_at   TIMESTAMPTZ    │     │ strategy_tag VARCHAR(30)     │
└──────────────────────────────┘     │ helped_count INT             │
                                     │ total_profiles INT           │
┌──────────────────────────────┐     │ computed_at  TIMESTAMPTZ    │
│ rag_chunks                   │     │ UQ(cohort_key, strategy_tag)│
│──────────────────────────────│     └──────────────────────────────┘
│ id           BIGSERIAL PK    │
│ chunk_id     TEXT UQ          │
│ content      TEXT             │     ENC = AES-256-GCM encrypted
│ source_url   TEXT             │
│ source_title TEXT             │
│ source_name  TEXT             │
│ source_domain TEXT            │
│ embedding    vector(3072)     │
│ search_vector tsvector (GEN)  │
└──────────────────────────────┘
```

```
┌──────────────────────────────┐
│ clinical_links               │   Optional link to an external clinical
│──────────────────────────────│   record (OpenMRS). See "OpenMRS Clinical
│ id           VARCHAR(36) PK  │   Context" below.
│ profile_id   VARCHAR(36) FK  │
│ source       VARCHAR(20)     │   "openmrs" (Fitbit later)
│ external_ref TEXT ENC        │   patient UUID — no name/DOB/identifiers
│ linked_at    TIMESTAMPTZ     │
│ last_synced_at TIMESTAMPTZ   │
│ last_status  VARCHAR(20)     │   ok / partial / unavailable
│ UQ(profile_id, source)       │
└──────────────────────────────┘
```

**Notes:**
- `behavioral_patterns`, `calming_strategies`, `safety_concerns` are JSON arrays stored as TEXT
- `search_vector` is a generated column: `to_tsvector('english', source_title || ' ' || content)`
- `chunk_id` is `md5(source_url || ':' || content)` for deduplication across re-ingests

---

## Privacy Model

```
┌────────────────────┐          ┌─────────────────────────┐
│  BROWSER ONLY      │          │  SERVER (PostgreSQL)     │
│  (localStorage)    │          │                          │
│                    │          │  profiles:               │
│  patient_name ─────┼── POST ──┼─► (transient, in memory) │
│  access_code  ─────┼──────────┼─► access_code_hash only  │
│                    │          │                          │
│                    │          │  conversations:          │
│                    │          │   - role + content only   │
│                    │          │   - NO patient_name       │
│                    │          │   - NO caregiver identity │
└────────────────────┘          └─────────────────────────┘

Patient name flows through the system prompt to the LLM
but is NEVER written to the database. If the browser's
localStorage is cleared, the name is gone.
```

---

## Conversation Session Flow

```
First visit:                     Return visit (tap recent conversation):

/coach                           /coach?session_id=abc-123
    │                                │
    v                                v
Phase 1: Greeting + Big Input    Load history from API:
    │                            GET /api/conversations/{code}/{id}/messages
    │ submit                         │
    v                                v
Phase 2: Chat layout             Phase 2: Chat layout with past exchanges
    │                                │
    │ POST /api/coach/chat           │ POST /api/coach/chat
    │ (new session_id assigned)      │ (same session_id reused)
    v                                v
SSE streaming response           SSE streaming response
    │                            (backend loads conversation history
    │                             for context continuity)
    v                                v
Saved to conversations table     Saved to conversations table
```

---

## Caregiver Feedback Loop

How feedback flows from a caregiver's thumbs-up/down into the pattern engine and back into better crisis guidance.

```
Step 1: CRISIS RESPONSE DELIVERED
+------------------------------------------------------------------+
|  Caregiver receives 4-part crisis guidance                        |
|  Backend generates suggested_tags from "Right Now" section        |
|  Tags stored (encrypted) on the assistant message row             |
+--------------------------------+---------------------------------+
                                 |
                                 v

Step 2: FEEDBACK COLLECTION (two paths)
+------------------------------------------------------------------+
|  Path A — Home Screen Card (primary, catches most users)          |
|  "How did it go?" card appears within 48h of unfeedback'd session |
|  Thumbs up/down → expandable strategy tags → Done                 |
|  Suppressed when caregiver navigates to crisis (sessionStorage)   |
|                                                                   |
|  Path B — In-Conversation Widget (secondary)                      |
|  When revisiting past sessions, per-response feedback widget      |
|  Shows read-only state if feedback already given via Path A       |
+--------------------------------+---------------------------------+
                                 |
                                 v

Step 3: FEEDBACK STORED
+------------------------------------------------------------------+
|  response_feedback table:                                         |
|  - conversation_id (FK → assistant message)                       |
|  - helpful (true/false/null=skipped)                              |
|  - tags: ["calm_approach", "music"] (encrypted)                   |
|  - negative_reasons: ["too_generic"] (encrypted, if thumbs down)  |
|  One feedback per response. Duplicates return 409.                |
+--------------------------------+---------------------------------+
                                 |
                                 v

Step 4: PATTERN ENGINE UPGRADE
+------------------------------------------------------------------+
|  compute_profile_insights() aggregates feedback:                  |
|  - effective_strategies: {"calm_approach": 8, "music": 5}         |
|  - ineffective_reasons: {"too_generic": 2}                        |
|  - resolution_rate upgraded from inference to ground truth         |
|  Stored in profile_insights.insights_json (encrypted)             |
+------------------------------------------------------------------+
```

---

## Behavioral Pattern Detection & Prediction

How CalmGuide detects recurring episode patterns and predicts when crises are likely.

```
DATA SOURCES
+-------------------+     +-------------------+
|  Crisis Sessions  |     |  Daily Check-In   |
|  (conversations)  |     |  (daily_checkin)   |
|  Timestamps of    |     |  Caregiver logs:   |
|  every crisis     |     |  calm / mild /     |
|  interaction      |     |  tough + time slot |
+---------+---------+     +---------+---------+
          |                         |
          +------------+------------+
                       |
                       v

PATTERN DETECTOR (app/services/pattern_detector.py)
+------------------------------------------------------------------+
|  1. Collect episode dates (crisis sessions + non-calm check-ins)  |
|  2. Sort and compute intervals between consecutive episodes       |
|  3. Coefficient of Variation (CV) determines regularity:          |
|     CV < 0.3 → high confidence cycle                              |
|     CV < 0.5 → moderate confidence                                |
|     CV < 0.7 → low confidence                                     |
|     CV > 0.7 → no reliable cycle detected                         |
|  4. Minimum: 5+ episodes across 14+ calendar days                 |
|                                                                   |
|  Output: { detected: true, avg_interval_days: 3.5,               |
|            last_episode_date, next_predicted_date, confidence }    |
+--------------------------------+---------------------------------+
                                 |
                                 v

RISK SCORING
+------------------------------------------------------------------+
|  risk_score = base (0-70) + trend_bonus (0-20) + time_bonus (0-10)|
|                                                                   |
|  Base score from cycle position:                                  |
|    days_since_last / avg_interval = position (0.0 to 1.0+)       |
|    position < 0.3  → low risk (just had an episode)              |
|    position 0.7-1.0 → high risk (episode is "due")              |
|    position > 1.0  → overdue (max base = 70)                    |
|                                                                   |
|  Trend bonus: increasing (+20), stable (+5), decreasing (+0)     |
|  Time bonus: +10 if current time is approaching peak_time        |
|                                                                   |
|  risk_level = "elevated" if score >= 50, else "normal"           |
|  Hysteresis: card appears at 50+, disappears at 40-              |
+--------------------------------+---------------------------------+
                                 |
                                 v

TONIGHT'S OUTLOOK CARD (Home Screen)
+------------------------------------------------------------------+
|  Appears ONLY when risk_level = "elevated"                        |
|  Never shows "tonight looks calm" (false negatives are silent)    |
|                                                                   |
|  Content:                                                         |
|  "Tonight may need some extra care"                               |
|  "Episodes tend to happen every 3-4 days, and it's been 3 days"  |
|  Top 3 strategies: "Music, Calm approach, Redirection"            |
|                                                                   |
|  Self-calibrating: 3+ false positives → raise threshold           |
|  After 7 consecutive high-risk days → switch to persistent msg    |
+------------------------------------------------------------------+
```

---

## Cross-Patient Learning & Prompt Injection

How anonymized strategy effectiveness from all caregivers feeds back into individual crisis guidance.

```
NIGHTLY AGGREGATION (APScheduler, 3am UTC)
+------------------------------------------------------------------+
|  For each profile:                                                |
|    1. Determine cohort: disease_stage + peak_time                 |
|       e.g., "middle:overnight", "late:evening"                    |
|    2. Collect all thumbs-up feedback tags (predefined only)       |
|    3. Count unique profiles per strategy tag                      |
+--------------------------------+---------------------------------+
                                 |
                                 v

CROSS-PATIENT STRATEGIES TABLE
+------------------------------------------------------------------+
|  cohort_key    | strategy_tag  | helped_count | total_profiles    |
|  middle:overnight | music      | 6            | 8                 |
|  middle:overnight | calm_approach | 5          | 8                 |
|  late:evening  | physical_touch | 4            | 6                 |
|                                                                   |
|  k-anonymity: only surfaced when cohort >= 5 profiles             |
|  Only predefined tags (12 standard) — no custom tags cross        |
|  patient boundaries                                               |
+--------------------------------+---------------------------------+
                                 |
               +-----------------+-----------------+
               |                                   |
               v                                   v

USE 1: NEW CAREGIVER BOOST              USE 2: PROMPT INJECTION
+---------------------------+    +----------------------------------+
| PatternInsights section:  |    | coach_system.jinja2:            |
| "What works for similar   |    |                                  |
|  patients"                |    | ## What Has Worked for Similar   |
| Music (6/8)               |    |    Patients                      |
| Calm approach (5/8)       |    | - Music (6 of 8 caregivers)      |
|                           |    | - Calm Approach (5 of 8)         |
| Gives actionable guidance |    | - Redirection (4 of 8)           |
| from day one, even with   |    |                                  |
| zero personal history     |    | Consider prioritizing these...   |
+---------------------------+    |                                  |
                                 | Strategy order RANDOMIZED to     |
                                 | prevent feedback loops           |
                                 +----------------------------------+
```

### Data Flow: Daily Check-In → Prediction → Prompt

```
Caregiver opens app
        │
        v
┌─ Home Screen Card Stack ─────────────────────────────────┐
│                                                           │
│  1. Feedback card     "How did it go?" (if pending)       │
│  2. Daily check-in    "How was today?" (if not logged)    │
│  3. Tonight's outlook "Tonight may need extra care"       │
│  4. Pattern insights  Cycle, trends, effective strategies │
│  5. Conversations     Recent sessions                     │
│                                                           │
│  Max 2 cards visible. Feedback first, check-in second.    │
│  All suppressed when navigating to/from crisis.           │
└───────────────────────────────────────────────────────────┘
        │
        │  Caregiver taps "Calm day" (1 tap)
        │  or "Tough + overnight + music" (3 taps)
        v
┌─ Daily Check-In Stored ──────────────────────────────────┐
│  daily_checkin: { severity, time_slot, tags (encrypted) } │
│  Feeds into pattern detector on next insights computation │
└───────────────────────────────────────────────────────────┘
        │
        │  Next crisis session
        v
┌─ Crisis Prompt Assembly ─────────────────────────────────┐
│  1. Patient profile (stage, behaviors, strategies)        │
│  2. RAG context (Alzheimer's Assoc. guidelines)           │
│  3. Cross-patient strategies (from aggregation table)     │
│  4. Conversation history                                  │
│                                                           │
│  The LLM now has: patient-specific data + evidence-based  │
│  guidance + what has worked for similar patients           │
└───────────────────────────────────────────────────────────┘
```

---

## Encryption at Rest

All sensitive data is encrypted with AES-256-GCM before writing to PostgreSQL.

```
Plaintext → encrypt() → "ENC:" + base64(12-byte nonce || ciphertext || 16-byte GCM tag)

"ENC:abc123..." → decrypt() → Plaintext
Non-ENC values  → decrypt() → Returned unchanged (migration safety)
```

**Key management:**
- `CONVERSATION_ENCRYPTION_KEY` env var: 32-byte random value, base64-encoded
- Validated at call time: rejects keys that aren't exactly 32 bytes
- Generate: `python -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"`
- Never logged, never stored in DB, never sent to client

**What's encrypted:**
- `conversations.content` (user + assistant messages)
- `profiles.behavioral_patterns`, `calming_strategies`, `safety_concerns`
- `conversations.suggested_tags`
- `response_feedback.tags`, `response_feedback.negative_reasons`
- `daily_checkin.tags`
- `profile_insights.insights_json`

**What's NOT encrypted (public/aggregate data):**
- `cross_patient_strategies` (contains only predefined tag names + counts, no PII)
- `rag_chunks` (public caregiving guidance from nonprofit sources)

---

## Response Quality Guardrails

Every LLM response (crisis, check-in, learn) passes through a post-stream validation pipeline before reaching the caregiver.

```
LLM streaming completes
        │
        v
┌─ validate_response_quality() ────────────────────────────┐
│                                                           │
│  1. Language Script Validation (6 non-Latin scripts)      │
│     - Min 65% of letters in target script                 │
│     - Min 100 meaningful letters                          │
│     - Detects romanization (>20% pure ASCII words)        │
│     Scripts: Arabic, Hindi, Tamil, Chinese, Japanese,     │
│              Korean                                       │
│                                                           │
│  2. Disrespectful Phrase Detection                         │
│     - 58 English phrases (control, force, burden, etc.)   │
│     - Localized lists: Arabic (6), Hindi (6), Tamil (6),  │
│       Chinese (6), Japanese (3), Korean (3)               │
│                                                           │
│  Result: is_valid (bool) + reason (str)                   │
└────────────────┬──────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │ Valid?           │
        v                  v
      YES                 NO
   (stream to          ┌─ guard_response_text() ─────────────┐
    client as-is)      │  1. Send original + repair prompt    │
                       │     to LLM: "Rewrite in correct      │
                       │     script, keep meaning + markdown"  │
                       │  2. If repair valid → send 'replace'  │
                       │     event to swap client-side         │
                       │  3. If repair fails → locale-specific │
                       │     fallback error message             │
                       └───────────────────────────────────────┘
```

Used in: `coach.py`, `checkin.py`, `learn.py` (all streaming endpoints).

---

## LLM Provider Abstraction

```
              ┌──────────────────────┐
              │   LLMProvider (ABC)  │
              │                      │
              │  stream_completion() │ → AsyncGenerator[str]
              │  completion()        │ → str
              └──────────┬───────────┘
                         │
              ┌──────────┴───────────┐
              │                      │
   ┌──────────▼──────┐   ┌──────────▼──────┐
   │ OpenAIProvider   │   │ AnthropicProvider│
   │                  │   │                  │
   │ gpt-4o-mini      │   │ claude-sonnet-4  │
   │ gpt-4o (multi-   │   │                  │
   │  lingual mode)   │   │                  │
   └──────────────────┘   └──────────────────┘
```

- **Factory:** `get_llm_provider(provider_name, api_key, model)` — configured via `LLM_PROVIDER` env var
- **Initialized** in app startup lifespan, attached to `app.state.llm_provider`
- **Model override:** per-request via `model_override` parameter (used for multilingual locales → gpt-4o)
- **Multilingual model selection:** non-English locales automatically use `gpt-4o` (better multilingual output) instead of `gpt-4o-mini`

---

## Multilingual RAG Query Translation

The RAG corpus is English-only (41 pages from Alzheimer's Association, Mayo Clinic, etc.). Non-English caregiver queries are translated to English before retrieval.

```
Caregiver (Tamil): "அப்பா இரவில் அலைகிறார்"
        │
        v
┌─ build_english_rag_query() ──────────────────────────────┐
│  1. Check locale: ta-IN ≠ "en" → trigger rewrite         │
│  2. LLM prompt: "Convert this caregiver request into a   │
│     concise English retrieval query for an English        │
│     dementia-care knowledge base"                         │
│  3. Result: "father wandering at night"                   │
│  4. Sanitize: 280 chars max, normalize whitespace         │
└────────────────┬─────────────────────────────────────────┘
                 │
                 v
        RAG hybrid search (English corpus)
                 │
                 v
        Top 3 chunks injected into Jinja2 prompt
                 │
                 v
        LLM responds in Tamil (language_constraint in prompt)
```

Enables non-English access to English-only RAG knowledge without requiring a
multilingual knowledge base — across both the 3 translated locales and the 8
experimental model-response languages.

---

## Learn Mode — Interactive Scenario Practice

```
GET /api/learn/scenarios?disease_stage=middle

Returns 6 built-in scenarios:
┌──────────────────────────────────────────────────┐
│  sundowning              │  refusal-to-bathe      │
│  wandering               │  repetitive-questions   │
│  medication-refusal      │  caregiver-burnout       │
└──────────────────────────────────────────────────┘
        │
        │  Caregiver selects a scenario, types their response
        v
POST /api/learn/interact
        │
        v
┌─ Learn Flow ─────────────────────────────────────────────┐
│  1. Lookup scenario by ID                                 │
│  2. Rewrite query to English for RAG (if non-English)     │
│  3. Fetch RAG context for scenario + caregiver message    │
│  4. Render learn prompt with scenario + RAG context       │
│  5. LLM evaluates caregiver's response                    │
│  6. Post-stream validation + repair (response guard)      │
│  7. Return expert feedback                                │
└───────────────────────────────────────────────────────────┘
```

---

## Caregiver Emotional Check-In

Separate from the Daily Behavioral Log. This is for the caregiver's own emotional state.

```
POST /api/checkin { access_code, message: "I'm exhausted" }
        │
        v
┌─ Check-In Flow ──────────────────────────────────────────┐
│  1. Render empathetic check-in prompt (Jinja2 template)   │
│  2. LLM generates compassionate streaming response        │
│  3. Post-stream validation (response guard)               │
│  4. If caregiver distress detected:                       │
│     → Surface 988 Suicide & Crisis Lifeline               │
│     → Surface Alzheimer's Association 24/7 Helpline       │
│  5. NOT saved to conversation history                      │
│     (emotional support only, not behavioral data)          │
└───────────────────────────────────────────────────────────┘

vs. Daily Behavioral Log (POST /api/checkin/daily):
- For patient's daily state (calm/mild/tough)
- Stored in daily_checkin table (encrypted)
- Feeds into pattern detection
- NOT a streaming LLM response
```

---

## Internationalization (i18n) — 3 Languages

CalmGuide supports exactly three languages: **English, Spanish, Hindi**.

One count, everywhere. The locale directories under `locales/`,
`SUPPORTED_LOCALES` in both clients, and the registry in
`backend/app/services/language_support.py` all list the same three, and a test
pins that they agree. An earlier version tiered eight additional
"experimental" languages in the registry after their translation files had been
removed, which meant `GET /languages` advertised languages whose UI silently
fell back to English. Scope is three.

```
Languages (translated UI): en, es, hi

Locale Files — repo-root /locales/ is the source of truth:
/locales/{lang}/{namespace}.json
  ├── common.json     (nav, actions, errors, tag labels, accessibility)
  ├── home.json       (greeting, patterns, feedback, prediction, check-in)
  ├── coach.json      (Moment Coach sections, input, streaming — was crisis.json)
  ├── checkin.json    (emotional check-in)
  ├── learn.json      (scenarios, interaction)
  ├── profile.json    (setup, edit, disease stages)
  ├── incidents.json  (incident logging + verification)
  ├── journey.json    (journey / stage content)
  ├── facility.json   (B2B staff-facing surface)
  └── impact.json     (public impact page)

frontend/locales/ and mobile/locales/ are generated copies, rsynced from the
root with --delete. Never edit them directly.
```

### Frontend (Next.js + next-intl)
- URL-based routing: `/[locale]/coach`, `/[locale]/home`
- Middleware negotiates locale: URL → X-App-Locale header → Accept-Language → default (en-US)
- Server-side translation loading from `/locales/` via `fs.readFileSync`

### Mobile (React Native + i18next)
- Static imports: 3 locales × 10 namespaces bundled at build time
- Device locale detection via `expo-localization`
- RTL scaffolding via `I18nManager.forceRTL()` is still present but currently
  unreachable: `isRtlLocale()` matches only `ar`, which is no longer a shipped
  locale. It is kept so re-adding Arabic doesn't mean rebuilding it.

### Backend Locale Handling
- `X-App-Locale` header from client → `resolve_locale_code()`
- Drives: response language, model selection (gpt-4o for non-English), RAG query rewriting, response guard validation
- Locale code stored on each `conversations` row for impact metrics

---

## Mobile App Architecture (React Native / Expo)

Full-featured mobile app with feature parity to the web frontend.

```
/mobile/src
├── app/                          # expo-router — the file tree IS the navigation
│   ├── _layout.tsx               # Root: theme, i18n, safe areas
│   ├── index.tsx                 # Entry / gate
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab bar: Home, Learn, Profile
│   │   ├── home.tsx              # Dashboard (card stack)
│   │   ├── learn.tsx             # Scenario list
│   │   └── profile.tsx           # Profile view/edit
│   ├── coach.tsx                 # Moment Coach (full-screen, SSE streaming)
│   ├── check-in.tsx              # Emotional check-in
│   ├── incidents/                # index, new, [id]
│   ├── journey/                  # noticing, diagnosis, hospice, bereavement
│   ├── learn/[id].tsx            # Scenario detail
│   ├── profile/                  # setup, edit
│   ├── facility/                 # B2B: (tabs), login, residents, staff,
│   │                             #   audit, trends, executive, settings
│   ├── impact.tsx                # Impact showcase
│   ├── login.tsx                 # Access code entry
│   └── privacy.tsx / terms.tsx   # Legal
├── components/                   # ~28 shared components, incl. facility/
│   ├── PatternInsights.tsx       # Cycle, trends, cross-patient
│   ├── FeedbackWidget.tsx        # Thumbs + strategy tags
│   ├── IncidentLogger.tsx        # 3am-friendly incident capture
│   ├── EmergencyBar.tsx          # Always-reachable escalation
│   ├── MicButton.tsx             # Voice input (expo-speech-recognition)
│   ├── SpeakButton.tsx           # Read-aloud (neural TTS + local fallback)
│   └── MarkdownText.tsx          # Coach response rendering
├── hooks/                        # Speech (recognition + synthesis), theme,
│   │                             #   color scheme, facility session guard
├── constants/theme.ts            # Design tokens
└── lib/
    ├── api.ts                    # Same endpoints as web frontend
    ├── facility-api.ts           # B2B endpoints + facility-storage/-utils
    ├── i18n.ts                   # i18next setup — 3 locales x 10 namespaces
    ├── network.ts                # NetInfo-based connectivity
    ├── storage.ts                # AsyncStorage (access code, patient name)
    └── parse-response.ts         # Coach response section parser
```

**Connects to same backend** — all API calls go to the same FastAPI server. SSE streaming uses XHR `onprogress` (fetch ReadableStream is unreliable in React Native).

**Unique to mobile:** voice input via `expo-speech-recognition`, device locale
auto-detection, offline-bundled translations. RTL scaffolding exists but is
currently inert — see the i18n section above.

---

## Nightly Job — APScheduler

```
┌─ 3am UTC Daily ──────────────────────────────────────────┐
│                                                           │
│  Phase 1: Per-Profile Insights                            │
│  ┌───────────────────────────────────────────────────┐    │
│  │  For each profile with ≥1 conversation:            │    │
│  │  1. Compute crisis frequency (weekly, trend)       │    │
│  │  2. Detect episode cycle (CV-based, ≥5 episodes)   │    │
│  │  3. Compute risk score (cycle + trend + time)      │    │
│  │  4. Aggregate feedback (effective_strategies)       │    │
│  │  5. Extract top triggers (keyword frequency)        │    │
│  │  6. Upsert to profile_insights (if ≥3 sessions)    │    │
│  │  Per-profile failures logged, don't block others    │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  Phase 2: Cross-Patient Aggregation                       │
│  ┌───────────────────────────────────────────────────┐    │
│  │  1. Group profiles by disease_stage + peak_time    │    │
│  │  2. Count unique profiles per predefined tag        │    │
│  │  3. Write to cross_patient_strategies table          │    │
│  │  4. k-anonymity: only cohorts with ≥5 profiles      │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  Initialized in FastAPI lifespan, app.state.scheduler     │
│  Shutdown cleanly via scheduler.shutdown()                │
└───────────────────────────────────────────────────────────┘
```

---

## Impact Showcase

Public endpoint (no authentication) returning aggregate metrics.

```
GET /api/impact (5-minute in-memory cache)

{
  "families_supported": 13,     ← COUNT(DISTINCT profile_id) from conversations
  "crisis_sessions": 72,        ← COUNT(DISTINCT session_id)
  "languages_served": 3,        ← COUNT(DISTINCT locale_code) where not null
  "overnight_pct": 15,          ← % of sessions with first message before 6am
  "sessions_this_week": 28      ← sessions in last 7 days
}
```

Rendered at `/[locale]/impact` (web) and `/impact` (mobile) — shareable URL for press kits, grant applications, partnership decks.

---

## Docker & Deployment

### Docker Compose (Local Development)

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    healthcheck: pg_isready -U calmguide

  backend:
    build: backend/Dockerfile
    working_dir: /app          # Volume mounts backend/ to /app
    volumes:
      - ./backend:/app
      - ./rag:/app/rag
    env_file: ./backend/.env
    command: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
    depends_on: db (healthy)
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL async connection string |
| `LLM_PROVIDER` | Yes | `openai` or `anthropic` |
| `OPENAI_API_KEY` | If openai | OpenAI API key |
| `ANTHROPIC_API_KEY` | If anthropic | Anthropic API key |
| `CONVERSATION_ENCRYPTION_KEY` | Yes | 32-byte base64-encoded AES-256 key |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins |
| `RAG_VECTOR_STORE` | No | `pgvector` (enables RAG) |
| `RAG_PGVECTOR_DSN` | If RAG | PostgreSQL sync connection for pgvector |
| `OPENMRS_ENABLED` | No | `true` enables linking a Care Profile to an OpenMRS record (default off) |
| `OPENMRS_BASE_URL` | If OpenMRS | OpenMRS web app root, ending in `/openmrs` |
| `OPENMRS_USERNAME` / `OPENMRS_PASSWORD` | If OpenMRS | Dedicated read-only OpenMRS account (never admin) |
| `OPENMRS_TIMEOUT_SECONDS` | No | Whole-fetch budget on the chat path (default 1.5) |
| `OPENMRS_CACHE_TTL_SECONDS` | No | Per-profile summary cache lifetime (default 300) |

### Startup Sequence

1. `alembic upgrade head` — run all pending migrations
2. FastAPI lifespan initializes: DB engine, LLM provider, RAG vector store, APScheduler
3. Uvicorn serves on port 8000

---

## Security Boundaries

| Layer | Measure |
|-------|---------|
| Access codes | 8-char alphanumeric, SHA-256 hashed, brute-force resistant |
| Patient names | Browser-only, never persisted server-side |
| Encryption at rest | AES-256-GCM for all conversations, profile data, feedback, daily check-ins, and insights |
| LLM safety | System prompt has 6 absolute rules (no reality contradiction, no medical advice, no restraint suggestions) |
| Response guard | Post-stream validation: language script, romanization, disrespectful phrases. Auto-repair or locale-specific fallback |
| Caregiver distress | Auto-detected, surfaces 988 and Alzheimer's helpline |
| Elder abuse | Detected with compassionate language, provides Eldercare Locator |
| Prompt injection | System prompt explicitly handles override attempts |
| RAG sources | Domain allowlist in `_SOURCE_NAMES` --- only approved nonprofits/government |
| Cross-patient privacy | k-anonymity (min 5 profiles per cohort). Only predefined tags cross patient boundaries. No PII in aggregation table |
| Feedback loop prevention | Cross-patient strategies randomized in prompt to prevent the LLM from always recommending the same top strategy |
| Session validation | UUID type-checked on session_id parameters |
| API keys | Stored in .env files, gitignored |
