"""Tests for JWT, PIN, and password auth services."""

import os
import time

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault("CONVERSATION_ENCRYPTION_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")

from app.services.jwt_service import create_token, verify_token
from app.services.facility_auth import hash_pin, verify_pin, hash_password, verify_password


def test_jwt_roundtrip():
    token = create_token(staff_id="s1", facility_id="f1", role="staff")
    payload = verify_token(token)
    assert payload["staff_id"] == "s1"
    assert payload["facility_id"] == "f1"
    assert payload["role"] == "staff"


def test_jwt_expired():
    token = create_token(staff_id="s1", facility_id="f1", role="staff", expiry_seconds=0)
    time.sleep(1)
    with pytest.raises(Exception):
        verify_token(token)


def test_jwt_contains_iat():
    token = create_token(staff_id="s1", facility_id="f1", role="staff")
    payload = verify_token(token)
    assert "iat" in payload
    assert "exp" in payload


def test_jwt_refuses_weak_or_missing_secret(monkeypatch):
    """Signing or verifying with a missing/short secret must fail closed —
    otherwise an attacker could forge a role='owner' token."""
    from app import config

    for bad in ("", "short"):
        monkeypatch.setenv("JWT_SECRET_KEY", bad)
        config.get_settings.cache_clear()
        with pytest.raises(RuntimeError):
            create_token(staff_id="s1", facility_id="f1", role="owner")
        with pytest.raises(RuntimeError):
            verify_token("any.invalid.token")
    config.get_settings.cache_clear()


def test_pin_hash_roundtrip():
    pin = "1234"
    hashed = hash_pin(pin)
    assert hashed != pin
    # PINs are hashed with salted bcrypt (not raw SHA-256), so the digest is a
    # bcrypt string, not a 64-char hex digest.
    assert hashed.startswith("$2")
    assert verify_pin(pin, hashed) is True
    assert verify_pin("5678", hashed) is False


def test_pin_hash_salted():
    # bcrypt is salted: hashing the same PIN twice yields different digests,
    # yet both verify. A deterministic hash would be brute-forceable offline.
    h1 = hash_pin("1234")
    h2 = hash_pin("1234")
    assert h1 != h2
    assert verify_pin("1234", h1) is True
    assert verify_pin("1234", h2) is True
    assert verify_pin("5678", h1) is False


def test_password_hash_roundtrip():
    password = "SecurePass123"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPass", hashed) is False


def test_password_hash_unique_salts():
    h1 = hash_password("same-password")
    h2 = hash_password("same-password")
    assert h1 != h2
