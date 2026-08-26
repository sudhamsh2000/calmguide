from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.facility import Facility
from app.models.facility_patient_link import FacilityPatientLink
from app.models.staff import Staff
from app.models.staff_patient_assignment import StaffPatientAssignment
from app.schemas.staff import (
    AssignmentCreate,
    AssignmentResponse,
    StaffCreate,
    StaffListItem,
    StaffResponse,
    StaffUpdate,
)
from app.services.auth import hash_access_code
from app.services.audit_service import log_audit
from app.services.facility_auth import hash_password, hash_pin
from app.services.rbac import require_role

router = APIRouter(prefix="/facilities", tags=["facility-staff"])


async def _get_facility(
    facility_code: str, session: AsyncSession, staff: Staff | None = None
) -> Facility:
    code_hash = hash_access_code(facility_code)
    result = await session.execute(
        select(Facility).where(
            Facility.facility_code_hash == code_hash,
            Facility.is_active == True,
        )
    )
    facility = result.scalar_one_or_none()
    if not facility:
        raise HTTPException(404, {"error": "Facility not found", "code": "FACILITY_NOT_FOUND"})
    # Multi-tenancy boundary: an authenticated caller may only act on their own
    # facility, regardless of the code in the URL (prevents cross-facility IDOR).
    if staff is not None and facility.id != staff.facility_id:
        raise HTTPException(403, {"error": "Access denied for this facility", "code": "WRONG_FACILITY"})
    return facility


async def _assigned_count(staff_id: str, session: AsyncSession) -> int:
    result = await session.execute(
        select(func.count(StaffPatientAssignment.id)).where(
            StaffPatientAssignment.staff_id == staff_id,
            StaffPatientAssignment.ended_at == None,
        )
    )
    return result.scalar() or 0


def _staff_response(staff: Staff, assigned: int = 0) -> StaffResponse:
    return StaffResponse(
        id=staff.id,
        name=staff.name,
        email=staff.email,
        role=staff.role,
        language_preference=staff.language_preference,
        is_active=staff.is_active,
        last_login_at=staff.last_login_at.isoformat() if staff.last_login_at else None,
        assigned_patients_count=assigned,
        created_at=staff.created_at.isoformat() if staff.created_at else "",
    )


@router.post("/{facility_code}/staff", status_code=201)
async def create_staff(
    facility_code: str,
    payload: StaffCreate,
    admin: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    facility = await _get_facility(facility_code, session, admin)

    if payload.role in ("admin", "owner") and not payload.email:
        raise HTTPException(400, {"error": "Email required for admin/owner roles", "code": "EMAIL_REQUIRED"})

    staff = Staff(
        facility_id=facility.id,
        name=payload.name,
        email=payload.email,
        role=payload.role,
        pin_hash=hash_pin(payload.pin) if payload.pin else None,
        password_hash=hash_password(payload.password) if payload.password else None,
        language_preference=payload.language_preference,
        is_active=True,
        failed_login_count=0,
    )
    session.add(staff)
    await log_audit(admin, "CREATE", "staff", session=session)
    await session.commit()
    await session.refresh(staff)

    return _staff_response(staff)


@router.get("/{facility_code}/staff")
async def list_staff(
    facility_code: str,
    admin: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    facility = await _get_facility(facility_code, session, admin)
    result = await session.execute(
        select(Staff).where(
            Staff.facility_id == facility.id,
            Staff.is_active == True,
        ).order_by(Staff.name)
    )
    staff_list = []
    for s in result.scalars().all():
        assigned = await _assigned_count(s.id, session)
        staff_list.append(_staff_response(s, assigned))

    return {"staff": staff_list}


@router.get("/{facility_code}/staff/active")
async def list_active_staff(
    facility_code: str,
    session: AsyncSession = Depends(get_session),
):
    facility = await _get_facility(facility_code, session)
    result = await session.execute(
        select(Staff).where(
            Staff.facility_id == facility.id,
            Staff.is_active == True,
        ).order_by(Staff.name)
    )
    return {
        "staff": [
            StaffListItem(id=s.id, name=s.name, role=s.role)
            for s in result.scalars().all()
        ]
    }


@router.put("/{facility_code}/staff/{staff_id}")
async def update_staff(
    facility_code: str,
    staff_id: str,
    payload: StaffUpdate,
    admin: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    facility = await _get_facility(facility_code, session, admin)
    result = await session.execute(
        select(Staff).where(
            Staff.id == staff_id,
            Staff.facility_id == facility.id,
        )
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(404, {"error": "Staff not found", "code": "STAFF_NOT_FOUND"})

    if payload.name is not None:
        staff.name = payload.name
    if payload.role is not None:
        staff.role = payload.role
    if payload.is_active is not None:
        staff.is_active = payload.is_active
    if payload.language_preference is not None:
        staff.language_preference = payload.language_preference

    await log_audit(admin, "UPDATE", "staff", staff.id, session=session)
    await session.commit()

    assigned = await _assigned_count(staff.id, session)
    return _staff_response(staff, assigned)


@router.delete("/{facility_code}/staff/{staff_id}")
async def deactivate_staff(
    facility_code: str,
    staff_id: str,
    admin: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    facility = await _get_facility(facility_code, session, admin)
    result = await session.execute(
        select(Staff).where(
            Staff.id == staff_id,
            Staff.facility_id == facility.id,
        )
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(404, {"error": "Staff not found", "code": "STAFF_NOT_FOUND"})

    staff.is_active = False

    assignments_result = await session.execute(
        select(StaffPatientAssignment).where(
            StaffPatientAssignment.staff_id == staff_id,
            StaffPatientAssignment.ended_at == None,
        )
    )
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    for assignment in assignments_result.scalars().all():
        assignment.ended_at = now

    await log_audit(admin, "DELETE", "staff", staff.id, session=session)
    await session.commit()
    return {"status": "ok"}


@router.post("/{facility_code}/assignments", status_code=201)
async def create_assignment(
    facility_code: str,
    payload: AssignmentCreate,
    admin: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    facility = await _get_facility(facility_code, session, admin)

    # Validate staff belongs to this facility
    staff_check = await session.execute(
        select(Staff).where(
            Staff.id == payload.staff_id,
            Staff.facility_id == facility.id,
            Staff.is_active == True,
        )
    )
    if not staff_check.scalar_one_or_none():
        raise HTTPException(404, {"error": "Staff not found in this facility", "code": "STAFF_NOT_FOUND"})

    # Validate patient is linked to this facility
    link_check = await session.execute(
        select(FacilityPatientLink).where(
            FacilityPatientLink.profile_id == payload.profile_id,
            FacilityPatientLink.facility_id == facility.id,
            FacilityPatientLink.is_active == True,
        )
    )
    if not link_check.scalar_one_or_none():
        raise HTTPException(404, {"error": "Patient not linked to this facility", "code": "PATIENT_NOT_LINKED"})

    existing = await session.execute(
        select(StaffPatientAssignment).where(
            StaffPatientAssignment.staff_id == payload.staff_id,
            StaffPatientAssignment.profile_id == payload.profile_id,
            StaffPatientAssignment.ended_at == None,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, {"error": "Assignment already exists", "code": "ALREADY_ASSIGNED"})

    assignment = StaffPatientAssignment(
        staff_id=payload.staff_id,
        profile_id=payload.profile_id,
        facility_id=facility.id,
        shift_pattern=payload.shift_pattern,
        is_primary=payload.is_primary,
    )
    session.add(assignment)
    await log_audit(admin, "CREATE", "assignment", session=session)
    await session.commit()
    await session.refresh(assignment)

    return AssignmentResponse(
        id=assignment.id,
        staff_id=assignment.staff_id,
        profile_id=assignment.profile_id,
        shift_pattern=assignment.shift_pattern,
        is_primary=assignment.is_primary,
        started_at=assignment.started_at.isoformat() if assignment.started_at else "",
    )


@router.delete("/{facility_code}/assignments/{assignment_id}")
async def remove_assignment(
    facility_code: str,
    assignment_id: str,
    admin: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    facility = await _get_facility(facility_code, session, admin)

    result = await session.execute(
        select(StaffPatientAssignment).where(
            StaffPatientAssignment.id == assignment_id,
            StaffPatientAssignment.facility_id == facility.id,
            StaffPatientAssignment.ended_at == None,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(404, {"error": "Assignment not found", "code": "ASSIGNMENT_NOT_FOUND"})

    from datetime import datetime, timezone
    assignment.ended_at = datetime.now(timezone.utc)

    await log_audit(admin, "DELETE", "assignment", assignment_id, session=session)
    await session.commit()
    return {"status": "ok"}


@router.get("/{facility_code}/assignments")
async def list_assignments(
    facility_code: str,
    staff_id: str | None = None,
    staff: Staff = Depends(require_role("staff", "admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    facility = await _get_facility(facility_code, session, staff)

    if staff.role == "staff" and staff_id and staff_id != staff.id:
        raise HTTPException(403, {"error": "Can only view own assignments", "code": "FORBIDDEN"})

    query = select(StaffPatientAssignment).where(
        StaffPatientAssignment.facility_id == facility.id,
        StaffPatientAssignment.ended_at == None,
    )
    if staff_id:
        query = query.where(StaffPatientAssignment.staff_id == staff_id)
    elif staff.role == "staff":
        query = query.where(StaffPatientAssignment.staff_id == staff.id)

    result = await session.execute(query)
    return {
        "assignments": [
            AssignmentResponse(
                id=a.id,
                staff_id=a.staff_id,
                profile_id=a.profile_id,
                shift_pattern=a.shift_pattern,
                is_primary=a.is_primary,
                started_at=a.started_at.isoformat() if a.started_at else "",
            )
            for a in result.scalars().all()
        ]
    }
