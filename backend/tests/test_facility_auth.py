"""Tests for POST /api/facility/auth/pin, /login, and /refresh.

Covers FAC-3: shared-tablet PIN logins must issue short-lived (60s) sessions,
distinct from the standard 900s email/password session, and /refresh must not
be usable to silently extend a PIN-issued session back up to the standard
window ("session isolation" for a device handed between staff members).
"""

from datetime import datetime, timezone

import pytest_asyncio

from app.models.facility import Facility
from app.models.staff import Staff
from app.services.auth import hash_access_code
from app.services.facility_auth import hash_pin, hash_password
from app.services.jwt_service import verify_token

PIN_TOKEN_EXPIRY_SECONDS = 60
STANDARD_TOKEN_EXPIRY_SECONDS = 900  # config.Settings.JWT_EXPIRY_SECONDS default


@pytest_asyncio.fixture
async def facility_with_staff(db_session):
    fac = Facility(name="A", facility_code_hash=hash_access_code("FACPIN01"), is_active=True)
    db_session.add(fac)
    await db_session.flush()

    nurse = Staff(
        facility_id=fac.id, name="Nurse", role="staff", is_active=True,
        pin_hash=hash_pin("4242"),
    )
    admin = Staff(
        facility_id=fac.id, name="Admin", email="admin@a.x", role="admin", is_active=True,
        password_hash=hash_password("correct horse battery staple"),
    )
    db_session.add_all([nurse, admin])
    await db_session.commit()
    return {"facility": fac, "nurse": nurse, "admin": admin}


def _expiry_seconds(token: str) -> int:
    payload = verify_token(token)
    return round(payload["exp"] - payload["iat"])


async def test_pin_login_issues_short_lived_token(client, facility_with_staff):
    resp = await client.post(
        "/api/facility/auth/pin",
        json={
            "facility_code": "FACPIN01",
            "staff_id": facility_with_staff["nurse"].id,
            "pin": "4242",
        },
    )
    assert resp.status_code == 200
    body = resp.json()

    assert _expiry_seconds(body["token"]) == PIN_TOKEN_EXPIRY_SECONDS

    expires_at = datetime.fromisoformat(body["expires_at"])
    now = datetime.now(timezone.utc)
    assert 50 <= (expires_at - now).total_seconds() <= 65


async def test_email_login_keeps_standard_session_length(client, facility_with_staff):
    resp = await client.post(
        "/api/facility/auth/login",
        json={"email": "admin@a.x", "password": "correct horse battery staple"},
    )
    assert resp.status_code == 200
    body = resp.json()

    assert _expiry_seconds(body["token"]) == STANDARD_TOKEN_EXPIRY_SECONDS


async def test_refresh_of_pin_session_stays_short_lived(client, facility_with_staff):
    login_resp = await client.post(
        "/api/facility/auth/pin",
        json={
            "facility_code": "FACPIN01",
            "staff_id": facility_with_staff["nurse"].id,
            "pin": "4242",
        },
    )
    pin_token = login_resp.json()["token"]

    refresh_resp = await client.post(
        "/api/facility/auth/refresh",
        headers={"Authorization": f"Bearer {pin_token}"},
    )
    assert refresh_resp.status_code == 200
    refreshed_token = refresh_resp.json()["token"]

    # The whole point of the short PIN session is that /refresh cannot be used
    # to silently extend it back up to the standard 900s window.
    assert _expiry_seconds(refreshed_token) == PIN_TOKEN_EXPIRY_SECONDS


async def test_refresh_of_email_session_stays_standard_length(client, facility_with_staff):
    login_resp = await client.post(
        "/api/facility/auth/login",
        json={"email": "admin@a.x", "password": "correct horse battery staple"},
    )
    email_token = login_resp.json()["token"]

    refresh_resp = await client.post(
        "/api/facility/auth/refresh",
        headers={"Authorization": f"Bearer {email_token}"},
    )
    assert refresh_resp.status_code == 200
    refreshed_token = refresh_resp.json()["token"]

    assert _expiry_seconds(refreshed_token) == STANDARD_TOKEN_EXPIRY_SECONDS
