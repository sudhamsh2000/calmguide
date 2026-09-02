"""
pgvector backend — uses the existing PostgreSQL instance.

Features:
  - HNSW index for fast approximate nearest-neighbor search at any scale
  - Full-text search (tsvector + GIN) for hybrid keyword+semantic retrieval
  - Connection pooling via asyncpg

Requirements:
    pip install asyncpg pgvector

Database setup (run once):
    CREATE EXTENSION IF NOT EXISTS vector;
"""

import re

import asyncpg
from pgvector.asyncpg import register_vector

from ..config import settings
from .base import SearchResult, VectorStore

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS rag_chunks (
    id            BIGSERIAL PRIMARY KEY,
    chunk_id      TEXT,
    content       TEXT        NOT NULL,
    source_url    TEXT        NOT NULL,
    source_title  TEXT        NOT NULL,
    source_name   TEXT,
    source_domain TEXT,
    embedding     vector({dim}) NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', source_title || ' ' || content)
    ) STORED
);
"""

_ADD_CHUNK_ID_COLUMN = """
ALTER TABLE rag_chunks
ADD COLUMN IF NOT EXISTS chunk_id TEXT
"""

_ADD_SOURCE_NAME_COLUMN = """
ALTER TABLE rag_chunks
ADD COLUMN IF NOT EXISTS source_name TEXT
"""

_ADD_SOURCE_DOMAIN_COLUMN = """
ALTER TABLE rag_chunks
ADD COLUMN IF NOT EXISTS source_domain TEXT
"""

# chunk_id is md5(source_url:content) — see rag/pipeline.py::make_chunk_id.
# Rows written before that scheme was unified used sha256(url:index:content),
# so this recomputes every id that doesn't already match the canonical formula
# rather than only filling in NULLs. Without it, a re-ingest inserts a second
# copy of every chunk under a new id instead of updating the existing row.
_CANONICAL_CHUNK_ID = "md5(source_url || ':' || content)"

_NEEDS_CHUNK_ID_MIGRATION = f"""
SELECT EXISTS (
    SELECT 1 FROM rag_chunks
    WHERE chunk_id IS DISTINCT FROM {_CANONICAL_CHUNK_ID}
)
"""

_BACKFILL_CHUNK_IDS = f"""
UPDATE rag_chunks
SET chunk_id = {_CANONICAL_CHUNK_ID}
WHERE chunk_id IS DISTINCT FROM {_CANONICAL_CHUNK_ID}
"""

_BACKFILL_SOURCE_NAME = """
UPDATE rag_chunks
SET source_name = COALESCE(NULLIF(source_name, ''), source_title)
WHERE source_name IS NULL OR source_name = ''
"""

_BACKFILL_SOURCE_DOMAIN = """
UPDATE rag_chunks
SET source_domain = COALESCE(
    NULLIF(source_domain, ''),
    split_part(regexp_replace(source_url, '^https?://', ''), '/', 1)
)
WHERE source_domain IS NULL OR source_domain = ''
"""

_DELETE_DUPLICATE_CHUNKS = """
WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY chunk_id ORDER BY id) AS row_num
    FROM rag_chunks
    WHERE chunk_id IS NOT NULL
)
DELETE FROM rag_chunks
WHERE id IN (SELECT id FROM ranked WHERE row_num > 1)
"""

_SET_CHUNK_ID_NOT_NULL = """
ALTER TABLE rag_chunks
ALTER COLUMN chunk_id SET NOT NULL
"""

# ivfflat for >2000 dimensions (pgvector HNSW limit is 2000).
# For <=2000 dims, HNSW would be preferred but text-embedding-3-large uses 3072.
_CREATE_VECTOR_INDEX = """
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
ON rag_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = {lists});
"""

# GIN index for fast full-text keyword search.
_CREATE_TEXT_INDEX = """
CREATE INDEX IF NOT EXISTS rag_chunks_search_idx
ON rag_chunks USING gin (search_vector);
"""

_CREATE_CHUNK_ID_UNIQUE_INDEX = """
CREATE UNIQUE INDEX IF NOT EXISTS rag_chunks_chunk_id_idx
ON rag_chunks (chunk_id);
"""

_INSERT = """
INSERT INTO rag_chunks (
    chunk_id,
    content,
    source_url,
    source_title,
    source_name,
    source_domain,
    embedding
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (chunk_id) DO UPDATE SET
    content = EXCLUDED.content,
    source_url = EXCLUDED.source_url,
    source_title = EXCLUDED.source_title,
    source_name = EXCLUDED.source_name,
    source_domain = EXCLUDED.source_domain,
    embedding = EXCLUDED.embedding
"""

# Hybrid search: semantic similarity + keyword boost.
# The keyword match adds a flat bonus so exact-term hits rank higher
# even when cosine similarity is modest (cross-style matching).
#
# Two-stage by design: scoring and ranking on the combined expression cannot use
# any index, so the candidate set is gathered first by two index-friendly probes
# — a pure ANN order-by (uses the ivfflat/HNSW index when one exists) and a
# plain full-text match (uses the GIN index) — and only that union is scored.
# The final ordering is identical to scoring the whole table for any row that
# either probe can reach, which is every row that could plausibly win.
_HYBRID_SEARCH = """
WITH vector_candidates AS (
    SELECT id FROM rag_chunks
    ORDER BY embedding <=> $1
    LIMIT $2
),
text_candidates AS (
    SELECT id FROM rag_chunks
    WHERE search_vector @@ plainto_tsquery('english', $3)
    LIMIT $2
),
candidates AS (
    SELECT id FROM vector_candidates
    UNION
    SELECT id FROM text_candidates
)
SELECT c.content, c.source_url, c.source_title, c.source_name, c.source_domain,
       (1 - (c.embedding <=> $1))
       + CASE WHEN c.search_vector @@ plainto_tsquery('english', $3)
              THEN 0.15 ELSE 0 END
       AS score
FROM rag_chunks c
JOIN candidates ON candidates.id = c.id
ORDER BY score DESC
LIMIT $2
"""

_DELETE_STALE_FOR_URLS = """
DELETE FROM rag_chunks
WHERE source_url = ANY($1::text[])
  AND chunk_id <> ALL($2::text[])
"""

_EMBEDDING_COLUMN_TYPE = """
SELECT format_type(a.atttypid, a.atttypmod)
FROM pg_attribute a
WHERE a.attrelid = 'rag_chunks'::regclass
  AND a.attname = 'embedding'
  AND NOT a.attisdropped
"""

# Pure vector search fallback (when no query text is provided).
_VECTOR_SEARCH = """
SELECT content, source_url, source_title, source_name, source_domain,
       1 - (embedding <=> $1) AS score
FROM rag_chunks
ORDER BY embedding <=> $1
LIMIT $2
"""


class PgVectorStore(VectorStore):
    def __init__(self, dsn: str | None = None):
        self._dsn = dsn or settings.pgvector_dsn
        self._pool: asyncpg.Pool | None = None
        self._ready = False

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                self._dsn,
                init=register_vector,
                min_size=1,
                max_size=5,
            )
        return self._pool

    @staticmethod
    async def _assert_embedding_dim_matches(conn) -> None:
        """Fail loudly when the table's vector width isn't the configured one.

        `CREATE TABLE IF NOT EXISTS` silently keeps the original width, so
        changing RAG_EMBEDDING_MODEL/RAG_EMBEDDING_DIM against a populated
        database otherwise surfaces later as an opaque insert error — or, on a
        read-only path, as retrieval that never matches anything.
        """
        column_type = await conn.fetchval(_EMBEDDING_COLUMN_TYPE)
        match = re.search(r"\((\d+)\)", column_type or "")
        if not match:
            return
        actual_dim = int(match.group(1))
        if actual_dim == settings.embedding_dim:
            return
        raise RuntimeError(
            f"rag_chunks.embedding is vector({actual_dim}) but RAG_EMBEDDING_DIM "
            f"is {settings.embedding_dim} (model {settings.embedding_model}). "
            "The existing corpus was embedded with a different model — re-ingest "
            "it with `python -m rag.pipeline --clear` after dropping the column "
            "width mismatch, or set the dimension back to "
            f"{actual_dim} to keep using the stored embeddings."
        )

    async def setup(self) -> None:
        if self._ready:
            return
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            await conn.execute(_CREATE_TABLE.format(dim=settings.embedding_dim))
            await conn.execute(_ADD_CHUNK_ID_COLUMN)
            await conn.execute(_ADD_SOURCE_NAME_COLUMN)
            await conn.execute(_ADD_SOURCE_DOMAIN_COLUMN)
            await self._assert_embedding_dim_matches(conn)
            # The backfills below rewrite every row that predates the current
            # column set or chunk_id formula. Once a corpus is migrated they
            # match nothing, so gate them on a single cheap probe instead of
            # re-running four table-wide statements on every process start.
            if await conn.fetchval(_NEEDS_CHUNK_ID_MIGRATION):
                await conn.execute(_BACKFILL_CHUNK_IDS)
                await conn.execute(_BACKFILL_SOURCE_NAME)
                await conn.execute(_BACKFILL_SOURCE_DOMAIN)
                await conn.execute(_DELETE_DUPLICATE_CHUNKS)
            await conn.execute(_SET_CHUNK_ID_NOT_NULL)
            # pgvector indexes (HNSW, ivfflat) cap at 2000 dimensions.
            # For higher dims (e.g. text-embedding-3-large at 3072), skip the
            # vector index and rely on sequential scan — fine for <10k rows.
            if settings.embedding_dim <= 2000:
                row_count = await conn.fetchval("SELECT COUNT(*) FROM rag_chunks")
                if row_count > 0:
                    import math

                    lists = max(1, min(int(math.sqrt(row_count)), row_count // 3))
                    await conn.execute(_CREATE_VECTOR_INDEX.format(lists=lists))
            await conn.execute(_CREATE_TEXT_INDEX)
            await conn.execute(_CREATE_CHUNK_ID_UNIQUE_INDEX)
        self._ready = True

    async def add(
        self,
        ids: list[str],
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ) -> None:
        pool = await self._get_pool()
        rows = [
            (
                chunk_id,
                text,
                meta["source_url"],
                meta["source_title"],
                meta["source_name"],
                meta["source_domain"],
                emb,
            )
            for chunk_id, text, emb, meta in zip(ids, texts, embeddings, metadatas, strict=True)
        ]
        async with pool.acquire() as conn:
            await conn.executemany(_INSERT, rows)

    async def search(
        self,
        query_embedding: list[float],
        k: int = 5,
        query_text: str = "",
    ) -> list[SearchResult]:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            # Set probes for ivfflat index (only matters when index exists, <=2000 dims)
            if settings.embedding_dim <= 2000:
                await conn.execute("SET ivfflat.probes = 10")
            if query_text:
                rows = await conn.fetch(_HYBRID_SEARCH, query_embedding, k, query_text)
            else:
                rows = await conn.fetch(_VECTOR_SEARCH, query_embedding, k)
        return [
            SearchResult(
                content=r["content"],
                source_url=r["source_url"],
                source_title=r["source_title"],
                source_name=r["source_name"] or "",
                source_domain=r["source_domain"] or "",
                score=float(r["score"]),
            )
            for r in rows
        ]

    async def count(self) -> int:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchval("SELECT COUNT(*) FROM rag_chunks")

    async def clear(self) -> None:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute("TRUNCATE rag_chunks RESTART IDENTITY")

    async def delete_stale(self, source_urls: list[str], keep_ids: list[str]) -> None:
        if not source_urls:
            return
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute(_DELETE_STALE_FOR_URLS, source_urls, keep_ids)
