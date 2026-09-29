"""OpenMRS clinical context: summary, link routes, coach wiring, safety invariant.

OpenMRS is faked with httpx.MockTransport serving Frank Kowalski's FHIR record
(tests/data/openmrs/, written by scripts/seed_openmrs_frank.py against the real
test instance). Every request the fake receives is recorded, which is what
lets the safety invariant assert *zero* calls on EMERGENCY/HIGH turns.
"""

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest
from sqlalchemy import select

from app import config
from app.models.clinical_link import ClinicalLink
from app.services import clinical_context
from app.services.clinical_context import ClinicalSummary, build_summary
from app.services.openmrs_client import OpenMRSClient
from app.services.prompt import get_request_locale_header, render_coach_prompt
from app.services.response_guard import validate_medication_safety
from app.services.safety_decision import evaluate_safety_v2
from app.services.safety_gate import resolve_emergency_locale

DATA = Path(__file__).parent / "data"
FIXTURES = DATA / "openmrs"
FRANK_UUID = json.loads((FIXTURES / "frank_patient.json").read_text())["id"]
UNKNOWN_UUID = "00000000-0000-4000-8000-000000000000"
# Fixture vitals are dated relative to the seed run on 2026-09-29.
SEED_NOW = datetime(2026, 9, 29, 13, 0, tzinfo=UTC)

BUNDLES = {
    "Condition": "frank_conditions.json",
    "MedicationRequest": "frank_medication_requests.json",
    "AllergyIntolerance": "frank_allergies.json",
    "Observation": "frank_observations.json",
}

PROFILE = {
    "disease_stage": "middle",
    "behavioral_patterns": ["exit_seeking"],
    "calming_strategies": ["walk_together"],
    "safety_concerns": ["elopement"],
}


def _resources(filename: str) -> list[dict]:
    return [e["resource"] for e in json.loads((FIXTURES / filename).read_text())["entry"]]


class FakeOpenMRS:
    """Serves Frank's record; `mode` simulates outages."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.mode = "ok"  # ok | down | slow | condition_500 | unauthorized

    async def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.mode == "down":
            raise httpx.ConnectError("connection refused", request=request)
        if self.mode == "slow":
            await asyncio.sleep(5)
        if self.mode == "unauthorized":
            return httpx.Response(401)
        path = request.url.path.split("/ws/fhir2/R4/", 1)[1]
        resource, _, ident = path.partition("/")
        if resource == "Patient" and ident:
            if ident != FRANK_UUID:
                return httpx.Response(404, json={"resourceType": "OperationOutcome"})
            return httpx.Response(200, content=(FIXTURES / "frank_patient.json").read_bytes())
        if self.mode == "condition_500" and resource == "Condition":
            return httpx.Response(500)
        if resource in BUNDLES and request.url.params.get("patient") == FRANK_UUID:
            return httpx.Response(200, content=(FIXTURES / BUNDLES[resource]).read_bytes())
        return httpx.Response(200, json={"resourceType": "Bundle", "entry": []})


@pytest.fixture(autouse=True)
def _clear_clinical_cache():
    clinical_context.clear_cache()
    yield
    clinical_context.clear_cache()


@pytest.fixture
def fake_openmrs() -> FakeOpenMRS:
    return FakeOpenMRS()


@pytest.fixture
def openmrs_client(fake_openmrs) -> OpenMRSClient:
    return OpenMRSClient(
        "https://openmrs.test/openmrs",
        "calmguide",
        "not-a-real-password",
        transport=httpx.MockTransport(fake_openmrs.handler),
    )


@pytest.fixture
def openmrs_enabled(monkeypatch):
    monkeypatch.setenv("OPENMRS_ENABLED", "true")
    monkeypatch.setenv("OPENMRS_TIMEOUT_SECONDS", "0.5")
    config.get_settings.cache_clear()
    yield
    config.get_settings.cache_clear()


@pytest.fixture
def wired_app(app, openmrs_client):
    app.state.openmrs = openmrs_client
    return app


async def _create_profile(client) -> str:
    resp = await client.post("/api/profiles", json=PROFILE)
    assert resp.status_code == 201, resp.text
    return resp.json()["access_code"]


async def _link_frank(client, code: str) -> None:
    resp = await client.put(
        f"/api/profiles/{code}/clinical-link", json={"patient_uuid": FRANK_UUID}
    )
    assert resp.status_code == 200, resp.text


async def _drop_warm_cache() -> None:
    """Linking pre-fetches the summary; start from a cold cache instead."""
    for task in list(clinical_context._INFLIGHT.values()):
        await task
    clinical_context.clear_cache()


async def _coach(client, code: str, message: str, locale: str = "en") -> str:
    resp = await client.post(
        "/api/coach/chat",
        json={"access_code": code, "patient_name": "Frank", "message": message},
        headers={"X-App-Locale": locale},
    )
    assert resp.status_code == 200, resp.text
    return resp.text


def _frank_summary(now: datetime = SEED_NOW) -> ClinicalSummary:
    return build_summary(
        conditions=_resources("frank_conditions.json"),
        medications=_resources("frank_medication_requests.json"),
        allergies=_resources("frank_allergies.json"),
        observations=_resources("frank_observations.json"),
        now=now,
    )


# ── Clinical summary (pure) ──────────────────────────────────────────────────


def test_summary_keeps_active_clinical_context():
    s = _frank_summary()
    assert s.status == "ok"
    assert "Alzheimer's disease (Moderate)" in s.conditions
    assert "Urinary tract infection (Recurrent)" in s.conditions
    assert len(s.conditions) == 8
    assert "Donepezil — once daily, at bedtime" in s.medications
    assert "Acetaminophen — every six hours, as needed, for knee pain" in s.medications
    assert len(s.medications) == 7
    assert any(a.startswith("Codeine (") for a in s.allergies)
    temperature = next(o for o in s.observations if o["label"] == "Temperature")
    assert temperature["latest"] == "37.9 °C"
    assert temperature["when"] == "today"
    assert temperature["range"] == "36.6–38.1 °C"


def test_summary_filters_identity_doses_and_inactive_items():
    s = _frank_summary()
    text = json.dumps(s.__dict__, default=str)
    for forbidden in (
        "Kowalski",
        "Joseph",
        "1932",
        "Maple Grove",
        "555-0142",
        "Quetiapine",  # discontinued
        "Oxybutynin",  # discontinued
        "Nitrofurantoin",  # completed course
        "Cystitis",  # resolved
        "Pneumonia",  # resolved
        "Mini-Mental",  # not a whitelisted vital
        "hemoglobin",
        "Height",
        "leukocyte",
    ):
        assert forbidden not in text, forbidden
    # Doses never reach the summary: medications are name + frequency only.
    assert not any(ch.isdigit() for m in s.medications for ch in m)
    # The 36.8 °C reading from 20 days before the seed is outside the window.
    temperature = next(o for o in s.observations if o["label"] == "Temperature")
    assert "36.8" not in (temperature["range"] or "")


def test_recent_fever_is_surfaced_as_an_alert():
    assert _frank_summary().alerts == ["Fever: 38.1 °C yesterday (latest 37.9 °C today)"]


def test_no_alert_without_a_recent_fever():
    normal = [
        o
        for o in _resources("frank_observations.json")
        if (o.get("valueQuantity") or {}).get("value", 0) < 37.8
        or "5088" not in json.dumps(o["code"])
    ]
    summary = build_summary(
        conditions=[], medications=[], allergies=[], observations=normal, now=SEED_NOW
    )
    assert summary.alerts == []


def test_summary_is_partial_or_unavailable_when_sections_fail():
    partial = build_summary(
        conditions=None,
        medications=_resources("frank_medication_requests.json"),
        allergies=[],
        observations=[],
        now=SEED_NOW,
    )
    assert partial.status == "partial"
    assert partial.medications and not partial.conditions
    empty = build_summary(
        conditions=None, medications=None, allergies=None, observations=None, now=SEED_NOW
    )
    assert empty.status == "unavailable"


# ── Fetch, timeout, cache ────────────────────────────────────────────────────


async def test_fetch_ok_then_served_from_cache(openmrs_client, fake_openmrs):
    kwargs = dict(timeout_seconds=2, cache_ttl_seconds=300)
    first = await clinical_context.get_clinical_summary(
        "profile-1", FRANK_UUID, openmrs_client, **kwargs
    )
    assert first.status == "ok"
    assert len(fake_openmrs.requests) == 4
    second = await clinical_context.get_clinical_summary(
        "profile-1", FRANK_UUID, openmrs_client, **kwargs
    )
    assert second is first
    assert len(fake_openmrs.requests) == 4

    clinical_context.evict("profile-1")
    await clinical_context.get_clinical_summary("profile-1", FRANK_UUID, openmrs_client, **kwargs)
    assert len(fake_openmrs.requests) == 8


async def test_fetch_timeout_is_unavailable_and_never_raises(openmrs_client, fake_openmrs):
    fake_openmrs.mode = "slow"
    summary = await clinical_context.get_clinical_summary(
        "profile-1", FRANK_UUID, openmrs_client, timeout_seconds=0.2, cache_ttl_seconds=300
    )
    assert summary.status == "unavailable"


async def test_one_failing_resource_gives_partial(openmrs_client, fake_openmrs):
    fake_openmrs.mode = "condition_500"
    summary = await clinical_context.get_clinical_summary(
        "profile-1", FRANK_UUID, openmrs_client, timeout_seconds=2, cache_ttl_seconds=300
    )
    assert summary.status == "partial"
    assert summary.conditions == [] and summary.medications
    # Only complete summaries are cached.
    fake_openmrs.mode = "ok"
    again = await clinical_context.get_clinical_summary(
        "profile-1", FRANK_UUID, openmrs_client, timeout_seconds=2, cache_ttl_seconds=300
    )
    assert again.status == "ok"


async def test_stale_summary_is_served_while_refreshing(openmrs_client, fake_openmrs):
    kwargs = dict(timeout_seconds=2, cache_ttl_seconds=0)  # everything is "stale"
    first = await clinical_context.get_clinical_summary(
        "profile-1", FRANK_UUID, openmrs_client, **kwargs
    )
    assert first.status == "ok"
    fake_openmrs.mode = "slow"
    # A slow OpenMRS doesn't matter: the stale summary comes back at once...
    second = await asyncio.wait_for(
        clinical_context.get_clinical_summary("profile-1", FRANK_UUID, openmrs_client, **kwargs),
        timeout=0.5,
    )
    assert second is first
    # ...while one refresh runs in the background.
    assert "profile-1" in clinical_context._INFLIGHT


async def test_overrun_fetch_fills_the_cache_for_the_next_message(openmrs_client, fake_openmrs):
    original = fake_openmrs.handler

    async def slowish(request):
        await asyncio.sleep(0.3)
        return await original(request)

    openmrs_client._http._transport = httpx.MockTransport(slowish)
    kwargs = dict(timeout_seconds=0.05, cache_ttl_seconds=300)
    first = await clinical_context.get_clinical_summary(
        "profile-1", FRANK_UUID, openmrs_client, **kwargs
    )
    assert first.status == "unavailable"
    await clinical_context._INFLIGHT["profile-1"]
    second = await clinical_context.get_clinical_summary(
        "profile-1", FRANK_UUID, openmrs_client, **kwargs
    )
    assert second.status == "ok"


# ── Prompt ───────────────────────────────────────────────────────────────────


def _prompt(clinical: ClinicalSummary | None) -> str:
    return render_coach_prompt(
        patient_name="Frank",
        disease_stage="middle",
        behavioral_patterns=["exit seeking"],
        calming_strategies=["walk with him"],
        safety_concerns=["elopement"],
        clinical=clinical,
    )


def test_prompt_renders_clinical_block_for_ok_and_partial():
    prompt = _prompt(_frank_summary())
    assert "## Clinical Record (from Frank's care team)" in prompt
    assert "Urinary tract infection (Recurrent)" in prompt
    assert "Never suggest starting, stopping" in prompt
    assert "**Notable right now**: Fever: 38.1 °C yesterday" in prompt
    assert (
        "FIRST bullet of WHEN TO CALL FOR HELP must tell the caregiver to contact Frank's doctor"
        in prompt
    )
    partial = build_summary(
        conditions=None, medications=[], allergies=[], observations=[], now=SEED_NOW
    )
    assert "## Clinical Record" in _prompt(partial)


def test_prompt_without_link_is_unchanged():
    assert _prompt(ClinicalSummary.not_linked()) == _prompt(None)
    assert "Clinical Record" not in _prompt(None)


def test_prompt_unavailable_adds_only_a_quiet_note():
    prompt = _prompt(ClinicalSummary.unavailable())
    assert "## Clinical Record" not in prompt
    assert "couldn't be reached" in prompt


# ── Response guard ───────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("text", "valid"),
    [
        ("Give Frank an extra 5 mg of donepezil to calm him.", False),
        ("You could skip tonight's donepezil.", False),
        ("Try one acetaminophen tablet for his knee.", False),
        ("Ask Frank's doctor about his donepezil.", True),
        ("Don't stop his donepezil without asking his doctor.", True),
        ("Stop and take a slow breath with him.", True),
    ],
)
def test_medication_dosing_check(text, valid):
    meds = ["Donepezil", "Acetaminophen"]
    assert validate_medication_safety(text, meds).is_valid is valid


def test_medication_check_is_off_without_a_record():
    assert validate_medication_safety("Give an extra 5 mg of donepezil.", []).is_valid


# ── Link routes ──────────────────────────────────────────────────────────────


async def test_routes_are_hidden_when_feature_disabled(client, wired_app):
    code = await _create_profile(client)
    resp = await client.get(f"/api/profiles/{code}/clinical-link")
    assert resp.status_code == 404
    assert resp.json()["code"] == "FEATURE_DISABLED"


async def test_preview_link_status_test_and_unlink(client, wired_app, openmrs_enabled):
    code = await _create_profile(client)

    status = (await client.get(f"/api/profiles/{code}/clinical-link")).json()
    assert status["linked"] is False

    preview = await client.post(
        f"/api/profiles/{code}/clinical-link/preview", json={"patient_uuid": FRANK_UUID}
    )
    assert preview.status_code == 200
    assert preview.json() == {"display_name": "Frank"}

    await _link_frank(client, code)
    status = (await client.get(f"/api/profiles/{code}/clinical-link")).json()
    assert status["linked"] is True
    assert status["patient_ref_hint"] == FRANK_UUID[-4:]
    assert FRANK_UUID not in json.dumps(status)

    tested = await client.post(f"/api/profiles/{code}/clinical-link/test")
    assert tested.json() == {
        "status": "ok",
        "conditions": 8,
        "medications": 7,
        "allergies": 3,
        # Fixture vitals age relative to today, so only assert the shape.
        "observations": tested.json()["observations"],
    }

    unlinked = await client.delete(f"/api/profiles/{code}/clinical-link")
    assert unlinked.json()["linked"] is False
    assert (await client.get(f"/api/profiles/{code}/clinical-link")).json()["linked"] is False


async def test_link_stores_uuid_encrypted_and_no_name(
    client, wired_app, openmrs_enabled, db_session
):
    code = await _create_profile(client)
    await _link_frank(client, code)
    row = (await db_session.execute(select(ClinicalLink))).scalar_one()
    assert FRANK_UUID not in row.external_ref
    assert "Frank" not in json.dumps(
        {c.name: str(getattr(row, c.name)) for c in row.__table__.columns}
    )


async def test_link_errors(client, wired_app, openmrs_enabled, fake_openmrs):
    code = await _create_profile(client)
    bad = await client.put(f"/api/profiles/{code}/clinical-link", json={"patient_uuid": "x" * 36})
    assert bad.status_code == 422
    missing = await client.put(
        f"/api/profiles/{code}/clinical-link", json={"patient_uuid": UNKNOWN_UUID}
    )
    assert missing.json()["code"] == "PATIENT_NOT_FOUND"
    wrong_code = await client.put(
        "/api/profiles/ZZZZZZZZ/clinical-link", json={"patient_uuid": FRANK_UUID}
    )
    assert wrong_code.status_code == 404
    fake_openmrs.mode = "down"
    down = await client.put(
        f"/api/profiles/{code}/clinical-link", json={"patient_uuid": FRANK_UUID}
    )
    assert down.status_code == 503
    assert (await client.get(f"/api/profiles/{code}/clinical-link")).json()["linked"] is False


async def test_profile_erasure_deletes_link(client, wired_app, openmrs_enabled, db_session):
    code = await _create_profile(client)
    await _link_frank(client, code)
    assert (await client.delete(f"/api/profiles/{code}")).status_code == 204
    assert (await db_session.execute(select(ClinicalLink))).scalars().all() == []


# ── Coach wiring ─────────────────────────────────────────────────────────────


async def test_coach_uses_linked_record(client, wired_app, openmrs_enabled, mock_llm, fake_openmrs):
    code = await _create_profile(client)
    await _link_frank(client, code)
    await _drop_warm_cache()
    fake_openmrs.requests.clear()

    await _coach(client, code, "Frank has been more confused since this afternoon")
    prompt = mock_llm.last_stream_system_prompt
    assert "## Clinical Record" in prompt
    assert "Urinary tract infection (Recurrent)" in prompt
    for forbidden in ("Kowalski", "1932", "10mg", "Quetiapine"):
        assert forbidden not in prompt
    assert len(fake_openmrs.requests) == 4


async def test_linking_warms_the_cache(client, wired_app, openmrs_enabled, mock_llm, fake_openmrs):
    code = await _create_profile(client)
    await _link_frank(client, code)
    for task in list(clinical_context._INFLIGHT.values()):
        await task
    fake_openmrs.requests.clear()
    await _coach(client, code, "Frank has been more confused since this afternoon")
    assert "## Clinical Record" in mock_llm.last_stream_system_prompt
    assert fake_openmrs.requests == []


async def test_coach_without_link_makes_no_openmrs_calls(
    client, wired_app, openmrs_enabled, mock_llm, fake_openmrs
):
    code = await _create_profile(client)
    await _coach(client, code, "He keeps asking to go home")
    assert fake_openmrs.requests == []
    assert "Clinical Record" not in mock_llm.last_stream_system_prompt


async def test_coach_ignores_link_when_feature_disabled(
    client, wired_app, openmrs_enabled, mock_llm, fake_openmrs, monkeypatch
):
    code = await _create_profile(client)
    await _link_frank(client, code)
    monkeypatch.setenv("OPENMRS_ENABLED", "false")
    config.get_settings.cache_clear()
    fake_openmrs.requests.clear()
    await _coach(client, code, "He keeps asking to go home")
    assert fake_openmrs.requests == []
    assert "Clinical Record" not in mock_llm.last_stream_system_prompt


async def test_coach_still_answers_when_openmrs_is_down(
    client, wired_app, openmrs_enabled, mock_llm, fake_openmrs
):
    code = await _create_profile(client)
    await _link_frank(client, code)
    await _drop_warm_cache()
    fake_openmrs.mode = "down"
    body = await _coach(client, code, "Frank refuses to walk to lunch")
    assert '"text"' in body  # the mock LLM's answer still streamed
    prompt = mock_llm.last_stream_system_prompt
    assert "## Clinical Record" not in prompt
    assert "couldn't be reached" in prompt


async def test_safety_invariant_no_openmrs_calls_on_short_circuit(
    client, wired_app, openmrs_enabled, fake_openmrs
):
    """The hard rule: EMERGENCY/HIGH turns never touch OpenMRS, even when
    the profile is linked. Checked against every regression case the gate
    actually short-circuits."""
    code = await _create_profile(client)
    await _link_frank(client, code)
    rows = [
        json.loads(line)
        for line in (DATA / "safety_gate_v2_regression.jsonl").read_text().splitlines()
        if line.strip()
    ]
    short_circuited = 0
    for row in rows:
        emergency_locale = resolve_emergency_locale(
            get_request_locale_header(row["language"], None)
        )
        if evaluate_safety_v2(row["input"], locale_code=emergency_locale).allow_llm:
            continue
        short_circuited += 1
        fake_openmrs.requests.clear()
        await _coach(client, code, row["input"], locale=row["language"])
        assert fake_openmrs.requests == [], row["id"]
    assert short_circuited >= 50
