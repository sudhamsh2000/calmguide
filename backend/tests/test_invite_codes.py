"""Tests for the private-testing invite-code gate.

Covers POST /api/invite-codes/validate and the enforcement inside
POST /api/profiles. conftest.py's autouse override_get_settings fixture
defaults INVITE_CODE_REQUIRED to False so the ~47 other POST /profiles call
sites across the suite keep working unmodified; the require_invite_code
fixture below flips the gate back on for just the tests here.
"""

import pytest

from app import config
from app.models.invite_code import InviteCode
from app.services.auth import hash_access_code

VALID_PROFILE = {
    "disease_stage": "middle",
    "behavioral_patterns": ["sundowning"],
    "calming_strategies": ["soft music"],
    "safety_concerns": ["fall risk"],
}


@pytest.fixture
def require_invite_code(monkeypatch):
    """Turn the invite-code gate back on, scoped to the requesting test."""
    monkeypatch.setenv("INVITE_CODE_REQUIRED", "true")
    config.get_settings.cache_clear()
    yield
    monkeypatch.setenv("INVITE_CODE_REQUIRED", "false")
    config.get_settings.cache_clear()


async def _make_invite_code(
    db_session, code: str, *, is_active: bool = True, label: str | None = None
) -> InviteCode:
    invite = InviteCode(code_hash=hash_access_code(code), is_active=is_active, label=label)
    db_session.add(invite)
    await db_session.commit()
    await db_session.refresh(invite)
    return invite


# ---------------------------------------------------------------------------
# POST /api/profiles -- gate enforcement
# ---------------------------------------------------------------------------


async def test_create_profile_rejects_missing_invite_code(client, require_invite_code):
    response = await client.post("/api/profiles", json=VALID_PROFILE)
    assert response.status_code == 403
    data = response.json()
    assert data["code"] == "INVALID_INVITE_CODE"


async def test_create_profile_rejects_unknown_invite_code(client, require_invite_code):
    payload = {**VALID_PROFILE, "invite_code": "NOPE1234"}
    response = await client.post("/api/profiles", json=payload)
    assert response.status_code == 403
    assert response.json()["code"] == "INVALID_INVITE_CODE"


async def test_create_profile_rejects_inactive_invite_code(client, db_session, require_invite_code):
    await _make_invite_code(db_session, "DEADCODE", is_active=False)
    payload = {**VALID_PROFILE, "invite_code": "DEADCODE"}
    response = await client.post("/api/profiles", json=payload)
    assert response.status_code == 403
    assert response.json()["code"] == "INVALID_INVITE_CODE"


async def test_create_profile_accepts_valid_invite_code(client, db_session, require_invite_code):
    await _make_invite_code(db_session, "GOODCODE")
    payload = {**VALID_PROFILE, "invite_code": "GOODCODE"}
    response = await client.post("/api/profiles", json=payload)
    assert response.status_code == 201
    assert "access_code" in response.json()


async def test_create_profile_increments_use_count(client, db_session, require_invite_code):
    invite = await _make_invite_code(db_session, "COUNTME1")
    payload = {**VALID_PROFILE, "invite_code": "COUNTME1"}

    response = await client.post("/api/profiles", json=payload)
    assert response.status_code == 201

    await db_session.refresh(invite)
    assert invite.use_count == 1


async def test_create_profile_invite_code_is_reusable(client, db_session, require_invite_code):
    """Shared codes are not single-use: multiple signups may use the same code."""
    invite = await _make_invite_code(db_session, "SHARE111")
    payload = {**VALID_PROFILE, "invite_code": "SHARE111"}

    first = await client.post("/api/profiles", json=payload)
    second = await client.post("/api/profiles", json=payload)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["access_code"] != second.json()["access_code"]

    await db_session.refresh(invite)
    assert invite.use_count == 2


async def test_create_profile_ignores_invite_code_when_gate_disabled(client):
    """Default test settings have INVITE_CODE_REQUIRED=False; no code needed."""
    response = await client.post("/api/profiles", json=VALID_PROFILE)
    assert response.status_code == 201


# ---------------------------------------------------------------------------
# POST /api/invite-codes/validate
# ---------------------------------------------------------------------------


async def test_validate_invite_code_valid(client, db_session, require_invite_code):
    await _make_invite_code(db_session, "VALIDATE")
    response = await client.post("/api/invite-codes/validate", json={"code": "VALIDATE"})
    assert response.status_code == 200
    assert response.json() == {"valid": True}


async def test_validate_invite_code_unknown(client, require_invite_code):
    response = await client.post("/api/invite-codes/validate", json={"code": "UNKNOWN1"})
    assert response.status_code == 200
    assert response.json() == {"valid": False}


async def test_validate_invite_code_inactive(client, db_session, require_invite_code):
    await _make_invite_code(db_session, "INACTIVE", is_active=False)
    response = await client.post("/api/invite-codes/validate", json={"code": "INACTIVE"})
    assert response.status_code == 200
    assert response.json() == {"valid": False}


async def test_validate_invite_code_always_valid_when_gate_disabled(client):
    """Default test settings have INVITE_CODE_REQUIRED=False."""
    response = await client.post("/api/invite-codes/validate", json={"code": "ANYTHING1"})
    assert response.status_code == 200
    assert response.json() == {"valid": True}


async def test_validate_invite_code_does_not_consume(client, db_session, require_invite_code):
    """Validation is a read-only check; use_count should not change."""
    invite = await _make_invite_code(db_session, "READONLY")
    await client.post("/api/invite-codes/validate", json={"code": "READONLY"})
    await client.post("/api/invite-codes/validate", json={"code": "READONLY"})

    await db_session.refresh(invite)
    assert invite.use_count == 0
