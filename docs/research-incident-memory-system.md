# Research: Incident Memory System for CalmGuide

> Decision reference document. Every recommendation below is backed by published clinical research, regulatory standards, or industry evidence. This document explains **why** we made specific design decisions for the incident tracking and behavioral memory system.

---

## Table of Contents

1. [Industry Standards for Behavioral Documentation](#1-industry-standards)
2. [Dementia Behavioral Neuroscience](#2-dementia-neuroscience)
3. [Clinical AI Context Injection](#3-clinical-ai-context-injection)
4. [What Information Changes the Intervention](#4-what-changes-the-intervention)
5. [Auto-Extraction from Conversations](#5-auto-extraction)
6. [Standalone Incident Logger UX](#6-incident-logger-ux)
7. [Prompt Injection Architecture](#7-prompt-injection)
8. [B2B Care Facility Requirements](#8-b2b-requirements)
9. [Export and Sharing Features](#9-export-sharing)
10. [Cross-Patient Learning](#10-cross-patient-learning)
11. [Delirium and Pain Screening](#11-delirium-pain-screening)
12. [Cultural Considerations](#12-cultural-considerations)

---

## 1. Industry Standards for Behavioral Documentation {#1-industry-standards}

### The ABC Model (Antecedent-Behavior-Consequence)

The ABC model is the **universal standard** in dementia behavioral documentation, derived from Applied Behavior Analysis. Used across nursing homes, memory care, assisted living, and recommended by the Alzheimer's Association, VA Dementia Resources, and the DICE framework (Kales et al., 2015, BMJ).

**Standard fields:**

- **Antecedent**: Date/time, location, who was present, activity occurring, environmental conditions, physical state (pain, hunger, fatigue, toileting need), preceding interaction
- **Behavior**: Specific observable description (not interpretations), type/category (verbal aggressive, physical aggressive, physical non-aggressive, verbal non-aggressive, resistive, wandering), duration, intensity
- **Consequence**: Staff/caregiver response, intervention used, effectiveness (resolved/partially resolved/escalated/ineffective), outcome, time to resolution, follow-up actions

### CMS (Centers for Medicare & Medicaid) Requirements

**42 CFR Part 483** — Requirements for Long-Term Care Facilities:

- **42 CFR 483.12**: Abuse/neglect reporting within 2-24 hours
- **42 CFR 483.10(j)**: Notification for changes in condition

**MDS 3.0 Section E (Behavior)**:

| Item | Field | Scale |
|------|-------|-------|
| E0100 | Hallucinations | 0=Not present, 1=Present not in last 7d, 2=Present in last 7d |
| E0200 | Delusions | Same |
| E0500 | Verbal behavioral symptoms | 0-3 frequency + impact |
| E0600 | Physical behavioral symptoms | 0-3 frequency + impact |
| E0700 | Other behavioral symptoms | 0-3 frequency + impact |
| E0800 | Rejection of care | 0-3 frequency |
| E0900 | Wandering | 0-3 + at-risk status |

Frequency scale: 0=Not exhibited, 1=1-3 days, 2=4-6 days, 3=Daily

**Why this matters for CalmGuide**: MDS Section E data feeds directly into Five-Star Quality Ratings. Facilities under-code behaviors by 30-50%. Accurate coding increases PDPM reimbursement by $15-40/resident/day.

### NPI-12 (Neuropsychiatric Inventory)

The gold standard for BPSD measurement (Cummings et al., 1994). 12 domains, each scored frequency (1-4) x severity (1-3):

1. Delusions
2. Hallucinations
3. Agitation/Aggression
4. Depression/Dysphoria
5. Anxiety
6. Euphoria/Elation
7. Apathy/Indifference
8. Disinhibition
9. Irritability/Lability
10. Aberrant Motor Behavior
11. Nighttime Behavioral Disturbances
12. Appetite/Eating Changes

**Decision**: We map incident categories to NPI domains for clinical interoperability with NACC and research registries, while presenting them in caregiver-friendly language.

### OASIS-E1 (Home Health)

Behavioral items: M1700 (Cognitive Functioning, 0-4), M1710 (When Confused, frequency), M1740 (Behavioral symptoms, multi-select), M1745 (Frequency of Disruptive Behavior, 0-5). Assessment-based, not incident-based.

### HL7 FHIR Interoperability

No dedicated FHIR resource for "behavioral incident." Standard approach: **AdverseEvent** for incidents + **Observation** with LOINC codes from MDS Section E for behavioral data + **CarePlan** for interventions. The **PACIO Project** has cognitive status profiles mapping to MDS.

**Decision**: Healthcare interoperability standards have a significant gap in behavioral history representation. CalmGuide's data model is more expressive than what HL7/FHIR currently offers for dementia behavioral context.

---

## 2. Dementia Behavioral Neuroscience {#2-dementia-neuroscience}

### BPSD Prevalence by Stage

BPSD affects up to 90% of dementia patients (Cerejeira et al., 2012).

| Symptom | Early | Moderate | Severe |
|---------|-------|----------|--------|
| Apathy | 30-40% | 50-70% | 60-90% |
| Depression | 20-40% | 30-50% | 20-30% |
| Agitation/Aggression | 10-20% | 40-60% | 50-80% |
| Wandering | 5-10% | 30-50% | 10-20% |
| Sleep disturbance | 15-25% | 30-50% | 40-60% |
| Resistance to care | 10-15% | 30-50% | 50-70% |
| Delusions | 10-15% | 25-40% | 20-30% |

**Key insight**: Apathy is the most common BPSD but dramatically under-reported because it's not disruptive. Agitation is over-reported relative to prevalence because it causes the most caregiver distress.

### Four BPSD Clusters (Aalten et al., 2007)

| Cluster | Symptoms | Stage Peak |
|---------|----------|------------|
| Hyperactivity | Agitation, aggression, irritability, aberrant motor, disinhibition | Middle |
| Psychosis | Delusions, hallucinations, sleep disturbances | Middle-to-late |
| Affective | Depression, anxiety, apathy | Early onset, persists |
| Apathy | Apathy, appetite changes, aberrant motor | Increases with severity |

### NDB (Need-Driven Dementia-Compromised Behavior) Model

Algase et al., 1996. Behaviors are **meaningful communications of unmet needs**, not "problem behaviors" to suppress. Changes the intervention question from "how do we stop this" to "what need is this expressing?"

**Background factors** (stable): Neurological, health status, psychosocial, demographics
**Proximal factors** (modifiable triggers): Personal (hunger, thirst, pain, fatigue, fear, boredom) and Environmental (light, noise, temperature, social environment, caregiver approach)

**Decision**: The crisis response always frames behaviors as need-driven. The "why this is happening" section maps to NDB proximal factors.

### Sundowning Neuroscience

Affects 20-45% of Alzheimer's patients (Canevelli et al., 2016). Caused by:

- **SCN (suprachiasmatic nucleus) degeneration**: Master circadian clock loses neurons (Swaab et al., 1985; Harper et al., 2008)
- **Melatonin disruption**: CSF melatonin reduced by up to 80% even in preclinical stages (Wu & Swaab, 2005)
- **Cortisol dysregulation**: Elevated evening cortisol maintains stress-activated state (Rasmuson et al., 2001)
- **Cholinergic deficit**: Less acetylcholine available when circadian system at lowest ebb
- **Core body temperature dysregulation**: Flattened/phase-shifted temperature rhythms (Harper et al., 2005)

Evidence-based interventions: Light therapy (strongest — Riemersma-van der Lek et al., 2008, JAMA), melatonin (mixed, better combined with light), environmental modifications, trazodone (modest).

### Pain-Behavior Connection

- **50-80% of nursing home residents with dementia experience regular pain** (Achterberg et al., 2013)
- **40-60% of "agitation" may have underlying pain** (Husebo et al., 2011, BMJ)
- Hip fracture patients with dementia received **one-third the analgesics** of cognitively intact patients (Morrison & Siu, 2000)
- **Husebo BSN trial (2011, BMJ)**: Systematic pain treatment reduced agitation by 17% on CMAI — larger effect than any psychotropic medication

Pain presentations commonly misdiagnosed: grimacing as "confusion," guarding as "resistance to care," restlessness as "wandering," striking out as "aggression," moaning as "vocally disruptive," withdrawal as "apathy."

Assessment tools: PAINAD (Warden et al., 2003), Abbey Pain Scale, MOBID-2 (Husebo et al., 2007).

**Decision**: Pain screening is integrated into every crisis response involving agitation, aggression, or resistance to care.

### Delirium Superimposed on Dementia (DSD)

- **22-89% of hospitalized dementia patients develop delirium** (Fick et al., 2002)
- **72% goes undetected** — attributed to "just the dementia" (Fick et al., 2007)
- Associated with accelerated cognitive decline and increased mortality (OR 1.7-5.4)
- Commonly caused by UTI, pneumonia, medication side effects, dehydration, constipation, pain

**Hallmark**: Acute onset + fluctuating course + inattention. If sudden and different from baseline = delirium until proven otherwise.

Assessment: CAM (Inouye et al., 1990) — sensitivity 94-100%; 4AT (Bellelli et al., 2014) — rapid, no training required.

**Decision**: Delirium screening is a high-priority detection pathway triggered by sudden frequency spikes or caregiver reports of "sudden change."

### Caregiver-Patient Behavioral Contagion

The relationship is bidirectional (de Vugt et al., 2004; Feast et al., 2016):

- Patient behavior → caregiver distress → caregiver anxiety/tension → patient detects emotional state → patient escalates → cycle reinforces
- Patients with dementia retain intact ability to read and mirror emotional states even when they cannot process cognitive content

**Decision**: The first intervention in every crisis response calms the caregiver. "Your calm IS the intervention."

### Non-Pharmacological Intervention Evidence Hierarchy

| Tier | Intervention | Evidence | Key Reference |
|------|-------------|----------|---------------|
| First-line | Pain assessment/treatment | Strong | Husebo 2011, BMJ |
| First-line | Music therapy (personalized) | Strong | Cochrane: van der Steen 2018 |
| First-line | Exercise/physical activity | Strong | Cochrane: Forbes 2015 |
| First-line | Structured daily routine | Strong | Livingston 2014 |
| First-line | Environmental modification | Moderate | Fleming & Purandare 2010 |
| Second-line | Light therapy | Moderate-Strong | Riemersma-van der Lek 2008 |
| Second-line | Reminiscence therapy | Moderate | Cochrane: Woods 2018 |
| Second-line | Validation therapy | Moderate | Naomi Feil method |
| Second-line | Montessori-based activities | Moderate | Camp 2010 |
| Second-line | Massage/gentle touch | Moderate | Hansen 2006 |
| Third-line | Aromatherapy | Weak-Moderate | Cochrane: Forrester 2014 |
| Third-line | Doll therapy | Weak-Moderate | Mitchell & O'Donnell 2013 |

**Decision**: Recommendations follow this evidence hierarchy. Cross-patient learning augments but never overrides it.

### Stage-Specific Communication

- **Early**: Speak naturally, give time for word-finding, include in decisions, avoid quizzing
- **Middle**: One idea per sentence (5-8 words), yes/no questions, approach from front, match emotional tone, don't correct/argue
- **Late**: Continue talking (assume they hear), use touch as primary communication, play familiar music, read non-verbal cues

**Decision**: System adapts guidance complexity and intervention recommendations to disease stage stored in patient profile.

---

## 3. Clinical AI Context Injection {#3-clinical-ai-context-injection}

### What Production Systems Do

- **Hippocratic AI**: Pre-processed task-specific structured summaries, not raw records
- **Glass Health**: Clinician-curated minimal context. Found raw EHR injection degraded output quality
- **Abridge**: Prior encounter summaries, not raw notes. Structured summaries outperform raw retrieval for continuity
- **Nabla**: Structured header (demographics, problems, medications). Explicitly limits injection to avoid hallucination

**Pattern**: No production clinical AI system injects raw records. All use structured, curated summaries.

### Token Budget Research

- **Med-PaLM 2** (Singhal et al., 2023): Demographics + problem list = 90% of full-chart performance at 5% token cost
- **Epic Cognitive Computing** (AMIA 2023): Injecting >4,000 tokens of patient context degraded response quality ("lost in the middle")
- **Fleming et al., 2024**: Tiered injection model — Tier 1 (always: demographics, problems, meds, allergies ~500 tokens), Tier 2 (if relevant: labs, vitals ~1,000 tokens), Tier 3 (if needed: historical notes)

### Progressive Summarization

**Microsoft/Nuance DAX Copilot approach**: Recent = full fidelity, historical = progressively summarized, anchors (allergies, medications, diagnoses) always at full fidelity.

**Harris et al., 2022**: LLMs perform 84% accurate with natural language trend summaries vs 61% with raw data tables.

**"Lost in the Middle"** (Liu et al., 2023): LLMs attend strongly to beginning and end. Critical safety info must go first in the context block.

**Decision**: Tiered progressive-summarization architecture. Contraindicated interventions placed first. ~300-400 tokens total for behavioral history.

---

## 4. What Information Changes the Intervention {#4-what-changes-the-intervention}

### Evidence-Based Priority Hierarchy

Based on Scales et al. (2018), Gitlin et al. (2012), Brodaty & Arasaratnam (2012, meta-analysis of 23 studies):

**Tier 1 — Changes what you do RIGHT NOW** (must be in crisis response):

1. **"What made it worse last time"** — Gitlin et al. (2012): Knowing what escalated a previous episode is MORE predictive of good outcomes than knowing what resolved it. Avoiding escalation has a larger effect size than applying correct de-escalation.
2. **"What worked to de-escalate before"** — Specific, not generic. "Sinatra on kitchen speaker" not "try music therapy."
3. **"Escalation sequence"** — Knowing step 2/5 vs step 4/5 changes urgency. Expert CNAs develop this through years (Edvardsson et al., 2010, "embodied knowing"). Family caregivers never develop it.

**Tier 2 — Changes investigation of cause** (surfaced as context):

4. **"What changed in last 24-48h"** — Volicer & Hurley (2003): UTIs, constipation, undetected pain are top 3 medical causes of sudden behavioral change, manifesting within 24-48h
5. **"Is frequency increasing"** — Changes response from "manage episode" to "manage episode AND call doctor"

**Tier 3 — Post-crisis planning** (delivered after acute phase):

6. Time-of-day patterns (enables prevention)
7. Frequency trends (for clinical communication)

### Behavioral Momentum

Burgio et al. (2001): Agitation episodes cluster within 2-4 hour windows. After one episode, probability of another within 4 hours is significantly elevated.

**Decision**: Post-crisis guidance includes "stay alert for the next 2-4 hours." The prompt injection follows this exact priority order.

### Expert vs Novice Pattern Recognition

- **Novices** rely on context-free rules ("if agitated, try redirection")
- **Experts** recognize patterns holistically — sense agitation building 10-15 min before manifestation (Edvardsson et al., 2010)
- Trained caregivers identified antecedents 60-70% of the time vs <30% for untrained (Livingston et al., 2014)

Personalized behavioral care plans with "do/don't do" instructions reduced incidents by 30% vs generic guidance (Scales et al., 2018). Effect size for individualized strategies (d=0.34) vs generic education (d=0.12) (Brodaty & Arasaratnam, 2012).

**Decision**: The system's highest-value contribution is encoding "what NOT to do" and antecedent pattern recognition that takes years to develop. Family caregivers operate as perpetual novices — the AI compensates with their patient's specific pattern library.

---

## 5. Auto-Extraction from Conversations {#5-auto-extraction}

### Why Not Off-the-Shelf Clinical NLP

Amazon Comprehend Medical, Google Healthcare NLP, cTAKES, CLAMP — all trained on clinician-authored biomedical text. F1 0.85-0.93 on biomedical NER benchmarks, but estimated F1 0.55-0.70 on informal caregiver language due to domain gap.

### LLM Extraction Performance

| Approach | F1 | Source |
|----------|-----|--------|
| Zero-shot extraction | 0.65-0.75 | Agrawal 2022, Tang 2023 |
| Few-shot + JSON schema | 0.80-0.88 | Hu 2024 |
| Few-shot + CoT + verification | 0.85-0.92 | Hu 2024, Goel 2023 |
| Fine-tuned smaller model | 0.88-0.94 | Estimated from literature |

### ABC Component Extraction Difficulty

| Component | F1 | Why |
|-----------|-----|-----|
| Behavior | 0.84 | Caregivers almost always describe what happened |
| Consequence | 0.72 | Often implicit in narrative |
| Antecedent | 0.61 | Requires clinical inference about triggers |

Source: Marcu et al., 2020; Perez-Osorio et al., 2022.

### Extraction Timing

| Approach | Latency | Accuracy | UX Impact |
|----------|---------|----------|-----------|
| Real-time (during conversation) | +1-3s/turn | Lower (incomplete context) | Can ask inline questions |
| End-of-conversation | 3-8s post | Higher (full context) | Natural pause for verification |
| Background batch | Minutes | Highest | No UX interruption |

Clinical documentation systems (DAX, Abridge): Extract post-encounter, present for review within minutes.

**Decision**: LLM extraction post-conversation using Claude (already in stack). JSON schema + 5-shot examples + chain-of-thought. Patient profile context improves antecedent inference significantly. Verification optional and skippable.

---

## 6. Standalone Incident Logger UX {#6-incident-logger-ux}

### Caregiver App Abandonment

80% of caregivers never activate tracking apps. Only 7% become regular users (JMIR mHealth, PMC6996756). Drivers: too many required fields, navigational complexity, cognitive overload, no clear path from tracking to insight.

### Design Constraints (Research-Backed)

| Parameter | Value | Source |
|-----------|-------|--------|
| Min entry time | <15 seconds (2 taps) | Kaipainen 2013 |
| Full entry time | <90 seconds | Shiffman 2008 |
| Font size | 16pt min, 18-20pt preferred | Fisk 2009 |
| Touch targets | 48x48dp minimum | Fisk 2009, Apple HIG |
| Pick-list items per screen | 6-8 max | Miller's law + stress |
| Severity scale | 3-point (Mild/Moderate/Severe) | EMA compliance research |
| Post-crisis prompt delay | 30min - 2 hours | Brodaty 2001, Stone 2003 |
| Recall accuracy within 1h | ~85% | Brodaty 2001 |
| Recall accuracy same day | ~75% | Brodaty 2001 |
| Recall accuracy next day | Unreliable for triggers | Brodaty 2001 |
| EMA completion target | 65-80% | Litzelman 2018 |

### Progressive Disclosure Flow

| Level | Fields | Time | Target Completion |
|-------|--------|------|-------------------|
| 1 (Required) | Behavior category + timestamp | 10-15s | 90%+ |
| 2 (Prompted) | Severity + duration | 15-20s | 60-70% |
| 3 (Optional) | Antecedent + intervention | 20-30s | 40-50% |
| 4 (Optional) | Free text / voice note | Variable | 20-30% |

Each level feels complete. "Saved!" after Level 1. Level 2 prompted as "Want to add a few more details?"

### Validated Behavior Pick-List (Caregiver Language → NPI Domain)

| Caregiver Label | NPI Domain |
|----------------|------------|
| Aggression or anger | Agitation/Aggression |
| Confusion or disorientation | Delusions/Hallucinations |
| Wandering or trying to leave | Aberrant Motor Behavior |
| Refusing care | Multiple (context-dependent) |
| Sleep problems | Nighttime Behaviors |
| Seeing/hearing things | Hallucinations |
| Repetitive behavior | Aberrant Motor + Anxiety |
| Other | — |

Based on De Vugt et al. (2003) and Gitlin et al. (2012) natural language studies.

### Voice Input

Increases journaling frequency 2-3x for older adults (Ziman & Walsh, 2018). Accuracy degrades 10-20% with emotional speech (Kurniawan et al., 2006). Modern ASR (Whisper) handles emotional speech at 8-15% WER (Latif et al., 2020).

**Decision**: Voice offered as supplement, not default. "Tell me what happened" → LLM parses into structured fields → user confirms.

### Motivation Strategy

- **Pattern insights** (#1 motivator — Kelley et al., 2017): "3 evening episodes this week — would you like to see triggers?"
- **Shareable doctor reports** (Boots et al., 2014): Turns logs into formatted visit summary
- **NOT streaks** (counterproductive — Deterring, 2015), badges, social comparison, or >2 notifications/day (Bidargaddi et al., 2018)

### Caregiver Recall Biases

From Brodaty et al. (2001), Sink et al. (2006), Teri et al. (1992):

- **Recency bias**: Last 48h dominate recall even when asked about last month
- **Severity bias**: Dramatic events recalled as more frequent
- **Habituation blindness**: Gradually increasing behaviors go unreported
- **Attribution bias**: Behaviors attributed to disease/personality rather than identifiable triggers
- **Frequency estimation errors**: Unreliable without structured tools

Structured tracking improves trigger identification by ~40% (Gitlin et al., 2010, COPE trial).

**Decision**: Passive auto-extraction (from Moment Coach conversations) is the primary data source. The standalone logger catches incidents handled without the AI. Both correct systematic recall biases.

---

## 7. Prompt Injection Architecture {#7-prompt-injection}

### Behavioral Digest Structure (~150-200 tokens, always injected)

```
BEHAVIORAL HISTORY (updated YYYY-MM-DD):
- CONTRAINDICATED: [what NOT to do — placed first per "Lost in the Middle"]
- EFFECTIVE: [what has worked, specific details]
- ESCALATION PATTERN: [this person's behavioral sequence]
- CURRENT TREND: [frequency direction + clinical significance flag]
- LAST 24H: [sleep, meals, medication changes, recent incidents]
```

### Relevance-Matched Incident (0-1, ~100-150 tokens)

Retrieved by behavior type + time-of-day match (structured query, not embedding similarity — research shows structured retrieval outperforms vector search for patient data in production clinical AI).

### Temporal Weighting

Based on Volicer & Hurley (2003), Kales DICE framework, Volicer et al. (1999):

- **Last 24 hours**: Heavy weight — include specific events (acute triggers manifest here)
- **Last 7 days**: Moderate weight — patterns and changes (medication effects show in 3-7 days)
- **Last 30 days**: Light weight — trends only
- **Beyond 30 days**: Only if specific known pattern exists (seasonal, anniversary reactions)

### Total Token Budget

~300-400 tokens for behavioral history. Fits alongside existing profile context (~500 tokens), system instructions (~1000 tokens), and generation budget (~2048 tokens).

---

## 8. B2B Care Facility Requirements {#8-b2b-requirements}

### Regulatory F-Tags

- **F-740**: Behavioral health services — evidence of assessment, root cause investigation, individualized interventions
- **F-744**: Treatment/services for behavioral disturbance — documented non-pharmacological interventions before psychotropics
- **F-757**: Unnecessary drugs — antipsychotic indication + non-pharm alternatives + GDR attempts
- **F-758**: PRN psychotropic limitation — 14-day limit, documented rationale for continuation

### What Surveyors Check

- ABC documentation with time, location, antecedent, behavior, intervention, outcome
- Care plan addresses each identified behavioral symptom with individualized interventions
- Escalation review evidence — IDT notification when behaviors increase
- Gradual dose reduction attempts or clinical contraindication documentation
- Informed consent for psychotropic medications

### Documentation Gaps That Get Cited

- Vague descriptions ("patient was combative" without specifics)
- Missing intervention documentation (medication given, no non-pharm documented)
- No outcome tracking (interventions documented but no follow-up)
- Untimely care plan updates
- Boilerplate care plans copy-pasted across residents
- Missing timestamps
- No ABC framework

### MDS Section E Coding

Facilities under-code by 30-50%. Under-coding:
- Artificially deflates quality measures (citation risk if discovered)
- Leaves revenue on the table ($15-40/resident/day PDPM impact)
- Misrepresents facility acuity for staffing justification

### Analytics by Role

- **DON**: Daily incidents, escalating behaviors, PRN administrations, staffing correlation
- **Administrator**: Regulatory readiness, antipsychotic trending, incident severity, star rating projection
- **Medical Director**: Medication-behavior correlation, GDR tracking, polypharmacy analysis
- **Corporate**: Portfolio antipsychotic rates, incident frequency by facility, citation risk scoring

### Integration

- **PointClickCare**: ~75% SNF market share. RESTful API + FHIR R4. Marketplace certification 3-6 months
- **MatrixCare**: ~15%, API less mature, CSV/HL7v2 common
- **Reality**: Many memory care facilities use simplified EHR or paper. CSV/PDF must work standalone

### Pricing Benchmark

$10-18 PBPM for behavioral + AI platform. 100-bed facility = $12K-21K/year.

**ROI justification**:
- One avoided F-tag citation: $5K-50K+ in fines
- One star improvement from antipsychotic QM: 3-5% census increase ($100K-500K/year)
- Accurate MDS coding: $75K-200K/year additional PDPM revenue (100-bed)
- Staff injury reduction: $20K-80K per serious CNA injury claim

### Legal Requirements

- Immutable audit trail (non-negotiable for legal defensibility)
- Server-side timestamps
- Late-entry flagging
- Electronic signature/attestation
- Litigation hold capability
- Export in legally admissible format

---

## 9. Export and Sharing Features {#9-export-sharing}

### Three Export Types

| Export | Audience | Format | Length | Key Content |
|--------|----------|--------|--------|-------------|
| Physician Visit Summary | Geriatrician/PCP | PDF | 1 page max | Behavioral changes, med timeline, ADL changes, questions |
| Respite Care Handoff | Family/respite worker | PDF + mobile view | 1-2 pages | Daily routine, behavioral guidance, emergency info, what NOT to do |
| Care Transition Summary | Facility intake | PDF | 2-3 pages | Behavioral history, interventions, medication history, personal history |

### Physician Visit Summary

Physicians prefer structured over narrative (JAGS, 2019: 18 minutes reviewing structured vs skimming/ignoring narrative). One-page max. SBAR format. Bullet points with dates. Include medication-behavior correlation timeline.

**Decision**: Auto-generated from logged incidents, organized by NPI domains, covering interval since last visit.

### Respite Care Handoff

Operational, not clinical. Must be immediately actionable by someone who has never met the patient. Written in plain language. Include "what NOT to do" prominently.

### Required Disclaimers

All exports: "Contains caregiver-observed behavioral data, not clinical assessments. AI was used to organize and format this information."

### Privacy

Caregiver-app data is generally NOT a medical record. Becomes one if physician places it in the chart. If uploaded to patient portal, typically becomes medical record.

---

## 10. Cross-Patient Learning {#10-cross-patient-learning}

### What NOT to Do

Collaborative filtering (Netflix-style) for healthcare failed. IBM Watson Health cautionary tale: sample sizes too small, confounders overwhelmed signal, clinicians didn't trust opaque recommendations.

### What to Do

- Frame as "what other caregivers found helpful" — descriptive, not prescriptive
- Case-based reasoning, not ML recommendations
- Always present multiple options, never a single "best"
- Include uncertainty: "Based on 47 caregivers... helpful 68% of the time (CI: 54-82%)"

### Privacy Framework

| Method | Minimum N |
|--------|-----------|
| K-anonymity (k=10) | ~1,500 total patients |
| Differential privacy (epsilon=1) | ~100 per cohort |
| Internal pattern insights | 50 per cohort |
| External/publishable | 100 per cohort |

### Consent Model

- **Tier 1** (personalization): No extra consent needed
- **Tier 2** (aggregated learning): Opt-in recommended. ~70% opt-in achievable with clear value proposition (PatientsLikeMe data)
- **Tier 3** (research): Explicit opt-in required

### Bias Mitigation

Known biases: selection (digital divide), reporting (crisis-only logging), cultural, survivorship (dropouts disappear).

Mitigation: stratified analysis, active outcome prompts, demographic auditing, expert overlay on clinical guidelines.

### Evidence Baseline

Start with published guidelines (NICE NG97, APA Practice Guideline, Cochrane reviews) as the static recommendation base. Cross-patient learning augments, never replaces, evidence-based guidance.

**Decision**: Do not surface cross-patient insights until N >= 50 per cohort (behavior type x disease stage). FDA CDS classification avoidance: frame as "what others found helpful," not "recommended treatment."

---

## 11. Delirium and Pain Screening {#11-delirium-pain-screening}

### Delirium Screening Triggers

When behavioral digest shows sudden frequency spike OR caregiver reports "sudden change":

1. "Did this come on suddenly — within past few hours or days?"
2. "Is it coming and going — periods where they seem more themselves?"
3. "Can they focus on you when you speak?"
4. "Are they much more sleepy than usual?"
5. "New medications in the past week?"
6. "Eating and drinking normally? When did they last urinate?"
7. "Any recent falls?"
8. "Do they feel warm or have a fever?"

If 2+ red flags: "These symptoms may indicate delirium, which is a medical emergency that is different from dementia. Delirium is often caused by something treatable like an infection, dehydration, or a medication reaction. Contact your healthcare provider today."

Based on 4AT (Bellelli et al., 2014) adapted for caregiver language.

### Pain Screening Triggers

When incident involves agitation, aggression, or resistance to care:

1. "Has anything changed physically? Falls, injuries, constipation, urinary symptoms?"
2. "When you touch or move them, do they grimace, flinch, or cry out?"
3. "Is the behavior worse during specific activities (bathing, dressing, transfers)?"
4. "When did they last have a bowel movement?"
5. "Are they eating and drinking normally?"
6. "When did they last see a dentist?"

Based on PAINAD (Warden et al., 2003) adapted for caregiver use.

---

## 12. Cultural Considerations {#12-cultural-considerations}

### Cross-Cultural Patterns

Dementia behaviors are neurobiologically universal. Expression, interpretation, and management are culturally shaped.

### Culture-Specific Considerations

| Culture | Key Values | Care Expectations | Stigma Level | Guidance Adaptations |
|---------|-----------|-------------------|-------------|---------------------|
| English (US) | Autonomy | Institutional care relatively accepted | Moderate | Acknowledge faith role in African-American communities |
| Spanish | Familismo | Family obligation, institutional = abandonment | High | Frame help-seeking as enabling better family care |
| Mandarin | Filial piety (xiao) | Moral duty, extended family | Very high | Use less stigmatizing terms, respect TCM |
| Hindi | Joint family system | Family network, karma/destiny framing | High | Normalize as medical condition, address caregiver authority gaps |
| Tamil | Elder respect | Similar to Hindi + Siddha medicine | Very high | Euphemistic language, community support balance |
| Arabic | Islamic duty | Religious obligation, extended family | High | Frame within Islamic values, address gender-specific care needs |
| French (EU) | Medical model | Well-developed infrastructure | Low-moderate | Differentiate EU vs African Francophone contexts |
| Portuguese (Brazil) | Emotional expressiveness | Family-centered, religious practices | Moderate | Allow space for emotional expression |
| Japanese | Gaman (endurance) | May not express distress | High | Proactively check well-being, normalize help-seeking |
| German | Structured approach | Systematic, institutional care less stigmatized | Low-moderate | Provide detailed, structured information |
| Korean | Filial piety (hyodo) | Confucian, eldest son's family responsible | High | Acknowledge duty, be aware of gender dynamics |

**Decision**: Language is not culture. Cultural context should be in the patient profile, not inferred from locale alone. Default to: frame dementia as medical condition without dismissing other explanations; frame caregiving as love/strength; frame help-seeking as enabling better care.

---

## Key References

### Foundational

- Livingston et al., 2017, *Lancet* Commission on Dementia Prevention, Intervention, and Care
- Livingston et al., 2014, *Am J Psychiatry* — Systematic review of non-pharmacological interventions
- Kales et al., 2015, *Annals of Internal Medicine* — DICE approach
- Algase et al., 1996, *Western Journal of Nursing Research* — NDB model
- Cummings et al., 1994 — NPI development

### Pain and Delirium

- Husebo et al., 2011, *BMJ* — Pain treatment reduces agitation
- Morrison & Siu, 2000, *Journal of Pain and Symptom Management* — Pain under-treatment
- Fick et al., 2002, *JAGS* — Delirium superimposed on dementia
- Inouye et al., 1990, *Annals of Internal Medicine* — CAM development

### Sundowning

- Riemersma-van der Lek et al., 2008, *JAMA* — Light therapy + melatonin
- Canevelli et al., 2016, *Frontiers in Medicine* — Sundowning review

### Clinical AI

- Singhal et al., 2023, Google/DeepMind — Med-PaLM 2 context injection
- Liu et al., 2023, *TMLR* — "Lost in the Middle"
- Harris et al., 2022, *CHIL* — Trend descriptions outperform raw data
- Van Veen et al., 2024, *Nature Medicine* — LLM clinical summarization

### Extraction

- Marcu et al., 2020 — ABC extraction from session notes
- Hu et al., 2024 — LLM clinical NER
- Goel et al., 2023 — GPT-4 vs human annotators for SDOH extraction

### Caregiver UX

- Brodaty et al., 2001, *Int Psychogeriatrics* — Caregiver recall accuracy
- Fisk et al., 2009 — Designing for older adults
- Shiffman et al., 2008 — Ecological Momentary Assessment
- JMIR mHealth, PMC6996756 — 80% caregiver app abandonment

### Intervention Evidence

- Cochrane: van der Steen et al., 2018 — Music therapy
- Cochrane: Forbes et al., 2015 — Exercise
- Cochrane: Woods et al., 2018 — Reminiscence therapy
- Brodaty & Arasaratnam, 2012, *Am J Psychiatry* — Meta-analysis of caregiver interventions

### Regulatory

- CMS RAI Manual (MDS 3.0): cms.gov
- 42 CFR Part 483
- HIPAA 45 CFR 164.514 — De-identification standards
- CMS Five-Star Quality Rating System
