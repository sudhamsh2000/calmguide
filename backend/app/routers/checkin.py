"""Caregiver Check-In streaming endpoint."""

import asyncio
import json
import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.profile import Profile
from app.schemas.checkin import CheckInRequest
from app.schemas.profile import ErrorResponse
from app.services.acute_change_screen import get_acute_change_advisory_message
from app.services.auth import hash_access_code
from app.services.availability import record_llm_failure, record_llm_success
from app.services.prompt import (
    get_request_locale_header,
    render_checkin_prompt,
    resolve_language,
    resolve_language_constraint,
    resolve_locale_code,
    resolve_model_for_locale,
)
from app.services.rate_limit import rate_limit
from app.services.response_guard import (
    get_localized_fallback,
    guard_response_text,
    validate_response_quality,
)
from app.services.response_timing import record_llm_timing
from app.services.safety_decision import RiskLevel, evaluate_safety_v2
from app.services.safety_gate import (
    SafetyGateType,
    build_gate_response_text,
    resolve_emergency_locale,
    response_category_for_text,
)
from app.services.safety_log import log_safety_event
from app.services.safety_observability import (
    record_response_guard_repair_used,
    record_safety_decision,
    record_static_fallback_used,
)

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
    result = await session.execute(select(Profile).where(Profile.access_code_hash == code_hash))
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
    # Geographic, not language-scoped — see coach.py.
    emergency_locale = resolve_emergency_locale(locale_header)
    language = resolve_language(locale_header)
    language_constraint = resolve_language_constraint(locale_header)

    # Safety Gate v2 (docs/SAFETY_GATE_V2_PLAN.md, Phase 5): Check-In already
    # ran safety before any LLM call, so this isn't a reordering — it's
    # bringing Check-In onto the same decision model coach.py now uses, so a
    # message like "can't catch his breath" escalates consistently in both
    # places instead of only in Moment Coach.
    decision = evaluate_safety_v2(payload.message, locale_code=emergency_locale)
    record_safety_decision(
        risk_level=decision.risk_level.value,
        category=decision.category.value if decision.category else None,
        action=decision.action.value,
        source=decision.source.value,
        rag_requested=decision.allow_rag,
    )

    if not decision.allow_llm:
        if decision.risk_level is RiskLevel.HIGH:
            response_text = get_acute_change_advisory_message()
        else:
            response_text = build_gate_response_text(
                response_category_for_text(decision.category), emergency_locale
            )
        safety_profile_id = profile.id
        safety_category = decision.category.value if decision.category else None
        safety_source = decision.source.value
        safety_confidence = decision.confidence

        async def _log_safety_gate_event() -> None:
            await log_safety_event(
                event_type="safety_gate_triggered",
                source=safety_source,
                category=safety_category,
                profile_id=safety_profile_id,
                locale_code=locale_code,
                confidence=safety_confidence,
            )

        async def safety_stream():
            _spawn_background(_log_safety_gate_event(), label="checkin-safety-log")
            yield f"data: {json.dumps({'text': response_text})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            safety_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    if decision.category is SafetyGateType.MEDICATION_RISK:
        logger.info(
            "Safety Gate v2: medication_risk concern detected in check-in — "
            "proceeding with normal, prompt-constrained guidance"
        )

    system_prompt = render_checkin_prompt(
        language=language, language_constraint=language_constraint
    )
    messages = [{"role": "user", "content": payload.message}]
    llm = request.app.state.llm_provider
    model_override = resolve_model_for_locale(locale_code)

    async def event_stream():
        full_response: list[str] = []
        llm_failed = False
        stream_start = time.monotonic()
        first_chunk_at: float | None = None
        try:
            async for chunk in llm.stream_completion(
                system_prompt, messages, model_override=model_override
            ):
                if first_chunk_at is None:
                    first_chunk_at = time.monotonic()
                full_response.append(chunk)
                yield f"data: {json.dumps({'text': chunk})}\n\n"
            record_llm_success()
            total_ms = (time.monotonic() - stream_start) * 1000
            ttfc_ms = (
                (first_chunk_at - stream_start) * 1000 if first_chunk_at is not None else total_ms
            )
            record_llm_timing(ttfc_ms, total_ms)
            logger.info("Checkin LLM stream timing ttfc_ms=%.0f total_ms=%.0f", ttfc_ms, total_ms)
        except Exception as exc:
            logger.error("Checkin LLM stream failed: %s", exc)
            llm_failed = True
            record_llm_failure()

        if llm_failed:
            fallback = get_localized_fallback("checkin", locale_code)
            record_static_fallback_used()
            event_key = "replace" if full_response else "text"
            yield f"data: {json.dumps({event_key: fallback})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # Post-stream validation
        response_text = "".join(full_response)
        validation = validate_response_quality(response_text, locale_code)
        if not validation.is_valid:
            logger.warning("Checkin response failed validation (%s), repairing", validation.reason)
            record_response_guard_repair_used()
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
                record_static_fallback_used()
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
