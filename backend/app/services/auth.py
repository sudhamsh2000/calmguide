"""Shared authentication utilities."""

import hashlib
import hmac

from app.config import get_settings


def _hmac_key() -> bytes:
    """Server-side key for access/facility code hashing.

    Prefer a dedicated secret; fall back to the conversation encryption key
    (also a high-entropy server secret) so existing deployments keep working.
    Keying the hash defeats offline dictionary/rainbow-table attacks on the
    stored hashes: without the key an attacker cannot precompute candidates.
    """
    settings = get_settings()
    secret = settings.ACCESS_CODE_HMAC_SECRET or settings.CONVERSATION_ENCRYPTION_KEY
    if not secret:
        raise RuntimeError(
            "ACCESS_CODE_HMAC_SECRET or CONVERSATION_ENCRYPTION_KEY must be set "
            "to hash access codes securely."
        )
    return secret.encode()


def hash_access_code(code: str) -> str:
    """Keyed hash of an access/facility code (HMAC-SHA256).

    Deterministic (so codes remain searchable by hash) but not brute-forceable
    offline without the server key. Returns a 64-char hex digest.
    """
    return hmac.new(_hmac_key(), code.encode(), hashlib.sha256).hexdigest()
