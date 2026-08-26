"""Behavioral insights endpoint — per-profile pattern data (auth required)."""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import distinct, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.conversation import Conversation
from app.models.profile import Profile
from app.models.profile_insights import ProfileInsights
from app.schemas.insights import InsightsPayload, InsightsResponse
from app.schemas.profile import ErrorResponse
from app.services.auth import hash_access_code
from app.services.crypto import decrypt

logger = logging.getLogger(__name__)
router = APIRouter(tags=["insights"])


@router.get(
    "/insights/{access_code}",
    response_model=InsightsResponse,
    responses={404: {"model": ErrorResponse}},
)
async def get_insights(
    access_code: str,
    db: AsyncSession = Depends(get_session),
):
    """Return behavioral pattern insights for the caregiver's profile."""
    code_hash = hash_access_code(access_code)
    profile_result = await db.execute(
        select(Profile).where(Profile.access_code_hash == code_hash)
    )
    profile = profile_result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
        )

    insights_result = await db.execute(
        select(ProfileInsights).where(ProfileInsights.profile_id == profile.id)
    )
    row = insights_result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "No insights yet — keep using CalmGuide", "code": "NO_INSIGHTS"},
        )

    payload_dict = json.loads(decrypt(row.insights_json))
    return InsightsResponse(
        profile_id=profile.id,
        computed_at=row.computed_at.isoformat(),
        insights=InsightsPayload(**payload_dict),
    )


