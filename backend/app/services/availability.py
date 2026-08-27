"""In-process LLM availability tracker — degraded-mode scaffolding.

Tracks recent LLM call outcomes (recorded by the coach/checkin routers on
every real request) so `/health` can report a `"degraded"` state when the
LLM provider is failing, without spending a request/API call just to probe
it on every health check.

This is deliberately simple: an in-memory sliding window of recent
successes/failures per process, not a distributed circuit breaker. Like
`RATE_LIMIT_ENABLED` in `app/config.py`, this state is per-process — in a
multi-instance deployment each worker tracks its own view of LLM health,
and a load balancer's health check only reflects the instance it happens to
hit. Back this with a shared store (Redis, etc.) before relying on it for
automated failover across instances.

Degraded-mode client behavior does not depend on this tracker: the
deterministic safety gate (`app.services.safety_gate.check_safety_gate`)
already runs before any LLM call and works regardless of LLM availability,
and `app.services.response_guard.get_localized_fallback` already gives
callers a safe static response when the LLM stream fails. This tracker only
adds *visibility* into that failure state for monitoring/`/health`.
"""

import time
from collections import deque
from dataclasses import dataclass
from threading import Lock

# How many of the most recent LLM calls to consider.
_WINDOW_SIZE = 20
# Minimum number of calls in the window before we're willing to call it
# "degraded" — avoids a single cold-start failure flipping the status.
_MIN_SAMPLES = 3
# Fraction of failures within the window that counts as degraded.
_FAILURE_THRESHOLD = 0.5
# A failure record older than this is treated as stale and ignored, so a
# transient outage that has already recovered doesn't linger as "degraded"
# just because no new traffic has arrived to push it out of the window.
_STALE_AFTER_SECONDS = 300.0


@dataclass(frozen=True, slots=True)
class _Outcome:
    ok: bool
    at: float


_lock = Lock()
_recent: deque[_Outcome] = deque(maxlen=_WINDOW_SIZE)


def record_llm_success() -> None:
    with _lock:
        _recent.append(_Outcome(ok=True, at=time.monotonic()))


def record_llm_failure() -> None:
    with _lock:
        _recent.append(_Outcome(ok=False, at=time.monotonic()))


def reset() -> None:
    """Test/ops helper — clear all tracked outcomes."""
    with _lock:
        _recent.clear()


def get_llm_status() -> str:
    """Returns "available", "degraded", or "unknown" (no recent samples)."""
    now = time.monotonic()
    with _lock:
        samples = [o for o in _recent if now - o.at <= _STALE_AFTER_SECONDS]

    if len(samples) < _MIN_SAMPLES:
        return "unknown"

    failure_rate = sum(1 for o in samples if not o.ok) / len(samples)
    return "degraded" if failure_rate >= _FAILURE_THRESHOLD else "available"
