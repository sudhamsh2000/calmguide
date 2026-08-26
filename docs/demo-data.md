# CalmGuide Demo Data

> All names, scenarios, and clinical details are fictional composites created for demonstration purposes. They do not represent any real individual.

## How to Seed

```bash
cd backend
python scripts/seed_demo.py
```

Requires: Database running + migrated (`alembic upgrade head`), `CONVERSATION_ENCRYPTION_KEY` and `JWT_SECRET_KEY` set in `.env`.

---

## B2C — Family Caregiver Profiles

These profiles simulate family caregivers using CalmGuide at home.

| Access Code | Stage | Behavioral Focus |
|-------------|-------|-----------------|
| `DEMO1FAM` | Middle | Sundowning, nighttime wandering, medication refusal, spouse accusations |
| `DEMO2FAM` | Early | Anxiety, item misplacement, social withdrawal, schedule confusion |

Each has 4 seeded incidents + a stale behavioral dossier (computed on first Moment Coach request).

**To use:** Open CalmGuide → "I have an access code" → enter `DEMO1FAM` → enter any patient name (e.g., "Mom").

---

## B2B — Facility

| Field | Value |
|-------|-------|
| Facility Name | Sunrise Gardens Memory Care |
| Facility Code | `SRSGARDN` |
| Residents | 6 |
| Staff | 10 |
| Total Incidents | 24 |

**To use (CNA):** Open CalmGuide → "I'm care facility staff" → enter facility code `SRSGARDN` → tap a staff name → enter their PIN.

**To use (DON/Admin):** Open CalmGuide → "I'm care facility staff" → "Admin Login" → enter email + password.

---

## Staff Roster

| Name | Role | PIN | Email | Password | Shift |
|------|------|-----|-------|----------|-------|
| Patricia Donnelly | Owner (DON) | `7734` | trish.donnelly@demo.calmguide.app | DemoOwner2026! | Day |
| James Okafor | Admin (LPN) | `4521` | james.okafor@demo.calmguide.app | DemoAdmin2026! | Day |
| Priya Nair | Admin (LPN) | `3309` | priya.nair@demo.calmguide.app | DemoAdmin2026! | Evening |
| Linda Reyes | Staff (CNA) | `1111` | — | — | Day |
| Marie-Claire Beaumont | Staff (CNA) | `2222` | — | — | Day |
| Aisha Thompson | Staff (CNA) | `3333` | — | — | Day |
| Gabriela Moreno | Staff (CNA) | `4444` | — | — | Evening |
| Blessing Adeyemi | Staff (CNA) | `5555` | — | — | Evening |
| Rosalie Toussaint | Staff (CNA) | `6666` | — | — | Night |
| Kevin Park | Staff (CNA) | `7777` | — | — | Night |

CNAs use PIN login on shared tablets. Admin/Owner use email + password.

---

## Patient Profiles (B2B — Linked to Facility)

### Margaret "Peggy" Sullivan — Room 104

| Field | Value |
|-------|-------|
| Access Code | `PEGSULLY` |
| Stage | Early |
| Primary CNA (Day) | Linda Reyes |
| Demo Value | Sundowning — most common behavior families search for |

**Behaviors:** Sundowning after 4pm, repetitive questioning about late husband, accuses staff of theft, anxious pacing before meals.

**What Works:** 1960s folk music (Joan Baez), photo album of school pictures, sorting colored buttons, warm herbal tea with honey.

**What NOT to Do:** Don't tell her Tom has passed (escalates grief). Don't force evening medications during sundowning peak.

**Seeded Incidents:**
1. Confused during shift change, tried to "go grade papers" → redirected with photo album (resolved)
2. Refused evening meds, "you're trying to poison me" → applesauce approach (resolved)
3. Asked "Where is Tom?" 23 times in 45 min → stopped factual answers, showed photos (resolved)
4. Accused night CNA of stealing ring → found in soap dish (partially resolved)

---

### Robert "Bobby" Chen — Room 112

| Field | Value |
|-------|-------|
| Access Code | `BOBYCHEN` |
| Stage | Middle |
| Primary CNA (Day) | Linda Reyes |
| Demo Value | Care refusal + aggression — staff injury prevention |

**Behaviors:** Physical resistance during bathing, nighttime calling out (1-4am), verbal aggression toward male staff, shadowing behavior.

**What Works:** Female staff for personal care, erhu music during bathing, warm washcloth before full bath, holding engineering slide rule during transitions.

**What NOT to Do:** Male staff must NOT assist with bathing (escalates to hitting). Don't remove slide rule — it's his security object.

**Safety:** Has struck staff during bathing (two-person assist required). Falls risk at night. Use simple Mandarin when agitated — doesn't respond to English.

**Seeded Incidents:**
1. Struck CNA during shower → female CNA + erhu music (partially resolved)
2. Found at nurses station at 2:30am, pulled catheter → soft music, 40 min resettle (resolved)
3. Verbal aggression at male visitor, blocked doorway → redirected with slide rule (resolved)
4. Shadowing CNA for 2 hours, distressed at shift change → introduced replacement CNA (resolved)

---

### Dorothy "Dot" Washington — Room 108

| Field | Value |
|-------|-------|
| Access Code | `DOTWASHN` |
| Stage | Late |
| Primary CNA (Day) | Marie-Claire Beaumont |
| Demo Value | Non-verbal pain detection — clinical intelligence |

**Behaviors:** Repetitive "help me" vocalizations, resistance to repositioning, grimacing suggesting pain, brief lucid periods.

**What Works:** Gospel music (Amazing Grace), lavender hand massage, speaking close to right ear (better hearing), daughter Yvonne's recorded voice message.

**What NOT to Do:** Don't assume vocalizations are "just the dementia" — 3 of 4 severe episodes correlated with constipation. Always assess pain first (PAINAD scale).

**Safety:** Aspiration risk (thickened liquids only), skin breakdown risk (reposition q2h), contracture risk in left hand.

**Seeded Incidents:**
1. "Help me" for 90 min → PAINAD score 6, Tylenol + hand massage (partially resolved)
2. Resistance during repositioning → two-person + daughter's voice recording (partially resolved)
3. Lucid episode — recognized daughter, asked about grandchildren (positive event)
4. Night vocalizations, found impacted stool → treatment resolved vocalizations (resolved)

**Demo "aha moment":** The system connects vocalizations to constipation pattern — "It found what my staff missed for months."

---

### Frank Kowalski — Room 115

| Field | Value |
|-------|-------|
| Access Code | `FRNKKOWL` |
| Stage | Middle |
| Primary CNA (Day) | Aisha Thompson |
| Demo Value | Exit-seeking — elopement prevention (liability nightmare for DONs) |

**Behaviors:** Exit-seeking after 3pm, paranoid ideation (staff stealing), refuses food he hasn't seen prepared, PTSD startle responses (Korean War veteran, retired police officer).

**What Works:** Walk with him to the door + redirect to snack area, male staff for redirection, let him watch food prepared, calm low tones + approach from front.

**What NOT to Do:** NEVER approach from behind (PTSD startle → combative). NEVER corner him physically. Don't open room door abruptly at night.

**Safety:** Elopement risk (door alarms on room + exits), hoards sharp utensils (check nightstand daily), history of combative episodes when cornered.

**Seeded Incidents:**
1. Made it to vestibule before alarm — "report for duty" → coffee + police career talk (resolved, near-miss filed)
2. Refused lunch, pushed tray — "you're drugging the food" → watched kitchen prepare tray (resolved)
3. PTSD flashback at night, struck CNA → spoke calmly from doorway, protocol changed (resolved)
4. Thunderstorm anxiety, checking every door → walked with him, showed weather (resolved)

**Demo "aha moment":** New night CNA reads the profile, knows to knock and open slowly. Prevents the PTSD flashback incident entirely.

---

### Maria Elena Gutierrez — Room 103

| Field | Value |
|-------|-------|
| Access Code | `MARGUTRZ` |
| Stage | Early |
| Primary CNA (Day) | Aisha Thompson |
| Demo Value | Spanish-speaking — multilingual support + Monday pattern detection |

**Behaviors:** Repetitive organizing/cleaning, confabulation about running a restaurant, agitation on routine changes, hoarding napkins and utensils.

**What Works:** Give towels to fold or silverware to sort, Spanish conversation about cooking, strict daily schedule in Spanish, help set tables before meals.

**What NOT to Do:** Don't confront hoarding directly (triggers aggression). Don't change her routine without warning. Don't speak English-only when she's distressed.

**Safety:** Wanders into kitchen (hot surfaces), may eat non-food items, agitation spikes on Mondays after weekend family visits, reverts to Spanish-only when distressed.

**Seeded Incidents:**
1. Found in commercial kitchen organizing pots → escorted, given towels to fold (resolved)
2. Told story about restaurant inspector to new CNA → Spanish-speaking CNA validated (resolved)
3. Monday morning aggression, "No me toques!" → let her cry, warm towel, Spanish comfort (resolved)
4. 47 napkins hoarded in dresser → removed without confrontation, left 5 (resolved)

**Demo "aha moment":** CalmGuide detects the Monday agitation pattern — DON proactively schedules Spanish-speaking CNA on Monday mornings.

---

### Harold "Harry" Johansson — Room 120

| Field | Value |
|-------|-------|
| Access Code | `HARYJOHN` |
| Stage | Middle |
| Primary CNA (Day) | Marie-Claire Beaumont |
| Demo Value | Lewy body dementia — medication safety (antipsychotic contraindication) |

**Behaviors:** Visual hallucinations (children playing — usually benign), fluctuating cognition (lucid mornings → confused afternoons), REM sleep behavior disorder (acts out dreams, falls), Parkinsonian gait with freezing.

**What Works:** Don't contradict hallucinations — ask what the children are doing, schedule decisions for morning hours, bed alarm + low bed + floor mat, count 1-2-3 for movement initiation.

**What NOT to Do:** NEVER give haloperidol or other antipsychotics — Lewy body patients have severe neuroleptic sensitivity (potentially fatal). Don't use patterned placemats (trigger visual hallucinations).

**Safety:** HIGH FALL RISK (Parkinsonism + sleep disorder), antipsychotic contraindication, fluctuating consciousness can mask acute events, orthostatic hypotension (stand slowly).

**Seeded Incidents:**
1. Benign hallucination — talking to "children" at dusk → no intervention needed (resolved)
2. REM sleep disorder, fell from bed → nurse assessed, no fracture, MD notified (escalated)
3. Fluctuating cognition — lucid at 8am, "in a barn" by 10am → oriented with familiar blanket (resolved)
4. Hallucinated insects on lunch plate → changed patterned placemat to solid color (partially resolved)

**Demo "aha moment":** Float nurse sees order for haloperidol → CalmGuide flags: "SAFETY ALERT: Antipsychotic contraindicated in Lewy body dementia — potentially fatal." One alert prevents a catastrophic medication error.

---

## Demo Scenarios for Sales Calls

### Scenario 1: "The 3 AM Crisis" (emotional impact)

Kevin (night CNA, 3 weeks on the job) is alone with 12 residents. Frank Kowalski is at the exit door.

- Kevin opens CalmGuide → sees Frank's behavioral card
- Card shows: "NEVER approach from behind. Walk WITH him. Redirect to snack area. Mention his police career."
- Kevin follows the guidance. Frank de-escalates in 8 minutes instead of 25.
- **DON reaction:** "My newest CNA handled that like a 10-year veteran. At 3 AM. Alone."

### Scenario 2: "The Wrong Medication" (safety/liability)

Float nurse sees haloperidol order for Harold Johansson. Opens CalmGuide before administering.

- System flags: "SAFETY ALERT: Harold has Lewy body dementia. Antipsychotic medications including haloperidol are contraindicated — potentially fatal."
- **DON reaction:** "That alert alone could save a life and prevent a lawsuit."

### Scenario 3: "The Pattern Nobody Saw" (clinical intelligence)

Dorothy Washington's incident history shows vocalizations correlate with constipation.

- 3 of 4 severe vocalization episodes occurred when no BM documented in 48+ hours
- Next time Dorothy starts calling out, CNA checks bowel chart first
- **DON reaction:** "It connected the dots that my staff missed for months."

### Scenario 4: "The Monday Problem" (operational efficiency)

Maria Elena's pattern shows agitation severity increases 2.3x on Mondays after weekend family visits.

- DON proactively schedules Spanish-speaking CNA on Monday mornings
- **DON reaction:** "It predicts problems before they happen."

### Scenario 5: "The New Hire" (workforce/retention)

New CNA Blessing starts her first day. Logs into CalmGuide.

- Immediately sees 4 assigned residents with full behavioral profiles
- Reads Bobby's profile: female staff for care, erhu music, never approach during bath without slide rule
- Compare to usual: "shadow someone and hope you remember"
- **DON reaction:** "Orientation went from 3 days to 3 hours. And she won't get hit."

### 20-Minute Demo Flow

1. (2 min) Show landing page, explain B2C vs B2B
2. (3 min) Log in as CNA Linda (PIN: 1111) → show "My Residents" grid
3. (3 min) Tap Bobby Chen → show behavioral card → "What NOT to Do" first
4. (5 min) Open Moment Coach → type a crisis query for Frank → show streaming response with his specific history
5. (3 min) Log in as DON Patricia (email login) → show dashboard → escalating residents + family activity
6. (2 min) Show Harold's profile → the medication safety alert
7. (2 min) Show ROI: "One prevented elopement pays for 2 years. One prevented fall with injury pays for 5 years."

---

## Metrics for Executive Dashboard Demo

| Metric | Before CalmGuide | After 90 Days | Change |
|--------|-----------------|---------------|--------|
| Severe incidents/week | 8 | 3 | -62% |
| Staff injury rate/month | 2.3 | 0.7 | -70% |
| Avg de-escalation time | 22 min | 9 min | -59% |
| Staff adoption rate | 30% | 94% | +213% |
| Family satisfaction | 3.1/5 | 4.4/5 | +42% |

---

## Legal Note

All patient data in this seed script is fictional. No real individuals are represented. Clinical scenarios are composites based on published literature from the Alzheimer's Association, CMS training materials, and NPI research. HIPAA does not regulate fictional data. The demo environment should display: "DEMO ENVIRONMENT — All patient data is fictional."
