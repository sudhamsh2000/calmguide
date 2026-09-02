"""FastAPI application factory with lifespan, CORS, and router registration."""

import logging
import uuid
from contextlib import asynccontextmanager

from app.services.request_context import RequestIdFilter, request_id_var


def _configure_logging() -> None:
    """Include the request id in every log line for cross-line correlation."""
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s")
    )
    handler.addFilter(RequestIdFilter())
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)


_configure_logging()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db import dispose_engine, get_engine
from app.services.llm import get_llm_provider


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialize DB engine and LLM provider. Shutdown: dispose engine."""
    settings = get_settings()

    # Validate encryption key before accepting any traffic
    from app.services.crypto import validate_encryption_key

    validate_encryption_key()

    # Validate JWT secret key. A present-but-weak secret is a misconfiguration
    # that makes tokens forgeable, so we fail hard. An absent secret only
    # disables facility auth (B2C still works); jwt_service fails closed, so we
    # warn loudly rather than blocking startup.
    from app.services.jwt_service import MIN_JWT_SECRET_LENGTH

    if not settings.JWT_SECRET_KEY:
        logging.getLogger(__name__).warning(
            "JWT_SECRET_KEY is not set — B2B facility auth is DISABLED (token "
            "creation/verification will fail closed). Set JWT_SECRET_KEY "
            "(>= %d chars) for production.",
            MIN_JWT_SECRET_LENGTH,
        )
    elif len(settings.JWT_SECRET_KEY) < MIN_JWT_SECRET_LENGTH:
        raise RuntimeError(
            f"JWT_SECRET_KEY is set but too short (< {MIN_JWT_SECRET_LENGTH} "
            "chars). Use a long random secret; a weak secret allows token forgery."
        )

    # Warm up the DB engine (validates connection string early)
    get_engine()

    # Initialize LLM provider and attach to app state
    if settings.LLM_PROVIDER == "anthropic":
        api_key = settings.ANTHROPIC_API_KEY
        model = settings.ANTHROPIC_MODEL
    else:
        api_key = settings.OPENAI_API_KEY
        model = settings.OPENAI_MODEL

    primary_provider = get_llm_provider(
        provider_name=settings.LLM_PROVIDER,
        api_key=api_key,
        model=model,
    )

    # Wire failover to the other provider when it is also configured, so a
    # single-provider outage degrades gracefully instead of taking crisis
    # guidance fully offline.
    other_name = "openai" if settings.LLM_PROVIDER == "anthropic" else "anthropic"
    if other_name == "openai":
        other_key, other_model = settings.OPENAI_API_KEY, settings.OPENAI_MODEL
    else:
        other_key, other_model = settings.ANTHROPIC_API_KEY, settings.ANTHROPIC_MODEL

    if other_key:
        from app.services.fallback_provider import FallbackLLMProvider

        secondary_provider = get_llm_provider(
            provider_name=other_name, api_key=other_key, model=other_model
        )
        app.state.llm_provider = FallbackLLMProvider(primary_provider, secondary_provider)
        logging.getLogger(__name__).info(
            "LLM failover enabled: primary=%s secondary=%s", settings.LLM_PROVIDER, other_name
        )
    else:
        app.state.llm_provider = primary_provider

    # Warm up RAG vector store (creates table/indexes if needed).
    # Non-fatal: app works without RAG if not configured.
    try:
        import sys
        from pathlib import Path

        _repo_root = str(Path(__file__).resolve().parents[2])
        if _repo_root not in sys.path:
            sys.path.insert(0, _repo_root)
        from rag.vectorstores import get_vector_store

        store = get_vector_store()
        await store.setup()
        logging.getLogger(__name__).info("RAG vector store ready")
    except Exception as exc:
        logging.getLogger(__name__).warning("RAG not available at startup: %s", exc)

    # Nightly insights computation (all profiles)
    from apscheduler.schedulers.asyncio import AsyncIOScheduler

    # Arbitrary but fixed: identifies this job's Postgres advisory lock.
    _NIGHTLY_JOB_LOCK_ID = 8412665301

    async def _nightly_insights():
        """Recompute insights for all profiles that have conversations."""
        import logging as _logging

        _log = _logging.getLogger("calmguide.nightly_insights")

        # The scheduler lives in-process, so every replica fires this job at
        # 3am. Cross-patient aggregation deletes the whole table before
        # rewriting it, so concurrent runs would fight over it. A session-level
        # advisory lock elects one runner; the others no-op. Released when the
        # connection returns to the pool, i.e. when this block exits.
        lock_conn = None
        try:
            from sqlalchemy import text as _sql_text

            engine = get_engine()
            if engine.dialect.name == "postgresql":
                lock_conn = await engine.connect()
                acquired = await lock_conn.scalar(
                    _sql_text("SELECT pg_try_advisory_lock(:lock_id)"),
                    {"lock_id": _NIGHTLY_JOB_LOCK_ID},
                )
                if not acquired:
                    _log.info("Nightly job already running on another replica; skipping")
                    await lock_conn.close()
                    return
        except Exception as lock_exc:
            _log.warning("Could not take the nightly job lock: %s", lock_exc)
            if lock_conn is not None:
                await lock_conn.close()
                lock_conn = None

        try:
            from sqlalchemy import distinct, select

            from app.db import get_session_factory
            from app.models.conversation import Conversation
            from app.services.insights import compute_profile_insights, upsert_profile_insights

            factory = get_session_factory()
            async with factory() as session:
                result = await session.execute(select(distinct(Conversation.profile_id)))
                profile_ids = [row[0] for row in result.all()]

            _log.info("Nightly insights: processing %d profiles", len(profile_ids))
            for profile_id in profile_ids:
                try:
                    async with factory() as session:
                        payload = await compute_profile_insights(profile_id, session)
                        if payload["crisis_frequency"]["total_sessions"] >= 3:
                            await upsert_profile_insights(profile_id, payload, session)
                except Exception as exc:
                    _log.warning("Insights failed for profile %s: %s", profile_id, exc)

            # Stale dossier recomputation
            try:
                from app.models.behavioral_dossier import BehavioralDossier
                from app.services.dossier import compute_dossier

                async with factory() as dossier_session:
                    stale_result = await dossier_session.execute(
                        select(BehavioralDossier.profile_id).where(
                            BehavioralDossier.is_stale == True
                        )
                    )
                    stale_profile_ids = stale_result.scalars().all()

                for stale_pid in stale_profile_ids:
                    try:
                        async with factory() as d_session:
                            await compute_dossier(stale_pid, d_session)
                    except Exception as d_exc:
                        _log.warning(
                            "Nightly dossier recompute failed for %s: %s", stale_pid, d_exc
                        )

                _log.info("Nightly dossier: recomputed %d stale dossiers", len(stale_profile_ids))
            except Exception as dossier_exc:
                _log.warning("Nightly dossier recomputation failed: %s", dossier_exc)

            # Cross-patient strategy aggregation
            try:
                from app.services.cross_patient import compute_cross_patient_strategies

                async with factory() as cp_session:
                    result = await compute_cross_patient_strategies(cp_session)
                    _log.info("Cross-patient: computed %d strategy entries", len(result))
            except Exception as cp_exc:
                _log.warning("Cross-patient aggregation failed: %s", cp_exc)
        except Exception as exc:
            _log.error("Nightly insights job failed: %s", exc)
        finally:
            if lock_conn is not None:
                await lock_conn.close()

    scheduler = AsyncIOScheduler()
    scheduler.add_job(_nightly_insights, "cron", hour=3, minute=0)  # 3am UTC nightly
    scheduler.start()
    app.state.scheduler = scheduler

    yield

    scheduler.shutdown()

    # Memory writes for a session that just ended run detached from the
    # response; give them a moment to land rather than dropping them on deploy.
    from app.routers.coach import drain_background_tasks

    await drain_background_tasks()

    await dispose_engine()


def create_app() -> FastAPI:
    """Application factory — creates and configures the FastAPI instance."""
    settings = get_settings()

    app = FastAPI(
        title="CalmGuide API",
        description="Multilingual AI companion for dementia caregivers",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Starlette CORS middleware adds headers after Content-Length is set on 204
    # responses, causing "Response content longer than Content-Length".
    # https://github.com/encode/starlette/issues/2155
    # _Fix204ContentLength strips Content-Length from 204s before CORS sees them.
    # Middleware stack order: CORS (outermost) → _Fix204 (innermost on response path)
    # so _Fix204 strips first, then CORS appends headers safely.
    from starlette.types import ASGIApp, Receive, Scope, Send

    class _Fix204ContentLength:
        def __init__(self, app: ASGIApp) -> None:
            self.app = app

        async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
            if scope["type"] != "http":
                await self.app(scope, receive, send)
                return

            async def _send(message):
                if message["type"] == "http.response.start" and message.get("status") == 204:
                    headers = [
                        (k, v)
                        for k, v in message.get("headers", [])
                        if (k if isinstance(k, bytes) else k.encode()).lower() != b"content-length"
                    ]
                    message = {**message, "headers": headers}
                await send(message)

            await self.app(scope, receive, _send)

    # Pure-ASGI request-id middleware (no body buffering, so SSE still streams).
    class _RequestIdMiddleware:
        def __init__(self, app: ASGIApp) -> None:
            self.app = app

        async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
            if scope["type"] != "http":
                await self.app(scope, receive, send)
                return
            headers = dict(scope.get("headers") or [])
            incoming = headers.get(b"x-request-id")
            request_id = incoming.decode() if incoming else uuid.uuid4().hex
            token = request_id_var.set(request_id)

            async def _send(message):
                if message["type"] == "http.response.start":
                    msg_headers = list(message.get("headers", []))
                    msg_headers.append((b"x-request-id", request_id.encode()))
                    message = {**message, "headers": msg_headers}
                await send(message)

            try:
                await self.app(scope, receive, _send)
            finally:
                request_id_var.reset(token)

    app.add_middleware(_Fix204ContentLength)
    app.add_middleware(_RequestIdMiddleware)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    from app.routers.care_changes import router as care_changes_router
    from app.routers.checkin import router as checkin_router
    from app.routers.checkin_daily import router as checkin_daily_router
    from app.routers.coach import router as coach_router
    from app.routers.facility import router as facility_router
    from app.routers.facility_audit import router as facility_audit_router
    from app.routers.facility_auth import router as facility_auth_router
    from app.routers.facility_dashboard import router as facility_dashboard_router
    from app.routers.facility_executive import router as facility_executive_router
    from app.routers.facility_report import router as facility_report_router
    from app.routers.facility_residents import router as facility_residents_router
    from app.routers.facility_staff import router as facility_staff_router
    from app.routers.feedback import router as feedback_router
    from app.routers.health import router as health_router
    from app.routers.impact import router as impact_router
    from app.routers.incidents import router as incidents_router
    from app.routers.insights import router as insights_router
    from app.routers.languages import router as languages_router
    from app.routers.learn import router as learn_router
    from app.routers.prediction import router as care_patterns_router
    from app.routers.profile import router as profile_router
    from app.routers.speech import router as speech_router

    app.include_router(health_router)
    app.include_router(profile_router, prefix="/api")
    app.include_router(coach_router, prefix="/api")
    app.include_router(learn_router, prefix="/api")
    app.include_router(checkin_router, prefix="/api")
    app.include_router(impact_router, prefix="/api")
    app.include_router(insights_router, prefix="/api")
    app.include_router(feedback_router, prefix="/api")
    app.include_router(checkin_daily_router, prefix="/api")
    app.include_router(care_patterns_router, prefix="/api")
    app.include_router(speech_router, prefix="/api")
    app.include_router(incidents_router, prefix="/api")
    app.include_router(care_changes_router, prefix="/api")
    app.include_router(facility_router, prefix="/api")
    app.include_router(facility_staff_router, prefix="/api")
    app.include_router(facility_auth_router, prefix="/api")
    app.include_router(facility_residents_router, prefix="/api")
    app.include_router(facility_dashboard_router, prefix="/api")
    app.include_router(facility_executive_router, prefix="/api")
    app.include_router(facility_audit_router, prefix="/api")
    app.include_router(facility_report_router, prefix="/api")
    app.include_router(languages_router, prefix="/api")

    # Consistent error format: {"error": str, "code": str}
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        if isinstance(exc.detail, dict) and "error" in exc.detail:
            return JSONResponse(status_code=exc.status_code, content=exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": str(exc.detail), "code": "HTTP_ERROR"},
        )

    # Catch-all: never leak a raw stack-trace / HTML 500 to the client.
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logging.getLogger(__name__).exception(
            "Unhandled error on %s %s", request.method, request.url.path
        )
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error", "code": "INTERNAL_ERROR"},
        )

    return app


app = create_app()
