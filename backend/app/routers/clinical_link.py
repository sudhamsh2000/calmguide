"""Link a Care Profile to the patient's OpenMRS record.

Same access-code auth as the other /profiles/{access_code} routes. Every route
returns 404 FEATURE_DISABLED when OPENMRS_ENABLED is off, which is how the
client knows to keep the OpenMRS row in its "coming soon" state.

The patient UUID is stored encrypted and never returned in full. The patient's
name is fetched only for the preview step, returned once, and never stored.
"""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models.clinical_link import ClinicalLink
from app.models.profile import Profile
from app.routers.profile import _find_profile_by_code
from app.schemas.clinical_link import (
    ClinicalLinkPreview,
    ClinicalLinkRequest,
    ClinicalLinkStatus,
    ClinicalLinkTestResult,
)
from app.schemas.profile import ErrorResponse
from app.services import clinical_context
from app.services.crypto import decrypt, encrypt
from app.services.openmrs_client import (
    OpenMRSClient,
    OpenMRSPatientNotFound,
    OpenMRSUnavailable,
    is_valid_patient_uuid,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["clinical-link"])

SOURCE = "openmrs"
_ERRORS = {404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}}


def _openmrs_client(request: Request) -> OpenMRSClient:
    if not get_settings().OPENMRS_ENABLED:
        raise HTTPException(
            status_code=404,
            detail={"error": "Health record linking is not enabled", "code": "FEATURE_DISABLED"},
        )
    client = getattr(request.app.state, "openmrs", None)
    if client is None:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Health record service is not configured",
                "code": "OPENMRS_UNAVAILABLE",
            },
        )
    return client


async def _profile_or_404(session: AsyncSession, access_code: str) -> Profile:
    profile = await _find_profile_by_code(session, access_code)
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "Profile not found", "code": "PROFILE_NOT_FOUND"},
        )
    return profile


async def get_link(session: AsyncSession, profile_id: str) -> ClinicalLink | None:
    result = await session.execute(
        select(ClinicalLink).where(
            ClinicalLink.profile_id == profile_id, ClinicalLink.source == SOURCE
        )
    )
    return result.scalar_one_or_none()


def _validated_uuid(payload: ClinicalLinkRequest) -> str:
    patient_uuid = payload.patient_uuid.strip().lower()
    if not is_valid_patient_uuid(patient_uuid):
        raise HTTPException(
            status_code=422,
            detail={
                "error": "That doesn't look like an OpenMRS patient ID",
                "code": "INVALID_PATIENT_ID",
            },
        )
    return patient_uuid


async def _fetch_patient(client: OpenMRSClient, patient_uuid: str) -> dict:
    try:
        return await client.get_patient(patient_uuid)
    except OpenMRSPatientNotFound as exc:
        raise HTTPException(
            status_code=404,
            detail={"error": "No patient with that ID in OpenMRS", "code": "PATIENT_NOT_FOUND"},
        ) from exc
    except OpenMRSUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error": "Couldn't reach the health record", "code": "OPENMRS_UNAVAILABLE"},
        ) from exc


def _status(link: ClinicalLink | None) -> ClinicalLinkStatus:
    if link is None:
        return ClinicalLinkStatus(linked=False)
    try:
        hint = decrypt(link.external_ref)[-4:]
    except Exception:
        hint = None
    return ClinicalLinkStatus(
        linked=True,
        source=link.source,
        linked_at=link.linked_at.isoformat() if link.linked_at else None,
        last_synced_at=link.last_synced_at.isoformat() if link.last_synced_at else None,
        last_status=link.last_status,
        patient_ref_hint=hint,
    )


@router.get(
    "/profiles/{access_code}/clinical-link", response_model=ClinicalLinkStatus, responses=_ERRORS
)
async def get_clinical_link(
    access_code: str, request: Request, session: AsyncSession = Depends(get_session)
):
    _openmrs_client(request)
    profile = await _profile_or_404(session, access_code)
    return _status(await get_link(session, profile.id))


@router.post(
    "/profiles/{access_code}/clinical-link/preview",
    response_model=ClinicalLinkPreview,
    responses=_ERRORS,
)
async def preview_clinical_link(
    access_code: str,
    payload: ClinicalLinkRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Confirm the patient exists and return their given name for the
    "Link to <name>?" step. Nothing is stored."""
    client = _openmrs_client(request)
    await _profile_or_404(session, access_code)
    patient = await _fetch_patient(client, _validated_uuid(payload))
    return ClinicalLinkPreview(display_name=clinical_context.patient_display_name(patient))


@router.put(
    "/profiles/{access_code}/clinical-link", response_model=ClinicalLinkStatus, responses=_ERRORS
)
async def put_clinical_link(
    access_code: str,
    payload: ClinicalLinkRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    client = _openmrs_client(request)
    profile = await _profile_or_404(session, access_code)
    patient_uuid = _validated_uuid(payload)
    await _fetch_patient(client, patient_uuid)  # 404/503 before anything is stored

    link = await get_link(session, profile.id)
    now = datetime.now(UTC)
    if link is None:
        link = ClinicalLink(profile_id=profile.id, source=SOURCE, external_ref="")
        session.add(link)
    link.external_ref = encrypt(patient_uuid)
    link.linked_at = now
    link.last_synced_at = now
    link.last_status = "ok"
    await session.commit()
    await session.refresh(link)
    clinical_context.evict(profile.id)
    # Warm the cache now so the first coach message after linking already has
    # the record instead of waiting on a slow OpenMRS.
    clinical_context.refresh(profile.id, patient_uuid, client)
    logger.info("Clinical link: linked profile=%s source=%s", profile.id, SOURCE)
    return _status(link)


@router.post(
    "/profiles/{access_code}/clinical-link/test",
    response_model=ClinicalLinkTestResult,
    responses=_ERRORS,
)
async def test_clinical_link(
    access_code: str, request: Request, session: AsyncSession = Depends(get_session)
):
    """Fetch the summary live (skipping the cache) and return counts only."""
    client = _openmrs_client(request)
    profile = await _profile_or_404(session, access_code)
    link = await get_link(session, profile.id)
    if link is None:
        raise HTTPException(
            status_code=404, detail={"error": "No health record linked", "code": "NOT_LINKED"}
        )
    settings = get_settings()
    summary = await clinical_context.get_clinical_summary(
        profile.id,
        decrypt(link.external_ref),
        client,
        # A caregiver pressing a button can wait longer than the chat path;
        # the result also refreshes the cache the coach reads from.
        timeout_seconds=clinical_context.BACKGROUND_FETCH_SECONDS,
        cache_ttl_seconds=settings.OPENMRS_CACHE_TTL_SECONDS,
        use_cache=False,
    )
    link.last_status = summary.status
    if summary.status in ("ok", "partial"):
        link.last_synced_at = datetime.now(UTC)
    await session.commit()
    logger.info("Clinical link: tested profile=%s status=%s", profile.id, summary.status)
    return ClinicalLinkTestResult(status=summary.status, **summary.counts())


@router.delete(
    "/profiles/{access_code}/clinical-link", response_model=ClinicalLinkStatus, responses=_ERRORS
)
async def delete_clinical_link(
    access_code: str, request: Request, session: AsyncSession = Depends(get_session)
):
    _openmrs_client(request)
    profile = await _profile_or_404(session, access_code)
    await session.execute(
        delete(ClinicalLink).where(
            ClinicalLink.profile_id == profile.id, ClinicalLink.source == SOURCE
        )
    )
    await session.commit()
    clinical_context.evict(profile.id)
    logger.info("Clinical link: unlinked profile=%s source=%s", profile.id, SOURCE)
    return ClinicalLinkStatus(linked=False)
