from enum import Enum
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings

# Resolve candidate .env files: prefer repo-root/.env, fall back to cwd/.env.
# This means RAG_ vars can live in backend/.env (when running the FastAPI server)
# or in a standalone rag/.env (when running the ingestion pipeline directly).
_REPO_ROOT = Path(__file__).resolve().parent.parent
_RAG_DIR = Path(__file__).resolve().parent
_ENV_FILES = [
    str(_REPO_ROOT / "backend" / ".env"),
    str(_RAG_DIR / ".env"),  # always absolute — works regardless of CWD
]

_EMBEDDING_MODEL_MAX_DIMS = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
}


class VectorStoreType(str, Enum):
    PGVECTOR = "pgvector"
    QDRANT = "qdrant"
    CHROMA = "chroma"


class Settings(BaseSettings):
    # --- Vector store selection ---
    vector_store: VectorStoreType = VectorStoreType.PGVECTOR

    # --- Embedding ---
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-large"
    embedding_dim: int = 3072  # 1536 for text-embedding-3-small, 3072 for text-embedding-3-large

    # --- pgvector ---
    # Strip "+asyncpg" if copied from the main backend DATABASE_URL
    pgvector_dsn: str = "postgresql://postgres:postgres@localhost:5432/calmguide"

    # --- Qdrant ---
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection: str = "calmguide_rag"

    # --- ChromaDB ---
    chroma_path: str = "./chroma_db"
    chroma_collection: str = "calmguide_rag"

    # --- Scraping ---
    scrape_delay: float = 1.5   # seconds between requests — be polite
    max_chunk_tokens: int = 400
    chunk_overlap_tokens: int = 50

    @model_validator(mode="after")
    def validate_embedding_config(self) -> "Settings":
        if self.embedding_dim <= 0:
            raise ValueError("embedding_dim must be a positive integer")

        max_dim = _EMBEDDING_MODEL_MAX_DIMS.get(self.embedding_model)
        if max_dim is not None and self.embedding_dim > max_dim:
            raise ValueError(
                f"embedding_dim={self.embedding_dim} exceeds the maximum supported "
                f"dimension for {self.embedding_model} ({max_dim})"
            )

        return self

    model_config = {"env_file": _ENV_FILES, "env_prefix": "RAG_", "extra": "ignore"}


settings = Settings()
