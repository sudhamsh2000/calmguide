"""Lightweight per-IP rate limiting for expensive (LLM) endpoints.

Protects against cost-exhaustion / DoS where one client floods the LLM
endpoints. This is an IN-PROCESS sliding window: it is per-worker and does not
coordinate across replicas — for multi-instance deployments back it with Redis.
"""

import itertools
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.config import get_settings

# scope:ip -> deque of monotonic request timestamps
_BUCKETS: dict[str, deque] = defaultdict(deque)


# Sweep at most this many buckets per request, so eviction stays O(1)-ish
# regardless of how many distinct clients have been seen.
_EVICTION_SCAN_LIMIT = 32


def _evict_idle_buckets(cutoff: float, keep: str) -> None:
    """Drop buckets whose newest entry has aged out of the window.

    Every distinct client IP created a permanent dict entry, so an internet-
    facing deployment leaked memory in proportion to the number of addresses
    that had ever touched an LLM endpoint.
    """
    stale = []
    for key, bucket in itertools.islice(_BUCKETS.items(), _EVICTION_SCAN_LIMIT):
        if key == keep:
            continue
        if not bucket or bucket[-1] < cutoff:
            stale.append(key)
    for key in stale:
        _BUCKETS.pop(key, None)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(scope: str, max_requests: int | None = None, window_seconds: float = 60.0):
    """Build a FastAPI dependency that throttles `scope` per client IP.

    `max_requests` defaults to RATE_LIMIT_PER_MINUTE. Honoring the global
    RATE_LIMIT_ENABLED flag lets tests disable it deterministically.
    """

    async def dependency(request: Request) -> None:
        settings = get_settings()
        if not settings.RATE_LIMIT_ENABLED:
            return
        limit = max_requests if max_requests is not None else settings.RATE_LIMIT_PER_MINUTE
        key = f"{scope}:{_client_ip(request)}"
        bucket = _BUCKETS[key]
        now = time.monotonic()
        cutoff = now - window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        _evict_idle_buckets(cutoff, keep=key)
        if len(bucket) >= limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Too many requests. Please wait a moment and try again.",
                    "code": "RATE_LIMITED",
                },
            )
        bucket.append(now)

    return dependency
