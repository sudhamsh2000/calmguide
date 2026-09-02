from ..config import VectorStoreType, settings
from .base import SearchResult, VectorStore


def get_vector_store() -> VectorStore:
    """Factory — returns the configured vector store backend."""
    if settings.vector_store == VectorStoreType.PGVECTOR:
        from .pgvector import PgVectorStore

        return PgVectorStore()
    if settings.vector_store == VectorStoreType.QDRANT:
        from .qdrant import QdrantStore

        return QdrantStore()
    if settings.vector_store == VectorStoreType.CHROMA:
        from .chroma import ChromaStore

        return ChromaStore()
    raise ValueError(f"Unknown vector store: {settings.vector_store}")


__all__ = ["VectorStore", "SearchResult", "get_vector_store"]
