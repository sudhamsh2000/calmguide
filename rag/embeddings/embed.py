"""
Embedding wrapper around OpenAI's text-embedding API.
Batches requests to stay within API limits.
"""

from openai import AsyncOpenAI

from ..config import settings

_client: AsyncOpenAI | None = None
_OPENAI_BATCH_LIMIT = 2048  # max texts per API call


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts. Automatically batches large lists."""
    client = _get_client()
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), _OPENAI_BATCH_LIMIT):
        batch = texts[i : i + _OPENAI_BATCH_LIMIT]
        response = await client.embeddings.create(
            input=batch, model=settings.embedding_model, dimensions=settings.embedding_dim
        )
        all_embeddings.extend(item.embedding for item in response.data)

    return all_embeddings


async def embed_text(text: str) -> list[float]:
    """Embed a single text string."""
    results = await embed_texts([text])
    return results[0]
