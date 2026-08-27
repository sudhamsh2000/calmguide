"""Tests for the health check endpoint."""

import pytest

from app.services import availability


@pytest.fixture(autouse=True)
def _reset_availability_tracker():
    """Each test gets a clean LLM-availability window; state is process-global."""
    availability.reset()
    yield
    availability.reset()


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
