"""Public impact showcase endpoint — no authentication required."""

import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.conversation import Conversation
from app.schemas.impact import ImpactResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["impact"])

# 5-minute in-memory cache
_cache: dict = {"data": None, "expires_at": None}


@router.get("/impact", response_model=ImpactResponse)
async def get_impact(db: AsyncSession = Depends(get_session)):
    """Return aggregate impact metrics. Cached for 5 minutes."""
    now = datetime.now(UTC)
    if _cache["data"] and _cache["expires_at"] and now < _cache["expires_at"]:
        return _cache["data"]

    # Families supported — distinct profiles with at least one message
    families_result = await db.execute(select(func.count(func.distinct(Conversation.profile_id))))
    families_count = families_result.scalar() or 0

    # Total distinct coaching sessions
    sessions_result = await db.execute(select(func.count(func.distinct(Conversation.session_id))))
    sessions_count = sessions_result.scalar() or 0

    # Languages served — distinct non-null locale codes
    langs_result = await db.execute(
        select(func.count(func.distinct(Conversation.locale_code))).where(
            Conversation.locale_code.is_not(None)
        )
    )
    langs_count = max(langs_result.scalar() or 0, 1 if sessions_count > 0 else 0)

    # Sessions this week
    week_ago = now - timedelta(days=7)
    week_result = await db.execute(
        select(func.count(func.distinct(Conversation.session_id))).where(
            Conversation.created_at >= week_ago
        )
    )
    week_count = week_result.scalar() or 0

    # Overnight % — try PostgreSQL EXTRACT first, fall back to SQLite strftime
    overnight_pct = 0
    for sql in [
        # PostgreSQL syntax
        "SELECT CAST(ROUND(100.0 * SUM(CASE WHEN EXTRACT(HOUR FROM created_at) < 6 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) AS INTEGER) FROM (SELECT session_id, MIN(created_at) as created_at FROM conversations WHERE role = 'user' GROUP BY session_id) s",
        # SQLite syntax (tests)
        "SELECT CAST(ROUND(100.0 * SUM(CASE WHEN CAST(strftime('%H', created_at) AS INTEGER) < 6 THEN 1 ELSE 0 END) / MAX(COUNT(*), 1)) AS INTEGER) FROM (SELECT session_id, MIN(created_at) as created_at FROM conversations WHERE role = 'user' GROUP BY session_id) s",
    ]:
        try:
            result = await db.execute(text(sql))
            val = result.scalar()
            overnight_pct = int(val) if val is not None else 0
            break
        except Exception:
            continue

    data = ImpactResponse(
        families_supported=families_count,
        coached_sessions=sessions_count,
        languages_served=langs_count,
        overnight_pct=overnight_pct,
        sessions_this_week=week_count,
    )
    _cache["data"] = data
    _cache["expires_at"] = now + timedelta(minutes=5)
    return data
