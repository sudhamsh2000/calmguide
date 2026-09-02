"""Retrieve relevant past incidents for coach prompt injection.

Uses keyword-based behavior category detection to find structurally similar
incidents. Falls back to most-recent incidents if fewer than max_results
match the detected categories.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incident import Incident
from app.services.crypto import decrypt

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "aggression_anger": [
        "hit",
        "hitting",
        "punch",
        "kick",
        "push",
        "threw",
        "aggressive",
        "angry",
        "yelling",
        "screaming",
        "violent",
        "slap",
        "bite",
    ],
    "wandering_exit_seeking": [
        "leave",
        "leaving",
        "wander",
        "wandering",
        "door",
        "outside",
        "escape",
        "elopement",
        "exit",
        "walk away",
        "trying to go",
    ],
    "confusion_disorientation": [
        "confused",
        "confusion",
        "disoriented",
        "lost",
        "doesn't know",
        "doesn't recognize",
        "where am i",
        "who are you",
    ],
    "refusing_care": [
        "refuse",
        "refusing",
        "won't take",
        "won't eat",
        "won't bathe",
        "resists",
        "fighting",
        "medication",
        "won't let",
    ],
    "sleep_problems": [
        "sleep",
        "awake",
        "insomnia",
        "nighttime",
        "up all night",
        "won't stay in bed",
        "3am",
        "2am",
        "middle of the night",
    ],
    "hallucinations": [
        "seeing things",
        "hearing things",
        "hallucin",
        "talking to someone",
        "people who aren't there",
        "imaginary",
        "sees people",
    ],
    "repetitive_behavior": [
        "keeps asking",
        "same question",
        "pacing",
        "repetitive",
        "over and over",
        "won't stop",
    ],
}


def detect_behavior_categories(message: str) -> list[str]:
    message_lower = message.lower()
    detected = []
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in message_lower for kw in keywords):
            detected.append(category)
    return detected or ["other"]


def format_incident_for_prompt(incident: Incident) -> dict:
    return {
        "date": incident.incident_time.isoformat() if incident.incident_time else "",
        "behavior_category": incident.behavior_category,
        "severity": incident.severity,
        "antecedent": (
            decrypt(incident.antecedent_description) if incident.antecedent_description else None
        ),
        "behavior": decrypt(incident.behavior_description),
        "intervention": (
            decrypt(incident.intervention_description)
            if incident.intervention_description
            else None
        ),
        "outcome": incident.intervention_outcome,
    }


async def get_relevant_incidents(
    profile_id: str,
    user_message: str,
    session: AsyncSession,
    max_results: int = 3,
) -> list[Incident]:
    categories = detect_behavior_categories(user_message)

    result = await session.execute(
        select(Incident)
        .where(
            Incident.profile_id == profile_id,
            Incident.behavior_category.in_(categories),
        )
        .order_by(Incident.created_at.desc())
        .limit(max_results)
    )
    incidents = list(result.scalars().all())

    if len(incidents) < max_results:
        remaining = max_results - len(incidents)
        existing_ids = [i.id for i in incidents]
        fallback_query = (
            select(Incident)
            .where(Incident.profile_id == profile_id)
            .order_by(Incident.created_at.desc())
            .limit(remaining)
        )
        if existing_ids:
            fallback_query = fallback_query.where(Incident.id.notin_(existing_ids))
        fallback_result = await session.execute(fallback_query)
        incidents.extend(fallback_result.scalars().all())

    return incidents
