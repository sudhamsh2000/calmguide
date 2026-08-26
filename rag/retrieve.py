"""
Retrieval helper — import this into the FastAPI crisis router.

Example usage in backend/app/routers/crisis.py:
    from rag.retrieve import get_rag_context

    context = await get_rag_context(user_message, k=3)
    # Inject `context` into the Jinja2 system prompt template
"""

import logging

from .embeddings.embed import embed_text
from .vectorstores import SearchResult, VectorStore, get_vector_store

logger = logging.getLogger(__name__)

_store: VectorStore | None = None


def _get_store() -> VectorStore:
    global _store
    if _store is None:
        _store = get_vector_store()
    return _store


def _format_result(result: SearchResult) -> str:
    source_label = result.source_name or result.source_domain or "Unknown source"
    return "\n".join(
        [
            f"Source: {source_label}",
            f"URL: {result.source_url}",
            f"Title: {result.source_title}",
            result.content,
        ]
    )


async def get_rag_context(
    query: str,
    k: int = 3,
    min_score: float = 0.20,
) -> str:
    """
    Retrieve relevant dementia caregiving content for a caregiver query.

    Uses hybrid search (semantic + keyword) when the vector store supports it.
    The raw query text is passed to the store so keyword matches can boost
    relevant results even when cosine similarity is modest.

    Returns a formatted string ready to inject into the crisis system prompt.
    Returns an empty string if no results exceed min_score.

    Args:
        query:      The caregiver's message / crisis description.
        k:          Max number of chunks to retrieve.
        min_score:  Minimum similarity to include a chunk (0–1).
    """
    store = _get_store()
    await store.setup()

    query_embedding = await embed_text(query)

    # Fetch more candidates than needed so reranking has room to work.
    fetch_k = k * 3

    results = await store.search(query_embedding, k=fetch_k, query_text=query)

    # Rerank: boost results whose title closely matches query keywords.
    # This is backend-agnostic and helps all vector stores.
    query_words = set(query.lower().split())
    for r in results:
        title_words = set(r.source_title.lower().split())
        overlap = len(query_words & title_words)
        if overlap:
            r.score += 0.05 * overlap

    results.sort(key=lambda r: r.score, reverse=True)
    top = results[:k]

    for r in top:
        logger.info(
            "RAG result: %.3f — %s / %s (chunk %d chars)",
            r.score,
            r.source_name or r.source_domain,
            r.source_title,
            len(r.content),
        )

    relevant = [r for r in top if r.score >= min_score]

    if not relevant:
        return ""

    sections = [_format_result(r) for r in relevant]
    return "\n\n---\n\n".join(sections)
