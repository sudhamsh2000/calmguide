"""Feedback endpoints — caregiver ratings of coach guidance."""
import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.conversation import Conversation
from app.models.profile import Profile
from app.models.response_feedback import ResponseFeedback
from app.schemas.feedback import (
    FeedbackCreate,
    FeedbackEntry,
    FeedbackResponse,
    FeedbackSkip,
    PendingFeedbackResponse,
    SessionFeedbackResponse,
    PREDEFINED_TAGS,
)
from app.schemas.profile import ErrorResponse
from app.services.auth import hash_access_code
from app.services.crypto import decrypt, encrypt

logger = logging.getLogger(__name__)
router = APIRouter(tags=["feedback"])


async def _get_profile(access_code: str, db: AsyncSession) -> Profile:
    code_hash = hash_access_code(access_code)
    result = await db.execute(
        select(Profile).where(Profile.access_code_hash == code_hash)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
        )
    return profile


async def _validate_conversation(conversation_id: str, profile_id: str, db: AsyncSession) -> Conversation:
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.profile_id == profile_id,
            Conversation.role == "assistant",
        )
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Assistant message not found", "code": "CONVERSATION_NOT_FOUND"},
        )
    return conv


@router.post(
    "/feedback",
    response_model=FeedbackResponse,
    status_code=201,
    responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
)
async def submit_feedback(
    payload: FeedbackCreate,
    db: AsyncSession = Depends(get_session),
):
    """Submit thumbs + tags feedback for a coach response."""
    profile = await _get_profile(payload.access_code, db)
    await _validate_conversation(payload.conversation_id, profile.id, db)

    existing = await db.execute(
        select(ResponseFeedback).where(
            ResponseFeedback.conversation_id == payload.conversation_id
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail={"error": "Feedback already submitted", "code": "DUPLICATE_FEEDBACK"},
        )

    feedback = ResponseFeedback(
        conversation_id=payload.conversation_id,
        helpful=payload.helpful,
        tags=encrypt(json.dumps(payload.tags)) if payload.tags else None,
        negative_reasons=encrypt(json.dumps(payload.negative_reasons)) if payload.negative_reasons else None,
        source="home",
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    return FeedbackResponse(id=feedback.id)


@router.post(
    "/feedback/skip",
    status_code=201,
    responses={404: {"model": ErrorResponse}},
)
async def skip_feedback(
    payload: FeedbackSkip,
    db: AsyncSession = Depends(get_session),
):
    """Record a dismissed feedback card (skipped)."""
    profile = await _get_profile(payload.access_code, db)
    await _validate_conversation(payload.conversation_id, profile.id, db)

    existing = await db.execute(
        select(ResponseFeedback).where(
            ResponseFeedback.conversation_id == payload.conversation_id
        )
    )
    if existing.scalar_one_or_none() is not None:
        return {"id": "already_exists"}

    feedback = ResponseFeedback(
        conversation_id=payload.conversation_id,
        helpful=None,
        tags=None,
        negative_reasons=None,
        source="home",
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    return {"id": feedback.id}


@router.get(
    "/feedback/pending/{access_code}",
    responses={204: {}, 404: {"model": ErrorResponse}},
)
async def get_pending_feedback(
    access_code: str,
    db: AsyncSession = Depends(get_session),
):
    """Get the most recent unfeedback'd session for the home screen card."""
    profile = await _get_profile(access_code, db)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)

    # Find session_ids that already have ANY feedback (including skips)
    feedbacked_session_ids = (
        select(Conversation.session_id)
        .join(ResponseFeedback, ResponseFeedback.conversation_id == Conversation.id)
        .where(Conversation.profile_id == profile.id)
        .distinct()
        .scalar_subquery()
    )

    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.profile_id == profile.id,
            Conversation.role == "assistant",
            Conversation.created_at >= cutoff,
            Conversation.session_id.not_in(feedbacked_session_ids),
        )
        .order_by(Conversation.created_at.desc())
        .limit(1)
    )
    assistant_msg = result.scalar_one_or_none()

    if assistant_msg is None:
        return Response(status_code=204)

    title_result = await db.execute(
        select(Conversation.content)
        .where(
            Conversation.session_id == assistant_msg.session_id,
            Conversation.profile_id == profile.id,
            Conversation.role == "user",
        )
        .order_by(Conversation.created_at)
        .limit(1)
    )
    raw_title = title_result.scalar_one_or_none()
    title = "Untitled"
    if raw_title:
        decrypted_title = decrypt(raw_title)
        title = (decrypted_title[:60] + "...") if len(decrypted_title) > 60 else decrypted_title

    suggested_tags = []
    if assistant_msg.suggested_tags:
        try:
            suggested_tags = json.loads(decrypt(assistant_msg.suggested_tags))
        except Exception:
            suggested_tags = list(PREDEFINED_TAGS)

    return PendingFeedbackResponse(
        session_id=assistant_msg.session_id,
        conversation_id=assistant_msg.id,
        title=title,
        suggested_tags=suggested_tags,
        created_at=assistant_msg.created_at.isoformat(),
    )


@router.get(
    "/feedback/{access_code}/{session_id}",
    response_model=SessionFeedbackResponse,
    responses={404: {"model": ErrorResponse}},
)
async def get_session_feedback(
    access_code: str,
    session_id: str,
    db: AsyncSession = Depends(get_session),
):
    """Get all feedback for a session."""
    profile = await _get_profile(access_code, db)

    convs_result = await db.execute(
        select(Conversation).where(
            Conversation.session_id == session_id,
            Conversation.profile_id == profile.id,
            Conversation.role == "assistant",
        )
    )
    conv_ids = [c.id for c in convs_result.scalars().all()]

    if not conv_ids:
        return SessionFeedbackResponse(feedback=[])

    fb_result = await db.execute(
        select(ResponseFeedback).where(
            ResponseFeedback.conversation_id.in_(conv_ids)
        )
    )
    entries = []
    for fb in fb_result.scalars().all():
        entries.append(FeedbackEntry(
            conversation_id=fb.conversation_id,
            helpful=fb.helpful,
            tags=json.loads(decrypt(fb.tags)) if fb.tags else [],
            created_at=fb.created_at.isoformat(),
        ))

    return SessionFeedbackResponse(feedback=entries)
