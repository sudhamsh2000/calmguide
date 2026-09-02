# CalmGuide RAG — Caregiving Knowledge Base

Retrieval-Augmented Generation pipeline that scrapes publicly available
caregiver content from trusted caregiving and public-health sources, chunks and embeds it,
and injects relevant context into Crisis Mode prompts at query time.

> **Attribution:** Content is sourced from the original publishers listed in `scraper/crawl.py`.
> Use only for non-commercial, research, or caregiving-assistance purposes.
> Review each source's robots.txt and terms before scraping. The scraper enforces an allowlist of approved domains.

---

## How It Works

```
trusted caregiving pages
    ↓  scraper/crawl.py   — httpx + BeautifulSoup → clean markdown
    ↓  scraper/chunk.py   — token-based overlapping chunks (400 tok, 50 overlap)
    ↓  embeddings/embed.py — OpenAI text-embedding-3-small
    ↓  vectorstores/      — pgvector | Qdrant | ChromaDB
                                          ↑
                              retrieve.py (called by FastAPI crisis router)
                                          ↓
                              Injected into crisis_system.jinja2 prompt
```

---

## Getting Started

### 1. Install dependencies

```bash
cd rag
pip install -r requirements.txt

# Install only what you need for your chosen vector store:
pip install asyncpg pgvector   # pgvector
pip install qdrant-client       # Qdrant
pip install chromadb            # ChromaDB
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env — set RAG_VECTOR_STORE, RAG_OPENAI_API_KEY, and the DSN/URL for your store
```

### 3. Run the ingestion pipeline

```bash
# From the repo root
python -m rag.pipeline

# Options
python -m rag.pipeline --clear          # wipe existing data first
python -m rag.pipeline --dry-run        # scrape + chunk, no embedding or storage
python -m rag.pipeline --urls https://www.alz.org/help-support/caregiving/safety
```

---

## Vector Store Setup

### pgvector (recommended — no extra infrastructure)

Uses your existing PostgreSQL instance.

```bash
# In psql
CREATE EXTENSION IF NOT EXISTS vector;
```

Set `RAG_PGVECTOR_DSN` to your PostgreSQL connection string.
The pipeline creates the `rag_chunks` table automatically.

### Qdrant

```bash
# Local — Docker
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant

# Or use Qdrant Cloud — set RAG_QDRANT_URL and RAG_QDRANT_API_KEY
```

### ChromaDB

No server needed. Data is stored locally at `RAG_CHROMA_PATH` (default: `./chroma_db`).

---

## Integrating with the Crisis Router

### 1. Add `rag_context` to the Jinja2 prompt

In `backend/app/prompts/crisis_system.jinja2`:

```jinja2
{% if rag_context %}
## Relevant Caregiving Guidance

{{ rag_context }}

---
{% endif %}
```

### 2. Call `get_rag_context` in the crisis router

In `backend/app/routers/crisis.py`:

```python
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # repo root

from rag.retrieve import get_rag_context

# Inside the crisis chat handler, before rendering the prompt:
rag_context = await get_rag_context(request.message, k=3, min_score=0.20)

prompt = template.render(
    profile=profile,
    message=request.message,
    rag_context=rag_context,  # empty string = no injection
)
```

---

## Configuration Reference

All env vars are prefixed with `RAG_`.

| Variable | Default | Description |
|---|---|---|
| `RAG_VECTOR_STORE` | `pgvector` | Backend: `pgvector`, `qdrant`, `chroma` |
| `RAG_OPENAI_API_KEY` | — | OpenAI API key for embeddings |
| `RAG_EMBEDDING_MODEL` | `text-embedding-3-large` | Embedding model |
| `RAG_EMBEDDING_DIM` | `3072` | Embedding dimensions (validated against the selected model, passed through to the embeddings API) |
| `RAG_PGVECTOR_DSN` | `postgresql://...` | PostgreSQL connection string |
| `RAG_QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `RAG_QDRANT_API_KEY` | — | Qdrant API key (Cloud only) |
| `RAG_QDRANT_COLLECTION` | `calmguide_rag` | Qdrant collection name |
| `RAG_CHROMA_PATH` | `./chroma_db` | ChromaDB persistence directory |
| `RAG_CHROMA_COLLECTION` | `calmguide_rag` | ChromaDB collection name |
| `RAG_SCRAPE_DELAY` | `1.5` | Seconds between HTTP requests |
| `RAG_MAX_CHUNK_TOKENS` | `400` | Max tokens per chunk |
| `RAG_CHUNK_OVERLAP_TOKENS` | `50` | Overlap between consecutive chunks |

---

## Folder Structure

```
rag/
├── README.md
├── requirements.txt
├── .env.example
├── config.py               — Pydantic settings (all RAG_ env vars)
├── pipeline.py             — CLI: scrape → chunk → embed → store
├── retrieve.py             — get_rag_context() used by FastAPI router
├── scraper/
│   ├── crawl.py            — httpx scraper for approved source domains
│   └── chunk.py            — token-based overlapping chunker
├── embeddings/
│   └── embed.py            — OpenAI embeddings wrapper
└── vectorstores/
    ├── base.py             — VectorStore ABC + SearchResult dataclass
    ├── pgvector.py         — PostgreSQL + pgvector backend
    ├── qdrant.py           — Qdrant backend
    └── chroma.py           — ChromaDB backend
```

---

## Seed URLs

The pipeline scrapes approved content from these domains by default:

- `alz.org`
- `nia.nih.gov`
- `mayoclinic.org`
- `helpguide.org`
- `caregiver.org`
- `cdc.gov`

Every new domain should be added to the source allowlist in `scraper/crawl.py` only after reviewing its robots.txt and usage terms.
Add or remove URLs in `scraper/crawl.py → SEED_URLS`.

---

## Estimated Cost

Using `text-embedding-3-large` (41 seed pages × ~10 chunks ≈ 410 chunks × ~400 tokens):

| Item | Est. tokens | Cost |
|---|---|---|
| Full initial ingest | ~164,000 | ~$0.02 |
| Per crisis query | ~200 | < $0.0001 |

Effectively free at this scale.
