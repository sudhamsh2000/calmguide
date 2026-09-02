"""Learn Mode — scenario-based practice for caregivers."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.schemas.profile import ErrorResponse
from app.services.prompt import (
    get_request_locale_header,
    render_learn_prompt,
    resolve_language,
    resolve_language_constraint,
    resolve_locale_code,
    resolve_model_for_locale,
)
from app.services.rate_limit import rate_limit
from app.services.response_guard import guard_response_text
from app.services.retrieval_query import build_english_rag_query
from app.services.safety_gate import check_safety_gate

logger = logging.getLogger(__name__)


async def _fetch_rag_context(message: str) -> str:
    """Retrieve RAG context for a learn scenario. Graceful fallback."""
    try:
        from rag.retrieve import get_rag_context  # noqa: PLC0415

        context = await get_rag_context(message, k=3, min_score=0.20)
        if context:
            chunk_count = len(context.split("\n\n---\n\n"))
            logger.info("RAG (learn): injected %d chunk(s) (%d chars)", chunk_count, len(context))
        else:
            logger.info("RAG (learn): no chunks above min_score threshold")
        return context
    except Exception as exc:
        logger.warning("RAG: unavailable for learn — %s", exc)
        return ""


router = APIRouter(tags=["learn"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class Scenario(BaseModel):
    id: str
    title: str
    description: str
    disease_stage: str
    category: str


class LearnInteractRequest(BaseModel):
    scenario_id: str
    disease_stage: str = Field(..., pattern="^(early|middle|late)$")
    message: str = Field(..., min_length=1)


class LearnInteractResponse(BaseModel):
    response: str


# ---------------------------------------------------------------------------
# Built-in scenarios
# ---------------------------------------------------------------------------

SCENARIOS: list[dict[str, Any]] = [
    {
        "id": "sundowning-evening",
        "title": "Evening Agitation (Sundowning)",
        "description": "Your loved one becomes increasingly anxious and confused as evening approaches. They insist on 'going home' even though they are home.",
        "disease_stage": "middle",
        "category": "behavioral",
    },
    {
        "id": "refusal-to-bathe",
        "title": "Refusing to Bathe",
        "description": "Your loved one hasn't bathed in several days and becomes aggressive when you suggest it.",
        "disease_stage": "middle",
        "category": "daily_care",
    },
    {
        "id": "wandering-night",
        "title": "Nighttime Wandering",
        "description": "You wake up at 2am to find your loved one dressed and trying to leave the house.",
        "disease_stage": "middle",
        "category": "safety",
    },
    {
        "id": "repeated-questions",
        "title": "Repetitive Questions",
        "description": "Your loved one has asked you the same question 15 times in the last hour. You feel your patience wearing thin.",
        "disease_stage": "early",
        "category": "communication",
    },
    {
        "id": "medication-refusal",
        "title": "Medication Refusal",
        "description": "Your loved one is spitting out their medications and accusing you of trying to poison them.",
        "disease_stage": "middle",
        "category": "daily_care",
    },
    {
        "id": "caregiver-burnout",
        "title": "Caregiver Overwhelm",
        "description": "You haven't slept more than 4 hours a night in weeks. You snapped at your loved one today and feel terrible about it.",
        "disease_stage": "late",
        "category": "self_care",
    },
]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/learn/scenarios", response_model=list[Scenario])
async def list_scenarios(
    disease_stage: str | None = None,
    category: str | None = None,
):
    filtered = SCENARIOS
    if disease_stage:
        filtered = [s for s in filtered if s["disease_stage"] == disease_stage]
    if category:
        filtered = [s for s in filtered if s["category"] == category]
    return filtered


@router.post(
    "/learn/interact",
    response_model=LearnInteractResponse,
    responses={404: {"model": ErrorResponse}},
)
async def learn_interact(
    payload: LearnInteractRequest,
    request: Request,
    _rl: None = Depends(rate_limit("learn")),
):
    # Find the scenario
    scenario = next((s for s in SCENARIOS if s["id"] == payload.scenario_id), None)
    if scenario is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Scenario not found", "code": "SCENARIO_NOT_FOUND"},
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
        return LearnInteractResponse(response=safety.response_text)

    # 1. Rewrite query to English for RAG corpus
    llm = request.app.state.llm_provider
    model_override = resolve_model_for_locale(locale_code)
    rewritten_user_query = await build_english_rag_query(
        llm,
        locale_code=locale_code,
        user_text=payload.message,
        context=f"{scenario['title']}: {scenario['description']}",
    )
    rag_query = f"{scenario['title']}: {scenario['description']} {rewritten_user_query}"
    if rewritten_user_query != payload.message:
        logger.info("RAG learn query rewritten to English: %s", rewritten_user_query)

    # 2. Fetch RAG context
    rag_context = await _fetch_rag_context(rag_query)

    # 3. Render prompt with RAG context
    system_prompt = render_learn_prompt(
        disease_stage=payload.disease_stage,
        scenario_type=scenario["category"],
        rag_context=rag_context,
        language=language,
        language_constraint=language_constraint,
    )

    messages = [
        {
            "role": "user",
            "content": f"Scenario: {scenario['description']}\n\nMy response: {payload.message}",
        },
    ]

    raw_response = await llm.completion(system_prompt, messages, model_override=model_override)
    response_text = await guard_response_text(
        llm,
        mode="learn",
        locale_code=locale_code,
        language=language,
        text=raw_response,
    )

    return LearnInteractResponse(response=response_text)
