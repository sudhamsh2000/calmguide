"""Moment Coach streaming endpoint — SSE via FastAPI's native EventSourceResponse."""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.conversation import Conversation
from app.models.profile import Profile
from app.models.staff import Staff
from app.services.availability import record_llm_failure, record_llm_success
from app.services.rate_limit import rate_limit
from app.services.rbac import get_current_staff, staff_can_access_profile
from app.schemas.coach import (
    AcuteChangeScreenRequest,
    AcuteChangeScreenResponse,
    ConversationListResponse,
    ConversationMessage,
    ConversationMessagesResponse,
    ConversationSummary,
    CoachRequest,
)
from app.schemas.profile import ErrorResponse
from app.services.prompt import (
    get_request_locale_header,
    render_coach_prompt,
    resolve_language,
    resolve_locale_code,
    resolve_language_constraint,
    resolve_model_for_locale,
)
from app.services.retrieval_query import build_english_rag_query
from app.services.auth import hash_access_code
from app.services.crypto import decrypt, encrypt
from app.services.response_guard import (
    get_localized_fallback,
    guard_response_text,
    validate_response_quality,
)
from app.services.safety_gate import SafetyGateType, build_gate_response_text, check_safety_gate
from app.services.safety_classifier import classify_message
from app.services.safety_log import log_safety_event
from app.services.acute_change_screen import (
    AcuteChangeScreenInput,
    evaluate_acute_change_screen,
)

logger = logging.getLogger(__name__)


async def _fetch_rag_context(message: str) -> str:
    """Retrieve RAG context for a caregiver message.

    Returns an empty string if the RAG pipeline is not configured or fails,
    so the app continues to work without it.
    """
    try:
        from rag.retrieve import get_rag_context  # noqa: PLC0415
        context = await get_rag_context(message, k=3, min_score=0.20)
        if context:
            chunk_count = len(context.split("\n\n---\n\n"))
            logger.info("RAG: injected %d chunk(s) (%d chars)", chunk_count, len(context))
        else:
            logger.info("RAG: no chunks above min_score threshold")
        return context
    except Exception as exc:
        logger.warning("RAG: unavailable — %s", exc)
        return ""

router = APIRouter(tags=["coach"])

# Strong references to in-flight background work. asyncio only holds a weak
# reference to a bare task, so without this the garbage collector is free to
# cancel a half-finished write.
_BACKGROUND_TASKS: set[asyncio.Task] = set()


def _spawn_background(coro, label: str) -> None:
    """Run `coro` detached from the response.

    Everything that turns a finished session into memory — the assistant
    message, its tags, the extracted incident, insights, the dossier — used to
    run inside the SSE generator after the [DONE] sentinel. A caregiver closing
    the app at that moment cancels the generator, so the session that just
    happened would never enter the memory graph. Detaching means a disconnect
    costs the caregiver nothing.
    """

    async def _guarded() -> None:
        try:
            await coro
        except Exception:
            logger.exception("Background task %s failed", label)

    task = asyncio.create_task(_guarded())
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)


async def drain_background_tasks(timeout: float = 10.0) -> None:
    """Let in-flight memory writes finish before the process goes away."""
    if not _BACKGROUND_TASKS:
        return
    pending = list(_BACKGROUND_TASKS)
    logger.info("Draining %d background task(s) before shutdown", len(pending))
    done, still_running = await asyncio.wait(pending, timeout=timeout)
    if still_running:
        logger.warning(
            "%d background task(s) did not finish within %.0fs",
            len(still_running), timeout,
        )


async def _persist_and_learn(
    *,
    session_id: str,
    profile_id: str,
    profile_data: dict[str, Any],
    patient_name: str | None,
    locale_code: str,
    assistant_text: str,
    extraction_messages: list[dict[str, str]],
    user_message: str,
    llm,
) -> None:
    """DICE: Evaluate — fold this session into the memory graph.

    Save the assistant turn, then fold this session into the memory graph.
    Ordered so each step sees the previous one's writes: message → tags →
    incident extraction → insights → dossier. The dossier runs last precisely
    because extraction may have just added an incident, and running it here
    keeps its narrative generation off the next crisis request's critical path.

    The caregiver-reported `intervention_outcome` on an extracted incident
    (set later via the incidents API, not here) is what actually closes the
    Evaluate loop — this function creates the incident that outcome later
    attaches to. See app.services.dice_workflow.EVALUATE.
    """
    from app.db import get_session_factory

    factory = get_session_factory()

    assistant_msg = Conversation(
        session_id=session_id,
        profile_id=profile_id,
        role="assistant",
        content=encrypt(assistant_text),
        locale_code=locale_code,
    )
    async with factory() as save_session:
        save_session.add(assistant_msg)
        await save_session.commit()

    try:
        from app.services.tag_generator import generate_suggested_tags
        from sqlalchemy import update

        tags = await generate_suggested_tags(assistant_text, llm)
        async with factory() as tag_session:
            await tag_session.execute(
                update(Conversation)
                .where(Conversation.id == assistant_msg.id)
                .values(suggested_tags=encrypt(json.dumps(tags)))
            )
            await tag_session.commit()
    except Exception as tag_exc:
        logger.warning("Tag generation failed for %s: %s", session_id, tag_exc)

    try:
        await _extract_incident(
            session_id=session_id,
            profile_id=profile_id,
            profile_data=profile_data,
            patient_name=patient_name,
            extraction_messages=extraction_messages,
            user_message=user_message,
            llm=llm,
            factory=factory,
        )
    except Exception as ext_exc:
        logger.warning("Incident extraction failed for %s: %s", session_id, ext_exc)

    try:
        from app.services.insights import compute_profile_insights, upsert_profile_insights

        async with factory() as ins_session:
            insights_payload = await compute_profile_insights(profile_id, ins_session)
            if insights_payload["crisis_frequency"]["total_sessions"] >= 3:
                await upsert_profile_insights(profile_id, insights_payload, ins_session)
    except Exception as ins_exc:
        logger.warning("Insights failed for %s: %s", profile_id, ins_exc)

    try:
        from app.services.dossier import compute_dossier

        async with factory() as dossier_session:
            await compute_dossier(profile_id, dossier_session, llm)
    except Exception as doss_exc:
        logger.warning("Dossier recompute failed for %s: %s", profile_id, doss_exc)


async def _extract_incident(
    *,
    session_id: str,
    profile_id: str,
    profile_data: dict[str, Any],
    patient_name: str | None,
    extraction_messages: list[dict[str, str]],
    user_message: str,
    llm,
    factory,
) -> None:
    """Auto-extract an ABC incident from the finished conversation."""
    from app.models.behavioral_dossier import BehavioralDossier
    from app.models.incident import Incident
    from app.routers.incidents import _compute_time_slot
    from app.services.incident_extractor import extract_incident_from_conversation

    extraction = await extract_incident_from_conversation(
        conversation_messages=extraction_messages,
        profile=profile_data,
        patient_name=patient_name,
        llm_provider=llm,
    )

    if not extraction or not extraction.get("behavior_category"):
        return

    now = datetime.now(timezone.utc)
    async with factory() as extract_session:
        incident = Incident(
            profile_id=profile_id,
            source="auto_extracted",
            incident_time=now,
            time_slot=_compute_time_slot(now),
            behavior_category=extraction["behavior_category"],
            behavior_subcategory=extraction.get("behavior_subcategory"),
            severity=extraction.get("severity"),
            duration_category=extraction.get("duration_category"),
            antecedent_description=(
                encrypt(extraction["antecedent_description"])
                if extraction.get("antecedent_description")
                else None
            ),
            antecedent_category=extraction.get("antecedent_category"),
            behavior_description=encrypt(
                extraction.get("behavior_description") or user_message[:200]
            ),
            intervention_description=(
                encrypt(extraction["intervention_description"])
                if extraction.get("intervention_description")
                else None
            ),
            intervention_outcome=extraction.get("intervention_outcome"),
            extraction_confidence=extraction.get("overall_confidence"),
            recall_confidence="high",
            extra_metadata=(
                encrypt(json.dumps({"v": 1, "safety_concern": extraction["safety_concern"]}))
                if extraction.get("safety_concern")
                else None
            ),
        )
        extract_session.add(incident)

        dossier_result = await extract_session.execute(
            select(BehavioralDossier).where(
                BehavioralDossier.profile_id == profile_id
            )
        )
        dossier = dossier_result.scalar_one_or_none()
        if dossier:
            dossier.is_stale = True
        else:
            extract_session.add(
                BehavioralDossier(profile_id=profile_id, is_stale=True)
            )

        await extract_session.commit()
        logger.info("Extracted incident %s for session %s", incident.id, session_id)


def _safe_decrypt_json(encrypted: str, default: Any = None) -> Any:
    try:
        return json.loads(decrypt(encrypted))
    except (json.JSONDecodeError, Exception):
        return default if default is not None else []


# Turns of in-session context replayed to the model. A crisis conversation is
# a handful of exchanges; replaying an unbounded session grew the prompt (and
# its latency and cost) with every message the caregiver sent.
_MAX_HISTORY_MESSAGES = 20


async def _get_conversation_history(
    session: AsyncSession, session_id: str, profile_id: str
) -> list[dict[str, str]]:
    """Retrieve the most recent messages in this session for context."""
    result = await session.execute(
        select(Conversation)
        .where(Conversation.session_id == session_id, Conversation.profile_id == profile_id)
        .order_by(Conversation.created_at.desc())
        .limit(_MAX_HISTORY_MESSAGES)
    )
    recent = list(result.scalars().all())
    recent.reverse()
    return [{"role": c.role, "content": decrypt(c.content)} for c in recent]


@router.get(
    "/conversations/{access_code}",
    response_model=ConversationListResponse,
    responses={404: {"model": ErrorResponse}},
)
async def list_conversations(
    access_code: str,
    session: AsyncSession = Depends(get_session),
):
    """Return recent conversation sessions for a profile, grouped by session_id."""
    code_hash = hash_access_code(access_code)
    result = await session.execute(
        select(Profile).where(Profile.access_code_hash == code_hash)
    )
    profile = result.scalar_one_or_none()

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
        )

    # Get the 10 most recent sessions with message counts and latest timestamp
    sessions_query = (
        select(
            Conversation.session_id,
            sa_func.count().label("message_count"),
            sa_func.max(Conversation.created_at).label("latest_at"),
        )
        .where(Conversation.profile_id == profile.id)
        .group_by(Conversation.session_id)
        .order_by(sa_func.max(Conversation.created_at).desc())
        .limit(10)
    )
    sessions_result = await session.execute(sessions_query)
    session_rows = sessions_result.all()

    if not session_rows:
        return ConversationListResponse(conversations=[])

    # Get the first user message per session for the title
    session_ids = [row.session_id for row in session_rows]
    first_msgs_query = (
        select(
            Conversation.session_id,
            Conversation.content,
        )
        .where(
            Conversation.profile_id == profile.id,
            Conversation.session_id.in_(session_ids),
            Conversation.role == "user",
        )
        .order_by(Conversation.created_at)
    )
    first_msgs_result = await session.execute(first_msgs_query)
    # Build a map of session_id -> first user message
    first_message_map: dict[str, str] = {}
    for row in first_msgs_result.all():
        if row.session_id not in first_message_map:
            first_message_map[row.session_id] = decrypt(row.content)

    conversations = []
    for row in session_rows:
        raw_title = first_message_map.get(row.session_id, "Untitled")
        title = (raw_title[:60] + "...") if len(raw_title) > 60 else raw_title
        conversations.append(
            ConversationSummary(
                session_id=row.session_id,
                title=title,
                created_at=row.latest_at.isoformat(),
                message_count=row.message_count,
            )
        )

    return ConversationListResponse(conversations=conversations)


@router.get(
    "/conversations/{access_code}/{session_id}/messages",
    response_model=ConversationMessagesResponse,
    responses={404: {"model": ErrorResponse}},
)
async def get_session_messages(
    access_code: str,
    session_id: UUID,
    db: AsyncSession = Depends(get_session),
):
    """Return all messages in a specific conversation session."""
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

    msgs_result = await db.execute(
        select(Conversation)
        .where(
            Conversation.session_id == str(session_id),
            Conversation.profile_id == profile.id,
        )
        .order_by(Conversation.created_at)
    )
    messages = [
        ConversationMessage(
            role=c.role,
            content=decrypt(c.content),
            created_at=c.created_at.isoformat(),
        )
        for c in msgs_result.scalars().all()
    ]

    return ConversationMessagesResponse(session_id=str(session_id), messages=messages)


@router.post(
    "/coach/chat",
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
async def coach_chat(
    payload: CoachRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    staff: Staff | None = Depends(get_current_staff),
    _rl: None = Depends(rate_limit("coach")),
):
    # DICE: Describe — payload.message IS the description (Moment Coach is
    # conversational intake, not a structured form). For a new/sudden change,
    # the caller is expected to have already run /coach/acute-change-screen,
    # which captures onset/context in structured form. See
    # app.services.dice_workflow.DESCRIBE.
    profile = None
    # Audit attribution is derived from the verified JWT, never from the body.
    audit_staff_id: str | None = None
    audit_facility_id: str | None = None

    if payload.profile_id:
        # B2B facility mode — requires an authenticated staff member who is
        # authorized for THIS specific profile. Without this check any caller
        # who knows a profile UUID could read/write a patient's clinical data.
        if staff is None:
            raise HTTPException(
                status_code=401,
                detail={"error": "Authentication required", "code": "AUTH_REQUIRED"},
            )
        result = await session.execute(
            select(Profile).where(Profile.id == payload.profile_id)
        )
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
        audit_staff_id = staff.id
        audit_facility_id = staff.facility_id
    elif payload.access_code:
        # B2C mode — existing behavior
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
    else:
        raise HTTPException(
            status_code=400,
            detail={"error": "Either profile_id or access_code is required", "code": "MISSING_IDENTIFIER"},
        )

    # Session management
    session_id = str(payload.session_id) if payload.session_id else str(uuid.uuid4())

    locale_header = get_request_locale_header(
        request.headers.get("x-app-locale"),
        request.headers.get("accept-language"),
    )
    locale_code = resolve_locale_code(locale_header)
    language = resolve_language(locale_header)
    language_constraint = resolve_language_constraint(locale_header)

    # Build system prompt with profile context + transient patient name
    llm = request.app.state.llm_provider
    model_override = resolve_model_for_locale(locale_code)

    # Resolved before the fan-out because both branches need it: retrieval
    # searches an English corpus, and incident recall matches English behaviour
    # keywords, so a Spanish or Tamil message would otherwise match nothing and
    # silently fall back to "three most recent incidents". For English locales
    # this is a pure string sanitize, not an LLM call.
    retrieval_query = await build_english_rag_query(
        llm, locale_code=locale_code, user_text=payload.message
    )
    if retrieval_query != payload.message:
        logger.info("Retrieval query rewritten to English: %s", retrieval_query)

    async def _rag_pipeline() -> str:
        """Vector retrieval. Touches the vector store, not the request DB
        session, so it runs concurrently with the DB reads."""
        return await _fetch_rag_context(retrieval_query)

    async def _db_context() -> dict[str, Any]:
        """DICE: Investigate — profile, prior triggers, and behavior history.

        Cross-patient + dossier + incident reads. These share the request
        session, so they run sequentially with respect to each other (an
        AsyncSession is not safe for concurrent statements). See
        app.services.dice_workflow.INVESTIGATE for the full phase mapping."""
        ctx: dict[str, Any] = {
            "cross_patient_strategies": None,
            "dossier_text": "",
            "contraindicated_list": [],
            "delirium_flags": None,
            "pain_flags": None,
            "effective_list": [],
            "frequency_trends": {},
            "relevant_incident_dicts": [],
            "care_change": None,
        }

        # An open observation window changes how the model should talk about
        # patterns: behaviour is in flux, so recent history is weak evidence.
        try:
            from app.models.care_change_event import CareChangeEvent
            from app.services.care_window import pre_change_cutoff

            care_changes_result = await session.execute(
                select(CareChangeEvent).where(
                    CareChangeEvent.profile_id == profile.id,
                    CareChangeEvent.is_active == True,
                )
            )
            today = datetime.now(timezone.utc).date()
            cutoff = pre_change_cutoff(care_changes_result.scalars().all(), today)
            if cutoff:
                ctx["care_change"] = {"days_ago": (today - cutoff).days}
        except Exception as care_exc:
            logger.warning("Care change lookup failed for %s: %s", profile.id, care_exc)

        # Cross-patient strategies for prompt injection
        try:
            from app.services.cross_patient import get_cohort_strategies
            from app.models.profile_insights import ProfileInsights
            insights_result = await session.execute(
                select(ProfileInsights).where(ProfileInsights.profile_id == profile.id)
            )
            insights_row = insights_result.scalar_one_or_none()
            if insights_row:
                import json as _json
                insights_data = _json.loads(decrypt(insights_row.insights_json))
                peak = insights_data.get("peak_time", "evening")
                cohort_key = f"{profile.disease_stage}:{peak}"
                strategies = await get_cohort_strategies(cohort_key, session)
                if strategies:
                    import random
                    shuffled = strategies[:3]
                    random.shuffle(shuffled)  # Randomize to prevent feedback loops
                    ctx["cross_patient_strategies"] = [
                        {"tag": s["tag"], "helped": s["helped"], "total": s["total"]}
                        for s in shuffled
                    ]
        except Exception as exc:
            logger.warning("Cross-patient fetch failed: %s", exc)

        # Behavioral dossier — read whatever is stored, never recompute here.
        # Recomputation ends in an LLM narrative call, and every session marks
        # the dossier stale on the way out, so computing it inline would put a
        # full generation in front of the first token of the *next* crisis.
        # The background pass at the end of this request refreshes it instead;
        # a dossier that is one session out of date is a far better trade at
        # 3am than a caregiver watching a blank screen.
        try:
            from app.models.behavioral_dossier import BehavioralDossier as BDModel

            dossier_result = await session.execute(
                select(BDModel).where(BDModel.profile_id == profile.id)
            )
            dossier = dossier_result.scalar_one_or_none()
            if dossier:
                if dossier.dossier_text:
                    ctx["dossier_text"] = decrypt(dossier.dossier_text)
                if dossier.contraindicated_json:
                    ctx["contraindicated_list"] = _safe_decrypt_json(dossier.contraindicated_json)
                if dossier.effective_json:
                    ctx["effective_list"] = _safe_decrypt_json(dossier.effective_json)
                if dossier.delirium_flags:
                    ctx["delirium_flags"] = _safe_decrypt_json(dossier.delirium_flags, default={})
                if dossier.pain_flags:
                    ctx["pain_flags"] = _safe_decrypt_json(dossier.pain_flags, default={})
                if dossier.frequency_trends:
                    ctx["frequency_trends"] = _safe_decrypt_json(dossier.frequency_trends, default={})
        except Exception as doss_exc:
            logger.warning("Dossier fetch failed for %s: %s", profile.id, doss_exc)

        # Relevant past incidents
        try:
            from app.services.incident_retriever import get_relevant_incidents, format_incident_for_prompt
            relevant = await get_relevant_incidents(
                profile.id, retrieval_query, session
            )
            ctx["relevant_incident_dicts"] = [format_incident_for_prompt(i) for i in relevant]
        except Exception as ret_exc:
            logger.warning("Incident retrieval failed for %s: %s", profile.id, ret_exc)

        return ctx

    # Overlap the RAG pipeline (LLM + vector store) with the DB context reads so
    # a 3am caregiver waits for max(rag, db) instead of their sum before the
    # first token streams.
    rag_context, _db_ctx = await asyncio.gather(_rag_pipeline(), _db_context())
    cross_patient_strategies = _db_ctx["cross_patient_strategies"]
    dossier_text = _db_ctx["dossier_text"]
    contraindicated_list = _db_ctx["contraindicated_list"]
    delirium_flags = _db_ctx["delirium_flags"]
    pain_flags = _db_ctx["pain_flags"]
    effective_list = _db_ctx["effective_list"]
    frequency_trends = _db_ctx["frequency_trends"]
    relevant_incident_dicts = _db_ctx["relevant_incident_dicts"]

    # DICE: Create — non-pharmacologic caregiver actions, structured into the
    # four response sections. See app.services.dice_workflow.CREATE.
    system_prompt = render_coach_prompt(
        patient_name=payload.patient_name,
        disease_stage=profile.disease_stage,
        behavioral_patterns=_safe_decrypt_json(profile.behavioral_patterns),
        calming_strategies=_safe_decrypt_json(profile.calming_strategies),
        safety_concerns=_safe_decrypt_json(profile.safety_concerns),
        rag_context=rag_context,
        language=language,
        language_constraint=language_constraint,
        cross_patient_strategies=cross_patient_strategies,
        dossier_text=dossier_text,
        contraindicated=contraindicated_list,
        relevant_incidents=relevant_incident_dicts,
        delirium_flags=delirium_flags,
        pain_flags=pain_flags,
        effective_interventions=effective_list,
        frequency_trends=frequency_trends,
        care_change=_db_ctx["care_change"],
    )

    # Get conversation history for context
    history = await _get_conversation_history(session, session_id, profile.id)
    messages = history + [{"role": "user", "content": payload.message}]

    safety = check_safety_gate(payload.message, locale_code=locale_code)
    safety_source = "deterministic_gate"
    classifier_confidence: float | None = None

    # Second, lightweight (non-ML) classifier layer behind the deterministic
    # gate: catches paraphrases/near-misses the regex gate doesn't match
    # verbatim. Escalates using the identical locale-aware response text as
    # the deterministic gate, so a caregiver never sees a "weaker" version of
    # the same safety response depending on which layer caught it. The
    # deterministic gate's decision is authoritative when it fires — this
    # layer only adds coverage, it never suppresses a gate trigger.
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
        safety_profile_id = profile.id
        safety_gate_type = safety.gate_type
        safety_event_source = safety_source
        safety_event_confidence = classifier_confidence

        async def _save_safety_turn() -> None:
            from app.db import get_session_factory

            factory = get_session_factory()
            async with factory() as save_session:
                save_session.add(Conversation(
                    session_id=session_id,
                    profile_id=safety_profile_id,
                    role="user",
                    content=encrypt(payload.message),
                    locale_code=locale_code,
                    is_safety_gate=True,
                ))
                save_session.add(Conversation(
                    session_id=session_id,
                    profile_id=safety_profile_id,
                    role="assistant",
                    content=encrypt(safety.response_text),
                    locale_code=locale_code,
                    is_safety_gate=True,
                ))
                await save_session.commit()

        async def _log_safety_gate_event() -> None:
            await log_safety_event(
                event_type="safety_gate_triggered",
                source=safety_event_source,
                category=safety_gate_type.value if safety_gate_type else None,
                profile_id=safety_profile_id,
                session_id=session_id,
                staff_id=audit_staff_id,
                facility_id=audit_facility_id,
                locale_code=locale_code,
                confidence=safety_event_confidence,
            )

        async def safety_stream():
            # Detached for the same reason as the main path: a safety-gated
            # turn is the last one that should go unrecorded if the caregiver
            # closes the app right after reading it.
            _spawn_background(_save_safety_turn(), label=f"safety:{session_id}")
            _spawn_background(_log_safety_gate_event(), label=f"safety-log:{session_id}")
            yield f"data: {json.dumps({'session_id': session_id})}\n\n"
            yield f"data: {json.dumps({'text': safety.response_text})}\n\n"
            yield "data: [DONE]\n\n"

        logger.info(
            "Safety gate triggered (%s, source=%s) for session %s",
            safety.gate_type, safety_source, session_id,
        )
        return StreamingResponse(
            safety_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # Save user message (no patient name stored)
    user_msg = Conversation(
        session_id=session_id,
        profile_id=profile.id,
        role="user",
        content=encrypt(payload.message),
        locale_code=locale_code,
        staff_id=audit_staff_id,
        facility_id=audit_facility_id,
    )
    session.add(user_msg)
    await session.commit()

    # Read off the request-scoped ORM object now: the background pass outlives
    # this session, and these values must not be re-fetched from a closed one.
    profile_id = profile.id
    profile_data = {
        "disease_stage": profile.disease_stage,
        "behavioral_patterns": _safe_decrypt_json(profile.behavioral_patterns),
        "calming_strategies": _safe_decrypt_json(profile.calming_strategies),
        "safety_concerns": _safe_decrypt_json(profile.safety_concerns),
    }
    persistence_started = False

    def _spawn_persistence(assistant_text: str) -> None:
        nonlocal persistence_started
        if persistence_started or not assistant_text.strip():
            return
        persistence_started = True
        _spawn_background(
            _persist_and_learn(
                session_id=session_id,
                profile_id=profile_id,
                profile_data=profile_data,
                patient_name=payload.patient_name,
                locale_code=locale_code,
                assistant_text=assistant_text,
                extraction_messages=messages
                + [{"role": "assistant", "content": assistant_text}],
                user_message=payload.message,
                llm=llm,
            ),
            label=f"persist:{session_id}",
        )

    async def event_stream():
        """Stream LLM output, then validate and send correction if needed."""
        # Stream chunks to the client immediately. If the LLM provider fails
        # mid-stream (timeout, rate limit, dropped connection), deliver a safe
        # localized static fallback instead of leaving the caregiver in silence.
        full_response: list[str] = []
        try:
            # First event: session metadata
            yield f"data: {json.dumps({'session_id': session_id})}\n\n"

            llm_failed = False
            try:
                async for chunk in llm.stream_completion(system_prompt, messages, model_override=model_override):
                    full_response.append(chunk)
                    yield f"data: {json.dumps({'text': chunk})}\n\n"
                record_llm_success()
            except Exception as exc:
                logger.error("LLM stream failed for session %s: %s", session_id, exc)
                llm_failed = True
                record_llm_failure()

            if llm_failed:
                assistant_text = get_localized_fallback("coach", locale_code)
                # Replace any partial text the caregiver already saw with the fallback.
                event_key = "replace" if full_response else "text"
                yield f"data: {json.dumps({event_key: assistant_text})}\n\n"
            else:
                # Post-stream validation
                assistant_text = "".join(full_response)
                validation = validate_response_quality(assistant_text, locale_code)
                if not validation.is_valid:
                    logger.warning("Coach response failed validation (%s), repairing", validation.reason)
                    try:
                        repaired_text = await guard_response_text(
                            llm,
                            mode="coach",
                            locale_code=locale_code,
                            language=language,
                            text=assistant_text,
                        )
                    except Exception as exc:
                        logger.error("Response repair failed for session %s: %s", session_id, exc)
                        repaired_text = get_localized_fallback("coach", locale_code)
                    # Send replacement event so the client swaps out the bad response
                    yield f"data: {json.dumps({'replace': repaired_text})}\n\n"
                    assistant_text = repaired_text

            # Hand the finished turn to the background before signalling DONE, so
            # a caregiver who closes the app on the last word still gets this
            # session recorded in their patient's memory graph.
            _spawn_persistence(assistant_text)

            # Done sentinel
            yield "data: [DONE]\n\n"
        finally:
            # Disconnect mid-answer: keep whatever the caregiver did see rather
            # than losing the session. No-op once the normal path has spawned.
            _spawn_persistence("".join(full_response))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/coach/acute-change-screen",
    response_model=AcuteChangeScreenResponse,
    responses={404: {"model": ErrorResponse}},
)
async def acute_change_screen(
    payload: AcuteChangeScreenRequest,
    session: AsyncSession = Depends(get_session),
    staff: Staff | None = Depends(get_current_staff),
):
    """Acute behavior-change / delirium SCREEN — call this before starting a
    Moment Coach chat session for a new or sudden behavior change.

    This is a screening prompt, not a diagnosis. See
    app/services/acute_change_screen.py for the decision logic and its
    CLINICAL-REVIEW-REQUIRED markers.
    """
    profile = None
    audit_staff_id: str | None = None
    audit_facility_id: str | None = None

    if payload.profile_id:
        if staff is None:
            raise HTTPException(
                status_code=401,
                detail={"error": "Authentication required", "code": "AUTH_REQUIRED"},
            )
        result = await session.execute(
            select(Profile).where(Profile.id == payload.profile_id)
        )
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
        audit_staff_id = staff.id
        audit_facility_id = staff.facility_id
    elif payload.access_code:
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
    else:
        raise HTTPException(
            status_code=400,
            detail={"error": "Either profile_id or access_code is required", "code": "MISSING_IDENTIFIER"},
        )

    answers = AcuteChangeScreenInput(
        is_new_or_different=payload.is_new_or_different,
        is_sudden_onset=payload.is_sudden_onset,
        alertness_change=payload.alertness_change,
        fever_or_infection_signs=payload.fever_or_infection_signs,
        pain_signs=payload.pain_signs,
        urinary_retention_signs=payload.urinary_retention_signs,
        constipation_signs=payload.constipation_signs,
        dehydration_signs=payload.dehydration_signs,
        medication_change_recent=payload.medication_change_recent,
        fall_recent=payload.fall_recent,
        unsure=payload.unsure,
    )
    result_ = evaluate_acute_change_screen(answers)

    _spawn_background(
        log_safety_event(
            event_type="acute_change_screen",
            source="acute_change_screen",
            category=result_.outcome.value,
            profile_id=profile.id,
            staff_id=audit_staff_id,
            facility_id=audit_facility_id,
            details={
                "concerning_flags": result_.concerning_flags,
                "is_uncertain": result_.is_uncertain,
            },
        ),
        label=f"acute-change-screen:{profile.id}",
    )

    return AcuteChangeScreenResponse(
        outcome=result_.outcome.value,
        concerning_flags=result_.concerning_flags,
        is_uncertain=result_.is_uncertain,
        message=result_.message,
    )
