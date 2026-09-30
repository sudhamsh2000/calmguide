# OpenMRS / FHIR Integration: Go/No-Go Recommendation

**Date:** 2026-09-30 · **Promised in:** `WEEKLY_REPORT_2026-09-24.md` §8 · **Decision owner:** LOF

## Recommendation

| Use | Decision |
| --- | --- |
| **October LOF demos and internal testing** on the Railway test instance with synthetic patients | **GO**, as deployed (feature flag on, one linked test profile) |
| **Linking real patients' records** | **NO-GO** until the four conditions in §4 are met |
| **Architecture** (FHIR R4 behind a provider-agnostic service; the safety gate never touches the record) | **Keep.** It's the right shape for any EHR, including the OpenEMR option in the 24 Sep plan |

The integration does what it was built to do, and it does it safely on synthetic
data. What stands between it and real patients isn't engineering quality. It is
authorisation (who may link which record) and data handling (where record data
goes). Both need decisions from LOF and a clinical or privacy reviewer, not just
code.

---

## 1. What was built

Live in production behind `OPENMRS_ENABLED` since 29 Sep (`fddfc76`, `428b985`,
`3e5e4fa`, mobile `0926aee`). A caregiver links a Care Profile to an OpenMRS patient.
The coach then receives a capped summary: conditions, medications with doses
stripped, allergies, 14 days of whitelisted vitals, and a recent-fever alert.
Details are in `ARCHITECTURE.md` → "OpenMRS Clinical Context".

## 2. Evidence

**It changes the guidance in the way intended.** In an A/B run on 2026-09-30
(`backend/tests/evaluation/run_openmrs_ab.py`; raw replies in
`runs/openmrs_ab_20260930T151431Z.json`), Frank Kowalski's caregiver sent "Frank
has been much more confused since this afternoon and keeps going to the
bathroom." The model was the production one (gpt-4o-mini), with 10 samples per arm.

| Measure | With linked record | Without |
| --- | --- | --- |
| WHEN TO CALL FOR HELP opens with "Call Frank's doctor today" | **10 / 10** | 0 / 10 |
| Escalation names a record fact (yesterday's 38.1 °C fever, UTI history) | **8 / 10** | 3 / 10 |
| No medication or dosing advice (rubric + response guard) | 10 / 10 | 10 / 10 |

Without the record, the same message got "contact the doctor if this continues past
tonight". With it, the caregiver is told to call today, and why. That's the
delirium-detection behaviour the integration exists for.

A clinician should still check the wording. One reply said frequent bathroom
visits "can be signs of a urinary tract infection, especially since he has a history
of recurrent infections". That's hedged and ends in a referral, but it's close to
the "never interpret readings as a diagnosis" line. It's a candidate item for
clinician batch 02.

**It can't slow or weaken the safety path.** The gate runs before the link
is even read. `tests/test_openmrs_integration.py` (27 tests) replays every
short-circuited case in the regression set and fails if OpenMRS is touched. All pass
today, alongside 741 safety tests.

**It degrades gracefully.** A 1.5 s budget; a stale-while-revalidate cache
(OpenMRS's Observation search takes ~9 s on the test instance); failures give a
`partial`/`unavailable` summary, and the coach carries on without the record.

## 3. Why not a GO for real patients yet

| # | Issue | Why it matters |
| --- | --- | --- |
| 1 | **Linking isn't authorised against the record.** The only check is the caregiver's own CalmGuide access code. Any valid patient UUID can be linked and read through the shared read-only service account, and the preview step returns that patient's first name. | With real data, anyone who obtains a patient UUID could read that person's conditions and medications through CalmGuide. This is the blocking issue. |
| 2 | **Record data goes to the model provider.** The summary (conditions, medications, vitals) is placed in the prompt sent to OpenAI or Anthropic. | CalmGuide deliberately stores no identity, but record contents are health information. Real records need a data-processing agreement / BAA with zero retention from the model provider, and LOF sign-off on the changed data-handling posture that the 24 Sep report flagged. |
| 3 | **Cache is in-process.** | Fine for one Railway instance; wrong once the backend scales out (a cold cache on each instance means answering without the record). Needs Redis. |
| 4 | **Clinician review of record-driven replies.** | The referral rule is verified by our own A/B, not by a clinician. |

## 4. Conditions for real patients

1. **Patient-scoped authorisation.** Replace the shared service account with SMART
   on FHIR (OAuth 2.0 launch with patient-scoped tokens) or an equivalent consent flow,
   so a caregiver can link only a record they are authorised for. Store tokens
   encrypted and remove the name-returning preview step.
2. **Data handling signed off.** LOF plus a privacy reviewer approve the posture
   change; a BAA / zero-retention agreement is in place with the model provider; the
   privacy page and consent copy describe the record link.
3. **Shared cache.** Move the summary cache to Redis.
4. **Clinician verification.** Two or three record-driven scenarios (fever plus
   sudden confusion; a new medication; a fall) go through the clinician workflow and
   are approved.

## 5. OpenMRS vs. OpenEMR

The 24 Sep plan named OpenEMR. The spike used OpenMRS because an instance with a
FHIR R4 module could be stood up on Railway with synthetic patients. CalmGuide only
touches four standard FHIR R4 resources through `openmrs_client.py`, so a second EHR
means a new client for the same interface (auth, base URL, resource-profile
differences), not a redesign. We recommend choosing the production EHR by
where LOF's partner organisations' data actually lives, rather than committing to
either now.
