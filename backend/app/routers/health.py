"""Health check endpoint."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(response: Response, session: AsyncSession = Depends(get_session)):
    """Readiness probe. Returns 503 when a hard dependency (the DB) is down so
    orchestrators stop routing traffic to a broken instance."""
    db_status = "connected"
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    healthy = db_status == "connected"
    if not healthy:
        response.status_code = 503

    return {"status": "healthy" if healthy else "unhealthy", "database": db_status}
