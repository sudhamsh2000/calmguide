"""Safety Gate v2 Phase 7 — observability counter tests.

Scope: app.services.safety_observability is a pure in-process counter
module (no DB, no schema) — these tests verify the counters increment
correctly and never accept anything but categorical labels/booleans/counts.
"""

import pytest

from app.services import safety_observability as so


@pytest.fixture(autouse=True)
def _reset():
    so.reset()
    yield
    so.reset()


def test_empty_state_has_zeroed_counters():
    stats = so.get_safety_observability_stats()
    assert stats["safety_decisions"]["by_risk_level"] == {}
    assert stats["rag"]["requested"] == 0
    assert stats["rag"]["skipped_due_to_safety"] == 0
    assert stats["llm"]["skipped_due_to_safety"] == 0
    assert stats["llm"]["by_provider"] == {}
    assert stats["llm"]["failover_used"] == 0
    assert stats["response_guard"]["repair_used"] == 0
    assert stats["response_guard"]["static_fallback_used"] == 0


def test_record_safety_decision_low_risk_counts_as_rag_requested():
    so.record_safety_decision(
        risk_level="low",
        category="routine_caregiver_issue",
        action="normal_guidance",
        source="none",
        rag_requested=True,
    )
    stats = so.get_safety_observability_stats()
    assert stats["safety_decisions"]["by_risk_level"] == {"low": 1}
    assert stats["safety_decisions"]["by_category"] == {"routine_caregiver_issue": 1}
    assert stats["rag"]["requested"] == 1
    assert stats["rag"]["skipped_due_to_safety"] == 0
    assert stats["llm"]["skipped_due_to_safety"] == 0


def test_record_safety_decision_emergency_counts_as_skipped():
    so.record_safety_decision(
        risk_level="emergency",
        category="life_threat",
        action="emergency_escalation",
        source="deterministic_gate",
        rag_requested=False,
    )
    stats = so.get_safety_observability_stats()
    assert stats["safety_decisions"]["by_risk_level"] == {"emergency": 1}
    assert stats["rag"]["requested"] == 0
    assert stats["rag"]["skipped_due_to_safety"] == 1
    assert stats["llm"]["skipped_due_to_safety"] == 1


def test_record_safety_decision_with_none_category():
    so.record_safety_decision(
        risk_level="low", category=None, action="normal_guidance", source="none", rag_requested=True
    )
    stats = so.get_safety_observability_stats()
    assert stats["safety_decisions"]["by_category"] == {"none": 1}


def test_multiple_decisions_accumulate_across_calls():
    for _ in range(3):
        so.record_safety_decision(
            risk_level="low",
            category="routine_caregiver_issue",
            action="normal_guidance",
            source="none",
            rag_requested=True,
        )
    so.record_safety_decision(
        risk_level="emergency",
        category="self_harm",
        action="emergency_escalation",
        source="classifier",
        rag_requested=False,
    )
    stats = so.get_safety_observability_stats()
    assert stats["safety_decisions"]["by_risk_level"] == {"low": 3, "emergency": 1}
    assert stats["rag"]["requested"] == 3
    assert stats["rag"]["skipped_due_to_safety"] == 1


def test_record_rag_outcome_available_with_chunks():
    so.record_rag_outcome(available=True, chunk_count=3)
    so.record_rag_outcome(available=True, chunk_count=2)
    stats = so.get_safety_observability_stats()
    assert stats["rag"]["available"] == 2
    assert stats["rag"]["retrieval_success"] == 2
    assert stats["rag"]["chunks_retrieved_total"] == 5


def test_record_rag_outcome_available_but_empty_is_not_a_success():
    so.record_rag_outcome(available=True, chunk_count=0)
    stats = so.get_safety_observability_stats()
    assert stats["rag"]["available"] == 1
    assert stats["rag"]["retrieval_success"] == 0
    assert stats["rag"]["chunks_retrieved_total"] == 0


def test_record_rag_outcome_unavailable():
    so.record_rag_outcome(available=False)
    stats = so.get_safety_observability_stats()
    assert stats["rag"]["unavailable"] == 1
    assert stats["rag"]["available"] == 0


def test_record_llm_provider_used_tracks_by_provider_and_failover():
    so.record_llm_provider_used(provider="OpenAIProvider", failover_used=False)
    so.record_llm_provider_used(provider="AnthropicProvider", failover_used=True)
    stats = so.get_safety_observability_stats()
    assert stats["llm"]["by_provider"] == {"OpenAIProvider": 1, "AnthropicProvider": 1}
    assert stats["llm"]["failover_used"] == 1


def test_record_response_guard_usage():
    so.record_response_guard_repair_used()
    so.record_response_guard_repair_used()
    so.record_static_fallback_used()
    stats = so.get_safety_observability_stats()
    assert stats["response_guard"]["repair_used"] == 2
    assert stats["response_guard"]["static_fallback_used"] == 1


def test_reset_clears_everything():
    so.record_safety_decision(
        risk_level="emergency",
        category="life_threat",
        action="emergency_escalation",
        source="deterministic_gate",
        rag_requested=False,
    )
    so.record_rag_outcome(available=True, chunk_count=5)
    so.record_llm_provider_used(provider="OpenAIProvider", failover_used=False)
    so.record_response_guard_repair_used()
    so.record_static_fallback_used()
    so.reset()
    stats = so.get_safety_observability_stats()
    assert stats["safety_decisions"]["by_risk_level"] == {}
    assert stats["rag"]["available"] == 0
    assert stats["llm"]["by_provider"] == {}
    assert stats["response_guard"]["repair_used"] == 0
    assert stats["response_guard"]["static_fallback_used"] == 0
