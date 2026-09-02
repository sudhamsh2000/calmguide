from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.conversation import Conversation
from app.models.facility_patient_link import FacilityPatientLink
from app.models.incident import Incident
from app.models.staff import Staff
from app.models.staff_patient_assignment import StaffPatientAssignment
from app.services.audit_service import log_audit
from app.services.crypto import decrypt
from app.services.rbac import require_role

router = APIRouter(prefix="/facility/dashboard", tags=["facility-dashboard"])


@router.get("/summary")
async def dashboard_summary(
    hours: int = Query(24, ge=1, le=168),
    staff: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    now = datetime.now(UTC)
    since = now - timedelta(hours=hours)
    facility_id = staff.facility_id

    linked_profiles = (
        select(FacilityPatientLink.profile_id)
        .where(
            FacilityPatientLink.facility_id == facility_id,
            FacilityPatientLink.is_active == True,
        )
        .scalar_subquery()
    )

    total_result = await session.execute(
        select(func.count(Incident.id)).where(
            Incident.profile_id.in_(linked_profiles),
            Incident.created_at >= since,
        )
    )
    total_incidents = total_result.scalar() or 0

    severe_result = await session.execute(
        select(func.count(Incident.id)).where(
            Incident.profile_id.in_(linked_profiles),
            Incident.created_at >= since,
            Incident.severity == "severe",
        )
    )
    severe = severe_result.scalar() or 0

    total_staff_result = await session.execute(
        select(func.count(Staff.id)).where(
            Staff.facility_id == facility_id,
            Staff.is_active == True,
        )
    )
    total_staff = total_staff_result.scalar() or 0

    active_staff_result = await session.execute(
        select(func.count(Staff.id)).where(
            Staff.facility_id == facility_id,
            Staff.is_active == True,
            Staff.last_login_at >= since,
        )
    )
    active_staff = active_staff_result.scalar() or 0

    family_sessions_result = await session.execute(
        select(func.count(distinct(Conversation.session_id))).where(
            Conversation.profile_id.in_(linked_profiles),
            Conversation.created_at >= since,
            Conversation.staff_id == None,
        )
    )
    family_sessions = family_sessions_result.scalar() or 0

    escalating_residents = await _find_escalating_residents(session, facility_id, since, now)

    await log_audit(staff, "READ", "facility_dashboard", session=session)
    await session.commit()

    return {
        "incident_count": {
            "total": total_incidents,
            "severe": severe,
            "mild": total_incidents - severe,
        },
        "escalating_residents": escalating_residents,
        "staff_adoption": {
            "active_users": active_staff,
            "total_staff": total_staff,
            "percentage": round((active_staff / total_staff * 100) if total_staff else 0),
        },
        "family_sessions": {
            "count": family_sessions,
            "resolved_without_911": family_sessions,
        },
    }


async def _find_escalating_residents(
    session: AsyncSession, facility_id: str, since: datetime, now: datetime
) -> list[dict]:
    """Residents with a behavior_category spiking in the current window vs. the
    prior equal-length window — same per-category spike heuristic
    services/dossier.py uses (recent >= 2 and recent > previous * 2).

    Returns {profile_id, category, trend} matching the shape already consumed
    by frontend/src/lib/facility-api.ts and mobile/src/lib/facility-api.ts.
    """
    window_length = now - since
    previous_since = since - window_length

    linked_profiles = (
        select(FacilityPatientLink.profile_id)
        .where(
            FacilityPatientLink.facility_id == facility_id,
            FacilityPatientLink.is_active == True,
        )
        .scalar_subquery()
    )

    recent_result = await session.execute(
        select(Incident.profile_id, Incident.behavior_category, func.count(Incident.id))
        .where(
            Incident.profile_id.in_(linked_profiles),
            Incident.incident_time >= since,
            Incident.incident_time < now,
        )
        .group_by(Incident.profile_id, Incident.behavior_category)
    )
    recent_counts = {(pid, cat): count for pid, cat, count in recent_result.all()}

    previous_result = await session.execute(
        select(Incident.profile_id, Incident.behavior_category, func.count(Incident.id))
        .where(
            Incident.profile_id.in_(linked_profiles),
            Incident.incident_time >= previous_since,
            Incident.incident_time < since,
        )
        .group_by(Incident.profile_id, Incident.behavior_category)
    )
    previous_counts = {(pid, cat): count for pid, cat, count in previous_result.all()}

    escalating = []
    for (profile_id, category), recent_count in recent_counts.items():
        previous_count = previous_counts.get((profile_id, category), 0)
        if recent_count >= 2 and recent_count > previous_count * 2:
            escalating.append(
                {
                    "profile_id": profile_id,
                    "category": category,
                    "trend": "spike",
                }
            )
    return escalating


@router.get("/trends")
async def dashboard_trends(
    period: str = Query("7d", pattern="^(7d|30d|90d)$"),
    staff: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    days = {"7d": 7, "30d": 30, "90d": 90}[period]
    since = datetime.now(UTC) - timedelta(days=days)
    facility_id = staff.facility_id

    linked_profiles = (
        select(FacilityPatientLink.profile_id)
        .where(
            FacilityPatientLink.facility_id == facility_id,
            FacilityPatientLink.is_active == True,
        )
        .scalar_subquery()
    )

    incidents_result = await session.execute(
        select(Incident)
        .where(
            Incident.profile_id.in_(linked_profiles),
            Incident.created_at >= since,
        )
        .order_by(Incident.created_at)
    )
    incidents = incidents_result.scalars().all()

    category_counts: dict[str, int] = {}
    time_dist = {"overnight": 0, "morning": 0, "afternoon": 0, "evening": 0}
    intervention_stats: dict[str, dict] = {}

    for inc in incidents:
        cat = inc.behavior_category
        category_counts[cat] = category_counts.get(cat, 0) + 1

        if inc.time_slot:
            slot = inc.time_slot.lower()
            if slot in time_dist:
                time_dist[slot] += 1

        if inc.intervention_description:
            key = decrypt(inc.intervention_description)[:50]
            if key not in intervention_stats:
                intervention_stats[key] = {"count": 0, "success": 0}
            intervention_stats[key]["count"] += 1
            if inc.intervention_outcome in ("resolved", "improved"):
                intervention_stats[key]["success"] += 1

    effectiveness = []
    for intervention, stats in intervention_stats.items():
        rate = round(stats["success"] / stats["count"] * 100) if stats["count"] else 0
        effectiveness.append(
            {
                "intervention": intervention,
                "success_rate": rate,
                "count": stats["count"],
            }
        )
    effectiveness.sort(key=lambda x: x["success_rate"], reverse=True)

    await log_audit(staff, "READ", "facility_trends", session=session)
    await session.commit()

    return {
        "incident_frequency": category_counts,
        "time_distribution": time_dist,
        "intervention_effectiveness": effectiveness[:10],
    }


@router.get("/staff-activity")
async def staff_activity(
    staff: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    facility_id = staff.facility_id
    seven_days_ago = datetime.now(UTC) - timedelta(days=7)

    staff_result = await session.execute(
        select(Staff)
        .where(
            Staff.facility_id == facility_id,
            Staff.is_active == True,
        )
        .order_by(Staff.name)
    )
    staff_members = staff_result.scalars().all()
    staff_ids = [s.id for s in staff_members]

    # Bulk aggregates keyed by staff_id (3 GROUP BY queries) instead of the
    # previous 3-queries-per-staff N+1.
    incidents_by_staff: dict[str, int] = {}
    sessions_by_staff: dict[str, int] = {}
    assigned_by_staff: dict[str, int] = {}
    if staff_ids:
        incidents_rows = await session.execute(
            select(Incident.staff_id, func.count(Incident.id))
            .where(Incident.staff_id.in_(staff_ids), Incident.created_at >= seven_days_ago)
            .group_by(Incident.staff_id)
        )
        incidents_by_staff = {sid: count for sid, count in incidents_rows.all()}

        sessions_rows = await session.execute(
            select(Conversation.staff_id, func.count(distinct(Conversation.session_id)))
            .where(Conversation.staff_id.in_(staff_ids), Conversation.created_at >= seven_days_ago)
            .group_by(Conversation.staff_id)
        )
        sessions_by_staff = {sid: count for sid, count in sessions_rows.all()}

        assigned_rows = await session.execute(
            select(StaffPatientAssignment.staff_id, func.count(StaffPatientAssignment.id))
            .where(
                StaffPatientAssignment.staff_id.in_(staff_ids),
                StaffPatientAssignment.ended_at == None,
            )
            .group_by(StaffPatientAssignment.staff_id)
        )
        assigned_by_staff = {sid: count for sid, count in assigned_rows.all()}

    activity = []
    for s in staff_members:
        activity.append(
            {
                "id": s.id,
                "name": s.name,
                "role": s.role,
                "sessions_this_week": sessions_by_staff.get(s.id, 0),
                "incidents_logged": incidents_by_staff.get(s.id, 0),
                "last_active": s.last_login_at.isoformat() if s.last_login_at else None,
                "assigned_patients_count": assigned_by_staff.get(s.id, 0),
            }
        )

    await log_audit(staff, "READ", "staff_activity", session=session)
    await session.commit()

    return {"staff": activity}
