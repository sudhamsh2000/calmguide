from datetime import UTC, datetime, timedelta

import jwt

from app.config import get_settings

# Minimum entropy for the HS256 signing secret. A short or empty secret makes
# tokens forgeable (an attacker can mint role="owner" tokens), so we refuse to
# sign OR verify with one — failing closed rather than issuing/accepting forgeries.
MIN_JWT_SECRET_LENGTH = 32


def _require_secret() -> str:
    settings = get_settings()
    secret = settings.JWT_SECRET_KEY or ""
    if len(secret) < MIN_JWT_SECRET_LENGTH:
        raise RuntimeError(
            "JWT_SECRET_KEY must be set to a random string of at least "
            f"{MIN_JWT_SECRET_LENGTH} characters. Facility authentication is "
            "disabled until it is configured."
        )
    return secret


def create_token(
    staff_id: str,
    facility_id: str,
    role: str,
    expiry_seconds: int | None = None,
    auth_method: str = "password",
) -> str:
    settings = get_settings()
    secret = _require_secret()
    exp = expiry_seconds if expiry_seconds is not None else settings.JWT_EXPIRY_SECONDS
    payload = {
        "staff_id": staff_id,
        "facility_id": facility_id,
        "role": role,
        "auth_method": auth_method,
        "exp": datetime.now(UTC) + timedelta(seconds=exp),
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, secret, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> dict:
    settings = get_settings()
    secret = _require_secret()
    return jwt.decode(
        token,
        secret,
        algorithms=[settings.JWT_ALGORITHM],
    )
