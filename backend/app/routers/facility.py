import secrets

from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import get_settings
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.facility import Facility
from app.models.facility_patient_link import FacilityPatientLink
from app.models.profile import Profile
from app.models.staff import Staff
from app.schemas.facility import FacilityCreate, FacilityResponse, FacilityUpdate
from app.schemas.staff import PatientLinkRequest, ResidentCreateRequest
from app.services.auth import hash_access_code
from app.services.audit_service import log_audit
from app.services.crypto import encrypt
from app.services.rbac import require_role

import json
import secrets as _secrets
import string as _string

_CODE_ALPHA = "".join(c for c in _string.ascii_uppercase + _string.digits if c not in "0O1IL")


def _generate_access_code() -> str:
    return "".join(_secrets.choice(_CODE_ALPHA) for _ in range(8))

router = APIRouter(prefix="/facilities", tags=["facilities"])

ACCESS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _generate_facility_code() -> str:
    return "".join(secrets.choice(ACCESS_CODE_ALPHABET) for _ in range(8))


async def _get_owned_facility(
    facility_code: str, staff: Staff, session: AsyncSession
) -> Facility:
    """Resolve a facility from its code and enforce that the authenticated
    caller belongs to it — the multi-tenancy boundary (prevents cross-facility
    IDOR where staff act on another facility by changing the URL code)."""
    code_hash = hash_access_code(facility_code)
    result = await session.execute(
        select(Facility).where(Facility.facility_code_hash == code_hash)
    )
    facility = result.scalar_one_or_none()
    if not facility:
        raise HTTPException(404, {"error": "Facility not found", "code": "FACILITY_NOT_FOUND"})
    if facility.id != staff.facility_id:
        raise HTTPException(403, {"error": "Access denied for this facility", "code": "WRONG_FACILITY"})
    return facility


@router.post("", status_code=201)
async def create_facility(
    payload: FacilityCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    admin_key = request.headers.get("X-Admin-Key", "")
    settings = get_settings()
    if not settings.ADMIN_API_KEY or admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=403,
            detail={"error": "Admin API key required", "code": "ADMIN_KEY_REQUIRED"},
        )
    for _ in range(10):
        code = _generate_facility_code()
        code_hash = hash_access_code(code)
        existing = await session.execute(
            select(Facility).where(Facility.facility_code_hash == code_hash)
        )
        if not existing.scalar_one_or_none():
            break
    else:
        raise HTTPException(500, {"error": "Could not generate unique code", "code": "CODE_GENERATION_FAILED"})

    facility = Facility(
        name=payload.name,
        facility_code_hash=code_hash,
        is_active=True,
    )
    session.add(facility)
    await session.commit()
    await session.refresh(facility)

    return FacilityResponse(
        id=facility.id,
        name=facility.name,
        facility_code=code,
        is_active=facility.is_active,
        created_at=facility.created_at.isoformat(),
    )


@router.get("/{facility_code}/verify")
async def verify_facility_code(
    facility_code: str,
    session: AsyncSession = Depends(get_session),
):
    """Unauthenticated — validates a facility code exists and returns basic info.
    Used by the login page before any staff has authenticated."""
    code_hash = hash_access_code(facility_code)
    facility_result = await session.execute(
        select(Facility).where(
            Facility.facility_code_hash == code_hash,
            Facility.is_active == True,
        )
    )
    facility = facility_result.scalar_one_or_none()
    if not facility:
        raise HTTPException(404, {"error": "Facility not found", "code": "FACILITY_NOT_FOUND"})

    return {
        "id": facility.id,
        "name": facility.name,
        "is_active": facility.is_active,
    }


@router.get("/{facility_code}")
async def get_facility(
    facility_code: str,
    staff: Staff = Depends(require_role("staff", "admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    """Authenticated — returns full facility details including counts."""
    facility = await _get_owned_facility(facility_code, staff, session)

    patient_count_result = await session.execute(
        select(func.count(FacilityPatientLink.id)).where(
            FacilityPatientLink.facility_id == facility.id,
            FacilityPatientLink.is_active == True,
        )
    )
    staff_count_result = await session.execute(
        select(func.count(Staff.id)).where(
            Staff.facility_id == facility.id,
            Staff.is_active == True,
        )
    )

    return FacilityResponse(
        id=facility.id,
        name=facility.name,
        patient_count=patient_count_result.scalar() or 0,
        staff_count=staff_count_result.scalar() or 0,
        default_language=(facility.settings or {}).get("default_language", "en-US"),
        timezone=(facility.settings or {}).get("timezone", "US/Eastern"),
        is_active=facility.is_active,
        created_at=facility.created_at.isoformat(),
    )


@router.patch("/{facility_code}")
async def update_facility(
    facility_code: str,
    payload: FacilityUpdate,
    staff: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    facility = await _get_owned_facility(facility_code, staff, session)

    facility.name = payload.name.strip()
    facility.settings = {
        **(facility.settings or {}),
        "default_language": payload.default_language,
        "timezone": payload.timezone,
    }

    await log_audit(staff, "UPDATE", "facility_settings", facility.id, session=session)
    await session.commit()
    await session.refresh(facility)

    patient_count_result = await session.execute(
        select(func.count(FacilityPatientLink.id)).where(
            FacilityPatientLink.facility_id == facility.id,
            FacilityPatientLink.is_active == True,
        )
    )
    staff_count_result = await session.execute(
        select(func.count(Staff.id)).where(
            Staff.facility_id == facility.id,
            Staff.is_active == True,
        )
    )

    return FacilityResponse(
        id=facility.id,
        name=facility.name,
        patient_count=patient_count_result.scalar() or 0,
        staff_count=staff_count_result.scalar() or 0,
        default_language=(facility.settings or {}).get("default_language", "en-US"),
        timezone=(facility.settings or {}).get("timezone", "US/Eastern"),
        is_active=facility.is_active,
        created_at=facility.created_at.isoformat(),
    )


@router.post("/{facility_code}/patients", status_code=201)
async def link_patient(
    facility_code: str,
    payload: PatientLinkRequest,
    staff: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    facility = await _get_owned_facility(facility_code, staff, session)

    patient_hash = hash_access_code(payload.access_code)
    profile_result = await session.execute(
        select(Profile).where(Profile.access_code_hash == patient_hash)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, {"error": "Patient profile not found", "code": "PROFILE_NOT_FOUND"})

    existing = await session.execute(
        select(FacilityPatientLink).where(
            FacilityPatientLink.facility_id == facility.id,
            FacilityPatientLink.profile_id == profile.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, {"error": "Patient already linked", "code": "ALREADY_LINKED"})

    link = FacilityPatientLink(
        facility_id=facility.id,
        profile_id=profile.id,
        linked_by=staff.id,
        unit=payload.unit,
        room=payload.room,
        bed=payload.bed,
        is_active=True,
    )
    session.add(link)
    await log_audit(staff, "CREATE", "patient_link", profile.id, session=session)
    await session.commit()

    return {
        "profile_id": profile.id,
        "disease_stage": profile.disease_stage,
    }


@router.post("/{facility_code}/residents", status_code=201)
async def create_resident(
    facility_code: str,
    payload: ResidentCreateRequest,
    staff: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    """Create a new resident profile and link it to this facility in one step."""
    facility = await _get_owned_facility(facility_code, staff, session)

    for _ in range(10):
        code = _generate_access_code()
        ac_hash = hash_access_code(code)
        dup = await session.execute(select(Profile).where(Profile.access_code_hash == ac_hash))
        if dup.scalar_one_or_none() is None:
            break
    else:
        raise HTTPException(500, {"error": "Failed to generate unique code", "code": "CODE_GENERATION_FAILED"})

    profile = Profile(
        access_code_hash=ac_hash,
        disease_stage=payload.disease_stage,
        behavioral_patterns=encrypt(json.dumps(payload.behavioral_patterns or [])),
        calming_strategies=encrypt(json.dumps(payload.calming_strategies or [])),
        safety_concerns=encrypt(json.dumps(payload.safety_concerns or [])),
    )
    session.add(profile)
    await session.flush()

    link = FacilityPatientLink(
        facility_id=facility.id,
        profile_id=profile.id,
        linked_by=staff.id,
        unit=payload.unit,
        room=payload.room,
        bed=payload.bed,
        is_active=True,
    )
    session.add(link)
    await log_audit(staff, "CREATE", "resident", profile.id, session=session)
    await session.commit()

    return {
        "profile_id": profile.id,
        "access_code": code,
        "disease_stage": profile.disease_stage,
        "unit": payload.unit,
        "room": payload.room,
        "bed": payload.bed,
    }


@router.get("/{facility_code}/patients")
async def list_patients(
    facility_code: str,
    staff: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    facility = await _get_owned_facility(facility_code, staff, session)

    links_result = await session.execute(
        select(FacilityPatientLink, Profile).join(
            Profile, FacilityPatientLink.profile_id == Profile.id
        ).where(
            FacilityPatientLink.facility_id == facility.id,
            FacilityPatientLink.is_active == True,
        )
    )
    patients = []
    for link, profile in links_result.all():
        patients.append({
            "profile_id": profile.id,
            "disease_stage": profile.disease_stage,
            "unit": link.unit,
            "room": link.room,
            "bed": link.bed,
        })

    return {"patients": patients}
