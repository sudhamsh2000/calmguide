"""Tests for the Learn Mode endpoints."""

import pytest


# ---------------------------------------------------------------------------
# GET /api/learn/scenarios
# ---------------------------------------------------------------------------


async def test_list_scenarios_returns_all(client):
    response = await client.get("/api/learn/scenarios")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    # Each scenario has required fields
    for scenario in data:
        assert "id" in scenario
        assert "title" in scenario
        assert "description" in scenario
        assert "disease_stage" in scenario
        assert "category" in scenario


async def test_list_scenarios_filter_by_stage(client):
    response = await client.get("/api/learn/scenarios", params={"disease_stage": "early"})
    assert response.status_code == 200
    data = response.json()
    for scenario in data:
        assert scenario["disease_stage"] == "early"


async def test_list_scenarios_filter_by_category(client):
    response = await client.get("/api/learn/scenarios", params={"category": "safety"})
    assert response.status_code == 200
    data = response.json()
    for scenario in data:
        assert scenario["category"] == "safety"


# ---------------------------------------------------------------------------
# POST /api/learn/interact
# ---------------------------------------------------------------------------


async def test_learn_interact_returns_response(client):
    payload = {
        "scenario_id": "sundowning-evening",
        "disease_stage": "middle",
        "message": "What should I do first?",
    }
    response = await client.post("/api/learn/interact", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert len(data["response"]) > 0


async def test_learn_interact_unknown_scenario(client):
    payload = {
        "scenario_id": "nonexistent-scenario",
        "disease_stage": "middle",
        "message": "Help",
    }
    response = await client.post("/api/learn/interact", json=payload)
    assert response.status_code == 404


async def test_learn_interact_invalid_stage(client):
    payload = {
        "scenario_id": "sundowning-evening",
        "disease_stage": "invalid",
        "message": "Help",
    }
    response = await client.post("/api/learn/interact", json=payload)
    assert response.status_code == 422
