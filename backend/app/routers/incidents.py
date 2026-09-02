"""Incident CRUD, patterns, digest, and verification endpoints."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.behavioral_dossier import BehavioralDossier
from app.models.incident import Incident
from app.models.profile import Profile
from app.models.staff import Staff
from app.schemas.incident import (
    IncidentCreate,
    IncidentListResponse,
    IncidentResponse,
    IncidentUpdate,
    VerifyRequest,
)
from app.services.auth import hash_access_code
from app.services.crypto import decrypt, encrypt
from app.services.rbac import require_role, staff_can_access_profile

router = APIRouter(prefix="/incidents", tags=["incidents"])


async def _get_profile(access_code: str, session: AsyncSession) -> Profile:
    code_hash = hash_access_code(access_code)
    result = await session.execute(select(Profile).where(Profile.access_code_hash == code_hash))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=404,
            detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
        )
    return profile


def _compute_time_slot(dt: datetime) -> str:
    hour = dt.hour
    if hour < 6:
        return "overnight"
    elif hour < 12:
        return "morning"
    elif hour < 18:
        return "afternoon"
    return "evening"


def _compute_recall_confidence(incident_time: datetime, logged_at: datetime) -> str:
    hours = (logged_at - incident_time).total_seconds() / 3600
    if hours <= 2:
        return "high"
    elif hours <= 24:
        return "moderate"
    elif hours <= 48:
        return "low"
    return "very_low"


def _incident_to_response(incident: Incident) -> IncidentResponse:
    return IncidentResponse(
        id=incident.id,
        profile_id=incident.profile_id,
        conversation_id=incident.conversation_id,
        source=incident.source,
        incident_time=incident.incident_time.isoformat(),
        time_slot=incident.time_slot,
        behavior_category=incident.behavior_category,
        behavior_subcategory=incident.behavior_subcategory,
        severity=incident.severity,
        duration_category=incident.duration_category,
        antecedent_description=(
            decrypt(incident.antecedent_description) if incident.antecedent_description else None
        ),
        antecedent_category=incident.antecedent_category,
        behavior_description=decrypt(incident.behavior_description),
        intervention_description=(
            decrypt(incident.intervention_description)
            if incident.intervention_description
            else None
        ),
        intervention_outcome=incident.intervention_outcome,
        location=incident.location,
        is_recurring=incident.is_recurring,
        caregiver_role=incident.caregiver_role,
        recall_confidence=incident.recall_confidence,
        extraction_confidence=incident.extraction_confidence,
        verified_by_caregiver=incident.verified_by_caregiver,
        created_at=incident.created_at.isoformat(),
    )


async def _mark_dossier_stale(profile_id: str, session: AsyncSession) -> None:
    result = await session.execute(
        select(BehavioralDossier).where(BehavioralDossier.profile_id == profile_id)
    )
    dossier = result.scalar_one_or_none()
    if dossier:
        dossier.is_stale = True
    else:
        session.add(BehavioralDossier(profile_id=profile_id, is_stale=True))


@router.get("/{access_code}/patterns")
async def get_patterns(
    access_code: str,
    session: AsyncSession = Depends(get_session),
):
    profile = await _get_profile(access_code, session)

    seven_days_ago = datetime.now(UTC) - timedelta(days=7)
    fourteen_days_ago = datetime.now(UTC) - timedelta(days=14)

    result = await session.execute(
        select(Incident)
        .where(Incident.profile_id == profile.id)
        .where(Incident.incident_time >= fourteen_days_ago)
        .order_by(Incident.incident_time.desc())
    )
    incidents = result.scalars().all()

    if not incidents:
        return {
            "time_clusters": {},
            "frequency_trends": {},
            "effective_interventions": [],
            "contraindicated": [],
            "escalation_pattern": None,
            "confidence_level": "none",
        }

    time_clusters: dict[str, int] = {}
    freq_current: dict[str, int] = {}
    freq_previous: dict[str, int] = {}
    effective: dict[str, int] = {}
    contra: list[dict] = []

    for inc in incidents:
        slot = inc.time_slot or "unknown"
        time_clusters[slot] = time_clusters.get(slot, 0) + 1

        cat = inc.behavior_category
        if inc.incident_time >= seven_days_ago:
            freq_current[cat] = freq_current.get(cat, 0) + 1
        else:
            freq_previous[cat] = freq_previous.get(cat, 0) + 1

        if inc.intervention_outcome == "resolved" and inc.intervention_description:
            desc = decrypt(inc.intervention_description)
            effective[desc] = effective.get(desc, 0) + 1

        if inc.intervention_outcome == "escalated" and inc.intervention_description:
            contra.append(
                {
                    "description": decrypt(inc.intervention_description),
                    "behavior": inc.behavior_category,
                }
            )

    all_cats = set(freq_current) | set(freq_previous)
    frequency_trends = {}
    for cat in all_cats:
        cur = freq_current.get(cat, 0)
        prev = freq_previous.get(cat, 0)
        if prev > 0 and cur >= prev * 2:
            direction = "spike"
        elif cur > prev:
            direction = "increasing"
        elif cur < prev:
            direction = "decreasing"
        else:
            direction = "stable"
        frequency_trends[cat] = {
            "current_weekly": cur,
            "previous_weekly": prev,
            "direction": direction,
            "clinical_flag": direction == "spike",
        }

    effective_list = [
        {"intervention": k, "behavior": "mixed", "count": v}
        for k, v in sorted(effective.items(), key=lambda x: -x[1])[:10]
    ]

    total = len(incidents)
    if total >= 20:
        confidence_level = "high"
    elif total >= 13:
        confidence_level = "moderate"
    elif total >= 8:
        confidence_level = "low"
    elif total >= 5:
        confidence_level = "provisional"
    else:
        confidence_level = "none"

    return {
        "time_clusters": time_clusters,
        "frequency_trends": frequency_trends,
        "effective_interventions": effective_list,
        "contraindicated": contra,
        "escalation_pattern": None,
        "confidence_level": confidence_level,
    }


@router.get("/{access_code}/verification-pending")
async def get_verification_pending(
    access_code: str,
    session: AsyncSession = Depends(get_session),
):
    profile = await _get_profile(access_code, session)

    twenty_four_hours_ago = datetime.now(UTC) - timedelta(hours=24)

    result = await session.execute(
        select(Incident)
        .where(
            Incident.profile_id == profile.id,
            Incident.source == "auto_extracted",
            Incident.verified_by_caregiver == False,
            Incident.created_at >= twenty_four_hours_ago,
        )
        .order_by(Incident.created_at.desc())
        .limit(1)
    )
    incident = result.scalar_one_or_none()
    if not incident:
        return Response(status_code=204)

    desc = decrypt(incident.behavior_description)
    antecedent = (
        decrypt(incident.antecedent_description) if incident.antecedent_description else None
    )
    intervention = (
        decrypt(incident.intervention_description) if incident.intervention_description else None
    )

    parts = []
    if antecedent:
        parts.append(antecedent)
    parts.append(desc)
    if intervention:
        outcome_text = incident.intervention_outcome or ""
        parts.append(f"You tried: {intervention}. Outcome: {outcome_text}.")

    return {
        "incident_id": incident.id,
        "summary_text": " ".join(parts),
    }


@router.post("/by-profile/{profile_id}", status_code=201)
async def create_incident_by_profile(
    profile_id: str,
    payload: IncidentCreate,
    staff: Staff = Depends(require_role("staff", "admin")),
    session: AsyncSession = Depends(get_session),
):
    """Create incident using profile_id directly (facility/B2B mode)."""
    result = await session.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=404,
            detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
        )
    # Object-level authz: prevent writing incidents into another facility's
    # patient record (IDOR). Attribution is derived from the verified token.
    if not await staff_can_access_profile(session, staff, profile_id):
        raise HTTPException(
            status_code=403,
            detail={"error": "Not authorized for this patient", "code": "PROFILE_FORBIDDEN"},
        )

    now = datetime.now(UTC)
    incident = Incident(
        profile_id=profile.id,
        source=payload.source,
        incident_time=payload.incident_time,
        time_slot=_compute_time_slot(payload.incident_time),
        behavior_category=payload.behavior_category,
        severity=payload.severity,
        duration_category=payload.duration_category,
        antecedent_description=(
            encrypt(payload.antecedent_description) if payload.antecedent_description else None
        ),
        antecedent_category=payload.antecedent_category,
        behavior_description=encrypt(payload.behavior_description),
        intervention_description=(
            encrypt(payload.intervention_description) if payload.intervention_description else None
        ),
        intervention_outcome=payload.intervention_outcome,
        location=payload.location,
        caregiver_role=payload.caregiver_role,
        is_recurring=payload.is_recurring,
        recall_confidence=_compute_recall_confidence(payload.incident_time, now),
        staff_id=staff.id,
        facility_id=staff.facility_id,
    )
    session.add(incident)
    await _mark_dossier_stale(profile.id, session)
    await session.commit()
    await session.refresh(incident)
    return {"id": incident.id, "created_at": incident.created_at.isoformat()}


@router.post("/{access_code}", status_code=201)
async def create_incident(
    access_code: str,
    payload: IncidentCreate,
    session: AsyncSession = Depends(get_session),
):
    profile = await _get_profile(access_code, session)
    now = datetime.now(UTC)

    incident = Incident(
        profile_id=profile.id,
        source=payload.source,
        incident_time=payload.incident_time,
        time_slot=_compute_time_slot(payload.incident_time),
        behavior_category=payload.behavior_category,
        severity=payload.severity,
        duration_category=payload.duration_category,
        antecedent_description=(
            encrypt(payload.antecedent_description) if payload.antecedent_description else None
        ),
        antecedent_category=payload.antecedent_category,
        behavior_description=encrypt(payload.behavior_description),
        intervention_description=(
            encrypt(payload.intervention_description) if payload.intervention_description else None
        ),
        intervention_outcome=payload.intervention_outcome,
        location=payload.location,
        caregiver_role=payload.caregiver_role,
        is_recurring=payload.is_recurring,
        recall_confidence=_compute_recall_confidence(payload.incident_time, now),
        staff_id=payload.staff_id,
        facility_id=payload.facility_id,
    )
    session.add(incident)
    await _mark_dossier_stale(profile.id, session)

    await session.commit()
    await session.refresh(incident)
    return {"id": incident.id, "created_at": incident.created_at.isoformat()}


@router.get("/{access_code}", response_model=IncidentListResponse)
async def list_incidents(
    access_code: str,
    category: str | None = None,
    severity: str | None = None,
    since: str | None = None,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    profile = await _get_profile(access_code, session)

    query = select(Incident).where(Incident.profile_id == profile.id)
    count_query = select(func.count(Incident.id)).where(Incident.profile_id == profile.id)

    if category:
        query = query.where(Incident.behavior_category == category)
        count_query = count_query.where(Incident.behavior_category == category)
    if severity:
        query = query.where(Incident.severity == severity)
        count_query = count_query.where(Incident.severity == severity)
    if since:
        since_dt = datetime.fromisoformat(since)
        query = query.where(Incident.incident_time >= since_dt)
        count_query = count_query.where(Incident.incident_time >= since_dt)

    query = query.order_by(Incident.created_at.desc()).limit(limit).offset(offset)

    result = await session.execute(query)
    incidents = result.scalars().all()
    count_result = await session.execute(count_query)
    total = count_result.scalar() or 0

    return IncidentListResponse(
        incidents=[_incident_to_response(i) for i in incidents],
        total=total,
    )


@router.get("/{access_code}/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    access_code: str,
    incident_id: str,
    session: AsyncSession = Depends(get_session),
):
    profile = await _get_profile(access_code, session)
    result = await session.execute(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.profile_id == profile.id,
        )
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(
            status_code=404,
            detail={"error": "Incident not found", "code": "INCIDENT_NOT_FOUND"},
        )
    return _incident_to_response(incident)


@router.put("/{access_code}/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    access_code: str,
    incident_id: str,
    payload: IncidentUpdate,
    session: AsyncSession = Depends(get_session),
):
    profile = await _get_profile(access_code, session)
    result = await session.execute(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.profile_id == profile.id,
        )
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(
            status_code=404,
            detail={"error": "Incident not found", "code": "INCIDENT_NOT_FOUND"},
        )

    encrypted_fields = {
        "behavior_description",
        "antecedent_description",
        "intervention_description",
    }
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None and field in encrypted_fields:
            setattr(incident, field, encrypt(value))
        else:
            setattr(incident, field, value)

    incident.verified_by_caregiver = True
    incident.verified_at = datetime.now(UTC)

    await _mark_dossier_stale(profile.id, session)
    await session.commit()
    await session.refresh(incident)
    return _incident_to_response(incident)


@router.post("/{access_code}/verify/{incident_id}")
async def verify_incident(
    access_code: str,
    incident_id: str,
    payload: VerifyRequest,
    session: AsyncSession = Depends(get_session),
):
    profile = await _get_profile(access_code, session)
    result = await session.execute(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.profile_id == profile.id,
        )
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(
            status_code=404,
            detail={"error": "Incident not found", "code": "INCIDENT_NOT_FOUND"},
        )

    if payload.corrections:
        encrypted_fields = {
            "behavior_description",
            "antecedent_description",
            "intervention_description",
        }
        correction_data = payload.corrections.model_dump(exclude_unset=True)
        for field, value in correction_data.items():
            if value is not None and field in encrypted_fields:
                setattr(incident, field, encrypt(value))
            else:
                setattr(incident, field, value)
        await _mark_dossier_stale(profile.id, session)

    incident.verified_by_caregiver = True
    incident.verified_at = datetime.now(UTC)

    await session.commit()
    await session.refresh(incident)
    return _incident_to_response(incident)
