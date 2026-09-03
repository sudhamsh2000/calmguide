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
| Mobile | Android APK, distributed for testing outside the Play Store; EAS Update pushes JS/UI changes to installed builds without a new APK |

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
                           └────────┬─────────┘
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

**Safety:** Every message reaching the LLM first passes a deterministic regex safety gate (`backend/app/services/safety_gate.py`) covering life-threat, self-harm, caregiver-harm-risk, and elder-abuse/neglect signals across all supported languages, with a heuristic fallback classifier behind it to catch paraphrases the gate misses. See [docs/SAFETY_ARCHITECTURE.md](docs/SAFETY_ARCHITECTURE.md) for the full two-layer design, the red-team evaluation harness used to regression-test it, and its explicit non-clinical-validation caveats and known gaps.

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed data flow diagrams.

## Features

| Feature | Description |
|---------|-------------|
| **Moment Coach** | One-button guidance with structured 4-part responses (Right Now / Why / What NOT to Do / When to Escalate) |
| **Patient Profiles** | Personalized LLM responses using disease stage, behavioral patterns, calming strategies |
| **RAG Pipeline** | 41 pages from Alzheimer's Association, Mayo Clinic, and other trusted sources ground every response |
| **Learn Mode** | Interactive scenario practice between tough moments |
| **Daily Check-In** | Caregiver wellness check + behavioral journal for pattern tracking |
| **Behavioral Patterns** | Episode cycle detection, peak time tracking, recurring trigger analysis |
| **Tonight's Outlook** | Risk card when episode patterns suggest elevated likelihood, based on cycle position |
| **Caregiver Feedback** | Post-session feedback (thumbs + strategy tags) that upgrades the pattern engine |
| **Cross-Patient Learning** | Anonymized strategy effectiveness across similar patient profiles, injected into LLM prompts |
| **Impact Showcase** | Public page with real aggregate stats (families helped, sessions, languages) |
| **Encryption** | AES-256-GCM for all conversations, profile data, and feedback at rest |
| **Safety Gate + Red-Team Harness** | Deterministic regex gate + heuristic fallback classifier ahead of every LLM call; regression-tested via an engineering-authored red-team dataset (see [docs/SAFETY_ARCHITECTURE.md](docs/SAFETY_ARCHITECTURE.md)) |
| **Acute-Change Screening** | Structured onset/context screening prompt for new or sudden behavior changes, run before a Moment Coach session starts |
| **Three Languages** | English, Spanish, Hindi --- fully translated UI, AI responses, and safety copy. Scope is deliberately three rather than a long list: the registry in `backend/app/services/language_support.py`, the files under `locales/`, and `SUPPORTED_LOCALES` in both clients all agree, so nothing is advertised that the product cannot actually render. Per-language native-review status is tracked in [locales/REVIEW_STATUS.md](locales/REVIEW_STATUS.md) |
| **Facility Portal (B2B)** | Separate staff-facing surface for care facilities --- staff accounts, resident assignment, incident tracking, care-change events, and admin dashboards/reports, under `/api/facilities/*` |
| **Mobile App** | React Native (Expo) with full feature parity |
| **Offline/Degraded-Mode Awareness** | Mobile and web both detect connectivity loss (NetInfo / `navigator.onLine`) and show a localized offline banner + distinct "you're offline" error copy instead of a generic server error; `/health` also reports a passively-tracked LLM-availability signal (`available`/`degraded`/`unknown`) alongside DB status. Detection only --- no request queueing or background sync yet, see [docs/DEFERRED.md](docs/DEFERRED.md) |
| **Neural Read-Aloud + Voice Input** | AI responses can be read aloud in a natural neural voice (OpenAI `gpt-4o-mini-tts`, gated by `TTS_ENABLED` + `OPENAI_API_KEY`), with an automatic fallback to the browser's/device's own speech synthesis if neural TTS is unavailable. An "auto-speak replies" setting (Profile → Voice) reads every response aloud without tapping the speaker button. Voice *input* (mic dictation) auto-submits once the caregiver finishes speaking, instead of requiring a separate tap. |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript (strict), Tailwind CSS |
| Mobile | React Native (Expo), expo-router, react-i18next |
| Backend | Python 3.11+, FastAPI 0.128+, async SQLAlchemy 2.0, Pydantic v2 |
| Database | PostgreSQL 16 + pgvector (via asyncpg) |
| Encryption | AES-256-GCM (cryptography package), key in env var |
| LLM | OpenAI gpt-4o-mini (default) or Anthropic Claude (switchable via env var) |
| RAG | OpenAI text-embedding-3-large, pgvector hybrid search (semantic + full-text) |
| Scheduling | APScheduler (in-process async, nightly insights + cross-patient aggregation) |
| Testing | Vitest + React Testing Library (frontend), pytest-asyncio (backend, 1500+ tests), Jest + @testing-library/react-native (mobile) |
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
│   │   ├── components/         # Shared UI (ui/, landing/, facility/) with tests
│   │   ├── features/           # Feature-specific components — checkin, coach, home,
│   │   │                       #   incidents, learn, profile, welcome
│   │   ├── lib/                # API client (with fetch-timeout handling), storage, theme
│   │   ├── hooks/              # useNetworkStatus, useSpeechSynthesis, useSpeechRecognition
│   │   ├── context/            # React Context (profile state)
│   │   ├── i18n/               # next-intl routing + navigation wrappers
│   │   ├── types/              # Shared TypeScript types
│   │   └── middleware.ts       # Locale negotiation / redirects
│   ├── locales/                # ⚙ generated — copied from ../locales, gitignored
│   ├── vitest.config.ts        # 32 test files
│   └── tailwind.config.ts      # CalmGuide design tokens
│
├── backend/                    # FastAPI (Python 3.11+)
│   ├── app/
│   │   ├── models/             # SQLAlchemy models (Profile, Conversation, DailyCheckin, …)
│   │   ├── schemas/            # Pydantic v2 request/response schemas
│   │   ├── routers/            # API endpoints (coach, speech, feedback, care_patterns,
│   │   │                       #   impact, incidents, languages, facility_*, …)
│   │   ├── services/           # LLM provider, prompt builder, crypto, insights, pattern
│   │   │                       #   detector, safety_gate, safety_classifier, safety_redteam,
│   │   │                       #   speech (TTS), token_usage, availability, response_timing
│   │   ├── prompts/            # Jinja2 system prompt templates
│   │   ├── config.py           # Pydantic settings — NOTE: @lru_cache'd, restart on .env change
│   │   └── db.py               # Async engine / session factory
│   ├── tests/                  # pytest-asyncio — 1601 tests
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
| GET | `/health` | Health check --- DB connectivity (gates HTTP 503) plus a passively-tracked LLM-availability signal (`available`/`degraded`/`unknown`) and a rolling p50/p95 response-timing block (LLM time-to-first-chunk/total, RAG retrieval); both informational only |
| POST | `/api/profiles` | Create profile, returns 8-char access code |
| GET | `/api/profiles/{code}` | Lookup profile by access code |
| PUT | `/api/profiles/{code}` | Update profile |
| DELETE | `/api/profiles/{code}` | Erase a profile and every record linked to it (conversations, incidents, check-ins, feedback, etc.) |
| POST | `/api/coach/chat` | Moment Coach --- streaming SSE response |
| POST | `/api/coach/acute-change-screen` | Structured screening prompt for new/sudden behavior changes, run before a coach session |
| GET | `/api/conversations/{code}` | List recent conversation sessions |
| GET | `/api/conversations/{code}/{session_id}/messages` | Get messages for a session |
| GET | `/api/learn/scenarios` | List learning scenarios |
| POST | `/api/learn/interact` | Interact with a learning scenario |
| POST | `/api/checkin` | Caregiver emotional check-in (streaming) |
| POST | `/api/checkin/daily` | Daily behavioral log entry |
| GET | `/api/checkin/daily/{code}/today` | Check if today's log exists |
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

## Moment Coach

Moment Coach is the core feature. It provides structured, AI-generated guidance when a caregiver faces a behavioral crisis.

### UX Flow

**Phase 1 --- Input:** The caregiver sees a calm greeting card ("Take a breath. Tell me what's happening...") and a large text input. They describe the situation and tap "Get Guidance".

**Phase 2 --- Chat:** The screen transitions to a chat layout. Past exchanges appear as a scrollable thread. A sticky footer input remains always visible. The backend retrieves relevant RAG context, injects it into the system prompt alongside the patient's profile, and streams the response.

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

- **Colors:** Calming teal palette (#2B7A78), warm off-white backgrounds, soft coral for errors
- **Typography:** Nunito (body, 16px min), Nunito Sans (labels). Moment Coach content: 18px min
- **Touch targets:** 48x48px minimum for all interactive elements
- **Dark mode:** Auto-activates 8pm-6am, follows system preference, manual toggle
- **Accessibility:** WCAG AA contrast ratios, keyboard navigation, visible focus indicators

## Access Codes

Profiles are accessed via 8-character alphanumeric codes (uppercase + digits, excluding ambiguous characters: 0, O, 1, I, L). Codes are stored as SHA-256 hashes --- the plaintext code is only shown once at profile creation.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) --- Detailed data flow diagrams and system design
- [docs/SAFETY_ARCHITECTURE.md](docs/SAFETY_ARCHITECTURE.md) --- Deterministic safety gate + heuristic classifier design, the red-team evaluation harness, and known gaps pending clinical/native-speaker review
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
- **P1 --- clinical/architecture**
  - DICE (Describe-Investigate-Create-Evaluate) workflow mapping for Moment Coach intake
  - Behavioral-memory retrieval refactor + design documentation ([docs/memory-graph-design.md](docs/memory-graph-design.md))
  - Privacy/PHI hardening: cascading profile deletion (`DELETE /api/profiles/{code}`), `.gitignore` hardening against accidental PHI/venv/env commits, demo-seed passwords overridable via env vars instead of hardcoded
  - Validated-vs-experimental language configuration (`GET /api/languages`, per-language native-review-pending status)
- **P2 --- validation / real-world use**
  - Safety red-team evaluation harness with regression-tested sensitivity/specificity/false-positive-rate floors ([docs/SAFETY_ARCHITECTURE.md](docs/SAFETY_ARCHITECTURE.md))
  - **P2-12** --- Offline/degraded-mode support scaffolding: in-process LLM availability tracker feeding a degraded `/health` status (backend/app/services/availability.py); connectivity detection (`useNetworkStatus`) + offline banners on both mobile (NetInfo) and web (`navigator.onLine`); localized offline error copy across every shipped locale that distinguishes "you're offline" from a generic server error; AbortController-based fetch timeouts on the web frontend (parity with mobile's existing `fetchWithTimeout`). Deliberately does not include request queueing, background sync, or offline read caching --- and does not run the safety gate client-side while offline --- see [docs/DEFERRED.md](docs/DEFERRED.md) and the "Known gaps" section of [docs/SAFETY_ARCHITECTURE.md](docs/SAFETY_ARCHITECTURE.md) for why those are deliberate, documented gaps rather than oversights.
  - **P2-13** --- Response-timing instrumentation: in-process rolling p50/p95 latency tracker (`backend/app/services/response_timing.py`), same per-process/informational-only scope as P2-12's availability tracker. Records LLM time-to-first-chunk and total stream duration around both Moment Coach's and check-in's `stream_completion()` calls (successful streams only --- a failed call's duration isn't a meaningful latency sample, and `availability.py` already tracks failure rate separately), plus RAG retrieval duration in `_fetch_rag_context`. Surfaced as a `timing` block on `GET /health` alongside the existing `llm` field; never gates the HTTP status code. No new DB table --- this is a lightweight visibility layer, not a metrics store; back it with a real backend (Prometheus, Datadog, etc.) before relying on it for SLOs across instances.

**In progress / planned:**

- **P2-14** --- Dependency/license manifest + license-mismatch report
- **P3-15** --- Facility handoff data model + FHIR mapping
- **P3-16** --- Correct the caregiver-prevalence statistic cited in product copy
- **P3-17** --- Finish the README/ARCHITECTURE.md documentation pass (this section is part of that)

## License

Proprietary. All rights reserved.
