"""Read-only OpenMRS FHIR R4 client for patient clinical context.

One shared ``httpx.AsyncClient`` lives on ``app.state.openmrs`` (created in the
app lifespan when OPENMRS_ENABLED is set). Every failure mode the caller can't
fix — timeout, connection error, 5xx, bad credentials — surfaces as
``OpenMRSUnavailable`` so the coach can simply carry on without the record.

Response bodies are never logged: they carry PHI. Only status codes and
timings are.
"""

import logging
import re
import time
from datetime import date
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

# Bundles are capped rather than paged: the summary keeps only a handful of
# items per section, and following `next` links would blow the latency budget.
_PAGE_SIZE = 100


class OpenMRSUnavailable(Exception):
    """OpenMRS could not be reached or refused the request."""


class OpenMRSPatientNotFound(Exception):
    """The patient UUID does not exist in OpenMRS."""


def is_valid_patient_uuid(value: str) -> bool:
    return bool(_UUID_RE.match(value or ""))


class OpenMRSClient:
    def __init__(
        self,
        base_url: str,
        username: str,
        password: str,
        *,
        timeout: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._fhir_base = f"{base_url.rstrip('/')}/ws/fhir2/R4"
        self._http = httpx.AsyncClient(
            auth=(username, password),
            timeout=timeout,
            headers={"Accept": "application/fhir+json"},
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> dict:
        resource = path.split("/", 1)[0]
        start = time.monotonic()
        try:
            response = await self._http.get(f"{self._fhir_base}/{path}", params=params)
        except httpx.HTTPError as exc:
            logger.warning(
                "OpenMRS %s failed after %.0fms: %s",
                resource,
                (time.monotonic() - start) * 1000,
                type(exc).__name__,
            )
            raise OpenMRSUnavailable(type(exc).__name__) from exc

        elapsed_ms = (time.monotonic() - start) * 1000
        logger.info(
            "OpenMRS %s status=%d duration_ms=%.0f", resource, response.status_code, elapsed_ms
        )
        if response.status_code == 404:
            raise OpenMRSPatientNotFound(resource)
        if response.status_code >= 400:
            raise OpenMRSUnavailable(f"HTTP {response.status_code}")
        try:
            return response.json()
        except ValueError as exc:
            raise OpenMRSUnavailable("invalid JSON") from exc

    async def _search(self, resource: str, **params: Any) -> list[dict]:
        bundle = await self._get(resource, {**params, "_count": _PAGE_SIZE})
        return [
            entry["resource"]
            for entry in bundle.get("entry", [])
            if entry.get("resource", {}).get("resourceType") == resource
        ]

    async def ping(self) -> bool:
        """True when OpenMRS answers and accepts our credentials."""
        try:
            await self._get("Patient", {"_count": 1})
            return True
        except (OpenMRSUnavailable, OpenMRSPatientNotFound):
            return False

    async def get_patient(self, patient_uuid: str) -> dict:
        if not is_valid_patient_uuid(patient_uuid):
            raise OpenMRSPatientNotFound("invalid uuid")
        return await self._get(f"Patient/{patient_uuid}")

    async def get_conditions(self, patient_uuid: str) -> list[dict]:
        return await self._search("Condition", patient=patient_uuid)

    async def get_medications(self, patient_uuid: str) -> list[dict]:
        return await self._search("MedicationRequest", patient=patient_uuid)

    async def get_allergies(self, patient_uuid: str) -> list[dict]:
        return await self._search("AllergyIntolerance", patient=patient_uuid)

    async def get_observations(self, patient_uuid: str, since: date) -> list[dict]:
        return await self._search(
            "Observation", patient=patient_uuid, date=f"ge{since.isoformat()}"
        )
