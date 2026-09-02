"""AES-256-GCM authenticated encryption for conversation and profile content.

Format: "ENC:" + base64(12-byte nonce || ciphertext || 16-byte GCM tag)

Values not starting with "ENC:" trigger a warning log — this allows safe
migration of existing plaintext rows while making unencrypted data visible
in monitoring.
"""

import base64
import logging
import os
from functools import lru_cache

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_PREFIX = "ENC:"
logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_cipher(key_b64: str) -> AESGCM:
    """Cache the expanded key.

    Building an AESGCM runs a key schedule, and the dossier/insights paths
    encrypt or decrypt hundreds of fields per recompute — one cipher per value
    made that cost scale with the size of a patient's history.
    """
    return AESGCM(_decode_key(key_b64))


def _current_cipher() -> AESGCM:
    from app.config import get_settings

    key_b64 = get_settings().CONVERSATION_ENCRYPTION_KEY
    if not key_b64:
        raise ValueError(
            "CONVERSATION_ENCRYPTION_KEY is not set. "
            'Generate with: python -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"'
        )
    return _get_cipher(key_b64)


def _decode_key(key_b64: str) -> bytes:
    if not key_b64:
        raise ValueError(
            "CONVERSATION_ENCRYPTION_KEY is not set. "
            'Generate with: python -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"'
        )
    key = base64.b64decode(key_b64)
    if len(key) != 32:
        raise ValueError(
            f"CONVERSATION_ENCRYPTION_KEY must decode to exactly 32 bytes (got {len(key)}). "
            'Generate with: python -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"'
        )
    return key


def validate_encryption_key() -> None:
    """Validate the encryption key at startup. Raises ValueError if misconfigured."""
    _current_cipher()


def encrypt(plaintext: str) -> str:
    """Encrypt plaintext string, returns ENC:-prefixed base64 blob."""
    aesgcm = _current_cipher()
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return _PREFIX + base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt(value: str) -> str:
    """Decrypt an ENC:-prefixed value. Logs warning for unencrypted values."""
    if not value.startswith(_PREFIX):
        logger.warning(
            "decrypt() called on non-encrypted value — returning plaintext. "
            "Run the encryption migration to fix: alembic upgrade head"
        )
        return value
    raw = base64.b64decode(value[len(_PREFIX) :])
    nonce, ciphertext = raw[:12], raw[12:]
    aesgcm = _current_cipher()
    return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")
