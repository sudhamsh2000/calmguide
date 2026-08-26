# CalmGuide

Multilingual AI companion for dementia caregivers.

CalmGuide helps family caregivers (typically 55-70 years old) navigate difficult dementia-related moments by providing structured, personalized guidance through an LLM-powered chat interface. When a caregiver describes a situation, CalmGuide delivers a four-part response:

1. **Right Now (60-Second Actions)** --- Immediate, concrete steps
2. **Why This Is Happening** --- Explanation tied to the patient's disease stage
3. **When to Get More Help** --- Specific escalation criteria
4. **What NOT to Do** --- Counter-intuitive mistakes caregivers commonly make

## Architecture

```
Browser (Next.js)          Backend (FastAPI)          External Services
┌──────────────────┐       ┌──────────────────┐       ┌─────────────┐
│                  │  SSE  │                  │Stream │  OpenAI /   │
│  React App       │◄─────│  Crisis Router   │◄──────│  Anthropic  │
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

**Privacy:** Patient names are stored only in the browser (localStorage). The server never persists PII --- it stores clinical profiles (disease stage, behavioral patterns, calming strategies) linked by hashed access codes. All conversations and profile data are encrypted at rest with AES-256-GCM.

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
| **11 Languages** | English, Spanish, French, German, Arabic, Hindi, Tamil, Japanese, Korean, Portuguese (BR), Chinese |
| **Mobile App** | React Native (Expo) with full feature parity |

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
| Testing | Vitest + React Testing Library (frontend), pytest-asyncio (backend, 126+ tests) |
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

This scrapes content from 6 trusted sources, embeds it, and stores it in PostgreSQL. Every crisis query will then automatically retrieve relevant guidance and inject it into the LLM prompt.

## RAG Pipeline

CalmGuide uses Retrieval-Augmented Generation to ground crisis responses in authoritative caregiving guidance. The pipeline scrapes, chunks, embeds, and stores content from trusted nonprofit and government sources.

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
 crisis_system.jinja2     --- {% if rag_context %} block
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

## Project Structure

```
calmguide/
├── frontend/                   # Next.js 16 App Router
│   ├── src/
│   │   ├── app/                # Pages (welcome, profile, home, crisis, learn)
│   │   ├── components/ui/      # Shared UI (Button, Input, Card) with tests
│   │   ├── features/           # Feature-specific components
│   │   │   ├── crisis/         # Crisis Mode (input, footer, renderer, parser, streaming)
│   │   │   ├── home/           # Home screen, patient card, conversation history
│   │   │   ├── learn/          # Learning scenarios
│   │   │   └── profile/        # Profile wizard, profile view
│   │   ├── lib/                # API client, storage helpers, theme
│   │   └── context/            # React Context (profile state)
│   ├── vitest.config.ts
│   └── tailwind.config.ts      # CalmGuide design tokens
│
├── backend/                    # FastAPI (Python)
│   ├── app/
│   │   ├── models/             # SQLAlchemy models (Profile, Conversation, DailyCheckin, etc.)
│   │   ├── schemas/            # Pydantic v2 request/response schemas
│   │   ├── routers/            # API endpoints (crisis, feedback, prediction, impact, etc.)
│   │   ├── services/           # LLM provider, prompt builder, crypto, insights, pattern detector
│   │   └── prompts/            # Jinja2 system prompt templates
│   ├── tests/                  # pytest-asyncio tests (126+)
│   └── alembic/                # Database migrations (4 revisions)
│
├── mobile/                     # React Native (Expo)
│   ├── src/
│   │   ├── app/                # Expo Router screens (tabs, crisis, check-in, impact)
│   │   ├── components/         # Shared components (PatternInsights, FeedbackWidget, etc.)
│   │   └── lib/                # API client, i18n, storage, theme
│   └── locales/                # i18n translations (11 languages)
│
├── rag/                        # RAG pipeline
│   ├── scraper/                # Web scraper + token-based chunker
│   ├── embeddings/             # OpenAI embeddings wrapper
│   ├── vectorstores/           # pgvector backend (hybrid search)
│   ├── retrieve.py             # get_rag_context() for FastAPI
│   ├── pipeline.py             # CLI: scrape -> chunk -> embed -> store
│   └── config.py               # Pydantic settings (RAG_ env prefix)
│
├── docker-compose.yml          # PostgreSQL + pgvector
└── ARCHITECTURE.md             # Detailed architecture & data flow diagrams
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check with DB connectivity |
| POST | `/api/profiles` | Create profile, returns 8-char access code |
| GET | `/api/profiles/{code}` | Lookup profile by access code |
| PUT | `/api/profiles/{code}` | Update profile |
| POST | `/api/crisis/chat` | Crisis Mode --- streaming SSE response |
| GET | `/api/conversations/{code}` | List recent conversation sessions |
| GET | `/api/conversations/{code}/{session_id}/messages` | Get messages for a session |
| GET | `/api/learn/scenarios` | List learning scenarios |
| POST | `/api/learn/interact` | Interact with a learning scenario |
| POST | `/api/checkin` | Caregiver emotional check-in (streaming) |
| POST | `/api/checkin/daily` | Daily behavioral log entry |
| GET | `/api/checkin/daily/{code}/today` | Check if today's log exists |
| POST | `/api/feedback` | Submit crisis response feedback (thumbs + tags) |
| POST | `/api/feedback/skip` | Record dismissed feedback card |
| GET | `/api/feedback/pending/{code}` | Get most recent unfeedback'd session |
| GET | `/api/feedback/{code}/{session_id}` | Get all feedback for a session |
| GET | `/api/insights/{code}` | Behavioral pattern insights for a profile |
| GET | `/api/prediction/{code}` | Tonight's risk prediction |
| GET | `/api/strategies/{code}` | Cross-patient strategy recommendations |
| GET | `/api/impact` | Public aggregate impact metrics (no auth) |

## Crisis Mode

Crisis Mode is the core feature. It provides structured, AI-generated guidance when a caregiver faces a behavioral crisis.

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
- **Typography:** Nunito (body, 16px min), Nunito Sans (labels). Crisis content: 18px min
- **Touch targets:** 48x48px minimum for all interactive elements
- **Dark mode:** Auto-activates 8pm-6am, follows system preference, manual toggle
- **Accessibility:** WCAG AA contrast ratios, keyboard navigation, visible focus indicators

## Access Codes

Profiles are accessed via 8-character alphanumeric codes (uppercase + digits, excluding ambiguous characters: 0, O, 1, I, L). Codes are stored as SHA-256 hashes --- the plaintext code is only shown once at profile creation.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) --- Detailed data flow diagrams and system design
- [docs/DEFERRED.md](docs/DEFERRED.md) --- Deferred features and future roadmap (push notifications, key rotation, care team sharing, etc.)
- [docs/superpowers/specs/](docs/superpowers/specs/) --- Design specs for each phase
- [docs/superpowers/plans/](docs/superpowers/plans/) --- Implementation plans

## License

Proprietary. All rights reserved.
