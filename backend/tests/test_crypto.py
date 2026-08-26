"""Unit tests for AES-256-GCM crypto service."""
import base64
import os
import pytest

# Use a fixed 32-byte test key
TEST_KEY_B64 = base64.b64encode(b"\x00" * 32).decode()


@pytest.fixture(autouse=True)
def set_test_key(monkeypatch):
    monkeypatch.setenv("CONVERSATION_ENCRYPTION_KEY", TEST_KEY_B64)
    # Clear lru_cache so config picks up the env var
    from app.config import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_encrypt_produces_enc_prefix():
    from app.services.crypto import encrypt
    result = encrypt("hello world")
    assert result.startswith("ENC:")


def test_roundtrip():
    from app.services.crypto import encrypt, decrypt
    plaintext = "Dad woke up screaming at 3am and doesn't know who I am."
    assert decrypt(encrypt(plaintext)) == plaintext


def test_same_plaintext_different_ciphertexts():
    """Each encryption uses a random nonce — ciphertexts must differ."""
    from app.services.crypto import encrypt
    c1 = encrypt("same text")
    c2 = encrypt("same text")
    assert c1 != c2


def test_decrypt_plaintext_passthrough():
    """Values that don't start with ENC: are returned unchanged (migration safety)."""
    from app.services.crypto import decrypt
    assert decrypt("[]") == "[]"
    assert decrypt('["wandering"]') == '["wandering"]'


def test_encrypt_empty_string():
    from app.services.crypto import encrypt, decrypt
    assert decrypt(encrypt("")) == ""


def test_decrypt_tampered_raises():
    """Tampered ciphertext must raise an error."""
    from app.services.crypto import encrypt, decrypt
    from cryptography.exceptions import InvalidTag
    enc = encrypt("sensitive")
    # Corrupt the ciphertext bytes
    raw = base64.b64decode(enc[4:])
    tampered = "ENC:" + base64.b64encode(raw[:-1] + bytes([raw[-1] ^ 0xFF])).decode()
    with pytest.raises(InvalidTag):
        decrypt(tampered)


def test_wrong_key_length_raises():
    """Keys that are not exactly 32 bytes must raise ValueError at call time."""
    from app.config import get_settings
    # 16-byte key (AES-128) should be rejected
    short_key = base64.b64encode(b"\x00" * 16).decode()
    get_settings.cache_clear()
    os.environ["CONVERSATION_ENCRYPTION_KEY"] = short_key
    get_settings.cache_clear()
    try:
        from app.services.crypto import encrypt
        with pytest.raises(ValueError, match="32 bytes"):
            encrypt("test")
    finally:
        os.environ["CONVERSATION_ENCRYPTION_KEY"] = base64.b64encode(b"\x00" * 32).decode()
        get_settings.cache_clear()
