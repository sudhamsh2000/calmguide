import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.behavioral_dossier import BehavioralDossier
from app.models.facility_patient_link import FacilityPatientLink
from app.models.incident import Incident
from app.models.profile import Profile
from app.models.staff import Staff
from app.models.staff_patient_assignment import StaffPatientAssignment
from app.services.audit_service import log_audit
from app.services.crypto import decrypt
from app.services.dossier import get_dossier_if_fresh, compute_dossier
from app.services.rbac import require_role

router = APIRouter(prefix="/facility", tags=["facility-residents"])


def _parse_encrypted_json(value: str | None) -> list | None:
    if not value:
        return None
    try:
        return json.loads(decrypt(value))
    except Exception:
        return None


@router.get("/my-residents")
async def get_my_residents(
    staff: Staff = Depends(require_role("staff", "admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    if staff.role == "staff":
        assignments = await session.execute(
            select(StaffPatientAssignment.profile_id).where(
                StaffPatientAssignment.staff_id == staff.id,
                StaffPatientAssignment.ended_at == None,
            )
        )
        profile_ids = [r[0] for r in assignments.all()]
    else:
        links = await session.execute(
            select(FacilityPatientLink.profile_id).where(
                FacilityPatientLink.facility_id == staff.facility_id,
                FacilityPatientLink.is_active == True,
            )
        )
        profile_ids = [r[0] for r in links.all()]

    if not profile_ids:
        return {"residents": []}

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # Bulk-load everything keyed by profile_id (one query each) instead of the
    # previous 5-queries-per-resident N+1, which scaled linearly with census.
    profiles_result = await session.execute(
        select(Profile).where(Profile.id.in_(profile_ids))
    )
    profiles_by_id = {p.id: p for p in profiles_result.scalars().all()}

    dossiers_result = await session.execute(
        select(BehavioralDossier).where(BehavioralDossier.profile_id.in_(profile_ids))
    )
    dossiers_by_id = {d.profile_id: d for d in dossiers_result.scalars().all()}

    counts_result = await session.execute(
        select(Incident.profile_id, func.count(Incident.id))
        .where(
            Incident.profile_id.in_(profile_ids),
            Incident.incident_time >= seven_days_ago,
        )
        .group_by(Incident.profile_id)
    )
    recent_counts = {pid: count for pid, count in counts_result.all()}

    # Most recent incident per profile via a window function (one query).
    row_number = func.row_number().over(
        partition_by=Incident.profile_id,
        order_by=Incident.created_at.desc(),
    ).label("rn")
    last_subq = (
        select(
            Incident.profile_id.label("pid"),
            Incident.behavior_category.label("category"),
            Incident.intervention_outcome.label("outcome"),
            row_number,
        )
        .where(Incident.profile_id.in_(profile_ids))
        .subquery()
    )
    last_result = await session.execute(
        select(last_subq.c.pid, last_subq.c.category, last_subq.c.outcome).where(
            last_subq.c.rn == 1
        )
    )
    last_by_id = {row.pid: (row.category, row.outcome) for row in last_result.all()}

    links_result = await session.execute(
        select(
            FacilityPatientLink.profile_id,
            FacilityPatientLink.unit,
            FacilityPatientLink.room,
            FacilityPatientLink.bed,
        ).where(
            FacilityPatientLink.profile_id.in_(profile_ids),
            FacilityPatientLink.facility_id == staff.facility_id,
            FacilityPatientLink.is_active == True,
        )
    )
    link_by_id = {row.profile_id: row for row in links_result.all()}

    residents = []
    for pid in profile_ids:
        p = profiles_by_id.get(pid)
        if not p:
            continue

        d = dossiers_by_id.get(pid)
        top_contra = None
        top_effective = None
        if d:
            contra_list = _parse_encrypted_json(d.contraindicated_json)
            if contra_list:
                top_contra = contra_list[0].get("description", "") if isinstance(contra_list[0], dict) else str(contra_list[0])
            eff_list = _parse_encrypted_json(d.effective_json)
            if eff_list:
                top_effective = eff_list[0].get("intervention", "") if isinstance(eff_list[0], dict) else str(eff_list[0])

        recent_count = recent_counts.get(pid, 0)
        risk = "low"
        if recent_count >= 5:
            risk = "high"
        elif recent_count >= 2:
            risk = "moderate"

        last_summary = None
        if pid in last_by_id:
            category, outcome = last_by_id[pid]
            last_summary = f"{category} ({outcome or 'pending'})"

        link_row = link_by_id.get(pid)
        unit_val = link_row.unit if link_row else None
        room_val = link_row.room if link_row else None
        bed_val = link_row.bed if link_row else None

        await log_audit(staff, "READ", "patient_profile", pid, session=session)

        residents.append({
            "profile_id": pid,
            "unit": unit_val,
            "room": room_val,
            "bed": bed_val,
            "disease_stage": p.disease_stage,
            "risk_level": risk,
            "top_contraindicated": top_contra,
            "top_effective": top_effective,
            "last_incident_summary": last_summary,
            "trend_direction": "stable",
        })

    await session.commit()
    return {"residents": residents}


@router.get("/residents/{profile_id}/behavioral-card")
async def get_behavioral_card(
    profile_id: str,
    request: Request,
    staff: Staff = Depends(require_role("staff", "admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    if staff.role == "staff":
        assignment = await session.execute(
            select(StaffPatientAssignment).where(
                StaffPatientAssignment.staff_id == staff.id,
                StaffPatientAssignment.profile_id == profile_id,
                StaffPatientAssignment.ended_at == None,
            )
        )
        if not assignment.scalar_one_or_none():
            raise HTTPException(403, {"error": "Not assigned to this patient", "code": "NOT_ASSIGNED"})

    d = await get_dossier_if_fresh(profile_id, session)
    if not d:
        try:
            llm = getattr(request.app.state, "llm_provider", None)
            d = await compute_dossier(profile_id, session, llm)
        except Exception:
            d = None
    if not d:
        stale_result = await session.execute(
            select(BehavioralDossier).where(BehavioralDossier.profile_id == profile_id)
        )
        d = stale_result.scalar_one_or_none()

    what_works = _parse_encrypted_json(d.effective_json) if d else []
    what_not = _parse_encrypted_json(d.contraindicated_json) if d else []
    escalation = None
    if d and d.escalation_pattern:
        try:
            escalation = decrypt(d.escalation_pattern)
        except Exception:
            pass

    delirium_flags = _parse_encrypted_json(d.delirium_flags) if d else None
    pain_flags = _parse_encrypted_json(d.pain_flags) if d else None

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    incidents_result = await session.execute(
        select(Incident).where(
            Incident.profile_id == profile_id,
            Incident.incident_time >= seven_days_ago,
        ).order_by(Incident.incident_time.desc()).limit(10)
    )
    recent_incidents = []
    for inc in incidents_result.scalars().all():
        recent_incidents.append({
            "date": inc.incident_time.isoformat(),
            "category": inc.behavior_category,
            "severity": inc.severity,
            "outcome": inc.intervention_outcome,
        })

    await log_audit(staff, "READ", "patient_profile", profile_id, session=session)
    await session.commit()

    return {
        "what_works": what_works or [],
        "what_not_to_do": what_not or [],
        "escalation_pattern": escalation,
        "recent_incidents": recent_incidents,
        "delirium_flags": delirium_flags,
        "pain_flags": pain_flags,
    }
