# The New Update: Linking the Moment Coach to the Patient's Health Record (OpenMRS)

Shipped 29 September 2026. It is live in production behind a feature flag and
tested against a fictional patient.

## The problem it solves

A caregiver writes "Dad is suddenly much more confused tonight." In people with
dementia, a sudden change like this is very often **delirium**. Delirium is a
treatable medical problem, frequently caused by a urinary tract infection,
dehydration or a medication reaction. It is not the dementia getting worse.

A general chatbot, and CalmGuide before this update, can only guess from the
words in the message. It does not know that Dad had a fever yesterday or that
he has a history of urinary infections. The patient's health record does know.
Connecting the two turns a generic "if things get worse, call the doctor" into
"call the doctor **today**. He had a fever of 38.1 °C yesterday and has had
urine infections before."

## What OpenMRS is

OpenMRS is a widely used open-source electronic medical record system. It
exposes patient data through **FHIR R4**, the international standard API for
health data. CalmGuide reads four FHIR resource types:

| FHIR resource | What CalmGuide keeps |
|---|---|
| Condition | Active conditions only, up to 8 |
| MedicationRequest | Active medications only, name and frequency, **doses removed**, up to 10 |
| AllergyIntolerance | Allergies, up to 6 |
| Observation | Whitelisted vital signs from the last 14 days, up to 8: temperature, blood pressure, heart rate, oxygen saturation, respiratory rate, blood glucose, weight |

Everything else is ignored, including labs, cognitive scores, names, birth
dates, addresses and identifiers.

## How a caregiver links a record

In the Care Profile, under Connected services → OpenMRS → Connect:

1. The caregiver pastes the patient ID from the record.
2. CalmGuide shows the patient's first name **once**, as a check:
   "Link to Frank?"
3. The caregiver confirms, and the link is stored. It works on web and mobile,
   because the link lives on the server.
4. "Test connection" shows how many conditions, medications, allergies and
   readings were found, and "Disconnect" removes the link.

What is stored: only the patient's internal ID, encrypted with AES-256-GCM,
plus the time of the last sync and its status. No name, no date of birth, no
medical record number. Deleting the Care Profile deletes the link.

## The five design rules

1. **Safety comes first, and the record can never slow it down.** The safety
   gate never reads, calls or waits for OpenMRS. Emergency and high-risk
   messages are answered before the health-record link is even looked up.
   Automated tests run every emergency case in the regression set and fail if
   OpenMRS is touched.
2. **Never wait long for the record.** The record is fetched alongside the
   trusted-guidance search and the database reads, with a total budget of
   1.5 seconds. If it isn't ready in time, the coach answers without it.
3. **Serve from a warm cache.** OpenMRS is slow: one vital-signs search takes
   about 9 seconds on the test server. So each profile's summary is cached
   using a stale-while-revalidate pattern:
   - younger than 5 minutes: used as is;
   - older, up to 24 hours: used immediately while a background refresh runs;
   - if a fresh fetch runs past the 1.5-second budget, it keeps going for up
     to 30 seconds in the background and fills the cache for the next message.

   The cache is warmed when a record is linked, when "Test connection" is
   pressed, and when the server starts, so replies normally use the record
   without waiting at all.
4. **Summarise, never dump.** The AI never sees raw medical records. It sees a
   short, capped summary, with doses stripped out and one narrow
   plain-language alert (a recent fever of 37.8 °C or higher within the last
   3 days).
5. **The record informs escalation. It never produces medical advice.**
   - The prompt tells the AI: this is background; don't recite it; never
     diagnose from readings; never suggest starting, stopping, skipping,
     changing or timing a medication; never mention a dose.
   - A new post-reply check scans every sentence. If a sentence names one of
     the patient's medications together with dosing language, the reply is
     sent back for repair. "Don't stop his donepezil without asking his
     doctor" passes. "Give him an extra 5 mg of donepezil" fails.

## Where the record shows up in the answer

Only in "When To Call For Help". When the caregiver describes a new or sudden
change and a record fact could explain it, the first bullet must be
"Call [name]'s doctor today", followed by the specific finding in plain words.

We learned during development that the AI followed this rule reliably only
when the rule was placed next to the section it controls and repeated as a
last check at the very end of the prompt. A single mention in the middle of a
long prompt was often ignored. This is one of the commits of the update:
"Put the clinical-record referral rule where the model follows it."

## The demo patient: Frank Kowalski (fictional)

- Middle-stage Alzheimer's, Korean War veteran, PTSD, hypertension, enlarged
  prostate, recurrent urinary tract infections, type 2 diabetes, knee
  arthritis, and hearing loss.
- Resolved conditions (an old bladder infection, pneumonia) and discontinued
  medications are present on purpose, to prove the filters keep them out.
- Allergies: penicillin, codeine, sulfa.
- 14 days of vital signs with a **fever spike yesterday**. This drives the
  demo moment: "sudden confusion → call the doctor today, he had a fever
  yesterday and has had UTIs before."
- The record is created by a re-runnable script
  (`backend/scripts/seed_openmrs_frank.py`) that dates the vitals relative to
  today, so the demo works on any day.

## Privacy and security posture

- OpenMRS is reached over Railway's **private network**, using a dedicated
  **read-only** OpenMRS account and never an admin account.
- Response bodies from OpenMRS are never logged.
- The feature is **off by default** (`OPENMRS_ENABLED`). With it off, or with no
  record linked, the coach behaves exactly as it did before.
- All four linking endpoints return "feature disabled" when the flag is off.

## Known limits (be honest about these in the video)

- The cache lives in the memory of one server. If the backend runs on more than
  one machine, it should move to Redis.
- Only one clinical alert type exists today (recent fever). Others, such as
  low oxygen or high blood sugar, would need clinical input first.
- It is tested against a demo OpenMRS instance with fictional data, not a real
  hospital system.
- Clinical verification of the behaviour is planned through the Leap of Faith
  (LOF) clinician-verification process. It has not been done yet.
