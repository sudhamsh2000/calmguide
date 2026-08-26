# CalmGuide Domain Catalog

**Version:** 2026-07-26
**Status:** Living document — update whenever a model, schema, or subsystem changes
**Audience:** Team, LOF Gate 1 reviewers, future contributors
**Purpose:** Canonical reference for every domain entity in the system — what it represents, what it holds, how it connects to everything else. Written as source material for the Knowledge Graph and Memory Graph design docs, so entity names and fields here should match those docs exactly.

**Source of truth:** `backend/app/models/` (SQLAlchemy models — 14 tables) cross-checked against `backend/app/schemas/` (Pydantic schemas, used where a column is a JSON/encrypted blob whose structure isn't visible from the model file alone) and `ARCHITECTURE.md`.

**A structural note that applies to every entity below:** none of the 14 SQLAlchemy models declare an ORM `relationship()`. All associations are plain `ForeignKey`-constrained columns, joined manually in service/query code. "Relationships" in this catalog are FK-implied, not ORM-navigable — worth knowing before assuming eager-loading or cascade behavior exists anywhere.

---

## 1. Core Patient/Caregiver Domain

The B2C heart of the system: an anonymous patient profile (no PII), the crisis-coaching conversation log, daily mood logging, and feedback on AI responses.

### Profile
**Table:** `profiles`
Represents one dementia patient's clinical/behavioral profile, identified only by a hashed access code. Deliberately holds no PII — the patient's name lives only in the browser, never sent to the server for storage.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `access_code_hash` | str(64), unique, indexed | SHA-256 hash of the caregiver-facing 8-char access code |
| `disease_stage` | str(20) | `early \| middle \| late \| unknown` |
| `behavioral_patterns` | Text (JSON array of str) | |
| `calming_strategies` | Text (JSON array of str) | |
| `safety_concerns` | Text (JSON array of str) | |
| `previous_stage`, `stage_changed_at` | str(10) / datetime, nullable | tracks disease-stage transitions |
| `created_at`, `updated_at` | datetime | |

**Relationships:** parent (1:N) of `Conversation`, `DailyCheckin`, `Incident`, `CareChangeEvent`, `FacilityPatientLink`, `StaffPatientAssignment`; parent (1:1, unique FK) of `ProfileInsights` and `BehavioralDossier`.

### Conversation
**Table:** `conversations`
One message (user or assistant turn) in a crisis-coaching chat, grouped by `session_id` rather than a stable user identity.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `session_id` | str(36), indexed | groups turns into one chat session |
| `profile_id` | FK → `profiles.id`, indexed | |
| `role` | str(10) | `"user" \| "assistant"` |
| `content` | Text | message text |
| `locale_code` | str(10), nullable | |
| `caregiver_role` | str(20), nullable | `spouse \| adult_child \| paid_aide \| other_family \| other` |
| `is_safety_gate` | bool, default False | flags messages that tripped the multilingual crisis-detection gate |
| `suggested_tags` | Text, nullable (encrypted JSON) | strategy tags suggested for feedback |
| `staff_id`, `facility_id` | FK, nullable | populated when the conversation happens in a facility/B2B context |
| `extra_metadata` | str, nullable | mapped from DB column `metadata` |
| `created_at` | datetime | |

**Relationships:** child of `Profile` (many:1), optional child of `Staff`/`Facility`; parent (1:1, unique FK) of `ResponseFeedback`; optional parent (1:N) of `Incident`.

### DailyCheckin
**Table:** `daily_checkin`
Lightweight daily behavioral log entry (severity + optional tags), independent of a full crisis conversation. Feeds episode-cycle/pattern detection.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `profile_id` | FK → `profiles.id`, indexed | |
| `check_date` | Date | |
| `time_slot` | str(10), nullable | `overnight \| morning \| afternoon \| evening` |
| `severity` | str(10) | `calm \| mild \| tough` |
| `tags` | Text, nullable (encrypted JSON array) | |
| `created_at` | datetime | |

**Relationships:** child of `Profile` (many:1).

### ResponseFeedback
**Table:** `response_feedback`
A caregiver's thumbs-up/down (and why) on a single AI response — drives per-patient learning and cross-patient strategy aggregation.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `conversation_id` | FK → `conversations.id`, unique + indexed | one feedback row per conversation turn |
| `helpful` | bool, nullable | `null` = caregiver skipped feedback |
| `tags` | Text, nullable (encrypted JSON list) | predefined strategy tags, e.g. `music`, `redirection`, `physical_space` |
| `negative_reasons` | Text, nullable (encrypted JSON list) | e.g. `too_generic`, `felt_unsafe` |
| `source` | str(10) | origin of the feedback prompt |
| `created_at` | datetime | |

**Relationships:** child of `Conversation` (1:1 via unique FK). Feeds `CrossPatientStrategies` (nightly aggregation).

---

## 2. Behavioral Memory Layer

The technical differentiator: structured incident capture, derived insights, a pre-computed encrypted dossier injected into every AI prompt, and anonymized cross-patient strategy learning. This is the domain the **Memory Graph design** doc should formalize.

### Incident
**Table:** `incidents`
A structured ABC (Antecedent-Behavior-Consequence) record of one behavioral episode — extracted from a conversation or logged manually/by voice. Raw substrate for pattern detection and the dossier.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `profile_id` | FK → `profiles.id` | |
| `conversation_id` | FK → `conversations.id`, nullable | set when auto-extracted from a chat |
| `source` | str(20) | `manual \| voice` |
| `incident_time`, `time_slot` | datetime / str(10) | |
| `behavior_category` | str(30) | `aggression_anger, confusion_disorientation, wandering_exit_seeking, refusing_care, sleep_problems, hallucinations, repetitive_behavior, other` |
| `behavior_subcategory`, `npi_domain` | str(30), nullable | NPI = Neuropsychiatric Inventory domain |
| `severity` | str(10), nullable | `mild \| moderate \| severe` |
| `duration_category` | str(20), nullable | `seconds \| minutes \| about_an_hour \| longer` |
| `antecedent_description` (encrypted), `antecedent_category` | str, str(20) nullable | `task_demand \| transition \| environmental \| social \| physical_state \| unknown` |
| `behavior_description` | str (encrypted, required) | |
| `intervention_description` (encrypted), `intervention_outcome` | str, str(25) nullable | `resolved \| partially_resolved \| unresolved \| escalated` |
| `location`, `is_recurring`, `caregiver_role` | nullable | |
| `recall_confidence` | str(10), default `"high"` | caregiver's confidence in their own recollection |
| `extraction_confidence` | float, nullable | LLM confidence when auto-extracted |
| `verified_by_caregiver`, `verified_at` | bool / datetime, nullable | human-in-the-loop verification |
| `staff_id`, `facility_id` | FK, nullable | |
| `extra_metadata` (encrypted), `created_at` | | |
| Indexes | `(profile_id, created_at)`, `(profile_id, behavior_category)`, `(severity, created_at)` | |

**Relationships:** child of `Profile` (many:1); optional child of `Conversation`, `Staff`, `Facility`.

### ProfileInsights
**Table:** `profile_insights`
One-row-per-profile cache of derived behavioral analytics, recomputed and upserted (not queried live).

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `profile_id` | FK → `profiles.id`, unique + indexed | one row per profile |
| `computed_at` | datetime | |
| `insights_json` | Text (encrypted JSON) | see `InsightsPayload` shape below |

`insights_json` deserializes to:
```
InsightsPayload {
  crisis_frequency: { this_week, last_week, trend, total_sessions },
  peak_time: str,
  drift_alert: { last_count, this_count } | null,
  resolution_rate: float,
  top_triggers: [str],
  effective_strategies: { tag: count },
  ineffective_reasons: { reason: count },
  episode_cycle: { detected, avg_interval_days, last_episode_date, next_expected_date, confidence } | null,
  care_score: int | null,
  care_level: str | null,
  top_strategies_for_context: [str],
  cross_patient_boost: { cohort, cohort_size, strategies: [...] } | null
}
```

**Relationships:** child of `Profile` (1:1 via unique FK).

### BehavioralDossier
**Table:** `behavioral_dossier`
The pre-computed, encrypted per-patient narrative summary injected into every AI coaching prompt — the centerpiece of the Behavioral Memory Layer. Uses a dirty-flag (`is_stale`) pattern, recomputed when new incidents arrive.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `profile_id` | FK → `profiles.id`, unique (1:1) | |
| `is_stale` | bool, default True, indexed (`idx_dossier_stale`) | set true when new incidents invalidate the cache |
| `version` | int, default 0 | |
| `dossier_text` | str, nullable | free-text narrative injected into prompts |
| `contraindicated_json`, `effective_json` | str, nullable (encrypted JSON → `list[dict]`) | interventions that made things worse / helped |
| `escalation_pattern` | str, nullable | |
| `seven_day_timeline`, `frequency_trends` (→ dict), `medication_correlation` | str, nullable | |
| `caregiver_distress_trend` | str, nullable | |
| `delirium_flags`, `pain_flags` | str, nullable (→ dict) | clinical safety flags for possible delirium/pain masquerading as behavioral symptoms |
| `computed_at`, `created_at` | datetime | |

**Relationships:** child of `Profile` (1:1 via unique FK). All content fields are AES-256-GCM encrypted at rest per the model's docstring.

### CareChangeEvent
**Table:** `care_change_events`
Tracks a medication or care-plan change with an observation window, during which pre-change incidents are excluded from cycle detection/risk scoring — prevents a med change from being misread as a behavior pattern.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `profile_id` | FK → `profiles.id`, indexed with `is_active` | |
| `change_date` | Date | |
| `description` | str (encrypted) | |
| `observation_window_days` | int, default 28 (7–90 range) | |
| `is_active` | bool, default True | |
| `created_at` | datetime | |

**Relationships:** child of `Profile` (many:1).

### CrossPatientStrategies
**Table:** `cross_patient_strategies`
Anonymized, k-anonymized (≥5 profiles per cohort) aggregate of which coping strategies helped which cohort — computed nightly (3am UTC scheduled job) and injected into other caregivers' prompts as "what worked for similar patients."

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `cohort_key` | str(30) | e.g. `"middle:overnight"` (disease_stage + peak_time) |
| `strategy_tag` | str(30) | one of the 12 predefined feedback tags |
| `helped_count`, `total_profiles` | int, default 0 | |
| `computed_at` | datetime | |
| Unique constraint | `(cohort_key, strategy_tag)` | |

**Relationships:** none — deliberately decoupled from `Profile`, a fully anonymized aggregate.

---

## 3. Facility / B2B Domain

Facility management, staff accounts, resident-facility linking, shift assignments, and the compliance audit trail — the B2C→B2B "Trojan horse" bridge.

### Facility
**Table:** `facilities`
A memory-care facility/organization tenant; owns staff accounts and links to resident profiles.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `name` | str(100) | |
| `facility_code_hash` | str(64), unique + indexed | hash of the facility join code |
| `settings` | JSONB, default `{}` | `{ default_language="en-US", timezone="US/Eastern", alert_severe_incident=True, alert_incident_threshold=2, alert_staff_inactive_days=3, alert_family_sessions=False }` |
| `is_active`, `created_at`, `updated_at` | | |

**Relationships:** parent (1:N) of `Staff`, `FacilityPatientLink`, `StaffPatientAssignment`, `AuditLog`; optional parent of `Conversation`/`Incident`.

### Staff
**Table:** `staff`
A facility employee account (CNA, nurse, DON, admin, owner) with PIN or password auth for shared-device/tablet use.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `facility_id` | FK → `facilities.id`, indexed | |
| `name`, `email` | str(100) / str(255) nullable, indexed | |
| `role` | str(20) | `staff \| admin \| owner` |
| `pin_hash`, `password_hash` | str(255), nullable | supports both PIN (shared tablet) and email/password login |
| `language_preference` | str(10), default `"en-US"` | |
| `is_active`, `last_login_at` | | |
| `failed_login_count`, `locked_until` | int / datetime, nullable | brute-force lockout |
| `created_at`, `updated_at` | | |

**Relationships:** child of `Facility` (many:1); parent (1:N) of `StaffPatientAssignment`, `AuditLog` (as `user_id`); optional parent of `Conversation`/`Incident`/`FacilityPatientLink` (as `linked_by`).

### StaffPatientAssignment
**Table:** `staff_patient_assignments`
Which staff member is assigned to which resident, on which shift, with a primary-caregiver flag — the facility-side care-team roster. Association entity.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `staff_id`, `profile_id`, `facility_id` | FK | |
| `shift_pattern` | str(10), nullable | `day \| evening \| night \| all` |
| `is_primary` | bool, default False | |
| `started_at`, `ended_at` | datetime, `ended_at` nullable | null = currently active |
| Unique constraint | `(staff_id, profile_id, ended_at)` | + partial indexes on active assignments |

**Relationships:** child of `Staff`, `Profile`, `Facility` (all many:1) — three-way join entity.

### FacilityPatientLink
**Table:** `facility_patient_links`
Links a resident `Profile` to a `Facility` (bed/room/unit placement) — enables the B2C→B2B data bridge: a home caregiver's behavioral history transfers with the patient into facility care.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `facility_id`, `profile_id` | FK | |
| `linked_by` | FK → `staff.id`, nullable | staff member who performed the linking |
| `unit`, `room`, `bed` | str, nullable | |
| `is_active`, `linked_at` | | |
| Unique constraint | `(facility_id, profile_id)` | + partial index on active links |

**Relationships:** child of `Facility`, `Profile` (many:1 each); optional child of `Staff` (as linker) — association entity.

### AuditLog
**Table:** `audit_logs`
Immutable compliance/security audit trail of staff actions against resources within a facility (HIPAA-style access logging).

| Field | Type | Notes |
|---|---|---|
| `id` | BigInteger (PK, autoincrement) | |
| `timestamp` | datetime | |
| `user_id` | FK → `staff.id`, indexed | |
| `user_name`, `user_role` | str(100) / str(20) | denormalized snapshot of the actor at time of action |
| `action`, `resource_type`, `resource_id` | str(20) / str(30) / str(36) nullable | |
| `outcome` | str(10), default `"SUCCESS"` | |
| `facility_id` | FK → `facilities.id`, indexed | |
| `source_ip`, `user_agent` | nullable | |
| `details` | JSONB, nullable | free-form structured detail per action |

**Relationships:** child of `Staff` and `Facility` (many:1 each).

---

## 4. Safety / RAG Domain

### RAGChunk
**Table:** `rag_chunks` — **flagged: not an SQLAlchemy model.** Defined via raw DDL in `rag/vectorstores/pgvector.py` (outside `backend/app/models/`), documented in `ARCHITECTURE.md`'s Database Schema diagram. See count note below.

A chunk of trusted third-party knowledge (Alzheimer's Association, Mayo Clinic, CDC, etc. — 41 pages from 5 sources) with an embedding vector, retrieved via hybrid semantic + keyword search to ground crisis-coaching responses. This is the domain the **Knowledge Graph design** doc should formalize.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL (PK) | |
| `chunk_id` | TEXT, unique | `md5(source_url || ':' || content)`, dedup key across re-ingests |
| `content` | TEXT, not null | |
| `source_url`, `source_title` | TEXT, not null | |
| `source_name`, `source_domain` | TEXT, nullable | |
| `embedding` | `vector(3072)` (pgvector, `text-embedding-3-large`), not null | |
| `search_vector` | generated `tsvector` column, GIN-indexed | `to_tsvector('english', source_title \|\| ' ' \|\| content)` for keyword search |

**Relationships:** none — standalone knowledge base, deliberately not FK-linked to any patient/facility entity.

### Safety Gate
Not a distinct entity — a flag on `Conversation`. `Conversation.is_safety_gate: bool` marks messages that tripped the multilingual crisis-detection gate (44 patterns across 8 languages). There is no separate `SafetyGateEvent` table; the outcome is recorded inline on the conversation turn it applies to.

---

## 5. Virtual / Computed Entities

Legitimate domain concepts worth cataloging, but **not persisted as their own rows** — computed on demand, or cached inside another entity's JSON blob:

| Entity | Schema | What it is |
|---|---|---|
| **PatternResponse** | `schemas/incident.py` | Live output of the pattern-detection algorithm (`time_clusters`, `frequency_trends`, `effective_interventions`, `contraindicated`, `escalation_pattern`, `confidence_level`). Request-scoped precursor to what eventually gets written into `BehavioralDossier`. |
| **CarePatternResponse / CarePatternReason** | `schemas/prediction.py` | The "Tonight's Outlook Card" risk prediction (`care_level`, `reason`, `top_strategies`, `cross_patient`) — computed at request time from `Incident`/`DailyCheckin`/`CrossPatientStrategies`; a summarized form is cached in `ProfileInsights.insights_json.care_score`/`care_level`. |
| **ImpactResponse** | `schemas/impact.py` | Public, unauthenticated aggregate (`families_supported`, `coached_sessions`, `languages_served`, `overnight_pct`, `sessions_this_week`), computed live via `COUNT(DISTINCT ...)` over `conversations`, 5-minute in-memory cache — never written to a table. |
| **ConversationSummary / ConversationMessage / ConversationListResponse / ConversationMessagesResponse** | `schemas/coach.py` | Projections/groupings of `Conversation` rows by `session_id` — not independent entities. |
| **CrossPatientResponse / CrossPatientStrategyEntry** | `schemas/prediction.py` | Read-side API view over the persisted `CrossPatientStrategies` table — not a new entity. |
| **VerificationPending** | `schemas/incident.py` | Transient prompt (`incident_id`, `summary_text`) shown to confirm an auto-extracted `Incident` — not stored. |
| **InsightsPayload** and sub-shapes (`CrisisFrequency`, `DriftAlert`, `EpisodeCycle`, `CrossPatientBoost`) | `schemas/insights.py` | Not purely virtual — this defines the structure of the real, persisted `ProfileInsights.insights_json` column. A "JSON-column-schema" entity, recomputed nightly. |
| **`CoachRequest.patient_name`** | `schemas/coach.py` | Explicitly commented `# Transient — never stored`. A deliberate privacy design choice: patient name is used to personalize the coaching conversation but is intentionally never persisted anywhere in the backend. |

---

## Table Count Note

`docs/lof-final-proposal.md` states **"Database models: 14 tables."** This matches exactly the 14 SQLAlchemy models exported from `backend/app/models/__init__.py`: `Profile, Conversation, ProfileInsights, ResponseFeedback, DailyCheckin, CrossPatientStrategies, Incident, BehavioralDossier, CareChangeEvent, Facility, Staff, StaffPatientAssignment, FacilityPatientLink, AuditLog`.

If "database models" is read as *total physical tables in Postgres* rather than *tables managed by the FastAPI backend's SQLAlchemy ORM*, the true total is **15** — `rag_chunks` is also a real table, created via raw DDL in `rag/vectorstores/pgvector.py` and managed by a separate ingestion pipeline rather than through `backend/app/models/`. Not an error in the proposal, but worth this footnote so the Knowledge Graph doc and this catalog stay consistent about where `rag_chunks` lives.

---

## Entity Relationship Summary

```
Profile ──1:N── Conversation ──1:1── ResponseFeedback
   │                  │
   │                  └─optional FK→ Incident
   ├──1:N── DailyCheckin
   ├──1:N── Incident
   ├──1:N── CareChangeEvent
   ├──1:1── ProfileInsights
   ├──1:1── BehavioralDossier
   ├──1:N── FacilityPatientLink ──N:1── Facility
   └──1:N── StaffPatientAssignment ──N:1── Staff ──N:1── Facility

CrossPatientStrategies  (no FK — anonymized aggregate, cohort-keyed)
RAGChunk                (no FK — standalone knowledge base, outside backend/app/models/)
AuditLog ──N:1── Staff, ──N:1── Facility
```
