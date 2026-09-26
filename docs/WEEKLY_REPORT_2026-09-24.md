# CalmGuide — Weekly Report

**Reporting period:** 2026-09-18 → 2026-09-24
**Prepared for:** Leap of Faith (LOF) weekly deliverable
**Repository state:** `main` @ `b277688`

---

## 1. Summary

This week's work fell into three areas: a full visual redesign of the web
and mobile applications, a set of functional defect fixes in the caregiver
dashboard, and the discovery and repair of a deployment failure that had
been silently blocking releases for twelve days.

Nine commits landed, touching 125 files (+3,515 / −801 lines) across the
web frontend, mobile app, backend and project documentation. A new Android
build was produced and is available for testing.

The most consequential item is not a feature. The live web application had
not received a successful deployment since 2026-09-08. This was found,
diagnosed and fixed this week, and is documented in §4.

---

## 2. What Shipped

### 2.1 Visual design system

A new design direction was applied across the web application and carried
into the mobile theme: a near-black ink, sky-blue and coral palette over
pale atmospheric gradients, with translucent "glass" panels on primary
content surfaces.

Two deliberate constraints were built in:

- The glass treatment is applied to two large content panels only, not
  uniformly. A heavy backdrop blur on a small control costs the same
  rendering work while reducing legibility.
- The material degrades to solid surfaces when the operating system
  reports a reduced-transparency preference, and when the browser does not
  support backdrop filtering. Reduced transparency is a genuine
  accessibility setting among older users, who are a substantial part of
  the caregiver population.

### 2.2 Dashboard restructure

- Two-column desktop layout with a persistent left rail carrying the care
  profile and the two primary actions.
- Moment Coach presented as the single dark surface and the only animated
  element on the screen, so attention lands there first.
- A weekly progress chart driven by real check-in data.

### 2.3 Profile portraits

Caregivers may now choose an illustrated portrait for the person they care
for, selected during signup alongside the name.

This is an explicit choice, not an inference. The backend stores no name
and no gender by design, so nothing server-side could determine a portrait,
and deriving one from a name would misgender people. A lettered monogram
remains a first-class third option rather than a fallback.

---

## 3. Defects Fixed

### 3.1 Weekly progress chart could never display a trend

The chart was built against an endpoint that filters to a single calendar
date, so it was structurally incapable of plotting more than one point. A
read-only history endpoint was added to the backend.

A second defect in the same feature: dates returned as `YYYY-MM-DD` were
parsed as UTC midnight and then read in local time, shifting every entry
one day earlier in any timezone west of UTC and dropping the current day
off the chart entirely. Both are fixed and covered by tests that run under
four timezones.

### 3.2 Sign-out did not sign out

Signing out cleared the session keys but left the stored profile list
behind. The application then treated that surviving profile as a session to
resume, rebuilt the credentials from it, and returned the user to the
dashboard. Sign-out now clears the full session.

### 3.3 Confirmation dialog rendered behind page content

The sign-out confirmation appeared with its heading obscured and dashboard
panels painted over it. The dialog relied on escaping to the root stacking
context; a layout change introduced earlier in the week created an
intervening stacking context that trapped it. The dialog is now rendered
through a portal, which makes it independent of the surrounding layout.

---

## 4. Deployment Incident

**Impact:** the production web application served a twelve-day-old build
while the codebase continued to advance. Any review of the live site during
that period was not looking at current work.

**Cause:** the hosting provider refuses a deployment when the GitHub
account that authored the commit does not hold a seat on the project team.
The build is skipped entirely — no compilation is attempted and no build
log is produced. This began when the hosting plan changed on 2026-09-07.

**Why it went unnoticed:** the failure is silent by design. The dashboard
reports a generic failure with no log, the previous build continues to
serve normally, and nothing distinguishes a stale site from a healthy one.

**Resolution:** commit authorship was corrected to an account holding a
seat. Verified on both production and preview deployments, which now build
and publish normally. The failure mode and its fix are documented in the
repository README so it cannot recur unrecognised.

---

## 5. Guidance Quality Review

A CalmGuide response was compared against a general-purpose assistant's
answer to the same caregiving scenario — a person with middle-stage
dementia repeatedly asking the same question.

Three defects were traced to specific instructions in our own prompt:

1. The response scripted the phrase "let me explain", which our own
   guidance lists as a mistake to avoid during a crisis. The prohibition
   had been written as advice about the caregiver's instincts, so it never
   constrained the assistant's own suggested wording.
2. The response never answered the caregiver's question — it deflected and
   redirected. For repeated questioning, the answer itself carries most of
   the reassurance.
3. The response never suggested checking for an unmet physical need.
   Repetitive questioning is a common proxy for toilet, thirst, hunger,
   pain, temperature or fatigue, and a person in middle-stage dementia may
   no longer be able to name discomfort directly.

All three were addressed and confirmed against live model generations
rather than by inspection of the prompt alone. One behaviour — the unmet
needs check — currently appears in approximately half of generations and is
being made deterministic.

An earlier attempt to mandate emergency red-flag signs in every response
was tried and withdrawn: the model did not follow the instruction at two
prompt positions, and the application already presents emergency contacts
persistently on screen, so inlining them on routine questions adds alarm
without adding reach.

---

## 6. Testing

| Suite | Result |
| --- | --- |
| Backend (pytest) | 1,837 passed |
| Web frontend (vitest) | 276 passed, 1 skipped |
| Mobile (jest) | 28 passed |
| Type checking | Clean across web and mobile |
| Production build | Passes |

A prompt cost-budget test correctly failed during this week's prompt work
and forced a deliberate decision on token growth rather than allowing it to
drift. The budget was raised from 5,000 to 5,150 tokens per request
(measured 4,913 → 5,082, +3.4%) with the reasoning recorded in the test.

---

## 7. Known Limitations and Open Items

- The coach prompt changes are verified locally but **not yet verified
  against the production environment**.
- The unmet-needs check in guidance responses is non-deterministic and
  applies inconsistently.
- **Mobile received the palette and icons only.** The portraits, progress
  chart, sign-out fix and dialog fix are web-only; the mobile application
  has a separate storage layer and screen set, and none of this work was
  ported.
- Access-code documentation does not distinguish local from production
  credentials, which caused avoidable confusion this week.

---

## 8. Planned — Remainder of Sprint

**OpenEMR integration for the patient profile (feasibility spike).**
An optional enrichment layer: a caregiver creates a CalmGuide profile as
today, and may then connect an existing OpenEMR record. CalmGuide retains
orchestration — the external record is a data source, not something that
addresses the model directly. Patient clinical context is kept separate
from the dementia-care knowledge base, safety routing is unchanged, and the
service layer is provider-agnostic with OpenEMR as the first
implementation. Initial scope: Patient, Condition, AllergyIntolerance,
Medication, Observation, Encounter. Authorization via OAuth with tokens
encrypted at rest.

This is time-boxed with a go/no-go recommendation at sprint end. Two items
require LOF and clinical input before it becomes a committed feature: the
available FHIR surface varies by OpenEMR deployment and version, and the
profile model currently holds clinical data and no personally identifying
information, so connecting a medical record changes the project's
data-handling posture.

**Psychology assessment form.** Shared with Chaitanya Chennupati
(M.Sc. Neuropsychology, Christ University, Bangalore) for review, with
backend integration to follow so assessment data can inform the care
profile and guidance.

---

## 9. Deliverables

| Item | Status |
| --- | --- |
| Weekly report | This document |
| Repository archive | Provided (source and documentation, credentials excluded) |
| Video demonstration | To follow |
