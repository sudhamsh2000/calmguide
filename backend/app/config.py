"""Application configuration via environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://calmguide:calmguide@localhost:5432/calmguide"
    LLM_PROVIDER: str = "openai"  # "openai" or "anthropic"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_MULTILINGUAL_MODEL: str = "gpt-4o"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    # Per-request timeout for LLM API calls. Without it a stalled provider hangs
    # the crisis SSE connection (and its DB connection) indefinitely.
    LLM_TIMEOUT_SECONDS: float = 30.0
    CORS_ORIGINS: str = "http://localhost:3000"
    # Connection pool sizing (PostgreSQL only). Default pool_size=5 is too small
    # for concurrent crisis traffic.
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 10
    # 32-byte key base64-encoded. Generate with:
    # python -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
    CONVERSATION_ENCRYPTION_KEY: str = ""
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_SECONDS: int = 900
    ADMIN_API_KEY: str = ""
    # Per-IP rate limiting on LLM endpoints (cost/DoS protection). In-process —
    # for multi-instance deployments back it with Redis.
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 30
    # Neural text-to-speech for read-aloud (app.services.speech). Off by
    # default: it bills per character, so it must be opted into rather than
    # switched on silently by deploying. When disabled the client falls back
    # to the browser's built-in speech, so read-aloud still works either way.
    TTS_ENABLED: bool = False
    # HMAC key for access/facility code hashing. Defeats offline dictionary
    # attacks on the stored hashes. Falls back to CONVERSATION_ENCRYPTION_KEY
    # when unset so existing deployments keep working.
    ACCESS_CODE_HMAC_SECRET: str = ""
    # Gate B2C signup (POST /profiles) behind a pre-generated, shared invite
    # code while the app is in private testing (see app.models.invite_code
    # and scripts/generate_invite_codes.py). Flip to False — no migration or
    # code change needed — once the app is ready for open public signup.
    INVITE_CODE_REQUIRED: bool = True
    # Operational retention window, in days, for inactive profiles. This is a
    # deployment-configurable knob, not a claim about any legal/regulatory
    # retention requirement — no automatic sweep runs off it yet; a deployer
    # who sets it is expected to wire it into their own scheduled job that
    # calls DELETE /api/profiles/{access_code} (see app.routers.profile) for
    # profiles inactive past this window. None (default) means no retention
    # limit is enforced.
    DATA_RETENTION_DAYS: int | None = None

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
