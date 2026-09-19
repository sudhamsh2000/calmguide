"""Daily behavioral check-in endpoints."""

import json
import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.daily_checkin import DailyCheckin
from app.models.profile import Profile
from app.schemas.checkin_daily import DailyCheckinCreate, DailyCheckinEntry, DailyCheckinStatus
from app.schemas.profile import ErrorResponse
from app.services.auth import hash_access_code
from app.services.crypto import decrypt, encrypt

logger = logging.getLogger(__name__)
router = APIRouter(tags=["daily_checkin"])


async def _get_profile(access_code: str, db: AsyncSession) -> Profile:
    code_hash = hash_access_code(access_code)
    result = await db.execute(select(Profile).where(Profile.access_code_hash == code_hash))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
        )
    return profile


@router.post(
    "/checkin/daily",
    status_code=201,
    responses={404: {"model": ErrorResponse}},
)
async def submit_daily_checkin(
    payload: DailyCheckinCreate,
    db: AsyncSession = Depends(get_session),
):
    """Submit a daily behavioral log entry."""
    profile = await _get_profile(payload.access_code, db)

    checkin = DailyCheckin(
        profile_id=profile.id,
        check_date=date.today(),
        severity=payload.severity,
        time_slot=payload.time_slot,
        tags=encrypt(json.dumps(payload.tags)) if payload.tags else None,
    )
    db.add(checkin)
    await db.commit()
    await db.refresh(checkin)

    return {"id": checkin.id}


@router.get(
    "/checkin/daily/{access_code}/today",
    response_model=DailyCheckinStatus,
    responses={404: {"model": ErrorResponse}},
)
async def get_today_status(
    access_code: str,
    db: AsyncSession = Depends(get_session),
):
    """Check if today's check-in exists."""
    profile = await _get_profile(access_code, db)

    result = await db.execute(
        select(DailyCheckin)
        .where(
            DailyCheckin.profile_id == profile.id,
            DailyCheckin.check_date == date.today(),
        )
        .order_by(DailyCheckin.created_at)
    )
    entries = result.scalars().all()

    return DailyCheckinStatus(
        checked_in=len(entries) > 0,
        entries=[
            DailyCheckinEntry(
                id=e.id,
                check_date=str(e.check_date),
                severity=e.severity,
                time_slot=e.time_slot,
                tags=json.loads(decrypt(e.tags)) if e.tags else [],
                created_at=e.created_at.isoformat(),
            )
            for e in entries
        ],
    )


@router.get(
    "/checkin/daily/{access_code}/history",
    response_model=DailyCheckinStatus,
    responses={404: {"model": ErrorResponse}},
)
async def get_history(
    access_code: str,
    days: int = Query(7, ge=1, le=31),
    db: AsyncSession = Depends(get_session),
):
    """Recent check-ins, for the caregiver's own weekly view.

    The `/today` endpoint above answers a different question — "has she
    checked in yet today?" — and filters to a single date, so it cannot
    back a trend over a week. Read-only, scoped to one profile by access
    code exactly as `/today` is, and capped at a month so it can never be
    used to pull an unbounded history.
    """
    profile = await _get_profile(access_code, db)
    since = date.today() - timedelta(days=days - 1)

    result = await db.execute(
        select(DailyCheckin)
        .where(
            DailyCheckin.profile_id == profile.id,
            DailyCheckin.check_date >= since,
        )
        .order_by(DailyCheckin.check_date, DailyCheckin.created_at)
    )
    entries = result.scalars().all()

    return DailyCheckinStatus(
        checked_in=any(e.check_date == date.today() for e in entries),
        entries=[
            DailyCheckinEntry(
                id=e.id,
                check_date=str(e.check_date),
                severity=e.severity,
                time_slot=e.time_slot,
                tags=json.loads(decrypt(e.tags)) if e.tags else [],
                created_at=e.created_at.isoformat(),
            )
            for e in entries
        ],
    )
