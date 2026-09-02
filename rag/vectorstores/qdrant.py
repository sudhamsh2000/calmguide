"""
Qdrant backend — works with local Qdrant server or Qdrant Cloud.

Requirements:
    pip install qdrant-client

Local Qdrant (Docker):
    docker run -p 6333:6333 qdrant/qdrant

Qdrant Cloud:
    Set RAG_QDRANT_URL and RAG_QDRANT_API_KEY in .env
"""

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    FilterSelector,
    HasIdCondition,
    MatchAny,
    PointStruct,
    VectorParams,
)

from ..config import settings
from .base import SearchResult, VectorStore


class QdrantStore(VectorStore):
    def __init__(self) -> None:
        self._client: AsyncQdrantClient | None = None
        self._collection = settings.qdrant_collection

    def _client_(self) -> AsyncQdrantClient:
        if self._client is None:
            self._client = AsyncQdrantClient(
                url=settings.qdrant_url,
                api_key=settings.qdrant_api_key or None,
            )
        return self._client

    async def setup(self) -> None:
        client = self._client_()
        existing = await client.get_collections()
        names = {c.name for c in existing.collections}
        if self._collection not in names:
            await client.create_collection(
                collection_name=self._collection,
                vectors_config=VectorParams(
                    size=settings.embedding_dim,
                    distance=Distance.COSINE,
                ),
            )

    async def add(
        self,
        ids: list[str],
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ) -> None:
        client = self._client_()
        points = [
            PointStruct(
                id=chunk_id,
                vector=emb,
                payload={"content": text, **meta},
            )
            for chunk_id, text, emb, meta in zip(ids, texts, embeddings, metadatas, strict=True)
        ]
        await client.upsert(collection_name=self._collection, points=points)

    async def search(
        self,
        query_embedding: list[float],
        k: int = 5,
        query_text: str = "",
    ) -> list[SearchResult]:
        client = self._client_()
        hits = await client.search(
            collection_name=self._collection,
            query_vector=query_embedding,
            limit=k,
            with_payload=True,
        )
        return [
            SearchResult(
                content=hit.payload["content"],
                source_url=hit.payload.get("source_url", ""),
                source_title=hit.payload.get("source_title", ""),
                source_name=hit.payload.get("source_name", ""),
                source_domain=hit.payload.get("source_domain", ""),
                score=hit.score,
            )
            for hit in hits
        ]

    async def count(self) -> int:
        client = self._client_()
        info = await client.get_collection(self._collection)
        return info.points_count or 0

    async def clear(self) -> None:
        client = self._client_()
        await client.delete_collection(self._collection)
        await self.setup()

    async def delete_stale(self, source_urls: list[str], keep_ids: list[str]) -> None:
        if not source_urls:
            return
        client = self._client_()
        await client.delete(
            collection_name=self._collection,
            points_selector=FilterSelector(
                filter=Filter(
                    must=[FieldCondition(key="source_url", match=MatchAny(any=source_urls))],
                    must_not=([HasIdCondition(has_id=keep_ids)] if keep_ids else []),
                )
            ),
        )
