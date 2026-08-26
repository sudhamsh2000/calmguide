from uuid import UUID

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.facility_patient_link import FacilityPatientLink
from app.models.staff import Staff
from app.models.staff_patient_assignment import StaffPatientAssignment
from app.services.jwt_service import verify_token


async def staff_can_access_profile(
    session: AsyncSession, staff: Staff, profile_id: str
) -> bool:
    """Object-level authorization: may this staff member access this profile?

    admin/owner may reach any profile actively linked to their own facility;
    a staff-role member may only reach profiles they are actively assigned to.
    Used by every B2B endpoint that takes a raw profile_id to prevent IDOR.
    """
    if staff.role in ("admin", "owner"):
        result = await session.execute(
            select(FacilityPatientLink).where(
                FacilityPatientLink.facility_id == staff.facility_id,
                FacilityPatientLink.profile_id == profile_id,
                FacilityPatientLink.is_active == True,
            )
        )
        return result.scalar_one_or_none() is not None

    result = await session.execute(
        select(StaffPatientAssignment).where(
            StaffPatientAssignment.staff_id == staff.id,
            StaffPatientAssignment.profile_id == profile_id,
            StaffPatientAssignment.ended_at == None,
        )
    )
    return result.scalar_one_or_none() is not None


def _set_facility_rls(session: AsyncSession, facility_id: str):
    """Set the PostgreSQL RLS GUC for facility isolation.

    asyncpg's SET statement does not accept bind parameters, so the value is
    interpolated. To keep that safe we validate it is a real UUID first (it is a
    system-generated id, never user input, but we defend in depth). SET LOCAL is
    PostgreSQL-only, so we skip it on other dialects (e.g. SQLite in tests).
    """
    dialect = getattr(getattr(session.get_bind(), "dialect", None), "name", "")
    if dialect != "postgresql":
        return None
    try:
        safe_id = str(UUID(str(facility_id)))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=500,
            detail={"error": "Invalid facility context", "code": "BAD_FACILITY_ID"},
        )
    return session.execute(text(f"SET LOCAL app.current_facility_id = '{safe_id}'"))


async def get_current_staff(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Staff | None:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]
    try:
        payload = verify_token(token)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail={"error": "Invalid or expired token", "code": "INVALID_TOKEN"},
        )
    request.state.token_payload = payload

    result = await session.execute(
        select(Staff).where(
            Staff.id == payload["staff_id"],
            Staff.is_active == True,
        )
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(
            status_code=401,
            detail={"error": "Staff account not found or inactive", "code": "STAFF_NOT_FOUND"},
        )

    stmt = _set_facility_rls(session, staff.facility_id)
    if stmt is not None:
        await stmt

    return staff


def require_role(*roles: str):
    async def dependency(
        staff: Staff | None = Depends(get_current_staff),
    ) -> Staff:
        if not staff:
            raise HTTPException(
                status_code=401,
                detail={"error": "Authentication required", "code": "AUTH_REQUIRED"},
            )
        if staff.role not in roles:
            raise HTTPException(
                status_code=403,
                detail={"error": "Insufficient permissions", "code": "FORBIDDEN"},
            )
        return staff
    return dependency


def require_any_staff():
    return require_role("staff", "admin", "owner")
