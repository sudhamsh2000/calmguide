"""Helper for writing structured, categorical-only `SafetyEvent` rows.

Opens its own short-lived DB session rather than reusing a request-scoped
one, so it is safe to call from detached background tasks (the same pattern
`coach.py` uses for post-stream persistence) as well as directly from request
handlers that have no long-lived profile-scoped session (e.g. checkin.py).

Callers must never pass raw caregiver-authored free text in `details` — only
categorical labels (flag names, matched concept labels, booleans).
"""

import logging

from app.db import get_session_factory
from app.models.safety_event import SafetyEvent

logger = logging.getLogger(__name__)


async def log_safety_event(
    *,
    event_type: str,
    source: str,
    category: str | None = None,
    profile_id: str | None = None,
    session_id: str | None = None,
    staff_id: str | None = None,
    facility_id: str | None = None,
    locale_code: str | None = None,
    model_provider: str | None = None,
    confidence: float | None = None,
    details: dict | None = None,
) -> None:
    try:
        factory = get_session_factory()
        async with factory() as db_session:
            db_session.add(
                SafetyEvent(
                    event_type=event_type,
                    source=source,
                    category=category,
                    profile_id=profile_id,
                    session_id=session_id,
                    staff_id=staff_id,
                    facility_id=facility_id,
                    locale_code=locale_code,
                    model_provider=model_provider,
                    confidence=confidence,
                    details=details,
                )
            )
            await db_session.commit()
    except Exception:
        logger.exception("Failed to write safety event (event_type=%s)", event_type)
