# CalmGuide

Multilingual AI companion for dementia caregivers.

CalmGuide helps family caregivers (typically 55-70 years old) navigate difficult dementia-related moments by providing structured, personalized guidance through an LLM-powered chat interface. When a caregiver describes a situation, CalmGuide delivers a four-part response:

1. **Right Now (60-Second Actions)** --- Immediate, concrete steps
2. **Why This Is Happening** --- Explanation tied to the patient's disease stage
3. **When to Get More Help** --- Specific escalation criteria
4. **What NOT to Do** --- Counter-intuitive mistakes caregivers commonly make

## Live Deployment

| Layer | Where |
|---|---|
| Web app | [calmguide.vercel.app](https://calmguide.vercel.app) --- Vercel, auto-deploys from `main` |
| Backend API | Railway (Docker) |
| Database | Railway PostgreSQL + pgvector |
| Test EHR | OpenMRS 3.7.1 backend + MariaDB on Railway (same project as the API), reached over Railway's private network. Holds only fictional demo patients (e.g. Frank Kowalski, seeded by `backend/scripts/seed_openmrs_frank.py`). See [OpenMRS test instance](#openmrs-test-instance) |
| Mobile | Android APK, distributed for testing outside the Play Store; EAS Update pushes JS/UI changes to installed builds without a new APK |

> **Deploys are attributed to the commit author.** Vercel refuses a
> deployment when the GitHub account that authored the commit does not hold
> a seat on the Vercel team (`TEAM_ACCESS_REQUIRED`) — the build is skipped
> entirely, and the dashboard shows "Failed to deploy to Production" with no
> build log. This silently broke every push for 12 days after the team moved
> to Pro. If you clone this repo, set your commit identity to a GitHub
> account with a seat:
>
> ```bash
> git config --local user.email "<id>+<username>@users.noreply.github.com"
> ```
>
> Symptom to watch for: the site keeps serving an old build while `main`
> moves on, and nothing in the dashboard distinguishes that from a healthy
> deploy.

The web app is currently gated behind a private invite code (`INVITE_CODE_REQUIRED=true` on the backend) --- it's in private testing, not open signup. This does not affect local development; see [Quick Start](#quick-start).

## Architecture

```
Browser (Next.js)          Backend (FastAPI)          External Services
┌──────────────────┐       ┌──────────────────┐       ┌─────────────┐
│                  │  SSE  │                  │Stream │  OpenAI /   │
│  React App       │◄─────│  Coach Router    │◄──────│  Anthropic  │
│  (TypeScript)    │──────►│                  │──────►│  LLM API    │
│                  │ REST  │                  │       └─────────────┘
└──────────────────┘       │  ┌─────────────┐ │       ┌─────────────┐
                           │  │ RAG Retrieve │ │──────►│  OpenAI     │
                           │  │ (hybrid)     │ │◄──────│  Embeddings │
                           │  └─────────────┘ │       └─────────────┘
                           │  ┌─────────────┐ │ FHIR  ┌─────────────┐
                           │  │ Clinical    │ │──────►│  OpenMRS    │
                           │  │ context     │ │◄──────│  (optional, │
                           │  └─────────────┘ │  R4   │  read-only) │
                           └────────┬─────────┘       └─────────────┘
                                    │
                           ┌────────▼─────────┐
                           │   PostgreSQL 16   │
                           │  + pgvector       │
                           │  ┌──────────────┐ │
                           │  │ profiles     │ │
                           │  │ conversations│ │
                           │  │ rag_chunks   │ │
                           │  └──────────────┘ │
                           └──────────────────┘
```

**Privacy:** Patient names are stored only in the browser (localStorage). The server never persists PII --- it stores clinical profiles (disease stage, behavioral patterns, calming strategies) linked by hashed access codes. All conversations and profile data are encrypted at rest with AES-256-GCM. A caregiver can permanently erase a profile and every record linked to it (conversations, incidents, check-ins, feedback, etc.) via `DELETE /api/profiles/{code}` --- see [Access Codes](#access-codes).

**Health record (optional):** A Care Profile can be linked to the patient's OpenMRS record. On normal-risk messages the coach then also reads a capped, PII-free clinical summary (active conditions, medication names + frequency, allergies, 14-day vitals), fetched in parallel with RAG and the DB reads under a 1.5 s budget. Because OpenMRS is slow, the summary is cached per profile and refreshed in the background (warmed on link, on "Test connection" and at startup), so replies normally use the cached record without waiting. EMERGENCY/HIGH messages never call OpenMRS. Off unless `OPENMRS_ENABLED=true`; without a link the coach is unchanged. See [ARCHITECTURE.md](ARCHITECTURE.md#openmrs-clinical-context).

**Safety:** Every message reaching the LLM first passes a deterministic regex safety gate (`backend/app/services/safety_gate.py`) covering life-threat, self-harm, caregiver-harm-risk, and elder-abuse/neglect signals across all supported languages, with a heuristic fallback classifier behind it to catch paraphrases the gate misses. **Safety Gate v2** turns both layers' output into a single structured decision (`RiskLevel` + `SafetyAction`, `backend/app/services/safety_decision.py`) with fine-grained categories (breathing, consciousness, fall, acute change, medication risk), and runs it immediately after profile/locale resolution --- so an EMERGENCY or HIGH message is answered before any RAG retrieval, DB-context read, or LLM call. A 911-level decision is streamed to the client as a distinct event and shown as a full-screen red emergency alert. See [docs/SAFETY_ARCHITECTURE.md](docs/SAFETY_ARCHITECTURE.md) for the full two-layer design, the red-team evaluation harness used to regression-test it, and its explicit non-clinical-validation caveats and known gaps.

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed data flow diagrams.

## Features

| Feature | Description |
|---------|-------------|
| **Moment Coach** | One-button guidance with structured 4-part responses (Right Now / Why / What NOT to Do / When to Escalate) |
| **Patient Profiles** | Personalized LLM responses using disease stage, behavioral patterns, calming strategies |
| **RAG Pipeline** | 41 pages (231 chunks) from Alzheimer's Association, Mayo Clinic, and other trusted sources ground every response. Live on the Railway database — see [docs/AUDIT.md](docs/AUDIT.md) for the reconnection history |
| **Learn Mode** | Interactive scenario practice between tough moments |
| **Daily Check-In** | Caregiver wellness check + behavioral journal for pattern tracking, with a progress chart backed by the check-in history endpoint |
| **Behavioral Patterns** | Episode cycle detection, peak time tracking, recurring trigger analysis |
| **Tonight's Outlook** | Risk card when episode patterns suggest elevated likelihood, based on cycle position |
| **Caregiver Feedback** | Post-session feedback (thumbs + strategy tags) that upgrades the pattern engine |
| **Cross-Patient Learning** | Anonymized strategy effectiveness across similar patient profiles, injected into LLM prompts |
| **Impact Showcase** | Public page with real aggregate stats (families helped, sessions, languages) |
| **Encryption** | AES-256-GCM for all conversations, profile data, and feedback at rest |
| **Safety Gate v2 + Red-Team Harness** | Deterministic regex gate + heuristic fallback classifier, combined into a structured risk decision with safety-first routing ahead of every LLM call. Regression-tested by the red-team harness (see [docs/SAFETY_ARCHITECTURE.md](docs/SAFETY_ARCHITECTURE.md)) and by a fixed 117-case regression corpus that is read, never regenerated, by the test suite (see [docs/SAFETY_REGRESSION_DATASET.md](docs/SAFETY_REGRESSION_DATASET.md)). The heuristic classifier gates its typo-tolerant character similarity behind a word-level content match, so common caregiver phrasing like "I don't know what to do" is not misclassified as self-harm language purely from shared letters. A 2026-09-25 probe of realistic caregiver messages closed three false negatives ("she took a whole bottle of pills", caregiver-harm disclosures like "I'm afraid I'm going to hit him", Spanish "no está respirando") and one false positive (end-of-life planning), and raised the sensitivity floor to 1.0 |
| **Emergency Alert** | When the gate decides a message warrants 911, the web coach shows a full-screen red alert with the local emergency number as a 60px call target (112 and the ARDSI helpline for Hindi, 911 and the Alzheimer's Association helpline otherwise), and a short two-pulse attention tone (mutable, no siren --- it plays in a home with a person with dementia). It can't be dismissed by tapping outside it. HIGH (acute change) is urgent but not a 911 prompt, so it does not trigger the alert |
| **Session Timeout (web)** | The web app signs a caregiver out after 30 minutes idle or 12 hours after sign-in, so someone who picks up the device later cannot land in the care profile. Device preferences are kept. `SessionExpiryGuard` + `frontend/src/lib/storage.ts` |
| **Acute-Change Screening** | Structured onset/context screening prompt for new or sudden behavior changes, run before a Moment Coach session starts |
| **Three Languages** | English, Spanish, Hindi --- fully translated UI, AI responses, and safety copy. Scope is deliberately three rather than a long list: the registry in `backend/app/services/language_support.py`, the files under `locales/`, and `SUPPORTED_LOCALES` in both clients all agree, so nothing is advertised that the product cannot actually render. Per-language native-review status is tracked in [locales/REVIEW_STATUS.md](locales/REVIEW_STATUS.md) |
| **Facility Portal (B2B)** | Separate staff-facing surface for care facilities --- staff accounts, resident assignment, incident tracking, care-change events, and admin dashboards/reports, under `/api/facilities/*` |
| **Mobile App** | React Native (Expo) with full feature parity |
| **Offline/Degraded-Mode Awareness** | Mobile and web both detect connectivity loss (NetInfo / `navigator.onLine`) and show a localized offline banner + distinct "you're offline" error copy instead of a generic server error; `/health` also reports a passively-tracked LLM-availability signal (`available`/`degraded`/`unknown`) alongside DB status. Detection only --- no request queueing or background sync yet, see [docs/DEFERRED.md](docs/DEFERRED.md) |
| **Health Record Link (OpenMRS)** | A caregiver can link a Care Profile to the patient's OpenMRS record (Care Profile → Connected services → OpenMRS: paste the patient ID, confirm "Link to <name>?"). On normal-risk messages the Moment Coach then sees a short, capped clinical summary — active conditions, current medications (name + frequency, never doses), allergies and whitelisted vitals from the last 14 days — alongside RAG and CalmGuide's own history. Emergency/high-risk messages never call OpenMRS, a slow or down record never blocks a reply, and no patient name or identifier is stored (the patient UUID is encrypted). Off unless `OPENMRS_ENABLED` is set; with it off, or with no linked record, the coach behaves exactly as before. Test data: `backend/scripts/seed_openmrs_frank.py`. |
| **Neural Read-Aloud + Voice Input** | AI responses can be read aloud in a natural neural voice (OpenAI `gpt-4o-mini-tts`, gated by `TTS_ENABLED` + `OPENAI_API_KEY`), with an automatic fallback to the browser's/device's own speech synthesis if neural TTS is unavailable. An "auto-speak replies" setting (Profile → Voice) reads every response aloud without tapping the speaker button. Voice *input* (mic dictation) auto-submits once the caregiver finishes speaking, instead of requiring a separate tap. |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript (strict), Tailwind CSS |
| Mobile | React Native (Expo), expo-router, react-i18next |
| Backend | Python 3.11+, FastAPI 0.128+, async SQLAlchemy 2.0 (pinned `<2.1`, see below), Pydantic v2 |
| Database | PostgreSQL 16 + pgvector (via asyncpg) |
| Encryption | AES-256-GCM (cryptography package), key in env var |
| LLM | OpenAI gpt-4o-mini (default) or Anthropic Claude (switchable via env var) |
| RAG | OpenAI text-embedding-3-large, pgvector hybrid search (semantic + full-text) |
| Scheduling | APScheduler (in-process async, nightly insights + cross-patient aggregation) |
| Testing | Vitest + React Testing Library (frontend), pytest-asyncio (backend, 1837 tests), Jest + @testing-library/react-native (mobile) |
| Infrastructure | Docker Compose, Alembic migrations |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20.9+
- Docker & Docker Compose (for PostgreSQL + pgvector)

### 1. Start the database

```bash
docker compose up -d db
```

### 2. Set up the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys

# Run migrations
alembic upgrade head

# Start the server
# Use 0.0.0.0 for physical-device testing so phones on your LAN can reach it.
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> **SQLAlchemy is pinned to `>=2.0.36,<2.1`.** The unbounded pin resolved to
> 2.1.1 on a container rebuild, and 2.1 rejects passing both `default` and
> `insert_default` to a column. That crash-looped production at
> `alembic upgrade head` with no code change. The models are fixed as well,
> but moving to 2.1 should be a deliberate upgrade with the test suite green on it.

### 3. Set up the frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

**Note on signup:** by default `INVITE_CODE_REQUIRED=true` in the backend, so creating a new profile requires an invite code first. For local development, either set `INVITE_CODE_REQUIRED=false` in `backend/.env`, or generate a code yourself:

```bash
cd backend
python scripts/generate_invite_codes.py --count 1 --label "local-dev"
```

### 4. Set up RAG (optional but recommended)

```bash
cd rag
cp .env.example .env
# Edit .env — set RAG_OPENAI_API_KEY and RAG_PGVECTOR_DSN

# Enable pgvector extension (one-time)
docker compose exec db psql -U calmguide -d calmguide -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Ingest caregiving content from trusted sources
pip install -r requirements.txt
cd ..
python -m rag.pipeline
```

This scrapes content from 6 trusted sources, embeds it, and stores it in PostgreSQL. Every Moment Coach query will then automatically retrieve relevant guidance and inject it into the LLM prompt.

### 5. Set up mobile (optional)

See [mobile/README.md](mobile/README.md) for the full Expo/EAS setup, including the local Android build path and its JDK 17 requirement.

## RAG Pipeline

CalmGuide uses Retrieval-Augmented Generation to ground Moment Coach responses in authoritative caregiving guidance. The pipeline scrapes, chunks, embeds, and stores content from trusted nonprofit and government sources.

### Sources

| Source | Type | Pages |
|--------|------|-------|
| [alz.org](https://www.alz.org) (Alzheimer's Association) | Nonprofit | 29 |
| [mayoclinic.org](https://www.mayoclinic.org) (Mayo Clinic) | Nonprofit | 2 |
| [helpguide.org](https://www.helpguide.org) (HelpGuide) | Nonprofit | 3 |
| [caregiver.org](https://www.caregiver.org) (Family Caregiver Alliance) | Nonprofit | 4 |
| [cdc.gov](https://www.cdc.gov) (CDC) | US Government | 3 |

### How It Works

```
Seed URLs (41 pages)
    |  scraper/crawl.py   --- httpx + BeautifulSoup, boilerplate removal
    |  scraper/chunk.py   --- token-based overlapping chunks (400 tok, 50 overlap)
    |                         title prepended to each chunk for semantic anchoring
    |  embeddings/embed.py --- OpenAI text-embedding-3-large (3072 dims)
    v  vectorstores/       --- pgvector with hybrid search
 rag_chunks table
    ^
    |  retrieve.py         --- hybrid search: cosine similarity + full-text keyword boost
    |                         reranking by title overlap, top-3 injected into prompt
    |
 coach_system.jinja2      --- {% if rag_context %} block
```

### Hybrid Search

Pure vector search produces modest scores (~0.25) for conversational-to-article matching. CalmGuide uses a hybrid approach:

1. **Semantic search** --- cosine similarity via pgvector
2. **Keyword boost** --- PostgreSQL `tsvector` full-text search adds +0.15 for keyword matches
3. **Title reranking** --- Python-level boost for title-word overlap with the query

### Pipeline Commands

```bash
python -m rag.pipeline              # Ingest all seed URLs
python -m rag.pipeline --clear      # Wipe and re-ingest
python -m rag.pipeline --dry-run    # Scrape + chunk without embedding
python -m rag.pipeline --urls URL1 URL2  # Ingest specific URLs
```

## LLM Provider

CalmGuide uses a provider abstraction to support multiple LLMs. Set the `LLM_PROVIDER` env var:

| Provider | Env Value | Default Model |
|----------|-----------|---------------|
| OpenAI | `openai` (default) | `gpt-4o-mini` |
| Anthropic | `anthropic` | `claude-sonnet-4-20250514` |

Both providers support streaming responses via SSE.

## Running Tests

### Backend

```bash
cd backend
source venv/bin/activate
python -m pytest -q
```

### Frontend

```bash
cd frontend
npx vitest run
```

### Mobile

```bash
cd mobile
npx jest
```

## Formatting and Linting

Two formatters split the repo by language. Both are configured once, at the
repo root, so every package shares the same rules.

| Scope | Tool | Config |
|---|---|---|
| TypeScript, JS, JSON, CSS, Markdown | Prettier | `.prettierrc.json` + `.prettierignore` |
| Python (`backend/` and `rag/`) | Ruff | `ruff.toml` |

```bash
# TypeScript / web + mobile
cd frontend && npm run format      # or: npm run format:check
cd mobile   && npm run format

# Python — run from the repo root so both backend/ and rag/ are covered
backend/.venv/bin/python -m ruff format .
backend/.venv/bin/python -m ruff check .
```

Prettier uses `printWidth: 100` and Ruff `line-length = 100` so both languages
wrap at the same column.

Two Ruff rules are switched off deliberately, and the reasons are written into
`ruff.toml` rather than left to be rediscovered:

- **E711/E712** — every occurrence is a SQLAlchemy column comparison
  (`Facility.is_active == True`). Ruff's suggested `is True` / `is None`
  produces a plain Python bool instead of a SQL expression and silently breaks
  the query. Applying that "fix" would be a correctness bug.
- **UP042** — rewriting `class X(str, Enum)` as `StrEnum` changes what
  `str(member)` returns. The classes it flags are all on safety paths, and the
  change buys nothing functional.

Translation JSON under `locales/` is excluded from formatting; it is data, and
both apps hold generated copies of it (see Project Structure).

## Project Structure

```
calmguide/
├── locales/                    # ← SOURCE OF TRUTH for all translations
│   ├── en/  es/  hi/           #   One JSON file per namespace, per language
│   └── REVIEW_STATUS.md        #   Native-speaker review state
│
├── frontend/                   # Next.js 16 App Router
│   ├── src/
│   │   ├── app/[locale]/       # Pages (welcome, profile, home, coach, learn, check-in,
│   │   │                       #   incidents, journey, facility, login, impact)
│   │   ├── components/         # Shared UI (ui/, landing/, facility/, auth/) with tests
│   │   ├── features/           # Feature-specific components — checkin, coach, home,
│   │   │                       #   incidents, learn, profile, welcome
│   │   ├── lib/                # API client (with fetch-timeout handling), storage, theme
│   │   ├── hooks/              # useNetworkStatus, useSpeechSynthesis, useSpeechRecognition
│   │   ├── context/            # React Context (profile state)
│   │   ├── i18n/               # next-intl routing + navigation wrappers
│   │   ├── types/              # Shared TypeScript types
│   │   └── middleware.ts       # Locale negotiation / redirects
│   ├── locales/                # ⚙ generated — copied from ../locales, gitignored
│   ├── vitest.config.ts        # 34 test files, 276 tests
│   └── tailwind.config.ts      # CalmGuide design tokens
│
├── backend/                    # FastAPI (Python 3.11+)
│   ├── app/
│   │   ├── models/             # SQLAlchemy models (Profile, Conversation, DailyCheckin,
│   │   │                       #   ClinicalLink, …)
│   │   ├── schemas/            # Pydantic v2 request/response schemas
│   │   ├── routers/            # API endpoints (coach, speech, feedback, care_patterns,
│   │   │                       #   impact, incidents, languages, clinical_link, facility_*, …)
│   │   ├── services/           # LLM provider, prompt builder, crypto, insights, pattern
│   │   │                       #   detector, safety_gate, safety_classifier, safety_decision,
│   │   │                       #   safety_categories, safety_observability, safety_redteam,
│   │   │                       #   speech (TTS), token_usage, availability, response_timing,
│   │   │                       #   openmrs_client, clinical_context (health-record summary)
│   │   ├── prompts/            # Jinja2 system prompt templates
│   │   ├── config.py           # Pydantic settings — NOTE: @lru_cache'd, restart on .env change
│   │   └── db.py               # Async engine / session factory
│   ├── tests/                  # pytest-asyncio — 1837 tests
│   └── alembic/                # Database migrations
│
├── mobile/                     # React Native (Expo SDK 55)
│   ├── src/
│   │   ├── app/                # Expo Router — the file tree IS the navigation
│   │   │   ├── (tabs)/         #   home, learn, profile
│   │   │   └── facility/       #   B2B: dashboard, residents, staff, audit, trends
│   │   ├── components/         # Shared components (facility/, EmergencyBar, …)
│   │   ├── hooks/              # Speech, network, theme, session guard
│   │   ├── lib/                # API clients, storage, i18n, response parsing
│   │   └── constants/          # Design tokens
│   ├── locales/                # ⚙ generated — rsynced from ../locales (tracked, see mobile/README)
│   └── eas.json                # Build/submit profiles
│
├── rag/                        # RAG pipeline (standalone; own requirements.txt)
│   ├── scraper/                # Web scraper + token-based chunker
│   ├── embeddings/             # OpenAI embeddings wrapper
│   ├── vectorstores/           # pgvector backend (hybrid search)
│   ├── retrieve.py             # get_rag_context() — the only part the backend imports
│   ├── pipeline.py             # CLI: scrape → chunk → embed → store
│   └── config.py               # Pydantic settings (RAG_ env prefix)
│
├── design/                     # Design references, logos, product screens
├── docs/                       # SAFETY_ARCHITECTURE.md, DEFERRED.md, audits, mermaid/ diagrams
├── docker-compose.yml          # PostgreSQL + pgvector
└── ARCHITECTURE.md             # Detailed architecture & data flow diagrams
```

### Two rules this layout depends on

**Translations are authored only in the repo-root `locales/`.** Both apps keep a
local copy that is generated at build time — `frontend/locales/` (gitignored)
and `mobile/locales/` (tracked). Editing either copy directly is silently
undone on the next sync.

**The backend imports `rag.retrieve` and `rag.vectorstores`, and nothing else.**
Those imports are deliberately function-level, and `backend/requirements.txt`
carries only the retrieval dependencies. Scraping dependencies
(`beautifulsoup4`, `html2text`) live in `rag/requirements.txt` and are imported
lazily, so ingestion stays an offline job the API never needs installed.

## API Endpoints

Caregiver-facing endpoints (all under `/api` unless noted):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check --- DB connectivity (gates HTTP 503) plus a passively-tracked LLM-availability signal (`available`/`degraded`/`unknown`), a rolling p50/p95 response-timing block (LLM time-to-first-chunk/total, RAG retrieval), and a `safety` block of Safety Gate v2 counters (risk level, category, action, RAG requested vs. skipped, provider failover). All three are informational only. RAG availability does not yet affect overall status |
| POST | `/api/profiles` | Create profile, returns 8-char access code |
| GET | `/api/profiles/{code}` | Lookup profile by access code |
| PUT | `/api/profiles/{code}` | Update profile |
| DELETE | `/api/profiles/{code}` | Erase a profile and every record linked to it (conversations, incidents, check-ins, feedback, health-record link, etc.) |
| GET | `/api/profiles/{code}/clinical-link` | Health-record link status (never the full patient ID). 404 `FEATURE_DISABLED` when `OPENMRS_ENABLED` is off |
| POST | `/api/profiles/{code}/clinical-link/preview` | Look up an OpenMRS patient ID and return the given name once, for the "Link to <name>?" confirmation. Stores nothing |
| PUT | `/api/profiles/{code}/clinical-link` | Link the profile to an OpenMRS patient (UUID stored encrypted) |
| POST | `/api/profiles/{code}/clinical-link/test` | Fetch the clinical summary live and return section counts only |
| DELETE | `/api/profiles/{code}/clinical-link` | Unlink the health record |
| POST | `/api/coach/chat` | Moment Coach --- streaming SSE response |
| POST | `/api/coach/acute-change-screen` | Structured screening prompt for new/sudden behavior changes, run before a coach session |
| GET | `/api/conversations/{code}` | List recent conversation sessions |
| GET | `/api/conversations/{code}/{session_id}/messages` | Get messages for a session |
| GET | `/api/learn/scenarios` | List learning scenarios |
| POST | `/api/learn/interact` | Interact with a learning scenario |
| POST | `/api/checkin` | Caregiver emotional check-in (streaming) |
| POST | `/api/checkin/daily` | Daily behavioral log entry |
| GET | `/api/checkin/daily/{code}/today` | Check if today's log exists |
| GET | `/api/checkin/daily/{code}/history` | Bounded read-only history of daily logs (feeds the progress chart) |
| POST | `/api/feedback` | Submit Moment Coach response feedback (thumbs + tags) |
| POST | `/api/feedback/skip` | Record dismissed feedback card |
| GET | `/api/feedback/pending/{code}` | Get most recent unfeedback'd session |
| GET | `/api/feedback/{code}/{session_id}` | Get all feedback for a session |
| GET | `/api/insights/{code}` | Behavioral pattern insights for a profile |
| GET | `/api/care-patterns/{code}` | Tonight's risk / episode-cycle prediction |
| GET | `/api/strategies/{code}` | Cross-patient strategy recommendations |
| GET | `/api/languages` | Supported languages, each tagged with validation tier + native-review status |
| GET | `/api/impact` | Public aggregate impact metrics (no auth) |

CalmGuide also ships a separate facility (B2B) staff-portal API under `/api/facilities/*` --- covering facility/staff registration, PIN/JWT auth, resident assignment, incidents, and admin dashboards/reports. See the `facility*` routers in `backend/app/routers/` for the current, authoritative list; it isn't fully enumerated here to avoid this table drifting out of sync with that surface.

## OpenMRS Test Instance

A test OpenMRS runs on Railway for the health-record demo. It holds only fictional patients: the 50 standard OpenMRS demo patients, plus Frank Kowalski (`FRNKKOWL`), whose record is designed around the Moment Coach demo beats.

| | |
|---|---|
| Services | `openmrs` (image `openmrs/openmrs-reference-application-3-backend:3.7.1`, FHIR R4 + legacy admin UI) and `openmrs-db` (MariaDB 10.11, `utf8mb4`), both with volumes |
| Public URL | `https://openmrs-production-5ae8.up.railway.app/openmrs` (admin UI and FHIR, login required) |
| From the API | `OPENMRS_BASE_URL=http://openmrs.railway.internal:8080/openmrs` (private network) |
| CalmGuide login | OpenMRS user `calmguide` with only the read-only `CalmGuide Integration` role. Its password lives only in Railway's `OPENMRS_PASSWORD` |
| Demo patient | Frank Kowalski, OpenMRS patient ID `fba2fc07-8bbd-447b-8aaa-c4b8dfcfec63` |

**Linking Frank (web):** open Frank's Care Profile → Connected services → OpenMRS → **Connect** → paste the patient ID → confirm **Link to Frank?** → **Link**. **Test connection** shows what was found; **Disconnect** removes the link.

**Seeding or refreshing Frank** (run on demo morning; vitals are dated relative to the run day, so the fever lands the day before the demo). It needs an OpenMRS account with write access, prompts for the password, and is safe to re-run:

```bash
cd backend
python scripts/seed_openmrs_frank.py --base-url https://openmrs-production-5ae8.up.railway.app/openmrs --username admin
```

**Railway gotchas this instance needed** (all already applied):

- `RAILWAY_RUN_UID=0` on `openmrs`: the image runs as a non-root user and can't otherwise write to its volume.
- The `openmrs` start command keeps the Lucene search index on local disk (`/openmrs/data/lucene` → `/tmp/lucene`). On the Railway volume, Lucene's per-commit `fsync` hung and stalled first-boot concept import indefinitely. The index is rebuilt automatically after a redeploy.
- The JDBC URL in `/openmrs/data/openmrs-runtime.properties` carries `tcpKeepAlive`, `connectTimeout` and `socketTimeout`, so a silently dropped private-network connection errors out instead of hanging forever. `OMRS_CONFIG_*` variables don't override that file once OpenMRS is installed.
- Demo-patient generation is switched off (`referencedemodata.createDemoPatientsOnNextStartup=0`), so restarts don't add patients.
- First boot takes ~30–45 minutes (concept import). Railway's CPU graph can read 0 while it's working. Don't restart mid-import: the current package restarts from zero.

## Moment Coach

Moment Coach is the core feature. It provides structured, AI-generated guidance when a caregiver faces a behavioral crisis.

### UX Flow

**Phase 1 --- Input:** The caregiver sees a calm greeting card ("Take a breath. Tell me what's happening...") and a large text input. They describe the situation and tap "Get Guidance".

**Phase 2 --- Chat:** The screen transitions to a chat layout. Past exchanges appear as a scrollable thread. A sticky footer input remains always visible. The backend runs the safety gate first. If the message is an emergency, it returns the static safety response (and, for 911-level decisions, the emergency alert) without calling the LLM. Otherwise it retrieves relevant RAG context, injects it into the system prompt alongside the patient's profile, and streams the response.

The coach prompt tells the model to **answer the caregiver's question first**. For example, a repeated question is answered plainly, as if asked for the first time, before any redirect. It also names common unmet needs (toilet, thirst, hunger, pain, temperature, fatigue) as likely causes, and prefers low-stimulation redirects (no television in the evening). This came from a side-by-side comparison and was checked with live generations, not just by reading the prompt.

### Response Card Hierarchy

Each AI response is parsed into four structured sections rendered with strict visual hierarchy --- no emoji, weight comes from color and typography:

| Section | Visual Treatment |
|---|---|
| **Right Now** | Primary color background + elevated shadow |
| **Why This Is Happening** | Neutral surface card |
| **What NOT to Do** | Red left-border accent, red title |
| **When to Escalate** | Neutral surface card, muted title |

If the response cannot be parsed into sections, it falls back to full markdown rendering.

## Design System

CalmGuide is designed for stressed, elderly caregivers using the app at 3am:

- **Colors:** Near-black ink primary (`#10141c`), sky (`#3e8fd0`) and coral (`#e8663d`) accents on a pale sky background, shared by web (`globals.css`) and mobile (`ThemeContext`). Semantic colours (911/emergency, success/warning/error, the four Moment Coach section tints) are kept separate so they stand out
- **Material:** A "luminous glass" `.glass-panel` (backdrop blur, 32px radius) used on only two large surfaces, the profile panel and Your Progress. It falls back to a solid panel without `backdrop-filter` or under `prefers-reduced-transparency`
- **Navigation:** The web app has no global nav bar at any width. Sections are reached through in-page links. A nav that leaked onto the pre-auth invite gate was withdrawn. The EmergencyBar is the one element on every screen
- **Typography:** Nunito (body, 16px min), Nunito Sans (labels). Moment Coach content: 18px min
- **Touch targets:** 48x48px minimum for all interactive elements
- **Dark mode:** Auto-activates 8pm-6am, follows system preference, manual toggle
- **Accessibility:** WCAG AA contrast ratios, keyboard navigation, visible focus indicators

## Access Codes

Profiles are accessed via 8-character alphanumeric codes (uppercase + digits, excluding ambiguous characters: 0, O, 1, I, L). Codes are stored as SHA-256 hashes --- the plaintext code is only shown once at profile creation. On web, the signed-in session expires after 30 minutes idle or 12 hours total (see Session Timeout under [Features](#features)).

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) --- Detailed data flow diagrams and system design
- [docs/SAFETY_ARCHITECTURE.md](docs/SAFETY_ARCHITECTURE.md) --- Deterministic safety gate + heuristic classifier design, the red-team evaluation harness, and known gaps pending clinical/native-speaker review (including §3.0, open clinical questions from the 2026-09-25 probe)
- [docs/SAFETY_GATE_V2_PLAN.md](docs/SAFETY_GATE_V2_PLAN.md) --- Safety Gate v2 design: structured decisions, fine categories, safety-first routing
- [docs/SAFETY_REGRESSION_DATASET.md](docs/SAFETY_REGRESSION_DATASET.md) --- The fixed 117-case engineering regression corpus and why it must never be auto-regenerated
- [docs/CALMGUIDE_E2E_AUDIT_2026_09.md](docs/CALMGUIDE_E2E_AUDIT_2026_09.md) --- Independent end-to-end audit of the Safety Gate v2 sprint
- [docs/WEEKLY_REPORT_2026-09-24.md](docs/WEEKLY_REPORT_2026-09-24.md) --- Latest weekly report (PDF alongside)
- [docs/memory-graph-design.md](docs/memory-graph-design.md) --- Behavioral memory graph, cascading profile deletion, and retention configuration
- [docs/DEFERRED.md](docs/DEFERRED.md) --- Deferred features and future roadmap (push notifications, key rotation, care team sharing, etc.)
- [docs/AUDIT.md](docs/AUDIT.md) --- Running audit log: test/type/lint/build results, dependency CVEs, open findings and incidents, each stamped with the date and commit it was measured against
- [docs/mobile-launch-checklist.md](docs/mobile-launch-checklist.md) --- Store submission checklist for Play and the App Store
- [docs/MILESTONE_3_REPORT.md](docs/MILESTONE_3_REPORT.md) --- Milestone 3 report: infrastructure migration, voice/UX fixes, testing status, known limitations

`docs/superpowers/` (design specs and implementation plans) is local scratch and
is gitignored, so it is not present in a fresh clone.

## Clinical Safety Hardening Roadmap

CalmGuide is going through an ongoing hardening pass driven by an external faculty clinical review, tracked in priority tiers: **P0** (safety-critical), **P1** (clinical/architecture), **P2** (validation / real-world use), **P3** (product/interoperability). This is an engineering roadmap, not a clinical-validation claim --- see the caveats in [docs/SAFETY_ARCHITECTURE.md](docs/SAFETY_ARCHITECTURE.md) for what has and hasn't actually been reviewed by a clinician.

**Done:**

- **P0 --- safety-critical**
  - Deterministic safety gate (life-threat, self-harm, caregiver-harm-risk, elder-abuse/neglect) + heuristic fallback classifier ahead of every LLM call
  - `SafetyEvent` audit logging wired into Moment Coach and check-in flows
  - Acute-change / delirium screening endpoint (`POST /api/coach/acute-change-screen`), run before a Moment Coach session for a new or sudden behavior change
  - EmergencyBar 911/988 fix on web
  - **Safety Gate v2** --- structured `SafetyDecision` (risk level + action), fine-grained categories, and safety-first routing so emergencies skip RAG and the LLM entirely; fixed a window-dilution bug in the classifier's fuzzy matcher
  - Full-screen emergency alert with an attention tone on 911-level escalation (web)
  - Real-world probe fixes (2026-09-25): overdose, caregiver-harm and Spanish breathing false negatives closed; end-of-life-planning false positive removed; sensitivity floor raised from 0.9 to 1.0
- **P1 --- clinical/architecture**
  - DICE (Describe-Investigate-Create-Evaluate) workflow mapping for Moment Coach intake
  - Behavioral-memory retrieval refactor + design documentation ([docs/memory-graph-design.md](docs/memory-graph-design.md))
  - Privacy/PHI hardening: cascading profile deletion (`DELETE /api/profiles/{code}`), `.gitignore` hardening against accidental PHI/venv/env commits, demo-seed passwords overridable via env vars instead of hardcoded
  - Validated-vs-experimental language configuration (`GET /api/languages`, per-language native-review-pending status)
  - Web session timeout (30 min idle / 12 h absolute) so a shared or unattended device does not stay signed in to a care profile
- **P2 --- validation / real-world use**
  - Safety red-team evaluation harness with regression-tested sensitivity/specificity/false-positive-rate floors ([docs/SAFETY_ARCHITECTURE.md](docs/SAFETY_ARCHITECTURE.md))
  - **P2-12** --- Offline/degraded-mode support scaffolding: in-process LLM availability tracker feeding a degraded `/health` status (backend/app/services/availability.py); connectivity detection (`useNetworkStatus`) + offline banners on both mobile (NetInfo) and web (`navigator.onLine`); localized offline error copy across every shipped locale that distinguishes "you're offline" from a generic server error; AbortController-based fetch timeouts on the web frontend (parity with mobile's existing `fetchWithTimeout`). Deliberately does not include request queueing, background sync, or offline read caching --- and does not run the safety gate client-side while offline --- see [docs/DEFERRED.md](docs/DEFERRED.md) and the "Known gaps" section of [docs/SAFETY_ARCHITECTURE.md](docs/SAFETY_ARCHITECTURE.md) for why those are deliberate, documented gaps rather than oversights.
  - **P2-13** --- Response-timing instrumentation: in-process rolling p50/p95 latency tracker (`backend/app/services/response_timing.py`), same per-process/informational-only scope as P2-12's availability tracker. Records LLM time-to-first-chunk and total stream duration around both Moment Coach's and check-in's `stream_completion()` calls (successful streams only --- a failed call's duration isn't a meaningful latency sample, and `availability.py` already tracks failure rate separately), plus RAG retrieval duration in `_fetch_rag_context`. Surfaced as a `timing` block on `GET /health` alongside the existing `llm` field; never gates the HTTP status code. No new DB table --- this is a lightweight visibility layer, not a metrics store; back it with a real backend (Prometheus, Datadog, etc.) before relying on it for SLOs across instances.
  - Safety Gate v2 regression corpus (117 cases, 8 flagged for clinical review) and `/health` safety observability counters

**In progress / planned:**

- Clinician verification of the open questions in [docs/SAFETY_ARCHITECTURE.md](docs/SAFETY_ARCHITECTURE.md) §3.0 (resolved choking, exertional breathlessness) and of `MEDICATION_RISK` routing, which currently still generates a response (`TODO(LOF-APPROVAL)`)
- Known follow-ups from the regression corpus: an ambiguous-breathing false-positive candidate and French self-harm coverage ("je veux mourir")
- Fold RAG availability into `/health` overall status (flagged HIGH in the September E2E audit)

- **P2-14** --- Dependency/license manifest + license-mismatch report
- **P3-15** --- Facility handoff data model + FHIR mapping
- **P3-16** --- Correct the caregiver-prevalence statistic cited in product copy
- **P3-17** --- Finish the README/ARCHITECTURE.md documentation pass (this section is part of that)

## License

Proprietary. All rights reserved.
