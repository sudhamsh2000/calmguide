from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.facility import Facility
from app.models.facility_patient_link import FacilityPatientLink
from app.models.incident import Incident
from app.models.staff import Staff
from app.services.audit_service import log_audit
from app.services.rbac import require_role

router = APIRouter(prefix="/facility/executive", tags=["facility-executive"])


@router.get("/overview")
async def executive_overview(
    staff: Staff = Depends(require_role("owner")),
    session: AsyncSession = Depends(get_session),
):
    facility_id = staff.facility_id
    now = datetime.now(timezone.utc)

    facility_result = await session.execute(
        select(Facility).where(Facility.id == facility_id)
    )
    facility = facility_result.scalar_one_or_none()
    created_at = facility.created_at if facility else None
    if created_at and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    days_active = (now - created_at).days if created_at else 0

    linked_profiles = select(FacilityPatientLink.profile_id).where(
        FacilityPatientLink.facility_id == facility_id,
        FacilityPatientLink.is_active == True,
    ).scalar_subquery()

    thirty_days_ago = now - timedelta(days=30)
    sixty_days_ago = now - timedelta(days=60)

    current_result = await session.execute(
        select(func.count(Incident.id)).where(
            Incident.profile_id.in_(linked_profiles),
            Incident.created_at >= thirty_days_ago,
        )
    )
    current_incidents = current_result.scalar() or 0

    previous_result = await session.execute(
        select(func.count(Incident.id)).where(
            Incident.profile_id.in_(linked_profiles),
            Incident.created_at >= sixty_days_ago,
            Incident.created_at < thirty_days_ago,
        )
    )
    previous_incidents = previous_result.scalar() or 0

    change_pct = 0
    if previous_incidents > 0:
        change_pct = round((current_incidents - previous_incidents) / previous_incidents * 100)

    total_staff_result = await session.execute(
        select(func.count(Staff.id)).where(
            Staff.facility_id == facility_id,
            Staff.is_active == True,
        )
    )
    total_staff = total_staff_result.scalar() or 0

    seven_days_ago = now - timedelta(days=7)
    active_staff_result = await session.execute(
        select(func.count(Staff.id)).where(
            Staff.facility_id == facility_id,
            Staff.is_active == True,
            Staff.last_login_at >= seven_days_ago,
        )
    )
    active_staff = active_staff_result.scalar() or 0
    adoption_pct = round((active_staff / total_staff * 100) if total_staff else 0)

    await log_audit(staff, "READ", "executive_dashboard", session=session)
    await session.commit()

    return {
        "days_active": days_active,
        "incident_rate": {
            "current": current_incidents,
            "previous": previous_incidents,
            "change_pct": change_pct,
        },
        "adoption_rate": {
            "staff_pct": adoption_pct,
            "active_staff": active_staff,
            "total_staff": total_staff,
        },
        "roi_estimate": {
            "incident_reduction_pct": abs(change_pct) if change_pct < 0 else 0,
        },
    }
