"""Voice-only conversations — ElevenLabs agent with CalmGuide as its Custom LLM.

Two endpoints:

- POST /voice/sessions — the app calls this before starting a call. It
  authenticates the profile exactly like /coach/chat and returns a
  short-lived voice token (plus a signed URL for a private agent).
- POST /voice/llm/chat/completions — ElevenLabs calls this for every turn,
  in OpenAI Chat Completions format. The latest caregiver utterance goes
  through Safety Gate v2 first; an emergency turn returns the fixed
  escalation copy without calling any model.

Non-emergency replies are generated in full and checked by the response
guard *before* anything is sent. Typed chat can stream and then swap a bad
answer out; a spoken answer cannot be taken back once it has been heard.
"""

import hmac
import json
import logging
import time
import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models.conversation import Conversation
from app.models.profile import Profile
from app.models.staff import Staff
from app.routers.coach import (
    _persist_and_learn,
    _safe_decrypt_json,
    _spawn_background,
    short_circuit_response_text,
)
from app.schemas.profile import ErrorResponse
from app.schemas.voice import VoiceSessionRequest, VoiceSessionResponse
from app.services.auth import hash_access_code
from app.services.availability import record_llm_failure, record_llm_success
from app.services.crypto import encrypt
from app.services.prompt import (
    get_request_locale_header,
    render_coach_prompt,
    resolve_language,
    resolve_language_constraint,
    resolve_locale_code,
    resolve_model_for_locale,
)
from app.services.rate_limit import rate_limit
from app.services.rbac import get_current_staff, staff_can_access_profile
from app.services.response_guard import get_localized_fallback, guard_response_text
from app.services.safety_decision import RiskLevel, evaluate_safety_v2
from app.services.safety_gate import resolve_emergency_locale
from app.services.safety_log import log_safety_event
from app.services.safety_observability import (
    record_response_guard_repair_used,
    record_safety_decision,
    record_static_fallback_used,
)
from app.services.voice import (
    VOICE_MODE_INSTRUCTIONS,
    VoiceUnavailable,
    chat_completion,
    chat_completion_chunk,
    create_voice_token,
    get_signed_url,
    to_spoken_text,
    verify_voice_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["voice"])

# Same bound as typed chat (coach._MAX_HISTORY_MESSAGES).
_MAX_HISTORY_MESSAGES = 20
_MAX_MESSAGE_CHARS = 4000
# A shorter shared secret is guessable; refuse to run with one rather than
# accept forged turns.
_MIN_LLM_SECRET_LENGTH = 32


def _require_voice_enabled() -> None:
    if not get_settings().VOICE_ENABLED:
        raise HTTPException(
            status_code=404,
            detail={"error": "Voice mode is not enabled", "code": "VOICE_DISABLED"},
        )


@router.post(
    "/voice/sessions",
    response_model=VoiceSessionResponse,
    responses={404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
async def create_voice_session(
    payload: VoiceSessionRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    staff: Staff | None = Depends(get_current_staff),
    _rl: None = Depends(rate_limit("voice-session")),
):
    _require_voice_enabled()
    settings = get_settings()
    if not settings.ELEVENLABS_AGENT_ID:
        raise HTTPException(
            status_code=503,
            detail={"error": "Voice agent is not configured", "code": "VOICE_UNAVAILABLE"},
        )

    # Same identity rules as /coach/chat: facility mode needs an authorized
    # staff member for this profile; family mode needs the access code.
    staff_id: str | None = None
    facility_id: str | None = None
    if payload.profile_id:
        if staff is None:
            raise HTTPException(
                status_code=401,
                detail={"error": "Authentication required", "code": "AUTH_REQUIRED"},
            )
        result = await session.execute(select(Profile).where(Profile.id == payload.profile_id))
        profile = result.scalar_one_or_none()
        if profile is None:
            raise HTTPException(
                status_code=404,
                detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
            )
        if not await staff_can_access_profile(session, staff, payload.profile_id):
            raise HTTPException(
                status_code=403,
                detail={"error": "Not authorized for this patient", "code": "PROFILE_FORBIDDEN"},
            )
        staff_id = staff.id
        facility_id = staff.facility_id
    elif payload.access_code:
        code_hash = hash_access_code(payload.access_code)
        result = await session.execute(select(Profile).where(Profile.access_code_hash == code_hash))
        profile = result.scalar_one_or_none()
        if profile is None:
            raise HTTPException(
                status_code=404,
                detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
            )
    else:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Either profile_id or access_code is required",
                "code": "MISSING_IDENTIFIER",
            },
        )

    signed_url: str | None = None
    if settings.ELEVENLABS_API_KEY:
        try:
            signed_url = await get_signed_url(
                settings.ELEVENLABS_AGENT_ID, settings.ELEVENLABS_API_KEY
            )
        except VoiceUnavailable as exc:
            logger.warning("%s", exc)
            raise HTTPException(
                status_code=503,
                detail={"error": "Voice agent is unavailable", "code": "VOICE_UNAVAILABLE"},
            ) from exc

    session_id = str(uuid.uuid4())
    token = create_voice_token(
        profile_id=profile.id,
        session_id=session_id,
        patient_name=payload.patient_name,
        locale_header=get_request_locale_header(
            request.headers.get("x-app-locale"), request.headers.get("accept-language")
        ),
        staff_id=staff_id,
        facility_id=facility_id,
    )
    return VoiceSessionResponse(
        session_id=session_id,
        voice_token=token,
        expires_in=settings.VOICE_TOKEN_TTL_SECONDS,
        agent_id=settings.ELEVENLABS_AGENT_ID,
        signed_url=signed_url,
    )


def _require_llm_secret(request: Request) -> None:
    secret = get_settings().VOICE_LLM_SECRET
    if len(secret) < _MIN_LLM_SECRET_LENGTH:
        logger.error("VOICE_LLM_SECRET is unset or too short; refusing voice LLM calls")
        raise HTTPException(
            status_code=503,
            detail={"error": "Voice mode is not configured", "code": "VOICE_UNAVAILABLE"},
        )
    auth = request.headers.get("authorization", "")
    presented = auth[7:] if auth.startswith("Bearer ") else ""
    if not hmac.compare_digest(presented.encode(), secret.encode()):
        raise HTTPException(
            status_code=401,
            detail={"error": "Invalid credentials", "code": "INVALID_TOKEN"},
        )


def _content_text(content) -> str:
    """Message content is a string, or a list of OpenAI content parts."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            part.get("text", "")
            for part in content
            if isinstance(part, dict) and part.get("type") == "text"
        )
    return ""


def _transcript(raw_messages) -> list[dict[str, str]]:
    """User/assistant turns only. The request's system message (the agent's
    dashboard prompt) is ignored — the system prompt is always CalmGuide's."""
    if not isinstance(raw_messages, list):
        return []
    turns = []
    for message in raw_messages:
        if not isinstance(message, dict) or message.get("role") not in ("user", "assistant"):
            continue
        text = _content_text(message.get("content")).strip()
        if text:
            turns.append({"role": message["role"], "content": text[:_MAX_MESSAGE_CHARS]})
    return turns[-_MAX_HISTORY_MESSAGES:]


def _completion_response(text: str, stream: bool):
    completion_id = f"chatcmpl-{uuid.uuid4().hex}"
    created = int(time.time())
    if not stream:
        return JSONResponse(chat_completion(completion_id, created, text))

    def _sse(obj: dict) -> str:
        return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"

    async def event_stream():
        yield _sse(chat_completion_chunk(completion_id, created, {"role": "assistant"}, None))
        yield _sse(chat_completion_chunk(completion_id, created, {"content": text}, None))
        yield _sse(chat_completion_chunk(completion_id, created, {}, "stop"))
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/voice/llm/chat/completions")
async def voice_llm_turn(request: Request, session: AsyncSession = Depends(get_session)):
    """ElevenLabs Custom LLM endpoint (OpenAI Chat Completions format).

    Configure the agent's Custom LLM server URL as `<api>/api/voice/llm`;
    ElevenLabs appends `/chat/completions`. Not rate-limited per IP: every
    call arrives from ElevenLabs' servers, so an IP bucket would throttle all
    callers together. The shared secret plus a per-call token gate it instead.
    """
    _require_voice_enabled()
    _require_llm_secret(request)

    try:
        body = await request.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail={"error": "Invalid JSON", "code": "INVALID_BODY"}
        ) from exc
    if not isinstance(body, dict):
        raise HTTPException(
            status_code=400, detail={"error": "Invalid body", "code": "INVALID_BODY"}
        )

    extra = body.get("elevenlabs_extra_body")
    token = extra.get("voice_token") if isinstance(extra, dict) else None
    if not isinstance(token, str) or not token:
        raise HTTPException(
            status_code=401,
            detail={"error": "Voice token required", "code": "AUTH_REQUIRED"},
        )
    try:
        claims = verify_voice_token(token)
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=401,
            detail={"error": "Invalid or expired voice token", "code": "INVALID_TOKEN"},
        ) from exc

    result = await session.execute(select(Profile).where(Profile.id == claims["profile_id"]))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
        )

    turns = _transcript(body.get("messages"))
    if not turns or turns[-1]["role"] != "user":
        raise HTTPException(
            status_code=422,
            detail={"error": "No caregiver utterance to answer", "code": "NO_USER_MESSAGE"},
        )
    message = turns[-1]["content"]
    stream = bool(body.get("stream", False))

    session_id = claims["session_id"]
    profile_id = profile.id
    staff_id = claims.get("staff_id")
    facility_id = claims.get("facility_id")
    locale_header = claims.get("locale")
    locale_code = resolve_locale_code(locale_header)
    emergency_locale = resolve_emergency_locale(locale_header)
    language = resolve_language(locale_header)

    # Safety first, before any model call — the same decision /coach/chat makes.
    decision = evaluate_safety_v2(message, locale_code=emergency_locale)
    record_safety_decision(
        risk_level=decision.risk_level.value,
        category=decision.category.value if decision.category else None,
        action=decision.action.value,
        source=decision.source.value,
        rag_requested=False,
    )

    if not decision.allow_llm:
        response_text = short_circuit_response_text(decision, emergency_locale)
        _spawn_background(
            _save_turns(
                session_id=session_id,
                profile_id=profile_id,
                locale_code=locale_code,
                user_text=message,
                assistant_text=response_text,
                staff_id=staff_id,
                facility_id=facility_id,
                is_safety_gate=True,
            ),
            label=f"voice-safety:{session_id}",
        )
        _spawn_background(
            log_safety_event(
                event_type="safety_gate_triggered",
                source=decision.source.value,
                category=decision.category.value if decision.category else None,
                profile_id=profile_id,
                session_id=session_id,
                staff_id=staff_id,
                facility_id=facility_id,
                locale_code=locale_code,
                confidence=decision.confidence,
                details={
                    "channel": "voice",
                    "emergency": decision.risk_level is RiskLevel.EMERGENCY,
                },
            ),
            label=f"voice-safety-log:{session_id}",
        )
        logger.info(
            "Voice safety short-circuit (%s, risk_level=%s) for session %s",
            decision.category,
            decision.risk_level.value,
            session_id,
        )
        return _completion_response(to_spoken_text(response_text), stream)

    # Voice turns use the patient profile but skip RAG, dossier, incident and
    # OpenMRS lookups: on a call, time to first word matters more than depth.
    profile_data = {
        "disease_stage": profile.disease_stage,
        "behavioral_patterns": _safe_decrypt_json(profile.behavioral_patterns),
        "calming_strategies": _safe_decrypt_json(profile.calming_strategies),
        "safety_concerns": _safe_decrypt_json(profile.safety_concerns),
    }
    system_prompt = render_coach_prompt(
        patient_name=claims["patient_name"],
        language=language,
        language_constraint=resolve_language_constraint(locale_header),
        **profile_data,
    ) + VOICE_MODE_INSTRUCTIONS.format(language=language)

    llm = request.app.state.llm_provider
    try:
        draft = await llm.completion(
            system_prompt, turns, model_override=resolve_model_for_locale(locale_code)
        )
        record_llm_success()
    except Exception as exc:
        logger.error("Voice LLM call failed for session %s: %s", session_id, exc)
        record_llm_failure()
        draft = None

    if draft is None or not draft.strip():
        assistant_text = get_localized_fallback("coach", locale_code)
        record_static_fallback_used()
    else:
        try:
            assistant_text = await guard_response_text(
                llm, mode="coach", locale_code=locale_code, language=language, text=draft
            )
        except Exception as exc:
            logger.error("Voice response repair failed for session %s: %s", session_id, exc)
            assistant_text = get_localized_fallback("coach", locale_code)
            record_static_fallback_used()
        if assistant_text != draft:
            record_response_guard_repair_used()

    spoken = to_spoken_text(assistant_text)

    session.add(
        Conversation(
            session_id=session_id,
            profile_id=profile_id,
            role="user",
            content=encrypt(message),
            locale_code=locale_code,
            staff_id=staff_id,
            facility_id=facility_id,
        )
    )
    await session.commit()
    _spawn_background(
        _persist_and_learn(
            session_id=session_id,
            profile_id=profile_id,
            profile_data=profile_data,
            patient_name=claims["patient_name"],
            locale_code=locale_code,
            assistant_text=spoken,
            extraction_messages=turns + [{"role": "assistant", "content": spoken}],
            user_message=message,
            llm=llm,
        ),
        label=f"voice-persist:{session_id}",
    )
    return _completion_response(spoken, stream)


async def _save_turns(
    *,
    session_id: str,
    profile_id: str,
    locale_code: str,
    user_text: str,
    assistant_text: str,
    staff_id: str | None,
    facility_id: str | None,
    is_safety_gate: bool,
) -> None:
    from app.db import get_session_factory

    factory = get_session_factory()
    async with factory() as save_session:
        for role, text in (("user", user_text), ("assistant", assistant_text)):
            save_session.add(
                Conversation(
                    session_id=session_id,
                    profile_id=profile_id,
                    role=role,
                    content=encrypt(text),
                    locale_code=locale_code,
                    staff_id=staff_id,
                    facility_id=facility_id,
                    is_safety_gate=is_safety_gate,
                )
            )
        await save_session.commit()
