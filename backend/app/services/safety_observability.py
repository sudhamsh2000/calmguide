"""In-process Safety Gate v2 observability — Phase 7 (docs/SAFETY_GATE_V2_PLAN.md).

Fourth companion to `app.services.availability` (LLM success/failure),
`app.services.response_timing` (latency), and `app.services.token_usage`
(cost) — same scope decision as all three: an in-memory, per-process
counter set, not a metrics store or a database table. `/health` surfaces it
for visibility; nothing here gates the HTTP status code or changes routing
behavior. Back this with a real metrics backend (Prometheus, Datadog, etc.)
before relying on it across instances or for alerting.

Counters here are cumulative since process start, not a rolling window —
unlike the three siblings above, these are categorical tallies ("how many
EMERGENCY decisions has this process made"), where a running total is more
useful than a recent-window percentile.

Every recording function takes only categorical labels, booleans, and
counts — exactly the same restriction `app.services.safety_log.SafetyEvent`
already enforces on its own `details` field. Never pass a caregiver's
message text, a patient name, or any decrypted profile content into this
module.
"""

from collections import Counter
from threading import Lock

_lock = Lock()

_risk_level_counts: Counter[str] = Counter()
_category_counts: Counter[str] = Counter()
_action_counts: Counter[str] = Counter()
_source_counts: Counter[str] = Counter()

_rag_requested = 0
_rag_skipped_due_to_safety = 0
_llm_skipped_due_to_safety = 0

_rag_available_count = 0
_rag_unavailable_count = 0
_rag_retrieval_success_count = 0
_rag_chunks_retrieved_total = 0

_llm_provider_counts: Counter[str] = Counter()
_llm_failover_used_count = 0

_response_guard_repair_used_count = 0
_static_fallback_used_count = 0


def record_safety_decision(
    *, risk_level: str, category: str | None, action: str, source: str, rag_requested: bool
) -> None:
    """Called once per Safety Gate v2 decision (coach.py/checkin.py, right
    after `evaluate_safety_v2`). `rag_requested` is whether the decision
    allowed RAG to run at all — this is what `rag_skipped_due_to_safety`
    and `llm_skipped_due_to_safety` are computed from, not a separate,
    independently-settable flag, so the two can never drift apart from
    what the router actually did.
    """
    with _lock:
        _risk_level_counts[risk_level] += 1
        _category_counts[category or "none"] += 1
        _action_counts[action] += 1
        _source_counts[source] += 1
        global _rag_requested, _rag_skipped_due_to_safety, _llm_skipped_due_to_safety
        if rag_requested:
            _rag_requested += 1
        else:
            _rag_skipped_due_to_safety += 1
            _llm_skipped_due_to_safety += 1


def record_rag_outcome(*, available: bool, chunk_count: int = 0) -> None:
    """Called from coach.py's `_fetch_rag_context` — `available=False` is
    the except branch (RAG unreachable/misconfigured, not "zero results"),
    matching that function's own success/failure convention.
    `chunk_count` is only meaningful when `available` is True.
    """
    with _lock:
        global _rag_available_count, _rag_unavailable_count
        global _rag_retrieval_success_count, _rag_chunks_retrieved_total
        if available:
            _rag_available_count += 1
            if chunk_count > 0:
                _rag_retrieval_success_count += 1
                _rag_chunks_retrieved_total += chunk_count
        else:
            _rag_unavailable_count += 1


def record_llm_provider_used(*, provider: str, failover_used: bool) -> None:
    """Called after a successful LLM call completes. `provider` is which
    provider actually served the request (e.g. "openai", "anthropic");
    `failover_used=True` means the primary failed and the secondary served
    it instead (see `app.services.fallback_provider.FallbackLLMProvider`).
    """
    with _lock:
        _llm_provider_counts[provider] += 1
        global _llm_failover_used_count
        if failover_used:
            _llm_failover_used_count += 1


def record_response_guard_repair_used() -> None:
    """Called when `response_guard.guard_response_text` was invoked (a
    streamed response failed `validate_response_quality` and needed an LLM
    repair pass)."""
    with _lock:
        global _response_guard_repair_used_count
        _response_guard_repair_used_count += 1


def record_static_fallback_used() -> None:
    """Called when `response_guard.get_localized_fallback` was the actual
    text sent to the caregiver (LLM stream failed entirely, or a repair
    attempt also failed validation)."""
    with _lock:
        global _static_fallback_used_count
        _static_fallback_used_count += 1


def reset() -> None:
    """Test/ops helper — clear all counters."""
    with _lock:
        _risk_level_counts.clear()
        _category_counts.clear()
        _action_counts.clear()
        _source_counts.clear()
        global _rag_requested, _rag_skipped_due_to_safety, _llm_skipped_due_to_safety
        global _rag_available_count, _rag_unavailable_count
        global _rag_retrieval_success_count, _rag_chunks_retrieved_total
        global _llm_failover_used_count
        global _response_guard_repair_used_count, _static_fallback_used_count
        _rag_requested = 0
        _rag_skipped_due_to_safety = 0
        _llm_skipped_due_to_safety = 0
        _rag_available_count = 0
        _rag_unavailable_count = 0
        _rag_retrieval_success_count = 0
        _rag_chunks_retrieved_total = 0
        _llm_provider_counts.clear()
        _llm_failover_used_count = 0
        _response_guard_repair_used_count = 0
        _static_fallback_used_count = 0


def get_safety_observability_stats() -> dict[str, object]:
    """Cumulative-since-start counters, informational only. See module
    docstring for the per-process caveat shared with its three siblings."""
    with _lock:
        return {
            "safety_decisions": {
                "by_risk_level": dict(_risk_level_counts),
                "by_category": dict(_category_counts),
                "by_action": dict(_action_counts),
                "by_source": dict(_source_counts),
            },
            "rag": {
                "requested": _rag_requested,
                "skipped_due_to_safety": _rag_skipped_due_to_safety,
                "available": _rag_available_count,
                "unavailable": _rag_unavailable_count,
                "retrieval_success": _rag_retrieval_success_count,
                "chunks_retrieved_total": _rag_chunks_retrieved_total,
            },
            "llm": {
                "skipped_due_to_safety": _llm_skipped_due_to_safety,
                "by_provider": dict(_llm_provider_counts),
                "failover_used": _llm_failover_used_count,
            },
            "response_guard": {
                "repair_used": _response_guard_repair_used_count,
                "static_fallback_used": _static_fallback_used_count,
            },
        }
