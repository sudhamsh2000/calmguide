"""
Seed Frank Kowalski's clinical record into the CalmGuide test OpenMRS instance.

Frank is the fictional CalmGuide demo persona FRNKKOWL (docs/demo-data.md).
Every name, address, phone number and clinical detail here is invented.

Usage:
    cd backend
    python scripts/seed_openmrs_frank.py \
        --base-url https://openmrs-production-5ae8.up.railway.app/openmrs \
        --username admin

    The password is read from OPENMRS_SEED_PASSWORD, or prompted for.
    Use an account with write access (e.g. admin). CalmGuide's runtime
    account stays read-only and is never used here.

Run it on demo morning: vitals are dated relative to the day it runs, so the
fever always lands the day before the demo.

Safe to re-run:
    - Frank is found by name + birthdate and never duplicated.
    - Conditions, allergies and medication orders are only created if missing.
    - Vitals/lab encounters are voided and recreated relative to today.

Afterwards it writes Frank's FHIR R4 resources to backend/tests/data/openmrs/
(as fixtures for the clinical-summary tests) and prints his patient UUID,
which is what gets pasted into CalmGuide's Care Profile → Health record card.
"""

import argparse
import getpass
import json
import os
import sys
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from typing import NamedTuple

import httpx

# ── Instance metadata (verified against the CalmGuide OpenMRS 3.7.1 dictionary) ──

OPENMRS_ID_TYPE = "05a29f94-c0ed-11e2-94be-8c13b969e334"
OPENMRS_ID_SOURCE = "8549f706-7e85-4c1d-9424-217d50a2988b"
TELEPHONE_ATTR = "14d4f066-15f5-102d-96e4-000c29c2a5d7"
LOCATION = "f47ac10b-58cc-4372-a567-0e02b2c3d479"  # Ubuntu Hospital (Visit Location)
VISIT_TYPE = "7b0f5697-27e3-40c4-8bae-f4049abfb4ed"  # Facility Visit
PROVIDER = "3a5caa04-cc7b-434b-ab92-830c74ee3d89"  # admin's provider record
ENCOUNTER_ROLE = "240b26f9-dd88-4172-823d-4a8bfeb7841f"  # Clinician
OUTPATIENT = "6f0c9a92-6f24-11e3-af88-005056821db0"

ENC_VITALS = "67a71486-1a54-468f-ac3e-7091a9a79584"
ENC_LAB = "3596fafb-6f6f-4396-8c87-6e63a0f1bd71"
ENC_MENTAL = "36db5123-0ad5-41c0-9037-625b46e0ceef"
ENC_ORDER = "39da3525-afe4-45ff-8977-c53b7b359158"
REFRESHED_ENCOUNTER_TYPES = (ENC_VITALS, ENC_LAB, ENC_MENTAL)

CLASS_DRUG = "8d490dfc-c2cc-11de-8d13-0010c6dffd0f"
CLASS_DIAGNOSIS = "8d4918b0-c2cc-11de-8d13-0010c6dffd0f"
CLASS_TEST = "8d4907b2-c2cc-11de-8d13-0010c6dffd0f"
DT_NA = "8d4a4c94-c2cc-11de-8d13-0010c6dffd0f"
DT_NUMERIC = "8d4a4488-c2cc-11de-8d13-0010c6dffd0f"


def ciel(code: int) -> str:
    """CIEL concepts use their code padded with 'A' to 36 characters as the UUID."""
    return str(code).ljust(36, "A")


MG = ciel(161553)
TABLET = ciel(1513)
ORAL = ciel(160240)
DAYS = ciel(1072)
ONCE_DAILY = "136ebdb7-e989-47cf-8ec2-4e8b2ffe0ab3"
TWICE_DAILY = "08c71152-c552-42e7-b094-f510ff44e9cb"
EVERY_SIX_HOURS = "136ebdb7-e989-47ct-8ec2-4e8b6ffe0ab1"

SEVERITY = {"mild": ciel(1498), "moderate": ciel(1499), "severe": ciel(1500)}

VITAL_CONCEPTS = {
    "temp": ciel(5088),
    "sbp": ciel(5085),
    "dbp": ciel(5086),
    "hr": ciel(5087),
    "spo2": ciel(5092),
    "rr": ciel(5242),
    "glucose": ciel(887),
    "weight": ciel(5089),
}

# Concepts this instance's dictionary is missing; created on first run.
MISSING_CONCEPTS = {
    "donepezil": ("Donepezil", CLASS_DRUG, DT_NA),
    "memantine": ("Memantine", CLASS_DRUG, DT_NA),
    "sertraline": ("Sertraline", CLASS_DRUG, DT_NA),
    "tamsulosin": ("Tamsulosin", CLASS_DRUG, DT_NA),
    "quetiapine": ("Quetiapine", CLASS_DRUG, DT_NA),
    "oxybutynin": ("Oxybutynin", CLASS_DRUG, DT_NA),
    "bph": ("Benign prostatic hyperplasia", CLASS_DIAGNOSIS, DT_NA),
    "mmse": ("Mini-Mental State Examination score", CLASS_TEST, DT_NUMERIC),
}

# ── Frank's record (docs: OpenMRS Integration Plan, Phase 9) ──

FRANK = {
    "given": "Frank",
    "middle": "Joseph",
    "family": "Kowalski",
    "gender": "M",
    "birthdate": "1932-03-14",
    "address1": "Maple Grove Memory Care, 1200 Birchwood Lane",
    "city": "Springfield",
    "phone": "555-0142",
    "next_of_kin": "Anna Kowalski (daughter)",
}

# (concept key or CIEL uuid, onset, status, end date, detail)
CONDITIONS = [
    (ciel(149019), "2021-06-01", "ACTIVE", None, "Moderate"),
    (ciel(113881), "1954-01-01", "ACTIVE", None, "Combat-related"),
    (ciel(140987), "2008-01-01", "ACTIVE", None, None),
    ("bph", "2015-01-01", "ACTIVE", None, None),
    (ciel(111633), "2025-11-01", "ACTIVE", None, "Recurrent"),
    (ciel(142473), "2012-01-01", "ACTIVE", None, None),
    (ciel(131651), "2016-01-01", "ACTIVE", None, "Both knees"),
    (ciel(117698), "2019-01-01", "ACTIVE", None, "Bilateral; wears hearing aids"),
    # Filter tests: resolved, must not reach the summary.
    (ciel(119685), "2026-08-04", "INACTIVE", "2026-08-09", "Acute cystitis, resolved"),
    (ciel(114100), "2024-02-01", "INACTIVE", "2024-02-20", "Community-acquired, resolved"),
]

# (allergen concept, severity, reaction concept, comment)
ALLERGIES = [
    (ciel(81725), "moderate", ciel(111061), "Hives"),  # Penicillin G
    (ciel(73667), "severe", ciel(121677), "Severe confusion and agitation"),  # Codeine
    (ciel(105281), "mild", ciel(512), "Rash"),  # Sulfamethoxazole / trimethoprim
]


# Medications are entered with full doses; the CalmGuide summary keeps name + frequency only.
class Med(NamedTuple):
    drug: str  # drug record name
    concept: str  # CIEL uuid, or a MISSING_CONCEPTS key
    strength: str
    dose: float  # mg
    frequency: str
    start: str
    instructions: str | None = None
    as_needed: bool = False
    stop: str | None = None
    stop_reason: str | None = None
    duration_days: int | None = None


MEDICATIONS = [
    Med("Donepezil 10mg", "donepezil", "10mg", 10, ONCE_DAILY, "2021-07-01", "At bedtime"),
    Med("Memantine 10mg", "memantine", "10mg", 10, TWICE_DAILY, "2023-03-15"),
    Med("Sertraline 50mg", "sertraline", "50mg", 50, ONCE_DAILY, "2022-01-10"),
    Med("Amlodipine 5mg", ciel(71137), "5mg", 5, ONCE_DAILY, "2008-05-01"),
    Med("Tamsulosin 0.4mg", "tamsulosin", "0.4mg", 0.4, ONCE_DAILY, "2015-09-01", "At bedtime"),
    Med("Metformin 500mg", ciel(79651), "500mg", 500, TWICE_DAILY, "2012-04-01", "With meals"),
    Med(
        "Acetaminophen 650mg",
        ciel(70116),
        "650mg",
        650,
        EVERY_SIX_HOURS,
        "2016-06-01",
        "For knee pain",
        as_needed=True,
    ),
    # Filter tests: stopped or completed, must not reach the summary.
    Med(
        "Quetiapine 25mg",
        "quetiapine",
        "25mg",
        25,
        ONCE_DAILY,
        "2025-10-01",
        "At bedtime",
        stop="2026-05-20",
        stop_reason="Falls and sedation",
    ),
    Med(
        "Oxybutynin 5mg",
        "oxybutynin",
        "5mg",
        5,
        ONCE_DAILY,
        "2025-06-01",
        stop="2025-12-15",
        stop_reason="Worsened confusion",
    ),
    Med(
        "Nitrofurantoin 100mg",
        "64d72b1f-2585-48e2-b66a-0da320d068da",
        "100mg",
        100,
        TWICE_DAILY,
        "2026-08-04",
        duration_days=5,
    ),
]

# Day offset → vitals. None = not measured that day.
VITALS = [
    (-13, dict(temp=36.7, sbp=136, dbp=80, hr=72, spo2=96, rr=16, glucose=124, weight=78.4)),
    (-10, dict(temp=36.6, sbp=140, dbp=82, hr=70, spo2=97, rr=16, glucose=118, weight=None)),
    (-7, dict(temp=36.8, sbp=134, dbp=78, hr=74, spo2=96, rr=16, glucose=130, weight=78.1)),
    (-4, dict(temp=36.9, sbp=138, dbp=84, hr=76, spo2=96, rr=17, glucose=127, weight=None)),
    (-2, dict(temp=37.4, sbp=142, dbp=86, hr=84, spo2=96, rr=18, glucose=145, weight=77.6)),
    (-1, dict(temp=38.1, sbp=146, dbp=88, hr=96, spo2=95, rr=20, glucose=168, weight=None)),
    (0, dict(temp=37.9, sbp=144, dbp=86, hr=92, spo2=95, rr=19, glucose=158, weight=77.3)),
]


class OpenMRS:
    def __init__(self, base_url: str, username: str, password: str):
        self.base = base_url.rstrip("/")
        self.http = httpx.Client(auth=(username, password), timeout=60.0)

    def _check(self, r: httpx.Response) -> dict:
        if r.status_code >= 400:
            raise SystemExit(
                f"OpenMRS {r.request.method} {r.request.url.path} → {r.status_code}: {r.text[:500]}"
            )
        return r.json() if r.content else {}

    def get(self, path: str, **params) -> dict:
        return self._check(self.http.get(f"{self.base}/ws/rest/v1/{path}", params=params))

    def post(self, path: str, body: dict) -> dict:
        return self._check(self.http.post(f"{self.base}/ws/rest/v1/{path}", json=body))

    def delete(self, path: str) -> None:
        self._check(self.http.delete(f"{self.base}/ws/rest/v1/{path}"))

    def fhir(self, path: str, **params) -> dict:
        return self._check(self.http.get(f"{self.base}/ws/fhir2/R4/{path}", params=params))


def ts(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000+0000")


def at_noon(day: str) -> datetime:
    return datetime.combine(date.fromisoformat(day), time(12), tzinfo=UTC)


def find_by_display(api: OpenMRS, resource: str, name: str, **extra) -> str | None:
    results = api.get(resource, q=name, v="custom:(uuid,display)", **extra)["results"]
    return next((r["uuid"] for r in results if r["display"].lower() == name.lower()), None)


def ensure_concepts(api: OpenMRS) -> dict[str, str]:
    uuids = {}
    for key, (name, concept_class, datatype) in MISSING_CONCEPTS.items():
        uuid = find_by_display(api, "concept", name)
        if not uuid:
            uuid = api.post(
                "concept",
                {
                    "names": [
                        {
                            "name": name,
                            "locale": "en",
                            "localePreferred": True,
                            "conceptNameType": "FULLY_SPECIFIED",
                        }
                    ],
                    "datatype": datatype,
                    "conceptClass": concept_class,
                },
            )["uuid"]
            print(f"  created concept {name}")
        uuids[key] = uuid
    return uuids


def resolve(ref: str, concepts: dict[str, str]) -> str:
    return concepts.get(ref, ref)


def ensure_attribute_type(api: OpenMRS, name: str, fmt: str, description: str) -> str:
    uuid = find_by_display(api, "personattributetype", name)
    if uuid:
        return uuid
    return api.post(
        "personattributetype", {"name": name, "format": fmt, "description": description}
    )["uuid"]


def ensure_patient(api: OpenMRS) -> tuple[str, bool]:
    for p in api.get("patient", q=f"{FRANK['given']} {FRANK['family']}", v="full")["results"]:
        person = p["person"]
        if (person.get("birthdate") or "").startswith(FRANK["birthdate"]) and not p.get("voided"):
            return p["uuid"], False

    next_of_kin = ensure_attribute_type(
        api, "Next of kin", "java.lang.String", "Name and relationship of next of kin"
    )
    veteran = ensure_attribute_type(
        api, "Military veteran", "java.lang.Boolean", "Whether the patient is a military veteran"
    )
    identifier = api.post(f"idgen/identifiersource/{OPENMRS_ID_SOURCE}/identifier", {})[
        "identifier"
    ]
    patient = api.post(
        "patient",
        {
            "person": {
                "names": [
                    {
                        "givenName": FRANK["given"],
                        "middleName": FRANK["middle"],
                        "familyName": FRANK["family"],
                        "preferred": True,
                    }
                ],
                "gender": FRANK["gender"],
                "birthdate": FRANK["birthdate"],
                "addresses": [
                    {"address1": FRANK["address1"], "cityVillage": FRANK["city"], "preferred": True}
                ],
                "attributes": [
                    {"attributeType": TELEPHONE_ATTR, "value": FRANK["phone"]},
                    {"attributeType": next_of_kin, "value": FRANK["next_of_kin"]},
                    {"attributeType": veteran, "value": "true"},
                ],
            },
            "identifiers": [
                {
                    "identifier": identifier,
                    "identifierType": OPENMRS_ID_TYPE,
                    "location": LOCATION,
                    "preferred": True,
                }
            ],
        },
    )
    return patient["uuid"], True


def new_encounter(
    api: OpenMRS, patient: str, enc_type: str, when: datetime, obs: list[dict] | None = None
) -> str:
    now = datetime.now(UTC)
    visit = api.post(
        "visit",
        {
            "patient": patient,
            "visitType": VISIT_TYPE,
            "location": LOCATION,
            "startDatetime": ts(when - timedelta(minutes=5)),
            "stopDatetime": ts(min(when + timedelta(minutes=30), now - timedelta(minutes=1))),
        },
    )["uuid"]
    return api.post(
        "encounter",
        {
            "patient": patient,
            "encounterType": enc_type,
            "encounterDatetime": ts(when),
            "location": LOCATION,
            "visit": visit,
            "encounterProviders": [{"provider": PROVIDER, "encounterRole": ENCOUNTER_ROLE}],
            "obs": obs or [],
        },
    )["uuid"]


def ensure_conditions(api: OpenMRS, patient: str, concepts: dict[str, str]) -> None:
    # Without includeInactive the resolved (filter-test) conditions are missed and duplicated.
    conditions = api.get("condition", patientUuid=patient, includeInactive="true", v="full")
    existing = set()
    for c in conditions.get("results", []):
        concept = ((c.get("condition") or {}).get("coded") or {}).get("uuid")
        if c.get("voided") or not concept:
            continue
        if concept in existing:
            api.delete(f"condition/{c['uuid']}")  # duplicate from an earlier run
            print(f"  removed duplicate condition {concept[:8]}…")
            continue
        existing.add(concept)
    for ref, onset, status, end, detail in CONDITIONS:
        concept = resolve(ref, concepts)
        if concept in existing:
            continue
        body = {
            "patient": patient,
            "condition": {"coded": concept},
            "clinicalStatus": status,
            "verificationStatus": "CONFIRMED",
            "onsetDate": f"{onset}T00:00:00.000+0000",
        }
        if end:
            body["endDate"] = f"{end}T00:00:00.000+0000"
        if detail:
            body["additionalDetail"] = detail
        api.post("condition", body)
        print(f"  condition {concept[:8]}… {status.lower()}")


def ensure_allergies(api: OpenMRS, patient: str) -> None:
    existing = {
        a["allergen"]["codedAllergen"]["uuid"]
        # An empty allergy list comes back without a "results" key.
        for a in api.get(f"patient/{patient}/allergy", v="full").get("results", [])
        if a.get("allergen", {}).get("codedAllergen")
    }
    for allergen, severity, reaction, comment in ALLERGIES:
        if allergen in existing:
            continue
        api.post(
            f"patient/{patient}/allergy",
            {
                "allergen": {"allergenType": "DRUG", "codedAllergen": {"uuid": allergen}},
                "severity": {"uuid": SEVERITY[severity]},
                "comment": comment,
                "reactions": [{"reaction": {"uuid": reaction}}],
            },
        )
        print(f"  allergy {comment}")


def ensure_drug(api: OpenMRS, name: str, concept: str, strength: str) -> str:
    uuid = find_by_display(api, "drug", name)
    if uuid:
        return uuid
    return api.post(
        "drug",
        {
            "name": name,
            "concept": concept,
            "strength": strength,
            "dosageForm": TABLET,
            "combination": False,
        },
    )["uuid"]


def ensure_medications(api: OpenMRS, patient: str, concepts: dict[str, str]) -> None:
    ordered_drugs = set()
    for enc in api.get(
        "encounter",
        patient=patient,
        encounterType=ENC_ORDER,
        v="custom:(uuid,orders:(uuid,drug:(uuid)))",
    )["results"]:
        ordered_drugs |= {o["drug"]["uuid"] for o in enc.get("orders", []) if o.get("drug")}

    for med in MEDICATIONS:
        concept = resolve(med.concept, concepts)
        drug = ensure_drug(api, med.drug, concept, med.strength)
        if drug in ordered_drugs:
            continue
        started = at_noon(med.start)
        order = {
            "type": "drugorder",
            "patient": patient,
            "careSetting": OUTPATIENT,
            "orderer": PROVIDER,
            "encounter": new_encounter(api, patient, ENC_ORDER, started),
            "drug": drug,
            "dateActivated": ts(started),
            "dosingType": "org.openmrs.SimpleDosingInstructions",
            "dose": med.dose,
            "doseUnits": MG,
            "route": ORAL,
            "frequency": med.frequency,
            "asNeeded": med.as_needed,
            "quantity": 30,
            "quantityUnits": TABLET,
            "numRefills": 0,
        }
        if med.instructions:
            order["dosingInstructions"] = med.instructions
        if med.as_needed:
            order["asNeededCondition"] = med.instructions
        if med.duration_days:
            order["duration"] = med.duration_days
            order["durationUnits"] = DAYS
        created = api.post("order", order)

        if med.stop:
            stopped = at_noon(med.stop)
            api.post(
                "order",
                {
                    "type": "drugorder",
                    "action": "DISCONTINUE",
                    "previousOrder": created["uuid"],
                    "patient": patient,
                    "careSetting": OUTPATIENT,
                    "orderer": PROVIDER,
                    "encounter": new_encounter(api, patient, ENC_ORDER, stopped),
                    "drug": drug,
                    "concept": concept,
                    "dateActivated": ts(stopped),
                    "orderReasonNonCoded": med.stop_reason,
                },
            )
        print(f"  medication {med.drug}{' (discontinued)' if med.stop else ''}")


def refresh_observations(api: OpenMRS, patient: str, concepts: dict[str, str]) -> None:
    for enc_type in REFRESHED_ENCOUNTER_TYPES:
        for enc in api.get(
            "encounter", patient=patient, encounterType=enc_type, v="custom:(uuid,visit:(uuid))"
        )["results"]:
            api.delete(f"encounter/{enc['uuid']}")
            if enc.get("visit"):
                api.delete(f"visit/{enc['visit']['uuid']}")

    now = datetime.now(UTC)
    today = now.date()

    # Each encounter gets its own visit, and OpenMRS rejects overlapping visits,
    # so readings on the same day need distinct hours.
    def reading_time(offset: int, hour: int = 8) -> datetime:
        when = datetime.combine(today + timedelta(days=offset), time(hour), tzinfo=UTC)
        return min(when, now - timedelta(minutes=10))

    for offset, readings in VITALS:
        obs = [
            {"concept": VITAL_CONCEPTS[k], "value": v} for k, v in readings.items() if v is not None
        ]
        if offset == -13:
            obs.append({"concept": ciel(5090), "value": 175})  # height: filter test
        new_encounter(api, patient, ENC_VITALS, reading_time(offset), obs)

    # Filter tests: none of these may reach the CalmGuide summary.
    new_encounter(
        api,
        patient,
        ENC_VITALS,
        reading_time(-20),
        [{"concept": VITAL_CONCEPTS["temp"], "value": 36.8}],
    )
    new_encounter(
        api, patient, ENC_LAB, reading_time(-30), [{"concept": ciel(159644), "value": 7.2}]
    )
    new_encounter(
        api,
        patient,
        ENC_MENTAL,
        reading_time(-30, 10),
        [{"concept": concepts["mmse"], "value": 15}],
    )
    new_encounter(
        api,
        patient,
        ENC_LAB,
        at_noon("2026-08-04") - timedelta(hours=3),  # the order visit that day is at noon
        [{"concept": ciel(161441), "value": ciel(703)}],
    )
    print(f"  vitals refreshed relative to {today.isoformat()}")


def write_fixtures(api: OpenMRS, patient: str, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    bundles = {
        "frank_patient.json": api.fhir(f"Patient/{patient}"),
        "frank_conditions.json": api.fhir("Condition", patient=patient, _count=100),
        "frank_allergies.json": api.fhir("AllergyIntolerance", patient=patient, _count=100),
        "frank_medication_requests.json": api.fhir(
            "MedicationRequest", patient=patient, _count=100
        ),
        "frank_observations.json": api.fhir("Observation", patient=patient, _count=200),
    }
    for filename, bundle in bundles.items():
        (out_dir / filename).write_text(json.dumps(bundle, indent=2, sort_keys=True) + "\n")
    print(f"  wrote {len(bundles)} FHIR fixtures to {out_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get("OPENMRS_BASE_URL", ""),
        help="e.g. https://host/openmrs",
    )
    parser.add_argument("--username", default="admin", help="OpenMRS account with write access")
    parser.add_argument(
        "--fixtures-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "tests" / "data" / "openmrs",
    )
    parser.add_argument("--skip-fixtures", action="store_true")
    args = parser.parse_args()

    if not args.base_url:
        parser.error("--base-url (or OPENMRS_BASE_URL) is required")
    password = os.environ.get("OPENMRS_SEED_PASSWORD") or getpass.getpass(
        f"OpenMRS password for {args.username}: "
    )

    api = OpenMRS(args.base_url, args.username, password)
    if not api.get("session").get("authenticated"):
        sys.exit("OpenMRS rejected the username/password.")

    print("Seeding Frank Kowalski (fictional demo patient)…")
    concepts = ensure_concepts(api)
    patient, created = ensure_patient(api)
    print(f"  patient {'created' if created else 'found'}")
    ensure_conditions(api, patient, concepts)
    ensure_allergies(api, patient)
    ensure_medications(api, patient, concepts)
    refresh_observations(api, patient, concepts)
    if not args.skip_fixtures:
        write_fixtures(api, patient, args.fixtures_dir)

    print("\nDone. Frank's OpenMRS patient UUID (paste into Care Profile → Health record):")
    print(f"  {patient}")


if __name__ == "__main__":
    main()
