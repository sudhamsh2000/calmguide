"""Turn a linked patient's OpenMRS record into a small, PII-free clinical summary.

The Moment Coach never sees raw FHIR. It sees a ``ClinicalSummary``: active
conditions, current medications (name + frequency, no doses), allergies, and a
whitelist of recent vital signs — each section capped. Names, birth dates,
addresses and identifiers never leave this module; CalmGuide's rule is that
patient names live only in the browser.

``get_clinical_summary`` never raises. OpenMRS being slow or down yields
``status="unavailable"`` (or ``"partial"``) and the coach carries on without it.

The cache is in-process and per instance, stale-while-revalidate (see
"Fetch + cache" below). If the backend ever runs more than one instance, move
it to Redis.
"""

import asyncio
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Literal

from app.services.openmrs_client import (
    OpenMRSClient,
    OpenMRSPatientNotFound,
    OpenMRSUnavailable,
)

logger = logging.getLogger(__name__)

SummaryStatus = Literal["ok", "partial", "unavailable", "not_linked"]

MAX_CONDITIONS = 8
MAX_MEDICATIONS = 10
MAX_ALLERGIES = 6
MAX_OBSERVATIONS = 8
OBSERVATION_WINDOW_DAYS = 14
_MAX_NOTE_CHARS = 60

CIEL_SYSTEM = "https://cielterminology.org"

# Whitelisted vital signs, keyed by CIEL code (this OpenMRS instance maps few
# vitals to LOINC, so CIEL is the reliable key). Everything else — labs,
# cognitive scores, height — is ignored.
VITALS: dict[str, tuple[str, str]] = {
    "5088": ("temperature", "°C"),
    "5085": ("systolic", "mmHg"),
    "5086": ("diastolic", "mmHg"),
    "5087": ("heart_rate", "bpm"),
    "5092": ("spo2", "%"),
    "5242": ("respiratory_rate", "/min"),
    "887": ("blood_glucose", "mg/dL"),
    "5089": ("weight", "kg"),
}
VITAL_LABELS = {
    "temperature": "Temperature",
    "blood_pressure": "Blood pressure",
    "heart_rate": "Heart rate",
    "spo2": "Oxygen saturation",
    "respiratory_rate": "Respiratory rate",
    "blood_glucose": "Blood glucose",
    "weight": "Weight",
}

# Drug names arrive as e.g. "Donepezil 10mg"; doses are kept out of the prompt.
_STRENGTH_RE = re.compile(
    r"\s*\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|ml|mL|iu|IU|units?|%)\b.*$", re.IGNORECASE
)
_HAS_DOSE_RE = re.compile(r"\d")


@dataclass(frozen=True)
class ClinicalSummary:
    status: SummaryStatus
    conditions: list[str] = field(default_factory=list)
    medications: list[str] = field(default_factory=list)
    allergies: list[str] = field(default_factory=list)
    observations: list[dict] = field(default_factory=list)
    fetched_at: datetime | None = None

    @classmethod
    def not_linked(cls) -> "ClinicalSummary":
        return cls(status="not_linked")

    @classmethod
    def unavailable(cls) -> "ClinicalSummary":
        return cls(status="unavailable")

    def counts(self) -> dict[str, int]:
        return {
            "conditions": len(self.conditions),
            "medications": len(self.medications),
            "allergies": len(self.allergies),
            "observations": len(self.observations),
        }


# ── FHIR → summary (pure functions) ──────────────────────────────────────────


def _concept_text(concept: dict | None) -> str:
    if not concept:
        return ""
    if concept.get("text"):
        return concept["text"]
    for coding in concept.get("coding", []):
        if coding.get("display"):
            return coding["display"]
    return ""


def _ciel_code(concept: dict | None) -> str | None:
    for coding in (concept or {}).get("coding", []):
        if coding.get("system") == CIEL_SYSTEM:
            return coding.get("code")
    return None


def _status_code(resource: dict, key: str) -> str:
    return ((resource.get(key) or {}).get("coding") or [{}])[0].get("code", "")


def _note(resource: dict) -> str:
    notes = [n.get("text", "").strip() for n in resource.get("note", []) if n.get("text")]
    text = "; ".join(notes)
    return text[:_MAX_NOTE_CHARS].rstrip() if text else ""


def summarize_conditions(conditions: list[dict]) -> list[str]:
    out = []
    for c in conditions:
        if _status_code(c, "clinicalStatus") != "active":
            continue
        name = _concept_text(c.get("code"))
        if not name:
            continue
        note = _note(c)
        out.append(f"{name} ({note})" if note else name)
    return out[:MAX_CONDITIONS]


def _drug_name(med: dict) -> str:
    name = (med.get("medicationReference") or {}).get("display") or _concept_text(
        med.get("medicationCodeableConcept")
    )
    return _STRENGTH_RE.sub("", name).strip()


def summarize_medications(medications: list[dict]) -> list[str]:
    out = []
    for m in medications:
        if m.get("status") != "active":
            continue
        name = _drug_name(m)
        if not name:
            continue
        dosage = (m.get("dosageInstruction") or [{}])[0]
        parts = []
        frequency = _concept_text((dosage.get("timing") or {}).get("code"))
        if frequency:
            parts.append(frequency.lower())
        if dosage.get("asNeededBoolean"):
            parts.append("as needed")
        instruction = (dosage.get("text") or "").strip()
        # Free-text instructions sometimes carry a dose ("take 2 tablets"); drop those.
        if instruction and not _HAS_DOSE_RE.search(instruction):
            parts.append(instruction[:_MAX_NOTE_CHARS].lower())
        out.append(f"{name} — {', '.join(parts)}" if parts else name)
    return out[:MAX_MEDICATIONS]


def summarize_allergies(allergies: list[dict]) -> list[str]:
    out = []
    for a in allergies:
        if _status_code(a, "clinicalStatus") not in ("active", ""):
            continue
        substance = _concept_text(a.get("code"))
        if not substance:
            continue
        details = []
        for reaction in a.get("reaction", []):
            details += [_concept_text(m) for m in reaction.get("manifestation", [])]
            if reaction.get("severity"):
                details.append(reaction["severity"])
        note = _note(a)
        if note:
            details.append(note)
        # The note often repeats the coded reaction; keep each detail once.
        details = list(dict.fromkeys(d for d in details if d))
        out.append(f"{substance} ({', '.join(details)})" if details else substance)
    return out[:MAX_ALLERGIES]


def _relative_day(when: date, today: date) -> str:
    days = (today - when).days
    if days <= 0:
        return "today"
    if days == 1:
        return "yesterday"
    return f"{days} days ago"


def _fmt(value: float) -> str:
    return f"{value:g}"


def summarize_observations(observations: list[dict], now: datetime) -> list[dict]:
    """Latest reading per whitelisted vital in the last 14 days, with its range.

    Blood pressure is combined into one line. Each item:
    ``{"label", "latest", "when", "range"}`` — ``range`` is ``None`` when
    there is only one reading.
    """
    cutoff = now - timedelta(days=OBSERVATION_WINDOW_DAYS)
    readings: dict[str, list[tuple[datetime, float]]] = {}
    for o in observations:
        code = _ciel_code(o.get("code"))
        if code not in VITALS:
            continue
        value = (o.get("valueQuantity") or {}).get("value")
        effective = o.get("effectiveDateTime")
        if value is None or not effective:
            continue
        try:
            taken = datetime.fromisoformat(effective.replace("Z", "+00:00"))
        except ValueError:
            continue
        if taken.tzinfo is None:
            taken = taken.replace(tzinfo=UTC)
        if taken < cutoff or taken > now + timedelta(hours=1):
            continue
        readings.setdefault(VITALS[code][0], []).append((taken, float(value)))

    today = now.date()
    items: list[dict] = []

    def add(key: str, unit: str) -> None:
        series = sorted(readings.get(key, []))
        if not series:
            return
        taken, latest = series[-1]
        values = [v for _, v in series]
        items.append(
            {
                "label": VITAL_LABELS[key],
                "latest": f"{_fmt(latest)} {unit}",
                "when": _relative_day(taken.date(), today),
                "range": (
                    f"{_fmt(min(values))}–{_fmt(max(values))} {unit}" if len(values) > 1 else None
                ),
            }
        )

    add("temperature", "°C")
    systolic, diastolic = (
        sorted(readings.get("systolic", [])),
        sorted(readings.get("diastolic", [])),
    )
    if systolic and diastolic:
        items.append(
            {
                "label": VITAL_LABELS["blood_pressure"],
                "latest": f"{_fmt(systolic[-1][1])}/{_fmt(diastolic[-1][1])} mmHg",
                "when": _relative_day(systolic[-1][0].date(), today),
                "range": None,
            }
        )
    for key in ("heart_rate", "spo2", "respiratory_rate", "blood_glucose", "weight"):
        add(key, VITALS[next(c for c, v in VITALS.items() if v[0] == key)][1])
    return items[:MAX_OBSERVATIONS]


def build_summary(
    *,
    conditions: list[dict] | None,
    medications: list[dict] | None,
    allergies: list[dict] | None,
    observations: list[dict] | None,
    now: datetime,
) -> ClinicalSummary:
    """A section passed as ``None`` failed to load; the summary is then partial."""
    sections = (conditions, medications, allergies, observations)
    loaded = sum(s is not None for s in sections)
    if loaded == 0:
        return ClinicalSummary.unavailable()
    return ClinicalSummary(
        status="ok" if loaded == len(sections) else "partial",
        conditions=summarize_conditions(conditions or []),
        medications=summarize_medications(medications or []),
        allergies=summarize_allergies(allergies or []),
        observations=summarize_observations(observations or [], now),
        fetched_at=now,
    )


# ── Fetch + cache ────────────────────────────────────────────────────────────
#
# OpenMRS FHIR is slow — a warm Observation search takes ~9 s on the test
# instance — while the chat path waits at most OPENMRS_TIMEOUT_SECONDS. So the
# cache is stale-while-revalidate: a summary younger than the TTL is served
# as-is; an older one (up to MAX_STALE_SECONDS) is served immediately while a
# refresh runs in the background. A fetch that overruns the chat budget is not
# cancelled: it keeps running (bounded by BACKGROUND_FETCH_SECONDS) and fills
# the cache for the next message. Linking, "Test connection" and app startup
# warm the cache, so a linked profile rarely waits on OpenMRS at all.

MAX_STALE_SECONDS = 24 * 60 * 60
BACKGROUND_FETCH_SECONDS = 30.0

# profile_id -> (patient_uuid, stored_at_monotonic, summary)
_CACHE: dict[str, tuple[str, float, ClinicalSummary]] = {}
# profile_id -> in-flight refresh, so concurrent messages share one fetch.
_INFLIGHT: dict[str, asyncio.Task] = {}


def evict(profile_id: str) -> None:
    _CACHE.pop(profile_id, None)
    task = _INFLIGHT.pop(profile_id, None)
    if task is not None and not task.done():
        task.cancel()


def clear_cache() -> None:
    for profile_id in list(_INFLIGHT):
        evict(profile_id)
    _CACHE.clear()


async def _fetch(
    client: OpenMRSClient, patient_uuid: str, timeout_seconds: float
) -> ClinicalSummary:
    now = datetime.now(UTC)
    since = (now - timedelta(days=OBSERVATION_WINDOW_DAYS)).date()
    tasks = {
        "conditions": asyncio.create_task(client.get_conditions(patient_uuid)),
        "medications": asyncio.create_task(client.get_medications(patient_uuid)),
        "allergies": asyncio.create_task(client.get_allergies(patient_uuid)),
        "observations": asyncio.create_task(client.get_observations(patient_uuid, since)),
    }
    start = time.monotonic()
    try:
        _done, pending = await asyncio.wait(tasks.values(), timeout=timeout_seconds)
    finally:
        for task in tasks.values():
            if not task.done():
                task.cancel()

    results: dict[str, list[dict] | None] = {}
    for name, task in tasks.items():
        if task in pending or task.cancelled():
            results[name] = None
            continue
        exc = task.exception()
        if exc is not None:
            if not isinstance(exc, (OpenMRSUnavailable, OpenMRSPatientNotFound)):
                logger.warning("OpenMRS %s fetch failed: %s", name, type(exc).__name__)
            results[name] = None
        else:
            results[name] = task.result()

    summary = build_summary(now=now, **results)
    logger.info(
        "Clinical summary status=%s timed_out=%d duration_ms=%.0f",
        summary.status,
        len(pending),
        (time.monotonic() - start) * 1000,
    )
    return summary


def refresh(profile_id: str, patient_uuid: str, client: OpenMRSClient) -> asyncio.Task:
    """Start (or join) a background fetch that stores a complete summary in the cache."""
    existing = _INFLIGHT.get(profile_id)
    if existing is not None and not existing.done():
        return existing

    async def _run() -> ClinicalSummary:
        summary = await _fetch(client, patient_uuid, BACKGROUND_FETCH_SECONDS)
        if summary.status == "ok":
            _CACHE[profile_id] = (patient_uuid, time.monotonic(), summary)
        return summary

    task = asyncio.create_task(_run())
    _INFLIGHT[profile_id] = task

    def _done(t: asyncio.Task) -> None:
        if _INFLIGHT.get(profile_id) is t:
            del _INFLIGHT[profile_id]
        if not t.cancelled() and t.exception() is not None:
            logger.warning("Clinical summary refresh failed: %s", type(t.exception()).__name__)

    task.add_done_callback(_done)
    return task


async def get_clinical_summary(
    profile_id: str,
    patient_uuid: str,
    client: OpenMRSClient,
    *,
    timeout_seconds: float,
    cache_ttl_seconds: int,
    use_cache: bool = True,
) -> ClinicalSummary:
    """Never raises. Returns within ~timeout_seconds."""
    if use_cache:
        cached = _CACHE.get(profile_id)
        if cached and cached[0] == patient_uuid:
            age = time.monotonic() - cached[1]
            if age < cache_ttl_seconds:
                return cached[2]
            if age < MAX_STALE_SECONDS:
                refresh(profile_id, patient_uuid, client)
                return cached[2]

    task = refresh(profile_id, patient_uuid, client)
    try:
        # shield: overrunning the budget must not cancel the fetch — it keeps
        # going and fills the cache for the next message.
        return await asyncio.wait_for(asyncio.shield(task), timeout_seconds)
    except TimeoutError:
        logger.info(
            "Clinical summary not ready within %.1fs; continuing in background", timeout_seconds
        )
        return ClinicalSummary.unavailable()
    except Exception as exc:
        logger.warning("Clinical summary fetch failed: %s", type(exc).__name__)
        return ClinicalSummary.unavailable()


def patient_display_name(patient: dict) -> str:
    """Given name only — shown once so the caregiver can confirm the link. Never stored."""
    for name in patient.get("name", []):
        if name.get("given"):
            return name["given"][0]
        if name.get("text"):
            return name["text"].split()[0]
    return ""
