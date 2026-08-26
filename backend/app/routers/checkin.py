"""Caregiver Check-In streaming endpoint."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.profile import Profile
from app.schemas.checkin import CheckInRequest
from app.schemas.profile import ErrorResponse
from app.services.prompt import (
    get_request_locale_header,
    render_checkin_prompt,
    resolve_language,
    resolve_locale_code,
    resolve_language_constraint,
    resolve_model_for_locale,
)
from app.services.auth import hash_access_code
from app.services.rate_limit import rate_limit
from app.services.response_guard import (
    get_localized_fallback,
    guard_response_text,
    validate_response_quality,
)
from app.services.safety_gate import check_safety_gate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["checkin"])


@router.post(
    "/checkin",
    responses={404: {"model": ErrorResponse}},
)
async def caregiver_checkin(
    payload: CheckInRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    _rl: None = Depends(rate_limit("checkin")),
):
    """Stream an empathetic response to a caregiver check-in message."""
    code_hash = hash_access_code(payload.access_code)
    result = await session.execute(
        select(Profile).where(Profile.access_code_hash == code_hash)
    )
    profile = result.scalar_one_or_none()

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
        )

    locale_header = get_request_locale_header(
        request.headers.get("x-app-locale"),
        request.headers.get("accept-language"),
    )
    locale_code = resolve_locale_code(locale_header)
    language = resolve_language(locale_header)
    language_constraint = resolve_language_constraint(locale_header)
    safety = check_safety_gate(payload.message, locale_code=locale_code)
    if safety.triggered:
        async def safety_stream():
            yield f"data: {json.dumps({'text': safety.response_text})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(
            safety_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
        )

    system_prompt = render_checkin_prompt(language=language, language_constraint=language_constraint)
    messages = [{"role": "user", "content": payload.message}]
    llm = request.app.state.llm_provider
    model_override = resolve_model_for_locale(locale_code)

    async def event_stream():
        full_response: list[str] = []
        llm_failed = False
        try:
            async for chunk in llm.stream_completion(system_prompt, messages, model_override=model_override):
                full_response.append(chunk)
                yield f"data: {json.dumps({'text': chunk})}\n\n"
        except Exception as exc:
            logger.error("Checkin LLM stream failed: %s", exc)
            llm_failed = True

        if llm_failed:
            fallback = get_localized_fallback("checkin", locale_code)
            event_key = "replace" if full_response else "text"
            yield f"data: {json.dumps({event_key: fallback})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # Post-stream validation
        response_text = "".join(full_response)
        validation = validate_response_quality(response_text, locale_code)
        if not validation.is_valid:
            logger.warning("Checkin response failed validation (%s), repairing", validation.reason)
            try:
                repaired_text = await guard_response_text(
                    llm,
                    mode="checkin",
                    locale_code=locale_code,
                    language=language,
                    text=response_text,
                )
            except Exception as exc:
                logger.error("Checkin response repair failed: %s", exc)
                repaired_text = get_localized_fallback("checkin", locale_code)
            yield f"data: {json.dumps({'replace': repaired_text})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
