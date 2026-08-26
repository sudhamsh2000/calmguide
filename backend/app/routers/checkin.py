"""Caregiver Check-In streaming endpoint."""

import asyncio
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
from app.services.safety_gate import SafetyGateType, build_gate_response_text, check_safety_gate
from app.services.safety_classifier import classify_message
from app.services.safety_log import log_safety_event

logger = logging.getLogger(__name__)

router = APIRouter(tags=["checkin"])

# Strong references to in-flight background log writes — see coach.py's
# `_spawn_background` for why a bare asyncio.create_task isn't safe here.
_BACKGROUND_TASKS: set[asyncio.Task] = set()


def _spawn_background(coro, label: str) -> None:
    async def _guarded() -> None:
        try:
            await coro
        except Exception:
            logger.exception("Background task %s failed", label)

    task = asyncio.create_task(_guarded())
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)


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
    safety_source = "deterministic_gate"
    classifier_confidence: float | None = None

    if not safety.triggered:
        classifier_result = classify_message(payload.message)
        if classifier_result.flagged and classifier_result.category is not None:
            gate_type = SafetyGateType(classifier_result.category.value)
            safety = type(safety)(
                triggered=True,
                gate_type=gate_type,
                response_text=build_gate_response_text(gate_type, locale_code),
            )
            safety_source = "classifier"
            classifier_confidence = classifier_result.confidence

    if safety.triggered:
        safety_gate_type = safety.gate_type
        safety_event_source = safety_source
        safety_event_confidence = classifier_confidence
        safety_profile_id = profile.id

        async def _log_safety_gate_event() -> None:
            await log_safety_event(
                event_type="safety_gate_triggered",
                source=safety_event_source,
                category=safety_gate_type.value if safety_gate_type else None,
                profile_id=safety_profile_id,
                locale_code=locale_code,
                confidence=safety_event_confidence,
            )

        async def safety_stream():
            _spawn_background(_log_safety_gate_event(), label="checkin-safety-log")
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
