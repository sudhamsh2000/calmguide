"""Care pattern and cross-patient strategy endpoints."""

import json
import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.profile import Profile
from app.models.profile_insights import ProfileInsights
from app.schemas.prediction import (
    CarePatternReason,
    CarePatternResponse,
    CrossPatientResponse,
    CrossPatientStrategyEntry,
)
from app.schemas.profile import ErrorResponse
from app.services.auth import hash_access_code
from app.services.cross_patient import get_cohort_strategies
from app.services.crypto import decrypt

logger = logging.getLogger(__name__)
router = APIRouter(tags=["care-patterns"])


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


@router.get(
    "/care-patterns/{access_code}",
    responses={204: {}, 404: {"model": ErrorResponse}},
)
async def get_care_patterns(
    access_code: str,
    db: AsyncSession = Depends(get_session),
):
    """Get what we're noticing about this patient's behavioral patterns."""
    profile = await _get_profile(access_code, db)

    result = await db.execute(
        select(ProfileInsights).where(ProfileInsights.profile_id == profile.id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return Response(status_code=204)

    insights = json.loads(decrypt(row.insights_json))

    care_level = insights.get("care_level")
    if not care_level or care_level == "stable":
        return Response(status_code=204)

    cycle = insights.get("episode_cycle", {})
    reason = CarePatternReason(
        type="cycle" if cycle.get("detected") else "trend",
        avg_interval_days=cycle.get("avg_interval_days"),
        days_since_last=None,
    )

    if cycle.get("last_episode_date"):
        last = date.fromisoformat(cycle["last_episode_date"])
        reason.days_since_last = (date.today() - last).days

    top_strategies = insights.get("top_strategies_for_context", [])

    cross = insights.get("cross_patient_boost")
    cross_data = None
    if cross and cross.get("strategies"):
        top = cross["strategies"][0] if cross["strategies"] else None
        if top:
            cross_data = {
                "cohort_size": cross["cohort_size"],
                "top_strategy": top["tag"],
                "top_strategy_rate": top["rate"],
            }

    return CarePatternResponse(
        care_level=care_level,
        reason=reason,
        top_strategies=top_strategies,
        cross_patient=cross_data,
    )


@router.get(
    "/strategies/{access_code}",
    responses={204: {}, 404: {"model": ErrorResponse}},
)
async def get_strategies(
    access_code: str,
    db: AsyncSession = Depends(get_session),
):
    """Get cross-patient strategy recommendations for this profile's cohort."""
    profile = await _get_profile(access_code, db)

    result = await db.execute(
        select(ProfileInsights).where(ProfileInsights.profile_id == profile.id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return Response(status_code=204)

    insights = json.loads(decrypt(row.insights_json))
    peak_time = insights.get("peak_time", "evening")
    cohort_key = f"{profile.disease_stage}:{peak_time}"

    strategies = await get_cohort_strategies(cohort_key, db)
    if not strategies:
        return Response(status_code=204)

    return CrossPatientResponse(
        cohort=cohort_key,
        cohort_size=strategies[0].get("helped", 0) if strategies else 0,
        strategies=[
            CrossPatientStrategyEntry(tag=s["tag"], helped=s["helped"], rate=s["rate"])
            for s in strategies
        ],
    )
