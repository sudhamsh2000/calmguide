"""Tests for the health check endpoint."""

import pytest

from app.services import availability, response_timing


@pytest.fixture(autouse=True)
def _reset_availability_tracker():
    """Each test gets a clean LLM-availability/timing window; state is process-global."""
    availability.reset()
    response_timing.reset()
    yield
    availability.reset()
    response_timing.reset()


async def test_health_returns_ok(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


async def test_health_includes_db_status(client):
    response = await client.get("/health")
    data = response.json()
    assert "database" in data
    assert data["database"] in ("connected", "disconnected")


async def test_health_llm_unknown_with_no_traffic(client):
    response = await client.get("/health")
    data = response.json()
    assert data["llm"] == "unknown"
    assert data["status"] == "healthy"


async def test_health_llm_available_after_successes(client):
    for _ in range(5):
        availability.record_llm_success()
    response = await client.get("/health")
    data = response.json()
    assert data["llm"] == "available"
    assert data["status"] == "healthy"


async def test_health_degraded_after_llm_failures(client):
    for _ in range(5):
        availability.record_llm_failure()
    response = await client.get("/health")
    assert response.status_code == 200  # DB is still fine — no 503
    data = response.json()
    assert data["llm"] == "degraded"
    assert data["status"] == "degraded"


async def test_health_includes_timing_block_with_no_traffic(client):
    response = await client.get("/health")
    data = response.json()
    assert "timing" in data
    assert data["timing"]["llm"]["total"] == {"p50_ms": None, "p95_ms": None, "samples": 0}
    assert data["timing"]["rag_retrieval"]["samples"] == 0


async def test_health_timing_reflects_recorded_samples(client):
    response_timing.record_llm_timing(time_to_first_chunk_ms=120, total_ms=800)
    response_timing.record_rag_timing(45)
    response = await client.get("/health")
    data = response.json()
    assert data["timing"]["llm"]["total"]["samples"] == 1
    assert data["timing"]["rag_retrieval"]["samples"] == 1
    # Timing is informational only — never gates status/HTTP code.
    assert response.status_code == 200
    assert data["status"] == "healthy"
