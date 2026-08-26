"""Tests for the health check endpoint."""

import pytest


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
