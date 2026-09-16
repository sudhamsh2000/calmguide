"""Safety Gate v2 Phase 5 — end-to-end routing tests against the live
POST /api/coach/chat endpoint.

Verifies, for a representative message per category: the SSE response
content, whether RAG-query preparation / RAG retrieval / DB-context reads /
normal LLM generation actually ran, and (for short-circuited turns) that
persistence/logging behaved as expected. No prior version of this test
suite covered the safety short-circuit path end-to-end at all — only the
underlying safety_gate.py/safety_classifier.py unit tests did — so this
file is new coverage, not a re-verification of something already tested.
"""

import asyncio
import json

import pytest
from sqlalchemy import select

from app.models.conversation import Conversation
from app.models.safety_event import SafetyEvent
from app.services import safety_observability
from app.services.crypto import decrypt


@pytest.fixture(autouse=True)
def _reset_safety_observability():
    safety_observability.reset()
    yield
    safety_observability.reset()


VALID_PROFILE = {
    "disease_stage": "middle",
    "behavioral_patterns": ["sundowning", "wandering"],
    "calming_strategies": ["soft music", "photo album"],
    "safety_concerns": ["fall risk"],
}


async def _create_profile(client) -> str:
    resp = await client.post("/api/profiles", json=VALID_PROFILE)
    return resp.json()["access_code"]


async def _send(client, access_code: str, message: str) -> tuple[str, list[dict]]:
    """POST a coach message and return (full SSE text-event concatenation,
    all parsed SSE events in order)."""
    resp = await client.post(
        "/api/coach/chat",
        json={"access_code": access_code, "patient_name": "Mom", "message": message},
    )
    events = []
    text_parts = []
    for line in resp.text.splitlines():
        if not line.startswith("data: "):
            continue
        data = line[len("data: ") :]
        if data == "[DONE]":
            continue
        parsed = json.loads(data)
        events.append(parsed)
        if "text" in parsed:
            text_parts.append(parsed["text"])
        elif "replace" in parsed:
            text_parts = [parsed["replace"]]
    return "".join(text_parts), events


@pytest.fixture(autouse=True)
def _spy_rag_and_db(monkeypatch):
    """Spies on the three things Phase 5 must skip for a short-circuited
    turn: the RAG-query LLM call, RAG retrieval itself, and the DB-context
    incident lookup (representative of the dossier/cross-patient/incident
    reads bundled in coach.py's `_db_context`). Returns a dict of call
    counters the tests read after each request.
    """
    calls = {"rag_query": 0, "rag_retrieval": 0, "db_incidents": 0}

    async def fake_build_english_rag_query(llm, *, locale_code, user_text):
        calls["rag_query"] += 1
        return user_text

    async def fake_fetch_rag_context(message):
        calls["rag_retrieval"] += 1
        return ""

    async def fake_get_relevant_incidents(profile_id, query, session):
        calls["db_incidents"] += 1
        return []

    monkeypatch.setattr("app.routers.coach.build_english_rag_query", fake_build_english_rag_query)
    monkeypatch.setattr("app.routers.coach._fetch_rag_context", fake_fetch_rag_context)
    monkeypatch.setattr(
        "app.services.incident_retriever.get_relevant_incidents",
        fake_get_relevant_incidents,
    )
    return calls


# ---------------------------------------------------------------------------
# LOW risk — normal path, everything runs
# ---------------------------------------------------------------------------


async def test_low_risk_normal_message_runs_full_pipeline(client, mock_llm, _spy_rag_and_db):
    code = await _create_profile(client)
    text, events = await _send(client, code, "She is trying to leave the house at 3am")

    assert text == "This is a test response."
    assert mock_llm.last_stream_system_prompt is not None
    assert _spy_rag_and_db["rag_query"] == 1
    assert _spy_rag_and_db["rag_retrieval"] == 1
    assert _spy_rag_and_db["db_incidents"] == 1


async def test_benign_medication_mention_runs_full_pipeline(client, mock_llm, _spy_rag_and_db):
    code = await _create_profile(client)
    text, _ = await _send(client, code, "he takes donepezil")
    assert text == "This is a test response."
    assert mock_llm.last_stream_system_prompt is not None
    assert _spy_rag_and_db["rag_retrieval"] == 1


async def test_benign_passed_out_flyers_runs_full_pipeline(client, mock_llm, _spy_rag_and_db):
    code = await _create_profile(client)
    text, _ = await _send(client, code, "I passed out flyers for the caregiver support group today")
    assert text == "This is a test response."
    assert mock_llm.last_stream_system_prompt is not None


async def test_benign_what_to_do_runs_full_pipeline(client, mock_llm, _spy_rag_and_db):
    code = await _create_profile(client)
    text, _ = await _send(client, code, "he keeps wandering at night and I don't know what to do")
    assert text == "This is a test response."
    assert mock_llm.last_stream_system_prompt is not None


# ---------------------------------------------------------------------------
# MODERATE (medication_risk) — proceeds through normal generation
# ---------------------------------------------------------------------------


async def test_medication_management_request_still_runs_normal_generation(
    client, mock_llm, _spy_rag_and_db
):
    code = await _create_profile(client)
    text, _ = await _send(client, code, "should I increase his dose?")
    # MODERATE does not skip generation — the existing system prompt is
    # relied on to refuse dosing advice, so the mock's canned response
    # still comes back exactly as it would for any normal request.
    assert text == "This is a test response."
    assert mock_llm.last_stream_system_prompt is not None
    assert _spy_rag_and_db["rag_retrieval"] == 1
    assert _spy_rag_and_db["db_incidents"] == 1


# ---------------------------------------------------------------------------
# EMERGENCY — deterministic gate / classifier categories
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message,expected_category,expected_snippet",
    [
        ("I want to kill myself", "self_harm", "You are not alone"),
        (
            "I'm afraid I might hurt him, I feel like I'm going to snap",
            "caregiver_harm_risk",
            "Please pause and get support",
        ),
        (
            "the aide hits him and I don't know what to do",
            "elder_abuse_neglect",
            "This is serious",
        ),
        ("he had a hart attak", "life_threat", "medical emergency"),
    ],
)
async def test_emergency_gate_and_classifier_categories_short_circuit(
    client, mock_llm, _spy_rag_and_db, db_session, message, expected_category, expected_snippet
):
    code = await _create_profile(client)
    text, events = await _send(client, code, message)

    assert expected_snippet in text
    assert mock_llm.last_stream_system_prompt is None, "normal LLM generation must be skipped"
    assert _spy_rag_and_db["rag_query"] == 0, "RAG-query LLM call must be skipped"
    assert _spy_rag_and_db["rag_retrieval"] == 0, "RAG retrieval must be skipped"
    assert _spy_rag_and_db["db_incidents"] == 0, "DB-context reads must be skipped"
    assert events[0].get("session_id")

    await asyncio.sleep(0.5)
    await db_session.commit()
    result = await db_session.execute(
        select(Conversation).where(Conversation.role == "assistant", Conversation.is_safety_gate)
    )
    saved = result.scalars().first()
    assert saved is not None
    assert expected_snippet in decrypt(saved.content)

    event_result = await db_session.execute(
        select(SafetyEvent).where(SafetyEvent.category == expected_category)
    )
    assert event_result.scalars().first() is not None


# ---------------------------------------------------------------------------
# EMERGENCY — Phase 5's new independent fine-category detection
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message,expected_category",
    [
        ("can't catch his breath", "breathing_difficulty"),
        ("not responding", "reduced_consciousness"),
        ("fell and hit his head", "fall_or_head_injury"),
    ],
)
async def test_independent_fine_category_detection_short_circuits(
    client, mock_llm, _spy_rag_and_db, db_session, message, expected_category
):
    """These specific phrasings do not trip the old deterministic gate or
    classify_message on their own (Phase 3 finding) — this is the only
    path that makes them escalate end-to-end at all, per Phase 5's
    explicit approval."""
    code = await _create_profile(client)
    text, _ = await _send(client, code, message)

    # All three reuse the existing LIFE_THREAT (911) response text verbatim
    # — no new clinical copy was added for these categories.
    assert "medical emergency" in text
    assert "911" in text
    assert mock_llm.last_stream_system_prompt is None
    assert _spy_rag_and_db["rag_query"] == 0
    assert _spy_rag_and_db["rag_retrieval"] == 0
    assert _spy_rag_and_db["db_incidents"] == 0

    await asyncio.sleep(0.5)
    await db_session.commit()
    event_result = await db_session.execute(
        select(SafetyEvent).where(SafetyEvent.category == expected_category)
    )
    saved_event = event_result.scalars().first()
    assert saved_event is not None
    assert saved_event.source == "category_detector"


# ---------------------------------------------------------------------------
# HIGH — acute_change
# ---------------------------------------------------------------------------


async def test_acute_change_short_circuits_to_advisory_message(
    client, mock_llm, _spy_rag_and_db, db_session
):
    code = await _create_profile(client)
    text, _ = await _send(client, code, "he suddenly seems much more confused")

    assert "This may need a medical check" in text
    assert "screening prompt, not a diagnosis" in text
    assert mock_llm.last_stream_system_prompt is None
    assert _spy_rag_and_db["rag_query"] == 0
    assert _spy_rag_and_db["rag_retrieval"] == 0
    assert _spy_rag_and_db["db_incidents"] == 0

    await asyncio.sleep(0.5)
    await db_session.commit()
    event_result = await db_session.execute(
        select(SafetyEvent).where(SafetyEvent.category == "acute_change")
    )
    saved_event = event_result.scalars().first()
    assert saved_event is not None
    assert saved_event.source == "category_detector"


async def test_acute_change_takes_priority_over_medication_risk_end_to_end(
    client, mock_llm, _spy_rag_and_db
):
    code = await _create_profile(client)
    text, _ = await _send(
        client, code, "he suddenly seems much more confused, should I increase his dose?"
    )
    assert "This may need a medical check" in text
    assert mock_llm.last_stream_system_prompt is None


# ---------------------------------------------------------------------------
# Phase 7 — observability counters actually reflect real requests
# ---------------------------------------------------------------------------


async def test_low_risk_request_records_rag_requested(client, mock_llm, _spy_rag_and_db):
    code = await _create_profile(client)
    await _send(client, code, "She is trying to leave the house at 3am")
    stats = safety_observability.get_safety_observability_stats()
    assert stats["safety_decisions"]["by_risk_level"] == {"low": 1}
    assert stats["rag"]["requested"] == 1
    assert stats["rag"]["skipped_due_to_safety"] == 0
    assert stats["llm"]["skipped_due_to_safety"] == 0


async def test_emergency_request_records_skipped_rag_and_llm(client, mock_llm, _spy_rag_and_db):
    code = await _create_profile(client)
    await _send(client, code, "I want to kill myself")
    stats = safety_observability.get_safety_observability_stats()
    assert stats["safety_decisions"]["by_risk_level"] == {"emergency": 1}
    assert stats["safety_decisions"]["by_category"] == {"self_harm": 1}
    assert stats["rag"]["requested"] == 0
    assert stats["rag"]["skipped_due_to_safety"] == 1
    assert stats["llm"]["skipped_due_to_safety"] == 1


async def test_medication_risk_records_moderate_but_rag_still_requested(
    client, mock_llm, _spy_rag_and_db
):
    code = await _create_profile(client)
    await _send(client, code, "should I increase his dose?")
    stats = safety_observability.get_safety_observability_stats()
    assert stats["safety_decisions"]["by_risk_level"] == {"moderate": 1}
    assert stats["rag"]["requested"] == 1
    assert stats["rag"]["skipped_due_to_safety"] == 0
