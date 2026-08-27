"""Health check endpoint."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.services.availability import get_llm_status
from app.services.response_timing import get_timing_stats

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(response: Response, session: AsyncSession = Depends(get_session)):
    """Readiness probe.

    Returns 503 when a hard dependency (the DB) is down so orchestrators stop
    routing traffic to a broken instance. The DB is the only thing that gates
    the HTTP status code: the deterministic safety gate and the
    coach/checkin LLM-failure fallback (`get_localized_fallback`) both still
    work with the LLM unreachable, so we don't want load balancers pulling an
    otherwise-functional instance out of rotation just because the LLM
    provider is degraded — callers that care about that should read the
    `llm` field instead of the HTTP status.

    `llm` reflects `app.services.availability`'s in-process, recent-outcome
    tracker (not a live probe — see that module's docstring for why, and its
    per-process-state caveat for multi-instance deployments):
    - "available" — recent LLM calls are succeeding
    - "degraded" — recent LLM calls are failing above threshold
    - "unknown" — not enough recent traffic to tell yet

    `timing` reflects `app.services.response_timing`'s in-process rolling
    p50/p95 latency window (LLM time-to-first-chunk/total, RAG retrieval
    duration). Same per-process caveat as `llm` above; informational only,
    never gates the HTTP status code. A metric with no recent traffic
    reports `"samples": 0` and `null` percentiles rather than an error.
    """
    db_status = "connected"
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    db_healthy = db_status == "connected"
    if not db_healthy:
        response.status_code = 503

    llm_status = get_llm_status()
    overall = "unhealthy" if not db_healthy else ("degraded" if llm_status == "degraded" else "healthy")

    return {
        "status": overall,
        "database": db_status,
        "llm": llm_status,
        "timing": get_timing_stats(),
    }
