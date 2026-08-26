"""Care change event CRUD endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.care_change_event import CareChangeEvent
from app.models.behavioral_dossier import BehavioralDossier
from app.models.profile import Profile
from app.schemas.care_change import CareChangeCreate, CareChangeResponse
from app.services.auth import hash_access_code
from app.services.crypto import decrypt, encrypt

router = APIRouter(prefix="/care-changes", tags=["care-changes"])


async def _get_profile(access_code: str, session: AsyncSession) -> Profile:
    code_hash = hash_access_code(access_code)
    result = await session.execute(
        select(Profile).where(Profile.access_code_hash == code_hash)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=404,
            detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
        )
    return profile


@router.post("/{access_code}", status_code=201)
async def create_care_change(
    access_code: str,
    payload: CareChangeCreate,
    session: AsyncSession = Depends(get_session),
):
    profile = await _get_profile(access_code, session)

    event = CareChangeEvent(
        profile_id=profile.id,
        change_date=payload.change_date,
        description=encrypt(payload.description),
        observation_window_days=payload.observation_window_days,
    )
    session.add(event)

    # Mark dossier stale
    dossier_result = await session.execute(
        select(BehavioralDossier).where(
            BehavioralDossier.profile_id == profile.id
        )
    )
    dossier = dossier_result.scalar_one_or_none()
    if dossier:
        dossier.is_stale = True

    await session.commit()
    await session.refresh(event)
    return {"id": event.id}


@router.get("/{access_code}")
async def list_care_changes(
    access_code: str,
    session: AsyncSession = Depends(get_session),
):
    profile = await _get_profile(access_code, session)

    result = await session.execute(
        select(CareChangeEvent)
        .where(CareChangeEvent.profile_id == profile.id)
        .order_by(CareChangeEvent.change_date.desc())
    )
    events = result.scalars().all()

    return {
        "events": [
            CareChangeResponse(
                id=e.id,
                change_date=e.change_date.isoformat(),
                description=decrypt(e.description),
                observation_window_days=e.observation_window_days,
                is_active=e.is_active,
                created_at=e.created_at.isoformat(),
            )
            for e in events
        ]
    }
