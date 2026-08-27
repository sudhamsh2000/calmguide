"""In-process response-timing tracker — latency visibility, not alerting.

Companion to `app.services.availability` (which tracks *whether* recent LLM
calls succeeded). This module tracks *how long* things took: time-to-first
streamed chunk and total stream duration for LLM calls, plus RAG retrieval
duration. Callers (the coach/checkin routers) record a sample after each
successful stream; `/health` surfaces rolling p50/p95 aggregates for
visibility, informational only, same as `availability.get_llm_status()` — it
never gates the HTTP status code.

Deliberately simple, matching `availability.py`'s scope decision: an
in-memory, fixed-size window of recent durations per process, not a
distributed metrics store. Like `RATE_LIMIT_ENABLED` in `app/config.py` and
`availability.py`'s tracker, this state is per-process — in a multi-instance
deployment each worker only sees the requests it personally handled. Back
this with a real metrics backend (Prometheus, Datadog, etc.) before relying
on it for capacity planning or SLOs across instances.

Only successful calls are recorded. A failed LLM stream's "duration" (which
could be anything from an instant connection refusal to a long timeout) is
not a meaningful latency sample and would skew percentiles without adding
signal; `availability.py` already tracks failure *rate* separately.
"""

import time
from collections import deque
from dataclasses import dataclass
from threading import Lock

# How many of the most recent samples to keep per metric.
_WINDOW_SIZE = 200

_lock = Lock()
_llm_ttfc_ms: deque[float] = deque(maxlen=_WINDOW_SIZE)
_llm_total_ms: deque[float] = deque(maxlen=_WINDOW_SIZE)
_rag_ms: deque[float] = deque(maxlen=_WINDOW_SIZE)


@dataclass(frozen=True, slots=True)
class TimingSample:
    """A single response-timing measurement, in milliseconds."""

    time_to_first_chunk_ms: float
    total_ms: float


def record_llm_timing(time_to_first_chunk_ms: float, total_ms: float) -> None:
    """Record one successful LLM stream's timing.

    `time_to_first_chunk_ms` is wall-clock time from the call starting to
    the first chunk arriving (proxy for perceived responsiveness);
    `total_ms` is the full stream duration.
    """
    with _lock:
        _llm_ttfc_ms.append(time_to_first_chunk_ms)
        _llm_total_ms.append(total_ms)


def record_rag_timing(duration_ms: float) -> None:
    """Record one RAG context-retrieval call's duration (success or empty-result;
    callers should not call this for the "RAG unavailable" exception path,
    mirroring the LLM timing's success-only convention above)."""
    with _lock:
        _rag_ms.append(duration_ms)


def reset() -> None:
    """Test/ops helper — clear all tracked samples."""
    with _lock:
        _llm_ttfc_ms.clear()
        _llm_total_ms.clear()
        _rag_ms.clear()


def _percentile(samples: list[float], pct: float) -> float | None:
    """Nearest-rank percentile over a small in-memory sample set.

    Not interpolated — fine for a rough, informational /health signal over
    at most `_WINDOW_SIZE` samples; not meant for precision SLO reporting.
    """
    if not samples:
        return None
    ordered = sorted(samples)
    idx = max(0, min(len(ordered) - 1, round(pct * (len(ordered) - 1))))
    return ordered[idx]


def _stats_for(samples: deque[float]) -> dict[str, float | int | None]:
    values = list(samples)
    return {
        "p50_ms": _percentile(values, 0.50),
        "p95_ms": _percentile(values, 0.95),
        "samples": len(values),
    }


def get_timing_stats() -> dict[str, dict[str, dict[str, float | int | None]]]:
    """Rolling p50/p95 latency stats, informational only.

    Returns `{"samples": 0, ...}` sub-objects (percentiles `None`) for any
    metric with no recent traffic — callers should treat that the same way
    `availability.get_llm_status()`'s `"unknown"` is treated: not enough
    signal yet, not a fault.
    """
    with _lock:
        ttfc = deque(_llm_ttfc_ms)
        total = deque(_llm_total_ms)
        rag = deque(_rag_ms)

    return {
        "llm": {
            "time_to_first_chunk": _stats_for(ttfc),
            "total": _stats_for(total),
        },
        "rag_retrieval": _stats_for(rag),
    }


def time_ms() -> float:
    """`time.monotonic()` in milliseconds — small readability helper for callers."""
    return time.monotonic() * 1000
