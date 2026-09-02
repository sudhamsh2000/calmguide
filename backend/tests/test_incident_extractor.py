from unittest.mock import AsyncMock, patch

import pytest

from app.services.incident_extractor import extract_incident_from_conversation

SAMPLE_CONVERSATION = [
    {
        "role": "user",
        "content": "Mom keeps trying to leave through the front door. It's 2am and she's very confused.",
    },
    {
        "role": "assistant",
        "content": "I understand this is frightening. Right now, stand between her and the door...",
    },
    {
        "role": "user",
        "content": "I tried playing her favorite Frank Sinatra and she calmed down after about 10 minutes.",
    },
    {"role": "assistant", "content": "That's wonderful that the music worked..."},
]

SAMPLE_PROFILE = {
    "disease_stage": "middle",
    "behavioral_patterns": ["sundowning", "wandering"],
    "calming_strategies": ["Sinatra music", "warm milk"],
    "safety_concerns": ["elopement risk"],
}


@pytest.mark.asyncio
async def test_extract_incident_returns_structured_data():
    mock_llm_response = {
        "incident_time_description": "2am",
        "behavior_category": "wandering_exit_seeking",
        "behavior_subcategory": None,
        "severity": "moderate",
        "duration_category": "minutes",
        "antecedent_description": "Patient woke up confused at 2am",
        "antecedent_category": "physical_state",
        "behavior_description": "Tried to leave through front door, very confused",
        "intervention_description": "Played Frank Sinatra music",
        "intervention_outcome": "resolved",
        "location": "front_door",
        "is_recurring": None,
        "caregiver_distress_level": "moderate",
        "field_confidences": {
            "behavior_category": 0.95,
            "antecedent": 0.80,
            "intervention": 0.90,
            "outcome": 0.92,
        },
        "overall_confidence": 0.89,
    }

    with patch(
        "app.services.incident_extractor._call_extraction_llm",
        new_callable=AsyncMock,
        return_value=mock_llm_response,
    ):
        result = await extract_incident_from_conversation(
            conversation_messages=SAMPLE_CONVERSATION,
            profile=SAMPLE_PROFILE,
            patient_name="Mom",
        )

    assert result is not None
    assert result["behavior_category"] == "wandering_exit_seeking"
    assert result["severity"] == "moderate"
    assert result["intervention_outcome"] == "resolved"
    assert result["overall_confidence"] == 0.89


@pytest.mark.asyncio
async def test_extract_incident_filters_low_confidence():
    mock_llm_response = {
        "incident_time_description": "sometime today",
        "behavior_category": "other",
        "severity": "mild",
        "behavior_description": "Something happened",
        "antecedent_description": "Not sure what triggered it",
        "antecedent_category": "unknown",
        "intervention_description": None,
        "intervention_outcome": None,
        "field_confidences": {
            "behavior_category": 0.70,
            "antecedent": 0.45,
            "intervention": 0.30,
            "outcome": 0.30,
        },
        "overall_confidence": 0.55,
    }

    with patch(
        "app.services.incident_extractor._call_extraction_llm",
        new_callable=AsyncMock,
        return_value=mock_llm_response,
    ):
        result = await extract_incident_from_conversation(
            conversation_messages=SAMPLE_CONVERSATION,
            profile=SAMPLE_PROFILE,
            patient_name="Mom",
        )

    assert result is not None
    assert result["behavior_category"] == "other"
    assert result["antecedent_description"] is None
    assert result["intervention_description"] is None


@pytest.mark.asyncio
async def test_extract_incident_flags_abuse_indicators():
    mock_llm_response = {
        "behavior_category": "refusing_care",
        "behavior_description": "Patient resisted medication",
        "intervention_description": "I had to hold her down to give the medication",
        "intervention_outcome": "resolved",
        "field_confidences": {
            "behavior_category": 0.90,
            "antecedent": 0.60,
            "intervention": 0.85,
            "outcome": 0.80,
        },
        "overall_confidence": 0.80,
    }

    with patch(
        "app.services.incident_extractor._call_extraction_llm",
        new_callable=AsyncMock,
        return_value=mock_llm_response,
    ):
        result = await extract_incident_from_conversation(
            conversation_messages=SAMPLE_CONVERSATION,
            profile=SAMPLE_PROFILE,
            patient_name="Mom",
        )

    assert result is not None
    assert result.get("safety_concern") == "potential_abuse_indicator"


@pytest.mark.asyncio
async def test_extract_incident_returns_none_on_llm_failure():
    with patch(
        "app.services.incident_extractor._call_extraction_llm",
        new_callable=AsyncMock,
        side_effect=RuntimeError("API timeout"),
    ):
        result = await extract_incident_from_conversation(
            conversation_messages=SAMPLE_CONVERSATION,
            profile=SAMPLE_PROFILE,
            patient_name="Mom",
        )

    assert result is None


@pytest.mark.asyncio
async def test_extract_incident_returns_none_on_empty_response():
    with patch(
        "app.services.incident_extractor._call_extraction_llm",
        new_callable=AsyncMock,
        return_value={},
    ):
        result = await extract_incident_from_conversation(
            conversation_messages=SAMPLE_CONVERSATION,
            profile=SAMPLE_PROFILE,
            patient_name="Mom",
        )

    assert result is None


@pytest.mark.asyncio
async def test_extract_incident_scrubs_pii():
    mock_llm_response = {
        "behavior_category": "aggression_anger",
        "behavior_description": "Patient hit sister Karen during dinner",
        "intervention_description": "Called Dr. Patel",
        "intervention_outcome": "escalated",
        "field_confidences": {
            "behavior_category": 0.90,
            "antecedent": 0.60,
            "intervention": 0.85,
            "outcome": 0.80,
        },
        "overall_confidence": 0.85,
    }

    with patch(
        "app.services.incident_extractor._call_extraction_llm",
        new_callable=AsyncMock,
        return_value=mock_llm_response,
    ):
        result = await extract_incident_from_conversation(
            conversation_messages=SAMPLE_CONVERSATION,
            profile=SAMPLE_PROFILE,
            patient_name="Mom",
        )

    assert result is not None
    assert "Karen" not in result["behavior_description"]
    assert "Patel" not in result["intervention_description"]
