"""Tests for profile CRUD and access code management."""

import hashlib

import pytest

VALID_PROFILE = {
    "disease_stage": "middle",
    "behavioral_patterns": ["sundowning", "wandering", "repetitive questions"],
    "calming_strategies": ["soft music", "photo album", "warm drink"],
    "safety_concerns": ["fall risk", "wandering at night"],
}


# ---------------------------------------------------------------------------
# POST /api/profiles -- Create profile
# ---------------------------------------------------------------------------


async def test_create_profile_returns_access_code(client):
    response = await client.post("/api/profiles", json=VALID_PROFILE)
    assert response.status_code == 201
    data = response.json()
    assert "access_code" in data
    assert len(data["access_code"]) == 8
    assert data["access_code"].isalnum()
    assert data["disease_stage"] == "middle"


async def test_create_profile_access_code_excludes_ambiguous_chars(client):
    """Access codes must not contain 0, O, 1, I, L."""
    response = await client.post("/api/profiles", json=VALID_PROFILE)
    code = response.json()["access_code"]
    ambiguous = set("0O1IL")
    assert not ambiguous.intersection(set(code)), f"Code {code} contains ambiguous characters"


async def test_create_profile_invalid_disease_stage(client):
    payload = {**VALID_PROFILE, "disease_stage": "nonexistent"}
    response = await client.post("/api/profiles", json=payload)
    assert response.status_code == 422


async def test_create_profile_missing_required_field(client):
    payload = {"disease_stage": "early"}
    response = await client.post("/api/profiles", json=payload)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/profiles/{access_code} -- Lookup profile
# ---------------------------------------------------------------------------


async def test_get_profile_by_access_code(client):
    create_resp = await client.post("/api/profiles", json=VALID_PROFILE)
    code = create_resp.json()["access_code"]

    get_resp = await client.get(f"/api/profiles/{code}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["disease_stage"] == "middle"
    # Access code should NOT be returned on lookup
    assert "access_code" not in data


async def test_get_profile_not_found(client):
    response = await client.get("/api/profiles/ZZZZZZZZ")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert "code" in data


# ---------------------------------------------------------------------------
# PUT /api/profiles/{access_code} -- Update profile
# ---------------------------------------------------------------------------


async def test_update_profile(client):
    create_resp = await client.post("/api/profiles", json=VALID_PROFILE)
    code = create_resp.json()["access_code"]

    update_data = {
        "disease_stage": "late",
        "behavioral_patterns": ["aggression"],
        "calming_strategies": ["dim lighting"],
        "safety_concerns": ["elopement risk"],
    }
    put_resp = await client.put(f"/api/profiles/{code}", json=update_data)
    assert put_resp.status_code == 200
    assert put_resp.json()["disease_stage"] == "late"


async def test_update_nonexistent_profile(client):
    response = await client.put("/api/profiles/ZZZZZZZZ", json=VALID_PROFILE)
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Access code security -- stored as hash
# ---------------------------------------------------------------------------


async def test_access_code_stored_as_hash(client, db_session):
    """The raw access code must not appear in the database."""
    from sqlalchemy import select

    from app.models.profile import Profile

    create_resp = await client.post("/api/profiles", json=VALID_PROFILE)
    code = create_resp.json()["access_code"]

    from app.services.auth import hash_access_code

    result = await db_session.execute(select(Profile))
    profiles = result.scalars().all()
    assert len(profiles) >= 1

    # Hash is the keyed HMAC produced by hash_access_code (not raw SHA-256).
    expected_hash = hash_access_code(code)
    hashes = [p.access_code_hash for p in profiles]
    assert expected_hash in hashes
    # The keyed hash must not equal a plain unsalted SHA-256 of the code.
    assert hashlib.sha256(code.encode()).hexdigest() not in hashes
    # Raw code should not be stored anywhere
    for p in profiles:
        assert p.access_code_hash != code


@pytest.mark.asyncio
async def test_profile_fields_encrypted_in_db(db_session, client):
    """Profile JSON fields must be stored encrypted, not as plaintext JSON."""
    from sqlalchemy import select

    from app.models.profile import Profile

    resp = await client.post(
        "/api/profiles",
        json={
            "disease_stage": "middle",
            "behavioral_patterns": ["wandering"],
            "calming_strategies": ["music"],
            "safety_concerns": ["falling"],
        },
    )
    assert resp.status_code == 201
    profile_id = resp.json()["id"]

    # Read raw value from DB — must be encrypted blob
    result = await db_session.execute(
        select(Profile.behavioral_patterns).where(Profile.id == profile_id)
    )
    raw = result.scalar()
    assert raw.startswith("ENC:"), f"Expected encrypted value, got: {raw[:50]}"


@pytest.mark.asyncio
async def test_profile_get_returns_plaintext(client):
    """GET /api/profiles/{code} must return decrypted JSON arrays."""
    resp = await client.post(
        "/api/profiles",
        json={
            "disease_stage": "middle",
            "behavioral_patterns": ["wandering"],
            "calming_strategies": ["music"],
            "safety_concerns": ["falling"],
        },
    )
    assert resp.status_code == 201
    code = resp.json()["access_code"]

    get_resp = await client.get(f"/api/profiles/{code}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["behavioral_patterns"] == ["wandering"]
    assert data["calming_strategies"] == ["music"]
    assert data["safety_concerns"] == ["falling"]


# ---------------------------------------------------------------------------
# Stage transition handling
# ---------------------------------------------------------------------------


async def test_stage_transition_sets_metadata(client):
    """Updating disease_stage sets stage_changed_at and previous_stage."""
    create_resp = await client.post("/api/profiles", json=VALID_PROFILE)
    code = create_resp.json()["access_code"]

    resp = await client.put(
        f"/api/profiles/{code}",
        json={
            "disease_stage": "late",
            "behavioral_patterns": ["aggression"],
            "calming_strategies": ["dim lighting"],
            "safety_concerns": ["elopement risk"],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["disease_stage"] == "late"
    assert data["previous_stage"] == "middle"
    assert data["stage_changed_at"] is not None


async def test_same_stage_does_not_set_transition(client):
    """Re-setting the same stage should not update previous_stage."""
    create_resp = await client.post("/api/profiles", json=VALID_PROFILE)
    code = create_resp.json()["access_code"]

    resp = await client.put(
        f"/api/profiles/{code}",
        json=VALID_PROFILE,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["previous_stage"] is None
    assert data["stage_changed_at"] is None


async def test_unknown_stage_accepted(client):
    """'unknown' is a valid disease stage per behavioral anchors spec."""
    resp = await client.post(
        "/api/profiles",
        json={
            **VALID_PROFILE,
            "disease_stage": "unknown",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["disease_stage"] == "unknown"
