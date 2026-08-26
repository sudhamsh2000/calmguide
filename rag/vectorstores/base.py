from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class SearchResult:
    content: str
    source_url: str
    source_title: str
    source_name: str
    source_domain: str
    score: float  # cosine similarity, 0–1 (higher = more relevant)


class VectorStore(ABC):
    @abstractmethod
    async def setup(self) -> None:
        """Create collections / tables if they don't exist."""

    @abstractmethod
    async def add(
        self,
        ids: list[str],
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ) -> None:
        """Persist a batch of chunks with their embeddings and metadata."""

    @abstractmethod
    async def search(
        self,
        query_embedding: list[float],
        k: int = 5,
        query_text: str = "",
    ) -> list[SearchResult]:
        """Return the top-k most similar chunks."""

    @abstractmethod
    async def count(self) -> int:
        """Return the total number of stored chunks."""

    @abstractmethod
    async def clear(self) -> None:
        """Delete all stored chunks."""

    @abstractmethod
    async def delete_stale(self, source_urls: list[str], keep_ids: list[str]) -> None:
        """Delete chunks from `source_urls` whose id is not in `keep_ids`.

        Called after a re-ingest so chunks produced by an older version of a
        page (different text → different chunk_id → a fresh row rather than an
        update) do not linger alongside the current ones.
        """
