"""Profile CRUD and access code management."""

import json
import secrets
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.behavioral_dossier import BehavioralDossier
from app.models.care_change_event import CareChangeEvent
from app.models.conversation import Conversation
from app.models.daily_checkin import DailyCheckin
from app.models.facility_patient_link import FacilityPatientLink
from app.models.incident import Incident
from app.models.profile import Profile
from app.models.profile_insights import ProfileInsights
from app.models.response_feedback import ResponseFeedback
from app.models.safety_event import SafetyEvent
from app.models.staff_patient_assignment import StaffPatientAssignment
from app.services.auth import hash_access_code
from app.services.crypto import decrypt, encrypt
from app.schemas.profile import (
    ErrorResponse,
    ProfileCreate,
    ProfileCreateResponse,
    ProfileResponse,
    ProfileUpdate,
)

router = APIRouter(tags=["profiles"])


def _safe_decrypt_list(encrypted: str) -> list[str]:
    try:
        return json.loads(decrypt(encrypted))
    except (json.JSONDecodeError, Exception):
        return []

# Characters for access codes — exclude ambiguous: 0, O, 1, I, L
ACCESS_CODE_ALPHABET = string.ascii_uppercase + string.digits
ACCESS_CODE_ALPHABET = "".join(
    c for c in ACCESS_CODE_ALPHABET if c not in "0O1IL"
)
ACCESS_CODE_LENGTH = 8


def _generate_access_code() -> str:
    return "".join(secrets.choice(ACCESS_CODE_ALPHABET) for _ in range(ACCESS_CODE_LENGTH))


async def _find_profile_by_code(session: AsyncSession, access_code: str) -> Profile | None:
    code_hash = hash_access_code(access_code)
    result = await session.execute(
        select(Profile).where(Profile.access_code_hash == code_hash)
    )
    return result.scalar_one_or_none()


@router.post(
    "/profiles",
    response_model=ProfileCreateResponse,
    status_code=201,
    responses={409: {"model": ErrorResponse}},
)
async def create_profile(
    payload: ProfileCreate,
    session: AsyncSession = Depends(get_session),
):
    # Generate collision-free access code
    for _ in range(10):
        code = _generate_access_code()
        code_hash = hash_access_code(code)
        existing = await session.execute(
            select(Profile).where(Profile.access_code_hash == code_hash)
        )
        if existing.scalar_one_or_none() is None:
            break
    else:
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to generate unique access code", "code": "CODE_GENERATION_FAILED"},
        )

    profile = Profile(
        access_code_hash=code_hash,
        disease_stage=payload.disease_stage,
        behavioral_patterns=encrypt(json.dumps(payload.behavioral_patterns)),
        calming_strategies=encrypt(json.dumps(payload.calming_strategies)),
        safety_concerns=encrypt(json.dumps(payload.safety_concerns)),
    )
    session.add(profile)
    await session.commit()
    await session.refresh(profile)

    return ProfileCreateResponse(
        id=profile.id,
        access_code=code,
        disease_stage=profile.disease_stage,
        behavioral_patterns=_safe_decrypt_list(profile.behavioral_patterns),
        calming_strategies=_safe_decrypt_list(profile.calming_strategies),
        safety_concerns=_safe_decrypt_list(profile.safety_concerns),
        previous_stage=profile.previous_stage,
        stage_changed_at=profile.stage_changed_at.isoformat() if profile.stage_changed_at else None,
    )


@router.get(
    "/profiles/{access_code}",
    response_model=ProfileResponse,
    responses={404: {"model": ErrorResponse}},
)
async def get_profile(
    access_code: str,
    session: AsyncSession = Depends(get_session),
):
    profile = await _find_profile_by_code(session, access_code)
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
        )

    return ProfileResponse(
        id=profile.id,
        disease_stage=profile.disease_stage,
        behavioral_patterns=_safe_decrypt_list(profile.behavioral_patterns),
        calming_strategies=_safe_decrypt_list(profile.calming_strategies),
        safety_concerns=_safe_decrypt_list(profile.safety_concerns),
        previous_stage=profile.previous_stage,
        stage_changed_at=profile.stage_changed_at.isoformat() if profile.stage_changed_at else None,
    )


@router.delete(
    "/profiles/{access_code}",
    status_code=204,
    responses={404: {"model": ErrorResponse}},
)
async def delete_profile(
    access_code: str,
    session: AsyncSession = Depends(get_session),
):
    """Erase a profile and every record in the memory graph keyed to it.

    Auth follows the same access-code lookup already used by GET/PUT on this
    router. Facility-linked profiles (FacilityPatientLink /
    StaffPatientAssignment) are erased too — this endpoint does not add a
    separate facility-admin authorization layer beyond what GET/PUT already
    have, since introducing one would be a bigger auth-model change than the
    hardening pass this endpoint is part of.

    response_feedback has no profile_id column (only conversation_id), so it's
    deleted via a subquery over this profile's conversations.
    """
    profile = await _find_profile_by_code(session, access_code)
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
        )

    conversation_ids = (
        select(Conversation.id).where(Conversation.profile_id == profile.id)
    )
    await session.execute(
        delete(ResponseFeedback).where(
            ResponseFeedback.conversation_id.in_(conversation_ids)
        )
    )
    for model in (
        Conversation,
        BehavioralDossier,
        Incident,
        CareChangeEvent,
        FacilityPatientLink,
        SafetyEvent,
        ProfileInsights,
        DailyCheckin,
        StaffPatientAssignment,
    ):
        await session.execute(delete(model).where(model.profile_id == profile.id))

    await session.execute(delete(Profile).where(Profile.id == profile.id))
    await session.commit()


@router.put(
    "/profiles/{access_code}",
    response_model=ProfileResponse,
    responses={404: {"model": ErrorResponse}},
)
async def update_profile(
    access_code: str,
    payload: ProfileUpdate,
    session: AsyncSession = Depends(get_session),
):
    profile = await _find_profile_by_code(session, access_code)
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
        )

    # Detect stage transition
    if payload.disease_stage != profile.disease_stage:
        profile.previous_stage = profile.disease_stage
        profile.stage_changed_at = datetime.now(timezone.utc)
        profile.disease_stage = payload.disease_stage

        # Mark dossier stale so pre-transition incidents get re-weighted
        dossier_result = await session.execute(
            select(BehavioralDossier).where(
                BehavioralDossier.profile_id == profile.id
            )
        )
        dossier = dossier_result.scalar_one_or_none()
        if dossier:
            dossier.is_stale = True
    else:
        profile.disease_stage = payload.disease_stage

    profile.behavioral_patterns = encrypt(json.dumps(payload.behavioral_patterns))
    profile.calming_strategies = encrypt(json.dumps(payload.calming_strategies))
    profile.safety_concerns = encrypt(json.dumps(payload.safety_concerns))

    await session.commit()
    await session.refresh(profile)

    return ProfileResponse(
        id=profile.id,
        disease_stage=profile.disease_stage,
        behavioral_patterns=_safe_decrypt_list(profile.behavioral_patterns),
        calming_strategies=_safe_decrypt_list(profile.calming_strategies),
        safety_concerns=_safe_decrypt_list(profile.safety_concerns),
        previous_stage=profile.previous_stage,
        stage_changed_at=profile.stage_changed_at.isoformat() if profile.stage_changed_at else None,
    )
