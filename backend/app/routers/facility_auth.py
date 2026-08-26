from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.facility import Facility
from app.models.staff import Staff
from app.schemas.staff import AuthResponse, EmailLoginRequest, PinLoginRequest, StaffResponse
from app.services.auth import hash_access_code
from app.services.audit_service import log_audit
from app.services.facility_auth import verify_password, verify_pin
from app.services.jwt_service import create_token
from app.services.rbac import require_role

router = APIRouter(prefix="/facility/auth", tags=["facility-auth"])

LOCKOUT_MINUTES = 30
MAX_FAILED_ATTEMPTS = 5

# Shared-tablet PIN sessions get a short, fixed expiry rather than the
# standard JWT_EXPIRY_SECONDS — a facility tablet is handed between staff
# members, so a long-lived token would let one CNA's session (and identity in
# the audit log) carry over to whoever picks up the device next. /refresh
# must also honor this — see the auth_method check in refresh_token below.
PIN_TOKEN_EXPIRY_SECONDS = 60


def _staff_response(staff: Staff) -> StaffResponse:
    return StaffResponse(
        id=staff.id,
        name=staff.name,
        email=staff.email,
        role=staff.role,
        language_preference=staff.language_preference,
        is_active=staff.is_active,
        last_login_at=staff.last_login_at.isoformat() if staff.last_login_at else None,
        created_at=staff.created_at.isoformat() if staff.created_at else "",
    )


@router.post("/pin")
async def pin_login(
    payload: PinLoginRequest,
    session: AsyncSession = Depends(get_session),
):
    code_hash = hash_access_code(payload.facility_code)
    facility_result = await session.execute(
        select(Facility).where(
            Facility.facility_code_hash == code_hash,
            Facility.is_active == True,
        )
    )
    facility = facility_result.scalar_one_or_none()
    if not facility:
        raise HTTPException(404, {"error": "Facility not found", "code": "FACILITY_NOT_FOUND"})

    staff_result = await session.execute(
        select(Staff).where(
            Staff.id == payload.staff_id,
            Staff.facility_id == facility.id,
            Staff.is_active == True,
        )
    )
    staff = staff_result.scalar_one_or_none()
    if not staff:
        raise HTTPException(404, {"error": "Staff not found", "code": "STAFF_NOT_FOUND"})

    now = datetime.now(timezone.utc)
    if staff.locked_until and staff.locked_until > now:
        raise HTTPException(423, {"error": "Account locked. Try again later.", "code": "ACCOUNT_LOCKED"})

    if not staff.pin_hash or not verify_pin(payload.pin, staff.pin_hash):
        staff.failed_login_count += 1
        if staff.failed_login_count >= MAX_FAILED_ATTEMPTS:
            staff.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
        await log_audit(staff, "FAILED_LOGIN", "auth", outcome="FAILURE", session=session)
        await session.commit()
        raise HTTPException(401, {"error": "Invalid PIN", "code": "INVALID_PIN"})

    staff.failed_login_count = 0
    staff.locked_until = None
    staff.last_login_at = now
    await log_audit(staff, "LOGIN", "auth", session=session)
    await session.commit()

    token = create_token(
        staff_id=staff.id, facility_id=facility.id, role=staff.role,
        expiry_seconds=PIN_TOKEN_EXPIRY_SECONDS, auth_method="pin",
    )
    exp = now + timedelta(seconds=PIN_TOKEN_EXPIRY_SECONDS)

    return AuthResponse(
        token=token,
        staff=_staff_response(staff),
        expires_at=exp.isoformat(),
    )


@router.post("/login")
async def email_login(
    payload: EmailLoginRequest,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Staff).where(
            Staff.email == payload.email,
            Staff.is_active == True,
        )
    )
    staff = result.scalar_one_or_none()
    if not staff or not staff.password_hash:
        raise HTTPException(401, {"error": "Invalid credentials", "code": "INVALID_CREDENTIALS"})

    now = datetime.now(timezone.utc)
    if staff.locked_until and staff.locked_until > now:
        raise HTTPException(423, {"error": "Account locked", "code": "ACCOUNT_LOCKED"})

    if not verify_password(payload.password, staff.password_hash):
        staff.failed_login_count += 1
        if staff.failed_login_count >= MAX_FAILED_ATTEMPTS:
            staff.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
        await log_audit(staff, "FAILED_LOGIN", "auth", outcome="FAILURE", session=session)
        await session.commit()
        raise HTTPException(401, {"error": "Invalid credentials", "code": "INVALID_CREDENTIALS"})

    staff.failed_login_count = 0
    staff.locked_until = None
    staff.last_login_at = now
    await log_audit(staff, "LOGIN", "auth", session=session)
    await session.commit()

    token = create_token(
        staff_id=staff.id, facility_id=staff.facility_id, role=staff.role,
        auth_method="password",
    )
    from app.config import get_settings
    exp = now + timedelta(seconds=get_settings().JWT_EXPIRY_SECONDS)

    return AuthResponse(
        token=token,
        staff=_staff_response(staff),
        expires_at=exp.isoformat(),
    )


@router.post("/refresh")
async def refresh_token(
    request: Request,
    staff: Staff = Depends(require_role("staff", "admin", "owner")),
):
    # Reissue with the same auth_method as the token being refreshed, so a
    # short-lived PIN session can't be silently extended to the standard
    # session length just by calling /refresh (see PIN_TOKEN_EXPIRY_SECONDS).
    original_payload = getattr(request.state, "token_payload", {})
    auth_method = original_payload.get("auth_method", "password")
    expiry_seconds = PIN_TOKEN_EXPIRY_SECONDS if auth_method == "pin" else None

    token = create_token(
        staff_id=staff.id, facility_id=staff.facility_id, role=staff.role,
        expiry_seconds=expiry_seconds, auth_method=auth_method,
    )

    from app.config import get_settings
    exp_seconds = expiry_seconds if expiry_seconds is not None else get_settings().JWT_EXPIRY_SECONDS
    exp = datetime.now(timezone.utc) + timedelta(seconds=exp_seconds)
    return {
        "token": token,
        "staff": _staff_response(staff),
        "expires_at": exp.isoformat(),
    }


@router.post("/logout")
async def logout(
    staff: Staff = Depends(require_role("staff", "admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    await log_audit(staff, "LOGOUT", "auth", session=session)
    await session.commit()
    return {"status": "ok"}
