"""
ChromaDB backend — persistent local vector store, no extra server needed.

Requirements:
    pip install chromadb

Data is stored at the path set by RAG_CHROMA_PATH (default: ./chroma_db).
"""

import asyncio

import chromadb
from chromadb.config import Settings as ChromaSettings

from ..config import settings
from .base import SearchResult, VectorStore


class ChromaStore(VectorStore):
    """
    Wraps ChromaDB's synchronous PersistentClient in asyncio.to_thread
    so it fits the async VectorStore interface without blocking the event loop.
    """

    def __init__(self) -> None:
        self._client: chromadb.ClientAPI | None = None
        self._collection: chromadb.Collection | None = None

    def _init(self) -> None:
        """Synchronous initialisation — called inside asyncio.to_thread."""
        if self._client is None:
            self._client = chromadb.PersistentClient(
                path=settings.chroma_path,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
        if self._collection is None:
            self._collection = self._client.get_or_create_collection(
                name=settings.chroma_collection,
                metadata={"hnsw:space": "cosine"},
            )

    async def setup(self) -> None:
        await asyncio.to_thread(self._init)

    async def add(
        self,
        ids: list[str],
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ) -> None:
        def _add() -> None:
            self._init()
            self._collection.upsert(  # type: ignore[union-attr]
                ids=ids,
                documents=texts,
                embeddings=embeddings,
                metadatas=metadatas,
            )

        await asyncio.to_thread(_add)

    async def search(
        self,
        query_embedding: list[float],
        k: int = 5,
        query_text: str = "",
    ) -> list[SearchResult]:
        def _search() -> list[SearchResult]:
            self._init()
            results = self._collection.query(  # type: ignore[union-attr]
                query_embeddings=[query_embedding],
                n_results=k,
                include=["documents", "metadatas", "distances"],
            )
            output: list[SearchResult] = []
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
                strict=True,
            ):
                output.append(
                    SearchResult(
                        content=doc,
                        source_url=meta.get("source_url", ""),
                        source_title=meta.get("source_title", ""),
                        source_name=meta.get("source_name", ""),
                        source_domain=meta.get("source_domain", ""),
                        score=1.0 - dist,  # cosine distance → similarity
                    )
                )
            return output

        return await asyncio.to_thread(_search)

    async def count(self) -> int:
        def _count() -> int:
            self._init()
            return self._collection.count()  # type: ignore[union-attr]

        return await asyncio.to_thread(_count)

    async def delete_stale(self, source_urls: list[str], keep_ids: list[str]) -> None:
        if not source_urls:
            return

        def _delete_stale() -> None:
            self._init()
            existing = self._collection.get(  # type: ignore[union-attr]
                where={"source_url": {"$in": source_urls}},
                include=[],
            )
            keep = set(keep_ids)
            stale = [cid for cid in existing["ids"] if cid not in keep]
            if stale:
                self._collection.delete(ids=stale)  # type: ignore[union-attr]

        await asyncio.to_thread(_delete_stale)

    async def clear(self) -> None:
        def _clear() -> None:
            self._init()
            self._client.delete_collection(settings.chroma_collection)  # type: ignore[union-attr]
            self._collection = None
            self._init()

        await asyncio.to_thread(_clear)
