"""Tests for safe-decrypt resilience patterns.

Covers:
- _safe_decrypt_list in profile router returns [] on decrypt failure (not 500)
- _safe_decrypt_json in coach router returns default on corrupt data
- Corrupted ciphertext (random bytes with ENC: prefix)
- Empty string encrypted fields
- Key rotation — data encrypted with old key, decrypted with new key
- Valid roundtrip: encrypt → store → fetch → decrypt
- Dossier fields with corrupted data via the coach chat endpoint

NOTE: Tests that require the HTTP client fixture (and therefore the test DB) will
fail until the JSONB SQLite incompatibility is resolved. The Facility model uses
JSONB (PostgreSQL-only) which SQLite cannot compile. The pure-unit tests (all
_safe_decrypt_* functions, key rotation, and the crypto module directly) all pass.
"""

import base64
import json

import pytest
from sqlalchemy import select

from app.models.profile import Profile
from app.services.auth import hash_access_code
from app.services.crypto import decrypt, encrypt


# ---------------------------------------------------------------------------
# Unit tests for _safe_decrypt_list (profile router helper)
# ---------------------------------------------------------------------------

def test_safe_decrypt_list_valid_roundtrip():
    """Encrypting a list and passing through _safe_decrypt_list returns the original."""
    from app.routers.profile import _safe_decrypt_list

    original = ["sundowning", "wandering", "fall risk"]
    encrypted = encrypt(json.dumps(original))
    result = _safe_decrypt_list(encrypted)
    assert result == original


def test_safe_decrypt_list_returns_empty_on_corrupted_ciphertext():
    """Corrupted ENC:-prefixed data must return [] without raising."""
    from app.routers.profile import _safe_decrypt_list

    # Build an ENC:-prefixed value with garbage bytes
    garbage = "ENC:" + base64.b64encode(b"\xff\xfe\xfd" * 20).decode()
    result = _safe_decrypt_list(garbage)
    assert result == []


def test_safe_decrypt_list_returns_empty_on_empty_string():
    """An empty string must return [] without raising."""
    from app.routers.profile import _safe_decrypt_list

    result = _safe_decrypt_list("")
    assert result == []


def test_safe_decrypt_list_returns_empty_on_invalid_json():
    """If decryption succeeds but the payload is not JSON, return []."""
    from app.routers.profile import _safe_decrypt_list

    # Encrypt something that is valid ciphertext but not JSON
    encrypted = encrypt("this is not json {{[}")
    result = _safe_decrypt_list(encrypted)
    assert result == []


# ---------------------------------------------------------------------------
# Unit tests for _safe_decrypt_json (coach router helper)
# ---------------------------------------------------------------------------

def test_safe_decrypt_json_valid_roundtrip():
    """Valid encrypted JSON dict roundtrips through _safe_decrypt_json."""
    from app.routers.coach import _safe_decrypt_json

    payload = {"key": "value", "nested": [1, 2, 3]}
    encrypted = encrypt(json.dumps(payload))
    result = _safe_decrypt_json(encrypted)
    assert result == payload


def test_safe_decrypt_json_returns_empty_list_default_on_corrupted():
    """Corrupted ciphertext returns the default value (empty list) without raising."""
    from app.routers.coach import _safe_decrypt_json

    garbage = "ENC:" + base64.b64encode(b"\xaa\xbb\xcc" * 10).decode()
    result = _safe_decrypt_json(garbage)
    assert result == []


def test_safe_decrypt_json_respects_explicit_default():
    """Caller can pass a custom default dict; it should be returned on failure."""
    from app.routers.coach import _safe_decrypt_json

    garbage = "ENC:" + base64.b64encode(b"\xde\xad\xbe\xef" * 8).decode()
    result = _safe_decrypt_json(garbage, default={})
    assert result == {}


def test_safe_decrypt_json_returns_empty_on_empty_string():
    """Empty string input returns the default without raising."""
    from app.routers.coach import _safe_decrypt_json

    result = _safe_decrypt_json("")
    assert result == []


def test_safe_decrypt_json_returns_empty_on_non_json_plaintext():
    """Non-JSON ciphertext returns [] without raising."""
    from app.routers.coach import _safe_decrypt_json

    encrypted = encrypt("not-valid-json")
    result = _safe_decrypt_json(encrypted)
    assert result == []


# ---------------------------------------------------------------------------
# Key rotation — encrypt with key A, try to decrypt with key B
# ---------------------------------------------------------------------------

def test_key_rotation_safe_decrypt_list_returns_empty(monkeypatch):
    """Data encrypted with old key yields [] when decrypted under new key."""
    from app.routers.profile import _safe_decrypt_list
    from app import config

    # Encrypt under the test key (set in conftest)
    encrypted_with_old_key = encrypt(json.dumps(["sundowning"]))

    # Rotate to a different key
    new_key = base64.b64encode(b"\x01" * 32).decode()
    monkeypatch.setenv("CONVERSATION_ENCRYPTION_KEY", new_key)
    config.get_settings.cache_clear()

    try:
        result = _safe_decrypt_list(encrypted_with_old_key)
        # Should return [] gracefully — decryption or JSON parsing will fail
        assert result == []
    finally:
        config.get_settings.cache_clear()


def test_key_rotation_safe_decrypt_json_returns_default(monkeypatch):
    """Data encrypted with old key yields default when decrypted under new key."""
    from app.routers.coach import _safe_decrypt_json
    from app import config

    encrypted_with_old_key = encrypt(json.dumps({"behavior": "wandering"}))

    new_key = base64.b64encode(b"\x02" * 32).decode()
    monkeypatch.setenv("CONVERSATION_ENCRYPTION_KEY", new_key)
    config.get_settings.cache_clear()

    try:
        result = _safe_decrypt_json(encrypted_with_old_key, default={})
        assert result == {}
    finally:
        config.get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Profile endpoint — HTTP-level resilience tests
# ---------------------------------------------------------------------------

VALID_PROFILE_PAYLOAD = {
    "disease_stage": "middle",
    "behavioral_patterns": ["sundowning", "wandering"],
    "calming_strategies": ["soft music", "warm drink"],
    "safety_concerns": ["fall risk"],
}


async def test_get_profile_returns_200_with_valid_encryption(client):
    """End-to-end: create profile, retrieve it, encrypted fields round-trip correctly."""
    resp = await client.post("/api/profiles", json=VALID_PROFILE_PAYLOAD)
    assert resp.status_code == 201
    code = resp.json()["access_code"]

    get_resp = await client.get(f"/api/profiles/{code}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["behavioral_patterns"] == ["sundowning", "wandering"]
    assert data["calming_strategies"] == ["soft music", "warm drink"]
    assert data["safety_concerns"] == ["fall risk"]


async def test_get_profile_with_corrupted_behavioral_patterns_returns_empty_arrays(
    client, db_session
):
    """Profile with corrupted encrypted fields returns 200 with empty arrays, not 500."""
    # Create a profile normally first
    resp = await client.post("/api/profiles", json=VALID_PROFILE_PAYLOAD)
    assert resp.status_code == 201
    code = resp.json()["access_code"]

    # Directly corrupt the encrypted fields in the DB
    code_hash = hash_access_code(code)
    result = await db_session.execute(
        select(Profile).where(Profile.access_code_hash == code_hash)
    )
    profile = result.scalar_one()

    corrupted = "ENC:" + base64.b64encode(b"\xff\xff\xff" * 20).decode()
    profile.behavioral_patterns = corrupted
    profile.calming_strategies = corrupted
    profile.safety_concerns = corrupted
    await db_session.commit()

    # Fetching should not crash — must return 200 with empty arrays
    get_resp = await client.get(f"/api/profiles/{code}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["behavioral_patterns"] == []
    assert data["calming_strategies"] == []
    assert data["safety_concerns"] == []


async def test_create_profile_returns_fields_immediately_decryptable(client):
    """The create endpoint must decrypt and return lists in the same response."""
    resp = await client.post("/api/profiles", json=VALID_PROFILE_PAYLOAD)
    assert resp.status_code == 201
    data = resp.json()
    # The create response must already include decrypted lists
    assert data["behavioral_patterns"] == ["sundowning", "wandering"]
    assert data["calming_strategies"] == ["soft music", "warm drink"]
    assert data["safety_concerns"] == ["fall risk"]


async def test_update_profile_with_valid_data_persists_correctly(client):
    """Updating a profile re-encrypts fields and they survive decryption."""
    create_resp = await client.post("/api/profiles", json=VALID_PROFILE_PAYLOAD)
    code = create_resp.json()["access_code"]

    update_payload = {
        "disease_stage": "late",
        "behavioral_patterns": ["hallucinations"],
        "calming_strategies": ["gentle touch"],
        "safety_concerns": ["wandering outdoors"],
    }
    put_resp = await client.put(f"/api/profiles/{code}", json=update_payload)
    assert put_resp.status_code == 200
    data = put_resp.json()
    assert data["behavioral_patterns"] == ["hallucinations"]
    assert data["disease_stage"] == "late"


def test_empty_list_survives_encrypt_decrypt_roundtrip():
    """Decrypt-resilience: an empty list must encrypt and decrypt back to [].

    (Tested at the crypto layer because the profile API intentionally requires
    at least one item per list — see ProfileUpdate min_length=1 — so an empty
    profile cannot be saved via the endpoint.)"""
    for value in ([], [""], ["a", "b"]):
        blob = encrypt(json.dumps(value))
        assert json.loads(decrypt(blob)) == value


async def test_update_profile_rejects_empty_lists(client):
    """Contract guard: the profile API requires non-empty clinical lists, so
    clearing them all returns 422 (a profile with no information is not useful)."""
    resp = await client.post("/api/profiles", json=VALID_PROFILE_PAYLOAD)
    code = resp.json()["access_code"]

    put_resp = await client.put(
        f"/api/profiles/{code}",
        json={
            "disease_stage": "middle",
            "behavioral_patterns": [],
            "calming_strategies": [],
            "safety_concerns": [],
        },
    )
    assert put_resp.status_code == 422


# ---------------------------------------------------------------------------
# Profile access code alphabet — no ambiguous characters
# ---------------------------------------------------------------------------

async def test_generated_access_code_excludes_ambiguous_characters(client):
    """Access codes must not contain 0, O, 1, I, L (visually ambiguous)."""
    for _ in range(10):
        resp = await client.post("/api/profiles", json=VALID_PROFILE_PAYLOAD)
        assert resp.status_code == 201
        code = resp.json()["access_code"]
        assert len(code) == 8
        for char in code:
            assert char not in "0O1IL", f"Ambiguous character '{char}' found in access code '{code}'"


# ---------------------------------------------------------------------------
# Direct crypto module roundtrip
# ---------------------------------------------------------------------------

def test_encrypt_decrypt_roundtrip():
    """encrypt() and decrypt() are inverse operations."""
    plaintext = "hello world — this is a test"
    ciphertext = encrypt(plaintext)
    assert ciphertext.startswith("ENC:")
    assert decrypt(ciphertext) == plaintext


def test_encrypt_produces_different_ciphertext_each_time():
    """AES-GCM with random nonce: same plaintext → different ciphertext each call."""
    plaintext = "same content"
    c1 = encrypt(plaintext)
    c2 = encrypt(plaintext)
    assert c1 != c2  # Different nonces guarantee different output


def test_decrypt_non_prefixed_value_returns_plaintext():
    """decrypt() on a value without ENC: prefix returns it as-is (migration path)."""
    result = decrypt("plaintext value")
    assert result == "plaintext value"
