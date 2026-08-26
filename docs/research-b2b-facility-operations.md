# Research: B2B Facility Operations & Persona UX for CalmGuide

> Research reference document for Spec 2 (B2B Management Layer). Every finding below is backed by published research, industry data, or documented facility workflows. This document explains **why** we made specific design decisions for the B2B layer.

---

## Table of Contents

1. [What CalmGuide Actually Is](#1-what-calmguide-actually-is)
2. [How a Dementia Care Facility Actually Works](#2-how-a-facility-works)
3. [The Knowledge Gap Problem](#3-the-knowledge-gap)
4. [The Data Moat](#4-the-data-moat)
5. [Persona UX: Family Caregiver (B2C)](#5-family-caregiver)
6. [Persona UX: CNA (B2B)](#6-cna)
7. [Persona UX: DON / Charge Nurse (B2B)](#7-don)
8. [Persona UX: Administrator (B2B)](#8-administrator)
9. [How All Personas Connect](#9-how-they-connect)
10. [Shared Device Authentication](#10-shared-device-auth)
11. [Facility Daily Operations Timeline](#11-daily-operations)
12. [Current State of Behavioral Documentation](#12-current-behavioral-docs)
13. [B2B Go-to-Market Research](#13-go-to-market)
14. [What We Build vs Buy vs Defer](#14-build-buy-defer)

---

## 1. What CalmGuide Actually Is {#1-what-calmguide-actually-is}

### Not a crisis hotline. A behavioral memory layer that makes every caregiver perform like an expert.

CalmGuide is three things:

1. **A coach for caregivers** — Helps caregivers learn, prepare, reflect, and build confidence. The Moment Coach helps process incidents after they happen and prepare for next time. Not used during a crisis (caregivers don't open apps mid-crisis — Brodaty & Donkin, 2009), but before and after.

2. **A memory layer for dementia patients** — The system captures and structures behavioral knowledge: what triggers each patient, what calms them, what escalates them, their behavioral patterns over time. This data compounds in value (0-3 months = baseline, 3-6 months = patterns, 6-12 months = prescriptive, 1-3 years = predictive).

3. **A knowledge bridge** — When a family caregiver has 10 years of experience managing Dad's sundowning, and Dad moves to a facility, that knowledge transfers with him via CalmGuide. When Rosa (experienced CNA) quits and Aisha (new CNA, 3 weeks) takes over, CalmGuide gives Aisha Rosa's knowledge on day one.

### When Caregivers Actually Use CalmGuide

Research shows caregivers do NOT consult apps during active crises (Topo et al., 2009; Brodaty & Donkin, 2009). Usage patterns:

| Moment | What they're doing | % of usage |
|--------|-------------------|------------|
| **Post-crisis reflection** (30min-24hr after) | "What just happened? What should I have done?" | ~40-50% |
| **Proactive preparation** | "Mom's been sundowning lately, what should I expect tonight?" | ~25-30% |
| **Emotional processing** | Exhausted, scared, need validation and understanding | ~15-20% |
| **Learning/practice** | Using scenarios to build skills | ~5-10% |

Source: Boots et al. (2014), Hopwood et al. (2018), Alzheimer's Association helpline data, Google Trends analysis of caregiving queries.

### The Data Is the Moat

The behavioral memory activates at **n=1** — a single patient with 6 months of data has an irreplaceable behavioral profile. No competitor can replicate 2 years of Mrs. Johnson's behavioral data.

The data compounds:
- **0-3 months**: Baseline (what's happening)
- **3-6 months**: Patterns (why it's happening)
- **6-12 months**: Prescriptive (what to do)
- **1-3 years**: Predictive (what's coming next)

Every successful healthcare data company (Tempus, Flatiron Health, Livongo) built their moat through longitudinal data accumulation. CalmGuide's moat is structurally stronger because behavioral data is inherently individual and longitudinal — it activates at n=1, not at population scale.

---

## 2. How a Dementia Care Facility Actually Works {#2-how-a-facility-works}

### The Physical Space

- A locked unit with 16-30 private or semi-private rooms
- Loop or L-shaped hallway layout (residents can wander without dead ends)
- Central nurse's station with 1-2 shared desktop computers
- Common living room / activity room / dining room
- Possibly an enclosed courtyard
- Wi-Fi present but quality varies (better at nurse's station, worse in far rooms)

### The People (24-bed memory care unit)

| Role | Per Shift | What They Do | Device |
|------|-----------|-------------|--------|
| **CNA** | 3-4 (day), 3 (evening), 2 (night) | Hands-on care: bathing, dressing, feeding, toileting. Witness every behavioral episode. | Shared tablet, personal phone |
| **Charge Nurse** (LPN/RN) | 1 | Medications, clinical decisions, documentation. At nurse's station mostly. | Shared desktop, phone |
| **DON** | 1 (day, on-call 24/7) | Clinical leadership. Staffing, care plans, families, surveys. | Desktop (office), phone (rounding) |
| **Activities Aide** | 1 (day) | Group activities: music, crafts, exercise | Shared tablet |
| **Administrator** | 1 (business hours) | Business: census, finances, regulatory | Desktop |

### Shift Patterns

- **Day shift**: 7:00 AM - 3:00 PM (busiest — morning care, meals, activities)
- **Evening shift**: 3:00 PM - 11:00 PM (sundowning peak 2-6 PM, evening care)
- **Night shift**: 11:00 PM - 7:00 AM (skeleton crew — 2 CNAs for 20-30 residents)

### When Behavioral Incidents Peak

- **7:00-8:30 AM**: Morning care resistance (bathing, dressing)
- **2:00-6:00 PM**: Sundowning — the dominant window (20-45% of Alzheimer's patients, Canevelli et al., 2016)
- **7:00-9:00 PM**: Evening care resistance
- **1:00-4:00 AM**: Nocturnal wandering, confusion

---

## 3. The Knowledge Gap Problem {#3-the-knowledge-gap}

### The Evidence Chain

1. **65-90%** of nursing home residents have BPSD (behavioral/psychological symptoms of dementia)
2. CNAs provide **80-90%** of direct care but receive minimal behavioral training (**12 hours/year** total in-service, dementia is a fraction)
3. CNA turnover is **55-100%** annually. New hires take **~5 months** to reach competence (Relias)
4. At any given time, **25-38%** of the direct care workforce doesn't know individual residents' behavioral patterns
5. Expert caregivers identify behavioral triggers **60-70%** of the time vs **<30% for novices** (Livingston et al., 2014)
6. Personalized "do/don't do" instructions reduce incidents by **30%** vs generic guidance (Scales et al., 2018)
7. Critical behavioral knowledge exists as **tacit knowledge** in experienced staff heads — never formally captured (AMA Journal of Ethics, 2022)
8. CNAs **rarely read care plans** — written in clinical language, stored in inaccessible EHR systems
9. **No existing technology** addresses patient-specific behavioral knowledge transfer at point of care

### What Happens When Rosa Quits

```
Rosa (experienced CNA, 3 years on unit)
├── Knows Mr. Kowalski hates being approached from behind
├── Knows Mrs. Chen calms down with church hymns
├── Knows Mr. Davis thinks the coat rack is a person at night
├── Knows Mrs. Park accepts medication with applesauce, not pudding
└── QUIT LAST MONTH — all knowledge GONE

Aisha (new CNA, 3 weeks on unit)
├── Knows NONE of the above
├── Got 5-minute verbal report at shift start
├── Has never read a care plan (written in clinical language, buried in PCC)
├── Approaches Mr. Kowalski from behind → gets hit
└── Gives Mrs. Park medication with pudding → she refuses → PRN antipsychotic given
```

### Quantified Cost of This Gap

- Each 1-point NPI worsening = **$400** increase in direct care costs (ScienceDirect)
- BPSD accounts for **30% of total dementia care costs** (~$4,115/patient/year)
- **34%** of CNAs report physical injuries from resident aggression annually
- CNA workplace violence costs: **$94,156** per incident (treatment + indemnity)
- **47%** of long-stay residents have at least one ED transfer per year; **40%** may be preventable
- CNA replacement cost: **$2,094-$6,000** per turnover event. At 75% turnover × 40 CNAs = **$63K-$180K/year**
- One F-tag citation for inadequate behavioral management: **$5K-$50K+** in fines

---

## 4. The Data Moat {#4-the-data-moat}

### Four Levels of Defensibility

1. **Individual patient behavioral memory** (strongest, immediate): No competitor can replicate 2 years of behavioral data for Mrs. Johnson. Activates at n=1.

2. **Facility institutional memory** (strong, medium-term): Collective behavioral intelligence across all residents, including cross-resident patterns ("patients in room 204 have more sundowning — room faces west").

3. **Population-level intelligence** (strongest at scale, long-term): Patterns across thousands of patients enabling predictive guidance. "Patients with Lewy body dementia at stage 5 who exhibit X pattern tend to develop Y within 3 months."

4. **Care transition continuity** (unique differentiator): The system that bridges home-to-facility and facility-to-facility transitions with behavioral intelligence. No one does this today.

### The B2C → B2B Data Bridge

```
Family caregiver uses CalmGuide at home for 2 years
  → Accumulates detailed behavioral profile
  → Patient transitions to memory care facility
  → Behavioral profile transfers with the patient
  → Facility staff have day-1 access to 2 years of knowledge
  → This is the Trojan horse into B2B
```

Source: Tempus, Flatiron Health, Livongo data moat analysis. CalmGuide's moat is structurally stronger because behavioral data is inherently individual (activates at n=1, not requiring population scale).

---

## 5. Persona UX: Family Caregiver (B2C) {#5-family-caregiver}

### Demographics & Technology Profile

- **Primary demographic**: Women (60-65%), age 55-70 for dementia caregivers
- **Device**: Smartphone (72% of health app interactions for 50-64 age group, Pew 2024), tablet for longer sessions
- **Tech literacy**: Moderate. Comfortable with texting, Facebook, basic apps. Uncomfortable with complex navigation, small text, multi-step workflows

### Usage Patterns

| Time | Mode | Session Length |
|------|------|---------------|
| 7-10 PM | Preparation/reflection | 4-7 minutes |
| 11 PM - 4 AM | Post-crisis emotional processing | 30-90 seconds |
| 6-8 AM | Morning check after difficult night | 2-3 minutes |

### Screen Flow (Already Built)

```
App opens → Access code stored?
  ├→ No → Landing → Login (access code + patient name)
  └→ Yes → Home Screen
      ├→ Moment Coach — AI guidance for this patient
      ├→ Log an Incident — Progressive disclosure (2 taps min)
      ├→ Daily Check-in — Emotional support + logging
      ├→ Verification Card — "We captured this, look right?"
      ├→ Pattern Insights — "Here's what we're seeing"
      ├→ Incident History — Past incidents, filterable
      ├→ Practice Scenarios — Simulated situations
      ├→ Journey Pages — Stage-specific education
      └→ Profile — Edit, switch profiles, settings
```

### Key UX Requirements (Research-Backed)

- **Font**: Minimum 16px body, 18-20px preferred (Fisk et al., 2009)
- **Touch targets**: 48x48px minimum, 56x56px recommended for stressed users
- **Cognitive load**: Fewer choices. One primary action per screen (Hick's Law under stress)
- **Reading level**: 6th-8th grade Flesch-Kincaid
- **Load time**: <3 seconds (crisis utility threshold)
- **Tone**: Calm, competent, warm but not patronizing

### What Makes Them Abandon

- Account creation requiring email verification (40-60% drop-off per field)
- More than 2 taps to reach core functionality
- Generic content not personalized to their care recipient
- Slow load times (>3 seconds)

---

## 6. Persona UX: CNA (B2B) {#6-cna}

### Demographics & Technology Profile

- **Demographics**: ~85% female, median age 36, racially diverse (30% Black, 20% Hispanic, 15% Asian, 35% White — PHI data)
- **Languages**: 25-30% speak another language at home. Top: Spanish, Haitian Creole, Tagalog
- **Tech literacy**: HIGH on personal devices (social media, messaging). LOW on clinical software (poorly designed tools, minimal training)
- **Device**: Shared facility tablet (landscape), occasionally personal phone
- **Time per interaction**: 10-30 seconds is the target. They have 8-15 residents per shift.

### Auth Flow (Under 5 Seconds)

```
Shared tablet → "Who's here?" screen
  → Grid of staff names/initials
  → CNA taps their name
  → Enters 4-digit PIN
  → CNA Home Screen (total: <5 seconds)
```

Research basis: CNAs prefer 4-digit PIN over passwords (faster, no forgotten-password friction). HIPAA requires unique user identification — PIN satisfies this when combined with device-level security. Login >15 seconds = system avoidance (AMDA/AHCA surveys).

### Screen Flow

```
CNA Home Screen
  │
  ├→ [My Residents Tonight] — THE primary screen
  │    Grid of 6-8 assigned residents, each card shows:
  │    ┌──────────────────────────────────────┐
  │    │ 📷 Mr. Kowalski          Room 208   │
  │    │ 🟡 Moderate risk                     │
  │    │ ⚠ Don't approach from behind         │
  │    │ ✓ Cookie + calm voice works          │
  │    │ Last: Refused meds yesterday          │
  │    └──────────────────────────────────────┘
  │    Tap any card → Full behavioral profile
  │
  ├→ [Resident Detail] (tapped from grid)
  │    ├→ "What Works" — specific interventions with success rates
  │    ├→ "What NOT to Do" — contraindicated (RED, prominent)
  │    ├→ "Recent Incidents" — last 7 days with outcomes
  │    ├→ "Escalation Pattern" — behavioral sequence
  │    ├→ [Ask Moment Coach] — same AI, staff-attributed
  │    └→ [Log Incident] — quick logging, attributed to CNA
  │
  ├→ [Log Incident] — Progressive disclosure
  │    Attributed to this CNA's PIN (audit trail)
  │    Includes "notify charge nurse" for severe incidents
  │
  └→ [Quick Switch] — always visible → back to "Who's here?"
       (auto-switch after 90 seconds inactivity)
```

### Key UX Requirements (Research-Backed)

- **One-handed operation**: Often holding something with the other hand
- **Glanceable cards**: Key info visible without tapping. Think smartwatch-level density for first screen
- **Large touch targets**: 56x56px minimum (gloved hands, nitrile reduces touch accuracy)
- **High contrast**: Hallway fluorescents vs dimmed rooms at night. High contrast mode = default
- **Minimal typing**: Selection-based input. Pre-populated options from patient history
- **Offline resilience**: Queue data, sync when connection returns (facility Wi-Fi is unreliable)
- **Auto-save**: Every 10 seconds for any in-progress documentation
- **Session timeout**: 60-90 seconds → back to "Who's here?" (HIPAA)
- **Landscape tablet**: Primary form factor for shared devices

### What Makes CNAs Actually Use It

- **Reduces charting time** (#1 — from nursing informatics studies)
- **Makes them look competent** to nurses and families
- **Specific, actionable advice** (not generic "redirect the patient")
- **Available in their language** (Spanish at launch covers 85-90%)
- **Leadership actively uses and references it**

### What Kills Adoption

- Adds time to their workflow (even 30 seconds per resident compounds)
- Complex password requirements
- Feels like surveillance ("is this tracking me?")
- Generic advice that doesn't know the specific resident
- Crashes or slow loading on older shared tablets
- No training, or training was months ago

---

## 7. Persona UX: DON / Charge Nurse (B2B Admin) {#7-don}

### Demographics & Technology Profile

- **Demographics**: RN with BSN/MSN, age 45-55, 10-20 years clinical experience
- **Tech literacy**: Moderate to high. EHR-experienced. Dashboard-literate. Prefers simplicity.
- **Device**: Desktop (60% of interactions in office), phone (40% rounding/on-call)

### Usage Patterns

| Time | Mode | Duration |
|------|------|----------|
| 7:00-7:30 AM | Morning check ("what happened overnight?") | 5-10 min |
| Throughout day | Spot checks (triggered by events) | 1-2 min |
| Weekly | Deep analytics for quality meetings | 15-30 min |

### Screen Flow

```
DON logs in (email + password)
  └→ DON Dashboard
      │
      ├→ [Morning Summary] — THE first screen
      │    "Last 24 Hours"
      │    ├→ Behavioral incidents: 5 (2 severe, 3 mild)
      │    ├→ Escalating patterns: Mrs. Chen (↑ wandering)
      │    ├→ Staff using CalmGuide: 8 of 12 (67%)
      │    ├→ PRN medications for behavior: 2
      │    └→ Family CalmGuide sessions: 3 (2 resolved without 911)
      │
      ├→ [All Residents] — searchable list
      │    Each: name, room, risk level, last incident, trend arrow
      │    Tap → full detail + all-time history + family activity
      │
      ├→ [Trends] — weekly/monthly
      │    ├→ Incident frequency by category (line chart)
      │    ├→ Time-of-day distribution (bar chart)
      │    ├→ Intervention effectiveness rates
      │    ├→ Staff-level patterns (which shifts)
      │    └→ Export to PDF for QAPI meetings
      │
      ├→ [Staff Management]
      │    ├→ Invite staff (name + PIN for CNA, email for nurses)
      │    ├→ Assign residents to staff
      │    ├→ View staff activity
      │    └→ Manage roles (staff/admin)
      │
      └→ [Settings]
           ├→ Facility profile
           ├→ Alert thresholds
           └→ Patient access code management
```

### Key UX Requirements (Research-Backed)

- **Morning summary = dashboard**: 5-7 KPIs visible without scrolling
- **Tables for comparison** (most trusted by nursing leadership)
- **Line charts for trends** (weekly/monthly)
- **Color-coded severity**: Red/yellow/green (maps to triage mental model)
- **Narrative + numbers**: "Falls increased 20% — primarily due to 2 new admissions" not just "Falls: +20%"
- **15-min auto-refresh**: Not real-time streaming (causes anxiety). Manual refresh button available.
- **PDF export on every view**: DONs present data in meetings constantly
- **"Residents with escalating patterns"** = highest-value insight (proactive vs reactive)

### Dashboard Visualization Preferences (Ranked by DON Preference)

1. Tables with conditional formatting — most trusted
2. Simple bar charts — for comparison
3. Line charts — for trends
4. Numbers with trend arrows — for KPI summaries
5. Narrative text — for context
6. Heat maps, scatter plots — actively disliked ("for data people, not for me")

### What the DON Shows to Others

- **To administrators**: Census, incident rates, staffing ratios, survey readiness
- **To families**: Individual resident trends, care plan adherence, staff qualifications
- **To CNAs**: Unit-level performance (anonymized), recognition, focus areas

---

## 8. Persona UX: Administrator (B2B Owner) {#8-administrator}

### Demographics & Technology Profile

- **Role**: NHA (Nursing Home Administrator) or Executive Director
- **Tech literacy**: High for business tools (Excel, PowerPoint). Moderate for clinical tools.
- **Device**: Desktop (80%+), laptop for travel
- **Usage**: Weekly review (10-15 min), monthly reporting (30 min)

### Screen Flow

```
Administrator logs in (email + password)
  └→ Executive Dashboard
      │
      ├→ [Facility Overview]
      │    ├→ Behavioral incident rate + trend
      │    ├→ CalmGuide adoption rate (% of staff)
      │    ├→ Family engagement (% using at home)
      │    ├→ Baseline comparison (before vs after)
      │    └→ "Since CalmGuide: incidents ↓22%, PRN use ↓15%"
      │
      ├→ [ROI Summary]
      │    ├→ Estimated cost savings
      │    ├→ Survey readiness improvement
      │    ├→ Marketing differentiator
      │    └→ Export to PowerPoint-friendly format
      │
      └→ [Admin Settings]
           ├→ Manage DON/admin accounts
           ├→ Billing (future)
           └→ Facility branding
```

### Key UX Requirements

- **No individual patient data** — HIPAA minimum necessary. Aggregate metrics only.
- **ROI view is critical** — this person justifies the cost
- **Extremely simple** — 3-4 screens total. 10 min/week.
- **Export to PowerPoint-friendly format** — they present to corporate
- **"Demo-able"** — during family tours, the administrator may show CalmGuide as a differentiator

---

## 9. How All Personas Connect {#9-how-they-connect}

### Shared Data Layer

```
                    ┌──────────────────────┐
                    │   PATIENT PROFILE    │
                    │  (behavioral memory) │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐  ┌─────▼──────┐  ┌──────▼────────┐
    │ Family Caregiver│  │    CNA     │  │   DON/Admin   │
    │   (B2C app)    │  │ (B2B app)  │  │ (B2B dashboard)│
    └────────────────┘  └────────────┘  └───────────────┘
    
    WRITES: incidents,    WRITES: incidents,  READS: trends,
    moment coach sessions moment coach,       patterns, staff
    daily check-ins       shift observations  activity
    
    READS: guidance,      READS: behavioral   READS: aggregate
    patterns, dossier     profiles, "what     metrics, ROI,
                          works/what doesn't"  resident summaries
```

### The B2C → B2B Bridge

The patient's behavioral profile is the shared data layer. Everyone who cares for this patient — family member, CNA, nurse — contributes to and reads from the same behavioral memory.

- Family's years of home caregiving knowledge doesn't disappear when the patient enters a facility
- Experienced CNA's tacit knowledge doesn't disappear when they quit
- Night shift's observations are immediately available to day shift
- The knowledge travels with the patient, not with any individual caregiver

---

## 10. Shared Device Authentication {#10-shared-device-auth}

### The Constraint

- Most CNAs do NOT have work-issued devices
- 1-2 shared desktops at nurse's station + 1-2 shared tablets on the unit
- Login friction is the #1 barrier to CNA technology adoption (above training, above interface complexity)
- HIPAA requires unique user identification — shared credentials violate HIPAA

### Authentication Models in Healthcare (Ranked by LTC Adoption)

| Method | Login Time | LTC Adoption | Notes |
|--------|-----------|-------------|-------|
| Username + password | 30-60 sec | ~60-70% (via EHR) | CNAs hate it. Share credentials in practice. |
| 4-6 digit PIN | 5-10 sec | Growing | Fast, HIPAA-acceptable with device security |
| Badge/NFC tap (Imprivata) | 2-3 sec | ~10-15% | Too expensive for most LTC ($15K-30K/yr) |
| Facial recognition | 3-5 sec | Rare | Privacy concerns, mask issues |
| QR code from personal phone | 5-10 sec | Very rare | Requires personal phone use |

### Recommended Model for CalmGuide

**Two-tier authentication:**
1. **Device level** (one-time): Facility code entered once on the shared tablet. Links device to facility.
2. **User level** (each login): 4-digit PIN. CNA taps their name from a grid, enters PIN. <5 seconds total.

**Session management:**
- 60-90 second inactivity timeout → back to "Who's here?" screen
- Draft state auto-saved before timeout (resumable after re-auth)
- No password rotation for PINs (causes sticky-note passwords)
- Audit log: every access logged with CNA PIN, timestamp, patient accessed

**HIPAA compliance:**
- 164.312(d): Unique user identification → each CNA has unique PIN (satisfied)
- 164.312(a)(2)(iii): Auto-logoff → 60-90 second timeout (satisfied)
- 164.312(b): Audit controls → all access logged (satisfied)

### PWA vs Native App for Shared Devices

**PWA (Progressive Web App) recommended:**
- No App Store review, no MDM app deployment
- Works on any device with a browser
- Facility IT just bookmarks the URL
- Many smaller facilities have no MDM at all
- Avoids the "CNA needs to install an app on a shared iPad" friction

---

## 11. Facility Daily Operations Timeline {#11-daily-operations}

### Hour-by-Hour (Memory Care Unit, 24 beds)

**Day Shift (7:00 AM - 3:00 PM)**

| Time | What Happens | CalmGuide Moment |
|------|-------------|------------------|
| 6:50-7:00 | Shift change huddle. Night nurse gives verbal report. | **Shift start**: CNA opens "My Residents" grid, reviews behavioral summaries in 2 min |
| 7:00-8:30 | Morning ADLs: wake, toileting, dressing, grooming. **HIGH behavioral resistance.** | CNA checks "What NOT to do" for each resident before entering room |
| 8:30-9:15 | Breakfast. CNAs assist with feeding, monitor intake. | |
| 9:30-11:00 | Activity time. CNAs catch up on documentation. | CNA logs any morning incidents |
| 11:30-12:30 | Lunch. | |
| 12:30-2:00 | Afternoon rest. **Main documentation window.** | CNA reviews verification cards from auto-extracted incidents |
| 2:00-3:00 | **Sundowning begins.** Shift change. | Evening CNA reviews "My Residents" for sundowning-prone patients |

**Evening Shift (3:00 PM - 11:00 PM)**

| Time | What Happens | CalmGuide Moment |
|------|-------------|------------------|
| 3:00-3:30 | Receive report, check residents. | CNA reviews assigned residents' behavioral cards |
| 3:30-6:00 | **Peak sundowning.** Pacing, exit-seeking, aggression, resistance. | CNA checks "What Works" before approaching agitated resident. Uses Moment Coach for unfamiliar situations. |
| 4:30-5:30 | Dinner. | |
| 7:00-9:00 | Evening ADLs. **HIGH resistance.** | CNA checks what approach worked for morning ADLs |
| 10:00-11:00 | Documentation, shift change. | CNA logs incidents. DON reviews morning summary at home. |

**Night Shift (11:00 PM - 7:00 AM)**

| Time | What Happens | CalmGuide Moment |
|------|-------------|------------------|
| 11:00-11:30 | Receive report. 2 CNAs for 20-30 residents. | Review behavioral cards, especially wandering-risk patients |
| Every 2 hours | Incontinence checks, repositioning. | |
| 1:00-4:00 | **Nocturnal wandering, confusion.** CNA is alone. | Moment Coach for guidance when no one else is available. "Mr. Davis is confused and won't go back to bed — what works?" |
| 5:00-7:00 | Early risers. Begin morning prep. | |

### What a Tuesday Afternoon Actually Looks Like

2:15 PM. Three day-shift CNAs on a 24-bed unit.

**Maria** is trying to chart on the one available computer. She has 6 residents' morning ADLs and lunch intake to document. Squinting at PointClickCare, checking a crumpled "brain sheet" in her scrub pocket.

**Aisha** (3 weeks on the job) enters Room 208. Mr. Kowalski pushes her hand away, yells "Get away from me! I don't know you!" She has no idea that Rosa (who quit) knew to offer a cookie first and approach from the front. She tells the charge nurse "208 is refusing again." The charge nurse says "Try in 15 minutes."

**Without CalmGuide**: Aisha goes back in 15 minutes with the same approach. Same result. PRN Ativan ordered.

**With CalmGuide**: Aisha glances at the shared tablet. Mr. Kowalski's card says "⚠ Don't approach from behind. ✓ Offer cookie first, use calm voice, call him 'sir'." She tries the cookie approach. He accepts care.

---

## 12. Current State of Behavioral Documentation {#12-current-behavioral-docs}

### How It Currently Works (Broken)

| Aspect | Current State | Problem |
|--------|-------------|---------|
| **Where behavioral info lives** | Scattered: EHR progress notes, paper incident reports, CNA flow sheets, care plans, staff heads | No single source of behavioral truth |
| **Who documents** | Nurses write progress notes. CNAs do ADL checkboxes. MDS Coordinator codes quarterly. | CNAs witness the most but document the least |
| **When documentation happens** | End of shift, from memory, 3-6 hours after events | Details lost, vague descriptions ("resident was agitated") |
| **Care plan accessibility** | In EHR (PointClickCare) or binder at nurse's station | CNAs rarely log in. Never checked during behavioral episodes |
| **Care plan language** | Clinical: "Utilize redirection techniques" | CNAs need: "Tell her it's time for her show and walk her to the activity room" |
| **Handoff quality** | 5-10 minute verbal report. Behavioral info is lowest priority after medical. | "Mrs. Smith was sundowning earlier than usual" gets dropped |
| **New staff orientation** | 2-5 buddy shifts with experienced CNA (if available) | No structured resident-specific behavioral briefing |
| **Family knowledge capture** | Social history at admission. Occasionally at quarterly care conferences. | Captured once, never updated, never reaches the CNA |

### What PointClickCare Lacks for Behavioral Management

- No longitudinal behavioral tracking dashboard
- No pattern recognition
- No way to surface behavioral interventions at point of care for CNAs
- No structured trigger/intervention/outcome documentation
- No family knowledge contribution channel
- CNA behavioral documentation = single dropdown ("calm" / "agitated" / "resistive")

### What DONs Wish They Had

1. "I can't see patterns" — No behavioral trend dashboard
2. "The information is there but I can't find it" — Scattered across notes, reports, memories
3. "New staff have no idea what they're walking into" — No quick behavioral reference
4. "I need to prove our interventions are working" — No structured intervention outcome data
5. "I want real-time alerts" — PCC doesn't push behavioral alerts
6. "Families know things we don't" — No channel to capture family behavioral knowledge

---

## 13. B2B Go-to-Market Research {#13-go-to-market}

### Every Successful Healthcare B2B Started with a Notification, Not a Platform

| Company | First B2B Product | Exit |
|---------|------------------|------|
| CarePort Health | Real-time discharge notifications | $1.3B (WellSky) |
| Collective Medical | ED event notifications | Acquired by PointClickCare |
| PatientPing | ADT notifications | Now Bamboo Health |
| Livongo | Employer engagement reports | $18.5B (Teladoc) |
| Calm Business | Usage reports for employers | Part of Calm (valued ~$2B) |

### Who Buys and How

**Decision makers:**
- **Single-site facilities**: DON (clinical champion) + Administrator (budget authority). 1-3 month sales cycle.
- **Multi-site chains**: Corporate VP Clinical + Corporate IT. 6-18 months.
- **Start with independent facilities** — shortest sales cycle, most acute pain, fastest to pilot.

**Purchase triggers (in order of urgency):**
1. State survey citation for behavioral management — immediate urgency
2. Corporate mandate from parent organization
3. CMS antipsychotic quality measure pressure
4. Staffing crisis ("we can't find experienced staff, we need tech to help")
5. Competitive pressure (neighboring facility markets better dementia programming)
6. DON frustration (clinical champion)

**Pilot structure:**
- 30-90 days (60 days most common)
- Usually entire memory care unit (16-32 beds)
- All shifts must participate
- DON evaluates: staff adoption rate, incident trends, staff satisfaction
- Success criteria: "Do my CNAs like it?" + "Will this help at survey?"

### Pricing Benchmarks

| Tier | PBPM (per bed per month) | For a 32-bed unit |
|------|--------------------------|-------------------|
| Basic behavioral tracking tools | $1-5 | $32-$160/mo |
| Care management add-ons | $5-15 | $160-$480/mo |
| AI-powered clinical tools | $10-25 | $320-$800/mo |
| **CalmGuide target** | **$3-5** | **$96-$160/mo** |

First 60-day pilot: free. Then month-to-month with 90-day commitment.

### CalmGuide's Unique Positioning

**No existing product provides real-time, AI-powered behavioral guidance at the point of care.** Every competitor is either:
- Documentation-focused (record what happened) — PointClickCare, MatrixCare
- Training-focused (prepare staff in advance) — Relias, Dementia Live
- Monitoring-focused (detect what's happening via sensors) — CarePredict, Sensara

CalmGuide is the first tool that helps in the moment of need AND builds a persistent behavioral memory. The closest analog is the DON's personal cell phone — CNAs text the DON at 3am when they don't know what to do. CalmGuide replaces that call with expert-level, resident-specific guidance.

---

## 14. What We Build vs Buy vs Defer {#14-build-buy-defer}

### Build (Competitive Advantage)

| Component | Why Custom |
|-----------|-----------|
| LLM orchestration + behavioral memory | Core IP — prompt engineering, patient context injection, safety guardrails |
| CNA behavioral summary cards | No off-the-shelf equivalent exists |
| Behavioral dossier computation | Patient-specific intelligence is the moat |
| Incident extraction pipeline | Domain-specific NLP for dementia behavioral descriptions |
| Facility-level access control | Simple enough to build, too specific to buy |

### Buy (Not Competitive Advantage)

| Component | Recommendation | Why |
|-----------|---------------|-----|
| Identity/Auth | Auth0 or Clerk | HIPAA BAA available, handles SSO/SAML when needed |
| Email notifications | SendGrid/Postmark | BAA-covered, deliverability |
| PDF export | Puppeteer headless | Commodity |
| Error monitoring | Sentry (has BAA) | Not core competency |
| Analytics dashboard (DON) | Metabase embedded (v1) | Don't build custom dashboards until you know what metrics matter |

### Defer (No Customer Has Asked Yet)

| Component | When to Build |
|-----------|--------------|
| SSO (SAML/OIDC) | When a multi-site chain requires it in procurement |
| Multi-facility hierarchy | When you have 3+ facilities from one operator |
| MDS Section E auto-coding | When a DON specifically asks for survey help |
| QAPI reports | When compliance becomes a sales argument |
| PointClickCare integration | Start the PCC Marketplace process now (6-12 months), build when approved |
| FHIR interoperability | When a health system customer requires it. Use Redox/Health Gorilla, don't build. |
| Mobile app for facility staff | PWA first. Native app only if PWA performance is insufficient. |

---

## Key References

### Facility Operations & Staffing
- PHI (Paraprofessional Healthcare Institute) — CNA demographics and turnover data
- Relias — CNA turnover costs ($2,094-$6,000 per event)
- Castle & Engberg, 2006 — CNA turnover and quality correlations
- CMS Staffing Data (PBJ) — Hours per patient day, turnover rates

### Knowledge Gap & Behavioral Management
- Livingston et al., 2014 — Expert vs novice trigger identification (60-70% vs <30%)
- Scales et al., 2018 — Personalized behavioral care plans reduce incidents 30%
- Brodaty & Arasaratnam, 2012 — Individualized interventions effect size d=0.34 vs generic d=0.12
- AMA Journal of Ethics, 2022 — Tacit knowledge in eldercare work
- Edvardsson et al., 2010 — "Embodied knowing" in dementia care

### Caregiver Behavior & Technology Use
- Brodaty & Donkin, 2009 — Family caregiver behavior during crises (fight-or-flight, not app use)
- Boots et al., 2014 — Internet-based caregiver intervention engagement patterns
- Hopwood et al., 2018 — Dementia caregiver app usage (reflective/planning, not real-time crisis)
- Pew Research, 2024 — Older adult smartphone/tablet ownership and usage

### Healthcare B2B Strategy
- a16z Vertical SaaS Knowledge Project — Wedge-to-platform sequencing
- CarePort, Collective Medical, PatientPing — notification-first B2B MVPs
- Livongo, Omada, Calm Business — B2C to B2B transition case studies
- Pear Therapeutics — cautionary tale of over-engineering B2B infrastructure

### Authentication & Shared Devices
- HIPAA Security Rule 164.312 — Authentication, audit controls, auto-logoff requirements
- Imprivata — Clinical SSO market leader, pricing, adoption in LTC
- PointClickCare CNA Workflow — Shared device documentation patterns

### UX Research
- Fisk et al., 2009 — Designing for older adults (font size, touch targets, cognitive load)
- NHS Design System — Left-aligned text mandate, accessibility guidelines
- Apple HIG, Material Design 3 — Healthcare app UI patterns
- Nursing informatics literature — CNA technology adoption drivers and barriers
