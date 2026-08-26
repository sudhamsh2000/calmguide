"""Behavioral dossier computation — dirty-flag, temporal weighting, LLM narrative.

Recomputes the per-profile dossier from weighted incident history. Uses a
debounce pattern (skip if computed within last 60 minutes) and structured
analysis to generate contraindicated/effective lists, frequency trends,
delirium/pain flags, and a 7-day timeline.
"""

import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.behavioral_dossier import BehavioralDossier
from app.models.care_change_event import CareChangeEvent
from app.models.incident import Incident
from app.models.profile import Profile
from app.services.care_window import is_excluded, pre_change_cutoff
from app.services.crypto import decrypt, encrypt

logger = logging.getLogger(__name__)

RECALL_WEIGHTS = {"high": 1.0, "moderate": 0.8, "low": 0.5, "very_low": 0.3}

# Matches the last band of _apply_temporal_weight: past this, weight is 0.0.
MAX_INCIDENT_AGE_DAYS = 365


def _apply_temporal_weight(incident_time: datetime, now: datetime) -> float:
    # Normalize both to UTC-aware for safe subtraction (SQLite strips tzinfo)
    if incident_time.tzinfo is None:
        incident_time = incident_time.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    age_days = (now - incident_time).days
    if age_days <= 30:
        return 1.0
    elif age_days <= 180:
        return 0.5
    elif age_days <= 365:
        return 0.2
    return 0.0


def _ensure_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _apply_stage_transition_weight(
    incident_time: datetime,
    stage_changed_at: datetime | None,
) -> float:
    if stage_changed_at and _ensure_utc(incident_time) < _ensure_utc(stage_changed_at):
        return 0.3
    return 1.0


def _is_in_observation_window(
    incident_time: datetime,
    care_changes: list,
    now: datetime,
) -> bool:
    """True when this incident predates a still-open observation window."""
    cutoff = pre_change_cutoff(care_changes, now.date())
    return is_excluded(incident_time.date(), cutoff)


def compute_incident_weight(
    incident: Incident,
    now: datetime,
    stage_changed_at: datetime | None,
    care_changes: list,
) -> float:
    weight = _apply_temporal_weight(incident.incident_time, now)
    if weight == 0.0:
        return 0.0

    weight *= _apply_stage_transition_weight(incident.incident_time, stage_changed_at)
    weight *= RECALL_WEIGHTS.get(incident.recall_confidence or "high", 1.0)

    if incident.extraction_confidence:
        weight *= incident.extraction_confidence

    if _is_in_observation_window(_ensure_utc(incident.incident_time), care_changes, now):
        return 0.0

    return weight


async def mark_dossier_stale(profile_id: str, session: AsyncSession) -> None:
    result = await session.execute(
        select(BehavioralDossier).where(
            BehavioralDossier.profile_id == profile_id
        )
    )
    dossier = result.scalar_one_or_none()
    if dossier:
        dossier.is_stale = True
    else:
        session.add(BehavioralDossier(profile_id=profile_id, is_stale=True))


async def get_dossier_if_fresh(
    profile_id: str, session: AsyncSession
) -> BehavioralDossier | None:
    result = await session.execute(
        select(BehavioralDossier).where(
            BehavioralDossier.profile_id == profile_id,
            BehavioralDossier.is_stale == False,
        )
    )
    return result.scalar_one_or_none()


async def compute_dossier(
    profile_id: str,
    session: AsyncSession,
    llm_provider=None,
) -> BehavioralDossier:
    now = datetime.now(timezone.utc)

    result = await session.execute(
        select(BehavioralDossier).where(
            BehavioralDossier.profile_id == profile_id
        )
    )
    dossier = result.scalar_one_or_none()

    if dossier and dossier.computed_at and not dossier.is_stale:
        if (now - dossier.computed_at).total_seconds() < 3600:
            return dossier

    profile_result = await session.execute(
        select(Profile).where(Profile.id == profile_id)
    )
    profile = profile_result.scalar_one()

    care_changes_result = await session.execute(
        select(CareChangeEvent).where(
            CareChangeEvent.profile_id == profile_id,
            CareChangeEvent.is_active == True,
        )
    )
    care_changes = care_changes_result.scalars().all()

    # Anything older than the decay horizon weighs 0.0 (see
    # _apply_temporal_weight), so there is no reason to read, decrypt and
    # discard it. Keeps the read flat as a profile's history grows.
    incidents_result = await session.execute(
        select(Incident)
        .where(
            Incident.profile_id == profile_id,
            Incident.incident_time >= now - timedelta(days=MAX_INCIDENT_AGE_DAYS),
        )
        .order_by(Incident.incident_time.desc())
    )
    all_incidents = incidents_result.scalars().all()

    weighted_incidents = []
    for incident in all_incidents:
        weight = compute_incident_weight(
            incident, now, profile.stage_changed_at, care_changes
        )
        if weight > 0:
            weighted_incidents.append((incident, weight))

    contraindicated = []
    effective = []
    seven_day = []
    frequency_by_category: dict[str, dict] = {}
    seven_days_ago = now - timedelta(days=7)

    for incident, weight in weighted_incidents:
        cat = incident.behavior_category
        itime = _ensure_utc(incident.incident_time)
        frequency_by_category.setdefault(cat, {"recent": 0, "previous": 0})

        if itime >= now - timedelta(days=7):
            frequency_by_category[cat]["recent"] += 1
        elif itime >= now - timedelta(days=14):
            frequency_by_category[cat]["previous"] += 1

        if incident.intervention_outcome == "escalated":
            contraindicated.append({
                "description": (
                    decrypt(incident.intervention_description)
                    if incident.intervention_description
                    else "Unknown intervention"
                ),
                "incident_date": itime.isoformat(),
                "behavior": incident.behavior_category,
                "weight": weight,
            })
        elif incident.intervention_outcome == "resolved":
            effective.append({
                "intervention": (
                    decrypt(incident.intervention_description)
                    if incident.intervention_description
                    else "Unknown"
                ),
                "behavior": incident.behavior_category,
                "caregiver_role": incident.caregiver_role,
                "date": itime.isoformat(),
                "weight": weight,
            })

        if itime >= seven_days_ago:
            seven_day.append({
                "date": itime.isoformat(),
                "behavior_category": incident.behavior_category,
                "severity": incident.severity,
                "outcome": incident.intervention_outcome,
            })

    # Heaviest first: the prompt shows a bounded slice of each list, and the
    # weight already encodes recency, recall confidence and extraction
    # confidence — so the entries most worth the caregiver's tokens lead.
    contraindicated.sort(key=lambda item: item["weight"], reverse=True)
    effective.sort(key=lambda item: item["weight"], reverse=True)

    trends = {}
    for cat, counts in frequency_by_category.items():
        direction = "stable"
        if counts["recent"] > counts["previous"] * 2 and counts["recent"] >= 2:
            direction = "spike"
        elif counts["recent"] > counts["previous"]:
            direction = "increasing"
        elif counts["recent"] < counts["previous"]:
            direction = "decreasing"
        trends[cat] = {
            "current_weekly": counts["recent"],
            "previous_weekly": counts["previous"],
            "direction": direction,
            "clinical_flag": direction == "spike",
        }

    delirium_flags = {
        "sudden_change": any(t["direction"] == "spike" for t in trends.values()),
        "details": (
            "Frequency spike detected"
            if any(t["direction"] == "spike" for t in trends.values())
            else None
        ),
    }

    pain_behaviors = {"aggression_anger", "refusing_care", "repetitive_behavior"}
    recent_pain_related = sum(
        1 for i, w in weighted_incidents
        if i.behavior_category in pain_behaviors
        and _ensure_utc(i.incident_time) >= seven_days_ago
    )
    pain_flags = {
        "suspected": recent_pain_related >= 2,
        "indicators": list({
            i.behavior_category
            for i, w in weighted_incidents
            if i.behavior_category in pain_behaviors
            and _ensure_utc(i.incident_time) >= seven_days_ago
        }),
    }

    if not dossier:
        dossier = BehavioralDossier(profile_id=profile_id)
        session.add(dossier)

    dossier.contraindicated_json = encrypt(json.dumps(contraindicated))
    dossier.effective_json = encrypt(json.dumps(effective))
    dossier.seven_day_timeline = encrypt(json.dumps(seven_day))
    dossier.frequency_trends = encrypt(json.dumps(trends))
    dossier.delirium_flags = encrypt(json.dumps(delirium_flags))
    dossier.pain_flags = encrypt(json.dumps(pain_flags))
    dossier.is_stale = False
    dossier.version = (dossier.version or 0) + 1
    dossier.computed_at = now

    if llm_provider and weighted_incidents:
        try:
            dossier_narrative = await _generate_dossier_narrative(
                llm_provider, contraindicated, effective, trends, seven_day, profile
            )
            dossier.dossier_text = encrypt(dossier_narrative)
        except Exception:
            logger.exception("Dossier narrative generation failed")

    await session.commit()
    return dossier


_DOSSIER_SYSTEM_PROMPT = """You are a clinical behavioral analyst writing a patient behavioral dossier for dementia caregivers.

Safety rules:
1. Report ONLY what is supported by the incident data provided. Do NOT fabricate incidents, dates, or details.
2. Do NOT provide medical diagnoses, medication recommendations, or clinical interpretations beyond behavioral observation.
3. Use dignity-preserving language — never use words like "crazy," "senile," "burden," or "difficult patient."
4. Do NOT speculate about causes beyond what the data shows. If a pattern is unclear, say so.
5. Focus on actionable information: what to avoid, what works, and what has changed recently."""


async def _generate_dossier_narrative(
    llm_provider,
    contraindicated: list,
    effective: list,
    trends: dict,
    seven_day: list,
    profile: Profile,
) -> str:
    prompt = f"""Generate a concise behavioral dossier for a {profile.disease_stage}-stage dementia patient.

CONTRAINDICATED (what NOT to do):
{json.dumps(contraindicated[:5], indent=2)}

EFFECTIVE (what works):
{json.dumps(effective[:10], indent=2)}

FREQUENCY TRENDS:
{json.dumps(trends, indent=2)}

LAST 7 DAYS:
{json.dumps(seven_day[:10], indent=2)}

Write a narrative summary in under 300 words covering: what NOT to do (most important), what works, current trends, and any clinical flags. Be specific — use dates, times, and exact interventions. Only describe what the data shows — do not invent or assume details not present in the data above."""

    return await llm_provider.completion(
        system_prompt=_DOSSIER_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
