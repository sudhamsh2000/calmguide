"""Focused tests for the local RAG integration contract."""

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def test_rag_settings_default_matches_deployed_embedding_config():
    """The bare field default (no env override) must match rag/.env.example —
    ARCHITECTURE.md and the domain catalog document rag_chunks.embedding as
    vector(3072) / text-embedding-3-large, and rag/.env.example is already
    pinned to that. A drifted code default is misleading even though every
    real deployment overrides it via .env.
    """
    from rag.config import Settings

    settings = Settings(_env_file=None)

    assert settings.embedding_model == "text-embedding-3-large"
    assert settings.embedding_dim == 3072


def test_rag_settings_reject_oversized_dimension():
    from rag.config import Settings

    with pytest.raises(ValueError, match="exceeds the maximum supported dimension"):
        Settings(
            embedding_model="text-embedding-3-small",
            embedding_dim=3072,
        )


def test_rag_settings_allow_reduced_dimension():
    from rag.config import Settings

    settings = Settings(
        embedding_model="text-embedding-3-large",
        embedding_dim=1024,
    )

    assert settings.embedding_dim == 1024


@pytest.mark.asyncio
async def test_embed_texts_passes_dimensions(monkeypatch):
    from rag.embeddings import embed as embed_module

    captured: dict[str, object] = {}

    class FakeEmbeddingsAPI:
        async def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                data=[SimpleNamespace(embedding=[0.1, 0.2, 0.3])],
            )

    class FakeClient:
        embeddings = FakeEmbeddingsAPI()

    monkeypatch.setattr(embed_module, "_client", None)
    monkeypatch.setattr(embed_module, "_get_client", lambda: FakeClient())

    await embed_module.embed_texts(["hello"])

    assert captured["model"] == embed_module.settings.embedding_model
    assert captured["dimensions"] == embed_module.settings.embedding_dim


def test_make_chunk_id_matches_the_legacy_backfill_formula():
    """rag/vectorstores/pgvector.py's _BACKFILL_CHUNK_IDS migration derives
    chunk_id for legacy rows as md5(source_url || ':' || content) — no
    chunk_index. New inserts must use the identical formula so both code
    paths agree on one canonical id, instead of the two incompatible schemes
    (sha256+chunk_index vs. md5-only) flagged in knowledge-graph-design.md.
    """
    import hashlib

    from rag.pipeline import make_chunk_id

    source_url = "https://www.alz.org/help-support/caregiving/safety"
    content = "Keep exits secured and remove tripping hazards."

    expected = hashlib.md5(f"{source_url}:{content}".encode()).hexdigest()

    assert make_chunk_id(source_url, content) == expected


def test_format_result_includes_source_attribution():
    from rag.retrieve import _format_result
    from rag.vectorstores.base import SearchResult

    result = SearchResult(
        content="Keep the room quiet and lower the lights.",
        source_url="https://www.nia.nih.gov/example",
        source_title="Managing Sundowning",
        source_name="National Institute on Aging",
        source_domain="www.nia.nih.gov",
        score=0.87,
    )

    formatted = _format_result(result)

    assert "Source: National Institute on Aging" in formatted
    assert "URL: https://www.nia.nih.gov/example" in formatted
    assert "Title: Managing Sundowning" in formatted


@pytest.mark.asyncio
async def test_coach_prompt_uses_generic_rag_header(client, mock_llm, monkeypatch):
    from app.routers import coach as coach_router

    async def fake_fetch_rag_context(message: str) -> str:
        return (
            "Source: National Institute on Aging\n"
            "URL: https://www.nia.nih.gov/example\n"
            "Title: Managing Sundowning\n"
            "Lower noise and redirect gently."
        )

    monkeypatch.setattr(coach_router, "_fetch_rag_context", fake_fetch_rag_context)

    create_response = await client.post(
        "/api/profiles",
        json={
            "disease_stage": "middle",
            "behavioral_patterns": ["sundowning"],
            "calming_strategies": ["soft music"],
            "safety_concerns": ["wandering"],
        },
    )
    access_code = create_response.json()["access_code"]

    response = await client.post(
        "/api/coach/chat",
        json={
            "access_code": access_code,
            "patient_name": "Mom",
            "message": "She wants to leave at night",
        },
    )

    assert response.status_code == 200
    # Assert on the coach (stream) prompt specifically — post-[DONE] tag/extraction
    # completion calls would otherwise overwrite last_system_prompt.
    coach_prompt = mock_llm.last_stream_system_prompt
    assert coach_prompt is not None
    assert "## Relevant Caregiving Guidance" in coach_prompt
    assert "National Institute on Aging" in coach_prompt
    assert "Relevant Guidance from the Alzheimer's Association" not in coach_prompt
