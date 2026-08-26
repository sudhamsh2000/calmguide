# CalmGuide Product Requirements Document (PRD)

**Version:** 2026-07-26
**Status:** Living document — Gate 1 deliverable
**Audience:** Team, LOF Gate 1 reviewers

**Scope of this document:** CalmGuide's B2C product is already specified in exhaustive detail in [`docs/product-guide.md`](./product-guide.md) — personas, the seven-phase caregiver journey, every screen's full user flow, safety architecture, i18n, privacy, accessibility, business model, roadmap, and success metrics. This PRD does not repeat that content. Its job is the four things `product-guide.md` doesn't already do:

1. State goals/non-goals as a formal requirement, not narrative
2. Specify the **B2B/Facility platform** — fully built (8 API routers, 5 dedicated tables) but never documented as a product spec anywhere in the repo
3. Provide requirement-to-artifact traceability across all the Gate 1 docs
4. Consolidate open questions/risks that block Gate 1 sign-off

---

## 1. Goals

| Goal | Source |
|---|---|
| Give an untrained family caregiver structured, safe, real-time guidance for a specific behavioral moment — replacing "generic web article or a hold queue" | `product-guide.md` Positioning Statement |
| Serve bilingual/immigrant caregivers, the largest unserved segment (11 languages vs. competitors' 1–2) | `docs/lof-final-proposal.md` Slide 2 |
| Get smarter about one specific patient over time without ever storing identifying information | [`docs/memory-graph-design.md`](./memory-graph-design.md) §1 |
| Bridge B2C and B2B: a family caregiver's behavioral history transfers with the patient into facility care (the "Trojan horse" into B2B) | `docs/lof-final-proposal.md` Slide 8; §3 below |
| Validate all of the above with real caregivers and one real facility pilot before scaling | `docs/lof-final-proposal.md` Slide 9 (Phases 1–3) |

## 2. Non-Goals

Restated from `product-guide.md` §4 ("What CalmGuide Never Does") as a formal requirement, since Gate 1 reviewers will look for explicit scope boundaries:

- **Not a diagnostic tool.** Never identifies a cognitive/behavioral condition, never screens.
- **Not a medication authority.** Never recommends or adjusts medications.
- **Not a restraint advisor.** Never suggests physical restraint or forced compliance.
- **Not an emergency service.** Never contradicts or substitutes for calling 911; the deterministic safety gate and Emergency Bar exist specifically so the AI is never the last line of defense in a life-threatening moment.
- **Not for four of the seven caregiver-journey phases** (Noticing, Diagnosis Shock, Hospice, Bereavement) — these get honest static deflection to human/nonprofit resources, not an AI response (`product-guide.md` §2–3).
- **Not for patients, clinicians, emergency responders, or researchers** as primary users (`product-guide.md` §1, "Who CalmGuide Is NOT For").

---

## 3. B2B / Facility Platform — Requirements

Per the LOF proposal (Slide 8), the facility platform exists to close the loop: when a family caregiver's patient transitions into a memory care facility, the behavioral knowledge accumulated in the Memory Graph should transfer with them, and facility staff should get day-one access instead of losing that knowledge to CNA turnover (55–100% annually, per the proposal). This section specifies what's actually built, since `product-guide.md` is B2C-only and this is otherwise undocumented outside the API code.

**Personas:**
- **CNA / floor staff** (`Staff.role = "staff"`) — shared-tablet PIN login, sees only their own assigned residents
- **DON / facility admin** (`Staff.role = "admin"`) — email/password login, sees the full facility roster and dashboard
- **Owner** (`Staff.role = "owner"`) — same access as admin plus facility settings/configuration

### FAC-1 — Facility Onboarding
**Router:** `facility.py` | **Entities:** `Facility` (domain catalog §3)
Create a facility (generates a hashed join code analogous to the B2C access code), verify a facility code, view/update facility settings (`default_language`, timezone, alert thresholds — see domain catalog's `FacilitySettings` shape).
**Acceptance criteria:** a facility can be created and its code verified without any facility-identifying data leaving the hash; settings changes take effect without redeploy.

### FAC-2 — Resident Linking (the B2C→B2B Bridge)
**Router:** `facility.py` (`link_patient`, `create_resident`, `list_patients`) | **Entities:** `FacilityPatientLink`
Links an existing `Profile` (a family caregiver's patient) to a facility with unit/room/bed placement, or creates a new resident profile directly within the facility flow.
**Acceptance criteria:** linking a profile makes its full `BehavioralDossier` and incident history immediately visible to assigned staff (see FAC-5) — this is the literal implementation of the proposal's "2 years of behavioral data transfers with the patient" claim, and is worth demonstrating explicitly in the Gate 1 progress video since it's the platform's core differentiator, not just a data-migration detail.

### FAC-3 — Staff Authentication
**Router:** `facility_auth.py` | **Entities:** `Staff`
Two login paths: PIN login for shared-device/floor use (`pin_login`), email/password for admin/owner (`email_login`), plus token refresh and logout. Brute-force protection: 5 failed attempts → 30-minute lockout (`LOCKOUT_MINUTES=30`, `MAX_FAILED_ATTEMPTS=5`), enforced server-side regardless of client.
**Acceptance criteria:** a locked-out account cannot be unlocked by retrying, only by lockout expiry; every login/failed-login is written to `AuditLog` (see FAC-8) — confirmed in code (`log_audit` called on both success and failure paths).
**Gap:** the proposal (Slide 9, Phase 3) calls for "PIN-based auth stress testing (shared device, 60-second timeout, session isolation)" — a session-timeout requirement distinct from the lockout above. No 60-second idle-session timeout was found in `facility_auth.py`; if this is a hard requirement for the facility pilot, it needs to be either implemented or the proposal's language walked back to match what's built.

### FAC-4 — Staff & Assignment Management
**Router:** `facility_staff.py` | **Entities:** `Staff`, `StaffPatientAssignment`
Create/list/update/deactivate staff; create/list/remove shift-based resident assignments (`shift_pattern`: day/evening/night/all, `is_primary` flag).
**Acceptance criteria:** deactivating a staff member does not delete their historical `Conversation`/`Incident`/`AuditLog` rows (those FKs are nullable-safe, per domain catalog); an ended assignment (`ended_at` set) no longer appears in that staff member's `/my-residents` view (FAC-5).

### FAC-5 — Resident Behavioral Card
**Router:** `facility_residents.py` (`get_my_residents`, `get_behavioral_card`) | **Entities:** `BehavioralDossier`, `Incident`
The CNA-facing view: for `staff` role, residents scoped to active assignments; for `admin`/`owner`, all actively-linked residents facility-wide. Returns each resident's dossier freshness, 7-day incident count, and most recent incident (category + outcome) via a single set of bulk queries (explicitly optimized in code from a prior N+1-per-resident pattern, per the code's own comment — worth citing as evidence of engineering maturity if Gate 1 asks about scalability).
**Acceptance criteria:** the "What Works" / "What NOT to Do" content per resident (per the proposal's Slide 8 feature list) is sourced directly from `BehavioralDossier.effective_json`/`contraindicated_json` — i.e., this is not a separate facility-specific feature, it's the same Memory Graph output reused across B2C and B2B, which is the intended architecture.

### FAC-6 — Executive/DON Dashboard
**Router:** `facility_dashboard.py`, `facility_executive.py` | **Entities:** aggregates over `Incident`, `Staff`, `Conversation`
Incident counts (total/severe/mild) and staff adoption percentage over a configurable window (1–168 hours), trends, and staff-activity views; role-gated to `admin`/`owner` only.
**Gap — flag for Gate 1:** `dashboard_summary`'s response includes `"escalating_residents": []` and `"prn_medications": 0` as **hardcoded stub values**, not computed from data — confirmed by reading `facility_dashboard.py` directly (these are literal constants in the return statement, not query results). If a facility administrator is shown this dashboard during the Phase 3 pilot, these two fields will always read as empty/zero regardless of actual conditions. This needs to be either implemented before the pilot or the fields removed from the API contract so they don't silently under-report risk to a DON relying on the dashboard.

### FAC-7 — PDF Reporting
**Router:** `facility_report.py` (`export_pdf`)
Generates a PDF report — per the proposal, intended for QAPI (Quality Assurance and Performance Improvement) meetings, a real nursing-home regulatory/compliance ritual.
**Acceptance criteria:** exported PDF content should be traceable to the same dashboard aggregates in FAC-6 — meaning the stub-field gap above would also silently propagate into any QAPI report generated today.

### FAC-8 — Audit Logging
**Router:** `facility_audit.py` (`get_audit_logs`) | **Entities:** `AuditLog`
Read endpoint over the immutable audit trail (domain catalog §3) — every staff action, actor snapshot, outcome, and (per the model) source IP/user agent.
**Acceptance criteria:** this is the concrete implementation of the proposal's "HIPAA-ready: every access logged with staff ID + timestamp" claim — worth pointing Gate 1 reviewers here directly if they ask for compliance evidence, since it's real and already wired into both auth (FAC-3) and dashboard reads (`log_audit` calls confirmed in both routers).

---

## 4. Requirement Traceability

| Area | Specified in | Built (routers/tables) | Status |
|---|---|---|---|
| B2C core features (Moment Coach, Practice, Check-In, Home, Profile, Impact, Emergency Bar, Journey deflection) | `product-guide.md` §3 | `coach.py`, `learn.py`, `checkin.py`, `checkin_daily.py`, `profile.py`, `impact.py` | Shipped |
| Behavioral Memory Layer | `memory-graph-design.md` | `Incident`, `ProfileInsights`, `BehavioralDossier`, `CareChangeEvent`, `CrossPatientStrategies` | Shipped (gaps noted in that doc §9) |
| Knowledge/RAG corpus | `knowledge-graph-design.md` | `rag/` pipeline, `rag_chunks` | Shipped (gaps noted in that doc §6) |
| B2B Facility platform | This doc §3 | `facility*.py` (8 routers), `Facility`/`Staff`/`StaffPatientAssignment`/`FacilityPatientLink`/`AuditLog` | Shipped, with two flagged gaps (§3 FAC-3, FAC-6) |
| Safety architecture | `product-guide.md` §4 | deterministic keyword gate + `crisis_system.jinja2` rules | Shipped |
| Multilingual (11 languages) | `product-guide.md` §5 | i18n build, RTL for Arabic | Shipped |
| Privacy/no-PII architecture | `product-guide.md` §6, `domain-catalog.md` | encrypted columns, access-code hashing | Shipped |
| Accessibility | `product-guide.md` §7 | — | In progress — P0/P1 gaps listed there (Emergency Bar touch targets, Medical Disclaimer translation) |
| Legal/compliance (ToS, liability insurance, SB 243) | `product-guide.md` §9 | — | Not started — explicit prerequisite for paid launch |
| Domain entity model | `domain-catalog.md` | all 15 persisted tables | Documented this session |

## 5. Success Metrics

B2C metrics are fully specified in `product-guide.md` Appendix B (session resumption, safety-gate deflection tracking, feedback thumbs-up rate, multi-mode usage, non-English session share, paid conversion, trust score, NPS) — not repeated here.

**B2B-specific metrics, from the LOF proposal's Phase 3 exit criteria** (not present in `product-guide.md`, since that doc predates/excludes the facility platform):

| Metric | Target | Source |
|---|---|---|
| Facility actively using CalmGuide | 1 facility, 30+ day pilot | `lof-final-proposal.md` Slide 9, Phase 3 |
| Staff members actively using the platform | ≥3 per pilot facility | Same |
| DON dashboard access | Validated with 1 real facility administrator | Same — blocked on the FAC-6 stub-field gap above being resolved first |
| CNA behavioral-card workflow observation | ≥2 CNAs observed using the shared-tablet flow | Same |

## 6. Open Questions / Risks for Gate 1

Consolidated from this doc and the two design docs it depends on:

- **Caregiver validation is the stated blocker** (per the team's own Gate 1 status update): 5–10 structured interviews are a prerequisite the team has flagged as needed before any roadmap expansion, and as the item LOF's help is most wanted on (introductions to caregivers/caregiver orgs).
- **Facility identification is not yet done** — Phase 3 (Slide 9) requires identifying 3+ candidate Chicago-area facilities; nothing in the repo indicates this has started.
- **FAC-6 dashboard stub fields** (`escalating_residents`, `prn_medications`) must be resolved before a real DON is shown this dashboard, or the pilot risks demonstrating a broken/misleading feature.
- **FAC-3's 60-second session-timeout requirement** (stated in the proposal) doesn't appear to be implemented — confirm whether this is still required for the pilot or update the proposal's language.
- **Legal/compliance track hasn't started** (healthcare lawyer review, ToS/Privacy Policy, age gate, liability insurance, SB 243 prep) — `product-guide.md` §9 marks this as a hard prerequisite for any paid launch, which is on the same 12-week timeline as the facility pilot.
- **RAG/Knowledge Graph config inconsistencies** (embedding model/dimension, chunk_id scheme, stale README example) — see `knowledge-graph-design.md` §6. Low urgency but should be resolved before the Knowledge Graph doc is presented as final.
- **Memory Graph invalidation inconsistency** (`ProfileInsights` has no dirty-flag where `BehavioralDossier` does) — see `memory-graph-design.md` §9. Worth a decision either way, not necessarily a fix.
