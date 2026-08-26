# CalmGuide Knowledge Graph Design

**Version:** 2026-07-26
**Status:** Living document — formalizes the RAG corpus as a knowledge graph; update whenever `rag/scraper/crawl.py`'s source list or the retrieval scoring logic changes
**Audience:** Team, LOF Gate 1 reviewers
**Depends on:** [`docs/domain-catalog.md`](./domain-catalog.md) §4 (`RAGChunk`); [`docs/memory-graph-design.md`](./memory-graph-design.md) §6 (where this fits in prompt assembly, relative to per-patient/cross-patient memory)

**Framing note, same caveat as the Memory Graph doc:** this is not a literal graph database — it's a flat table of embedded text chunks (`rag_chunks`) searched by hybrid vector+keyword similarity. There is no explicit entity-relationship graph connecting concepts (e.g. no `wandering --related_to--> nighttime confusion` edge). What *is* graph-shaped here is the **provenance structure**: every chunk traces back through a page to a source domain to a trust tier, and that provenance is what gets surfaced to the caregiver and to the LLM alongside the content. This doc treats that provenance chain as the graph.

---

## 1. Why This Exists

CalmGuide's crisis guidance is grounded in evidence-based caregiving content, not purely the LLM's parametric knowledge — per the LOF proposal, this is what lets responses cite "Alzheimer's Association, Mayo Clinic, CDC" rather than reading as generic AI advice. The Knowledge Graph is the retrieval layer that makes that grounding possible: a small, curated, provenance-tagged corpus (not an open web search) that gets hybrid-searched per query and injected into the crisis prompt.

This is deliberately a **closed, allowlisted corpus**, not a general RAG-over-the-internet system — the allowlist is a safety and legal control, not just a data-quality one (see §5).

---

## 2. Node Types (Provenance Chain)

### 2.1 SourceDomain — the trust tier

The root of the provenance graph. `rag/scraper/crawl.py::_SOURCE_NAMES` hardcodes a fixed allowlist — any URL whose domain isn't in this map raises a `ValueError` at scrape time (`get_source_metadata`), so this is an enforced gate, not just documentation.

| Domain | Source name | Category | Status |
|---|---|---|---|
| `www.alz.org` | Alzheimer's Association | Nonprofit | Active — 29 of 41 seed URLs |
| `www.mayoclinic.org` | Mayo Clinic | Nonprofit | Active — 2 URLs |
| `www.helpguide.org` | HelpGuide | Nonprofit | Active — 3 URLs |
| `www.caregiver.org` | Family Caregiver Alliance | Nonprofit | Active — 4 URLs |
| `www.cdc.gov` | Centers for Disease Control and Prevention | US government, public domain | Active — 3 URLs |
| `www.nia.nih.gov` | National Institute on Aging | US government, public domain | **Blocked** — returns HTTP 405, zero URLs currently scraped (per code comment: "re-check periodically") |

**This confirms the LOF proposal's "41 pages from 5 trusted sources" claim exactly** — 41 total `SEED_URLS`, and 5 of the 6 allowlisted domains are actually contributing content (NIA is allowlisted in code but dormant). Worth stating explicitly in any Gate 1 materials: NIA is aspirational/future, not currently part of the live corpus.

### 2.2 SourceDocument — one scraped page

A single URL's cleaned content, produced by `scraper/crawl.py::scrape_pages`. Not persisted as its own row — it's an in-memory intermediate (`ScrapedPage` dataclass) that exists only during a pipeline run, between scrape and chunk.

| Field | Notes |
|---|---|
| `url`, `title` | `title` extracted from the page's `<h1>`, falls back to the URL's last path segment |
| `source_name`, `source_domain` | resolved via the `SourceDomain` allowlist |
| `content` | HTML → markdown (via `html2text`), with `nav/footer/header/script/style/aside/form/iframe` and CMS chrome (`.cookie-banner`, `.breadcrumb`, etc.) stripped, plus a fixed boilerplate-line filter (e.g. `"Donate Now"`, `"24/7 Helpline"`, `"Sign up for our weekly e-newsletter"`) |

Pages under 100 characters after cleaning are silently dropped (likely extraction failures, e.g. JS-rendered content the scraper can't see).

### 2.3 Chunk — the retrievable unit

**Table:** `rag_chunks` (see domain catalog §4 for the full column list). This is the only node actually persisted, and the only one that reaches the LLM.

- **Chunking:** token-based (via `tiktoken`, `o200k_base` encoding), 400 tokens per chunk with 50-token overlap (both configurable via `RAG_MAX_CHUNK_TOKENS`/`RAG_CHUNK_OVERLAP_TOKENS`). Each chunk is prefixed with `"{page title}: "` before embedding — a deliberate anchor so a short conversational query ("Dad is screaming at midnight") matches better against formal article prose.
- **Embedding:** OpenAI embeddings, model configurable (`RAG_EMBEDDING_MODEL`) — see §6 for a flagged inconsistency between the configured default and what the system is documented elsewhere as using.
- **Dedup key (`chunk_id`):** **two different schemes coexist** — see §6.

---

## 3. Ingestion Pipeline

```
SEED_URLS (41, allowlist-checked)
    │  rag/scraper/crawl.py — httpx + BeautifulSoup, 1.5s delay between requests
    v
ScrapedPage[] (in-memory, dropped if <100 chars after cleaning)
    │  rag/scraper/chunk.py — tiktoken, 400 tok/chunk, 50 tok overlap, title-prefixed
    v
Chunk[] (in-memory)
    │  rag/embeddings/embed.py — OpenAI embeddings API, batched 100/call
    │  rag/pipeline.py::make_chunk_id — sha256(source_url:chunk_index:content)
    v
rag_chunks table (Postgres + pgvector)
    │  ON CONFLICT (chunk_id) DO UPDATE — re-running the pipeline on an
    │  unchanged page/chunk-boundary is idempotent; a shifted chunk boundary
    │  produces a new chunk_id (new row) rather than updating in place
    v
Vector index (ivfflat, cosine ops) — only built when embedding_dim <= 2000
GIN index on generated tsvector (source_title || content) — always built
```

Run via `python -m rag.pipeline` (`--clear` to wipe first, `--dry-run` to scrape+chunk without embedding/storing, `--urls` to target specific pages). Not currently scheduled/automated — this is a manual, developer-run ingestion step, unlike the Memory Graph's nightly cross-patient aggregation job. Worth flagging as a Gate 1 roadmap item if RAG corpus expansion (the proposal's "20+ pages from NIA, HelpGuide, Family Caregiver Alliance" Phase 2 goal) is meant to be recurring rather than one-off.

---

## 4. Retrieval — Hybrid Search

Implemented in `rag/vectorstores/pgvector.py::search` + `rag/retrieve.py::get_rag_context`.

**Step 1 — scored candidate fetch (SQL):**
```
score = (1 - cosine_distance(embedding, query_embedding))
       + (0.15 if full-text match on (source_title || content) else 0)
LIMIT fetch_k   -- fetch_k = k * 3, i.e. 9 when k=3
```
Falls back to pure cosine similarity (no keyword bonus) when no query text is supplied.

**Step 2 — Python rerank (backend-agnostic, works across pgvector/Qdrant/Chroma):**
```
for each candidate: score += 0.05 × (number of words shared between
                                      query and the chunk's source_title)
```

**Step 3 — filter + format:**
- Sort by boosted score, descending
- Take top `k` (default 3)
- Keep only those with `score >= min_score` (**default 0.20** in `retrieve.py` — see §6 for a doc/code mismatch)
- Format each surviving chunk as `Source / URL / Title / content`, joined with `---` separators, injected as `rag_context` into `crisis_system.jinja2`

An empty result set (nothing clears `min_score`) returns an empty string — the template's `{% if rag_context %}` guard means no RAG section appears in the prompt at all rather than an awkward "no results found" block.

**Where this lands relative to the Memory Graph:** per `memory-graph-design.md` §6, RAG context is injected *second*, after the patient profile and before the Behavioral Dossier/cross-patient strategies — general evidence-based guidance is asserted before this-patient-specific memory, so the dossier can read as "here's the general guidance, and here's what we specifically know about this patient."

---

## 5. Governance & Legal Boundaries

- **Enforced allowlist, not just documentation:** `get_source_metadata()` raises `ValueError` for any domain not in `_SOURCE_NAMES` — a new source cannot silently enter the corpus through a code change to `SEED_URLS` alone; someone has to also register it in the allowlist map, which the README instructs should only happen "after reviewing its robots.txt and usage terms."
- **Source composition is deliberate:** every current source is either a US government domain (public domain — `cdc.gov`, and `nia.nih.gov` once unblocked) or a nonprofit (`alz.org`, `mayoclinic.org`, `helpguide.org`, `caregiver.org`) — no commercial publishers, which sidesteps most licensing questions but doesn't eliminate them (Mayo Clinic and HelpGuide content is still copyrighted, just used here under an educational/non-commercial framing per the module docstrings). If Gate 1 review wants a formal legal sign-off on scraping/redistribution terms, this is the section to expand.
- **Attribution is structural, not incidental:** every chunk carries `source_name`/`source_url`/`source_title` all the way to the LLM prompt — the model is shown where the guidance came from, and `retrieve.py::_format_result` puts the source label first in the formatted block.
- **Politeness:** 1.5s delay between requests (`RAG_SCRAPE_DELAY`), custom `User-Agent` string identifying the scraper and its purpose, manual (not scheduled/cron) execution — no risk of an automated job silently hammering a source on a schedule nobody's watching.

---

## 6. Gaps to Flag for Gate 1 Review

**Resolved (2026-07-31):**

- **Embedding model/dimension mismatch — fixed.** `rag/config.py`'s coded defaults were `text-embedding-3-small`/1536, disagreeing with `ARCHITECTURE.md`/domain catalog's documented `vector(3072)` and with `rag/.env.example` (already pinned to `text-embedding-3-large`/3072). Changed the Pydantic field defaults to match `.env.example` — code, docs, and the deployed config template now agree. Locked in by `test_rag_settings_default_matches_deployed_embedding_config` in `backend/tests/test_rag.py`.
- **Two incompatible `chunk_id` schemes — fixed.** `pipeline.py::make_chunk_id` used `sha256(source_url:chunk_index:content)`; `pgvector.py`'s legacy backfill used `md5(source_url:content)`. Changed `make_chunk_id` to the latter formula (dropped the `chunk_index` parameter — it wasn't needed for uniqueness since chunk content already differs per position) so both paths now agree on one canonical id. Locked in by `test_make_chunk_id_matches_the_legacy_backfill_formula`.
- **`README.md`'s stale integration example and cost estimate — fixed.** `min_score=0.70` example corrected to the actual default (`0.20`); "Estimated Cost" section's page count corrected from a stale 24 to the real 41, and its model reference/token math updated to `text-embedding-3-large`.

**Resolved (2026-07-31, second pass):**

- **Hybrid search could never use an index — fixed.** The old query scored `(1 - cosine_distance) + keyword_bonus` for every row and sorted on that expression, so it was a guaranteed sequential scan and the GIN index was dead weight even when it existed. `_HYBRID_SEARCH` is now two-stage: an ANN `ORDER BY embedding <=> $1` probe (index-usable whenever one exists) unioned with a plain full-text probe (GIN-usable), and only that candidate union is scored and ranked. Ranking is unchanged for any row either probe can reach.
- **Re-ingest left superseded chunks behind — fixed.** `chunk_id` is `md5(url:content)`, so a page whose wording changed produced new rows while its old chunks stayed in the corpus forever (only `--clear` removed them). The pipeline now calls `VectorStore.delete_stale(source_urls, keep_ids)` after storing, pruning exactly the chunks of re-read pages that this run didn't produce.
- **The 2026-07-31 embedding/chunk_id change was not safe for an existing corpus — fixed.** `CREATE TABLE IF NOT EXISTS` keeps the original `vector(n)` width, so flipping the default from 1536 to 3072 against a populated database would have failed at insert time with an opaque error; `setup()` now compares the live column width against the configured dimension and fails loudly with the remedy. Separately, rows written under the old sha256 `chunk_id` formula would not have collided with the new md5 ids, so a re-ingest would have doubled the corpus — the backfill now recomputes every non-canonical id before the dedupe pass, and the whole migration block is skipped once a corpus is clean.

**Still open:**

- **No real ANN index above 2000 embedding dimensions.** `pgvector.py` explicitly skips building any vector index when `embedding_dim > 2000` (pgvector's HNSW/ivfflat both cap there) and relies on sequential scan, commented as "fine for <10k rows." At ~41 pages × ~10 chunks/page the corpus is roughly 400 rows today, well under that threshold — not an active problem, but the Phase 2 RAG expansion goal (+20 pages) plus any future corpus growth should have an explicit threshold at which this needs revisiting (e.g. switch to Qdrant, which supports HNSW at any dimension, or drop to `text-embedding-3-small`'s 1536 dims to keep pgvector's native index path available).
