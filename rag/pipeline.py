"""
Ingestion pipeline: scrape alz.org → chunk → embed → store

Usage:
    # Ingest all default alz.org seed URLs
    python -m rag.pipeline

    # Ingest specific URLs
    python -m rag.pipeline --urls https://www.alz.org/help-support/caregiving/safety

    # Clear existing data first, then ingest
    python -m rag.pipeline --clear

    # Dry run — scrape and chunk without embedding or storing
    python -m rag.pipeline --dry-run
"""

import argparse
import asyncio
import hashlib

from .config import settings
from .embeddings.embed import embed_texts
from .scraper.chunk import chunk_pages
from .scraper.crawl import ALZ_SEED_URLS, scrape_pages
from .vectorstores import get_vector_store

_EMBED_BATCH = 100  # chunks per embedding API call


def make_chunk_id(source_url: str, content: str) -> str:
    """md5(source_url:content) — must match the legacy backfill formula in
    rag/vectorstores/pgvector.py's _BACKFILL_CHUNK_IDS migration, so both new
    inserts and backfilled legacy rows agree on one canonical chunk_id.
    """
    raw = f"{source_url}:{content}".encode()
    return hashlib.md5(raw).hexdigest()


async def run_pipeline(
    urls: list[str] | None = None,
    clear: bool = False,
    dry_run: bool = False,
) -> None:
    urls = urls or ALZ_SEED_URLS
    store = get_vector_store()

    print(f"Vector store : {settings.vector_store}")
    print(f"Embedding    : {settings.embedding_model} (dim={settings.embedding_dim})")
    print(f"URLs         : {len(urls)}\n")

    if not dry_run:
        await store.setup()
        if clear:
            print("Clearing existing data...")
            await store.clear()

    # 1. Scrape
    print("=== Scraping ===")
    pages = await scrape_pages(urls=urls, delay=settings.scrape_delay)
    print(f"Scraped {len(pages)} pages.\n")

    # 2. Chunk
    print("=== Chunking ===")
    chunks = chunk_pages(
        pages,
        max_tokens=settings.max_chunk_tokens,
        overlap_tokens=settings.chunk_overlap_tokens,
    )
    print(f"Total chunks : {len(chunks)}\n")

    if dry_run:
        print("[dry-run] Stopping before embed/store.")
        for c in chunks[:3]:
            print(f"  [{c.source_title}] {c.content[:80]}...")
        return

    # 3. Embed + store in batches
    print("=== Embedding & storing ===")
    total_batches = (len(chunks) - 1) // _EMBED_BATCH + 1

    ingested_ids: list[str] = []

    for batch_idx in range(0, len(chunks), _EMBED_BATCH):
        batch = chunks[batch_idx : batch_idx + _EMBED_BATCH]
        ids = [make_chunk_id(c.source_url, c.content) for c in batch]
        ingested_ids.extend(ids)
        texts = [c.content for c in batch]
        metadatas = [
            {
                "source_url": c.source_url,
                "source_title": c.source_title,
                "source_name": c.source_name,
                "source_domain": c.source_domain,
                "chunk_index": c.chunk_index,
            }
            for c in batch
        ]

        embeddings = await embed_texts(texts)
        await store.add(ids=ids, texts=texts, embeddings=embeddings, metadatas=metadatas)

        current_batch = batch_idx // _EMBED_BATCH + 1
        print(f"  Batch {current_batch}/{total_batches} — stored {len(batch)} chunks")

    # A page whose wording changed produces new chunk_ids, so its previous
    # chunks would otherwise survive this run as an outdated second copy of the
    # same source. Only chunks from the pages we just re-read are considered.
    scraped_urls = sorted({page.url for page in pages})
    await store.delete_stale(source_urls=scraped_urls, keep_ids=ingested_ids)
    print(f"Pruned superseded chunks for {len(scraped_urls)} re-ingested page(s).")

    total = await store.count()

    # Build/rebuild vector index after data load (ivfflat needs rows to exist first)
    print("=== Building indexes ===")
    store._ready = False  # force re-run to create index now that rows exist
    await store.setup()
    print("Indexes ready.")

    print(f"\nDone. Total chunks in store: {total}")


def main() -> None:
    parser = argparse.ArgumentParser(description="CalmGuide RAG ingestion pipeline")
    parser.add_argument("--urls", nargs="*", help="URLs to scrape (default: all alz.org seed URLs)")
    parser.add_argument("--clear", action="store_true", help="Clear all data before ingesting")
    parser.add_argument(
        "--dry-run", action="store_true", help="Scrape and chunk without embedding or storing"
    )
    args = parser.parse_args()

    asyncio.run(run_pipeline(urls=args.urls, clear=args.clear, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
