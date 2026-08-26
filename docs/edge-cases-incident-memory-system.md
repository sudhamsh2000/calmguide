# Edge Cases & Safeguards: Incident Memory System

> Every edge case below is paired with a concrete safeguard. Severity ratings reflect potential for patient/caregiver harm, not engineering complexity.

---

## Table of Contents

1. [Critical: Data Integrity & Safety](#critical-data-integrity--safety)
2. [High: System Quality Degradation](#high-system-quality-degradation)
3. [Medium: Should Handle](#medium-should-handle)
4. [Cross-Cutting Architectural Patterns](#cross-cutting-architectural-patterns)
5. [Legal & Regulatory Implications](#legal--regulatory-implications)

---

## Critical: Data Integrity & Safety

These edge cases can cause direct harm to the patient or caregiver if not handled.

---

### EC-01: Caregiver Enters Wrong or Misleading Patient Profile Data

**Severity**: Critical
**Frequency**: High (this is the baseline, not an edge case)

#### The Problem

Caregiver-reported data is systematically biased. This is one of the most robust findings in dementia caregiving research:

- **30-50% of dementia caregivers are clinically depressed** (Schulz & Martire, 2004). Depression distorts perception — depressed caregivers report more problem behaviors than actually observed (Teri & Wagner, 1991).
- Caregivers **cannot accurately stage dementia**. Significant discrepancy between caregiver-reported severity and clinician-rated CDR scores (Perneczky et al., 2006).
- Caregivers systematically **underestimate** patient functional abilities due to habituation (Zanetti et al., 1999).
- When two caregivers rate the same patient on the NPI, they frequently disagree on presence and severity of symptoms (Cummings et al., 1994 validation studies).

#### Intentional Misreporting Scenarios

| Scenario | Motivation | Frequency | Harm Potential |
|----------|-----------|-----------|----------------|
| **Denial / downplaying** | Avoid reality, maintain normalcy | Very common (spouse caregivers especially) | High — AI gives guidance requiring cognitive capacity the patient lacks |
| **Exaggeration** | Justify institutionalization, caregiver benefits, seek validation | Common during burnout | Medium — AI over-escalates, adds unnecessary alarm |
| **Abuse cover-up** | Create paper trail of "diligent caregiving" | Rare | Extreme — AI becomes tool for legitimizing abuse |
| **Custody/guardianship disputes** | Adversarial documentation | Rare | High — AI-generated records used as legal evidence |
| **FDIA (factitious disorder)** | Fabricate crises for attention/validation | Very rare | Extreme — AI validates fabricated scenarios |

#### Unintentional Misreporting Scenarios

| Scenario | Cause | Frequency | Harm Potential |
|----------|-------|-----------|----------------|
| **Wrong disease stage** | Caregiver doesn't know clinical staging; told a stage at diagnosis but patient progressed | Very common | High — stage drives all intervention selection |
| **Misattribution to dementia** | Delirium, pain, medication side effects look like dementia to a lay person | Very common | Critical — treatable emergency goes unrecognized |
| **Depression-distorted reporting** | Caregiver's depression causes negative attentional bias, catastrophizing | Affects 30-50% of users | Medium — over-counts severity, skews patterns |
| **Cultural misinterpretation** | Talking to unseen people = spiritual (not hallucination); resistance = stubbornness (not symptom) | Common in non-Western cultures | Medium — wrong behavioral classification |

#### The Most Dangerous Scenario

Profile says "early stage." Patient is actually late-stage. AI says "try having a conversation about what's bothering them." Patient can't speak. Caregiver gets frustrated. Escalation to aggression.

Even worse: Caregiver describes acute confusion (delirium). Profile says "mid-stage." AI attributes it to dementia progression. **Treatable medical emergency goes unrecognized.** UTI, stroke, or medication toxicity untreated.

#### Safeguards

**S-01a: Behavioral-anchor stage selection (replaces clinical labels)**

Instead of asking caregivers to select "Early / Middle / Late" (which requires clinical knowledge they don't have), present behavioral descriptions they can observe:

```
Which best describes your loved one RIGHT NOW?

[ ] Can have conversations and manage some daily tasks with reminders
    (May repeat questions, misplace items, need help with finances)

[ ] Needs help with most daily tasks, may not always recognize familiar people
    (May wander, resist bathing, get confused about time/place)

[ ] Needs help with all daily tasks, limited or no speech
    (May not recognize family, needs help eating/dressing/toileting)
```

This maps to early/middle/late internally but produces more accurate staging because it tests what the caregiver can directly observe, not what they think the clinical label should be.

**Research basis**: Perneczky et al. (2006) showed lay caregivers are much more accurate at describing observable behaviors than selecting clinical categories.

**S-01b: Profile-crisis consistency detection**

After each crisis conversation, compare the crisis description against the patient profile. Flag inconsistencies:

```python
# Pseudocode for consistency detection
if profile.disease_stage == "early" and crisis contains indicators of late-stage:
    # Indicators: "doesn't recognize me", "can't speak", "non-verbal",
    # "needs help eating", "incontinent", "doesn't know where they are"
    inject_into_response(
        "Based on what you're describing, your loved one may have progressed "
        "beyond what's in their profile. We recommend discussing staging with "
        "their doctor. Updating the profile helps us give you better guidance."
    )
```

This is NOT a gate — the AI still responds to the crisis. It surfaces the inconsistency and suggests an update.

**S-01c: Always-on acute change detection (profile-independent)**

Regardless of what the profile says, if the caregiver's description matches delirium markers, trigger screening. This is the **single most important safeguard** because it catches the most dangerous error with zero dependence on profile accuracy.

Trigger keywords (profile-independent):
- "suddenly", "just started", "was fine this morning", "never done this before"
- "in and out", "comes and goes", "worse then better then worse"
- "completely different", "like a different person", "not themselves"

When triggered: Inject delirium screening questions into the response. If 2+ positive → "This may be a treatable medical condition. Contact your healthcare provider today."

**S-01d: Periodic profile review**

Every 60 days, prompt the caregiver to review the profile using fresh behavioral anchors:

> "Dementia changes over time. Let's make sure [patient name]'s profile is up to date. Does this still describe them?"

Show the current behavioral-anchor selection and ask if it's still accurate. If the caregiver selects a different stage, trigger stage transition handling (see EC-06).

**S-01e: Longitudinal anomaly detection**

Flag when incident data doesn't match expected patterns:

| Anomaly | Possible Cause | Action |
|---------|---------------|--------|
| Crisis descriptions suddenly improve | Denial, new caregiver with different baseline | Prompt profile review |
| Dramatic escalation in <1 week | Delirium, medication change, or exaggeration | Trigger medical screening + prompt for context |
| Identical crisis descriptions repeated | Possible fabrication, or genuine recurring crisis | Compare timestamps, check for copy-paste patterns |
| Zero crises for extended period after high frequency | Patient institutionalized, passed away, or denial | Gentle check-in: "We noticed it's been quiet. How are things going?" |

**S-01f: Caregiver wellbeing screening**

Periodically screen for caregiver depression using PHQ-2 (2 questions, validated, <30 seconds):

1. "Over the past 2 weeks, how often have you felt down, depressed, or hopeless?"
2. "Over the past 2 weeks, how often have you had little interest or pleasure in doing things?"

If positive: The system should be more cautious about accepting severity reports at face value AND more aggressive about recommending professional support. Add to the behavioral dossier context: "Caregiver screening suggests elevated distress — behavioral reports may reflect caregiver state as well as patient behavior."

**Research basis**: Teri & Truax (1994) — caregiver depression is the strongest predictor of reported behavioral disturbance frequency. This is not fabrication — it's perceptual distortion.

---

### EC-02: Delirium Misattributed as Dementia Progression

**Severity**: Critical
**Frequency**: Very common — 72% of delirium in dementia patients goes undetected (Fick et al., 2007)

#### The Problem

Delirium is acute, treatable, and potentially fatal. Dementia is chronic and progressive. The caregiver (and the AI) may attribute delirium symptoms to "the dementia getting worse," missing a medical emergency.

Common delirium causes: UTI (42% misdiagnosed — Cedars-Sinai), dehydration, constipation, medication side effects (anticholinergics, benzodiazepines), pain, pneumonia.

#### Safeguard

**S-02: Profile-independent delirium screening (always active)**

This is implemented in the system prompt, not as a conditional flag. The AI is instructed to screen for delirium markers in EVERY crisis interaction:

```
ALWAYS assess whether this could be delirium, regardless of the patient profile:

Delirium markers (any ONE is a red flag):
- Acute onset (hours to days, not gradual)
- Fluctuating course (better then worse within the same day)
- New inattention (can't focus, looks through you)
- Altered consciousness (much more sleepy OR much more agitated than baseline)
- New hallucinations (different from any baseline hallucinations)

If you detect ANY delirium marker in the caregiver's description:
1. Address the immediate crisis first (safety)
2. Then explicitly state: "What you're describing sounds like it came on suddenly. 
   This could be a sign of something treatable like an infection, dehydration, or 
   a medication reaction — not just the dementia progressing. Please contact your 
   healthcare provider TODAY, or go to the emergency room if they seem very unwell."
3. Do NOT attribute sudden changes to dementia progression even if the profile 
   says mid/late stage
```

This is the single highest-value safety feature in the entire system.

---

### EC-03: Abusive Caregiver Using the App as Cover

**Severity**: Critical
**Frequency**: Rare but catastrophic

#### The Problem

An abusive caregiver could use CalmGuide to create a documented history of "diligent caregiving" — fabricating crises with appropriate-sounding AI responses. The AI's clinical-sounding language lends false legitimacy to the record.

Indicators from elder abuse literature (Lachs & Pillemer, 2004):
- Frequent reports of "falls" or injuries with inconsistent explanations
- Descriptions that include restraint, isolation, or withholding of care
- Language normalizing force ("I had to hold her down," "I locked the door so she couldn't get out")
- Pattern of escalating injuries attributed to patient behavior

#### Safeguards

**S-03a: Abuse indicator tagging**

The system prompt already instructs the LLM to detect elder abuse indicators. Extend this to the extraction pipeline:

```python
# In post-conversation processing
if llm_detects_abuse_indicators(conversation):
    conversation.metadata["safety_concern"] = "potential_abuse_indicator"
    # Exclude from cross-patient strategy aggregation
    # Exclude from behavioral pattern insights
    # Retain for documentation (immutable audit trail)
```

**S-03b: Negative strategy tag list**

Never auto-extract these as "effective strategies," even if the caregiver reports them as such:

- Physical restraint / holding down / pinning
- Locking in a room / isolation
- Withholding food, water, or medication as punishment
- Threatening or intimidating
- Sedating without prescription

If these appear in conversations, the response addresses them therapeutically (per existing prompt design), but they are flagged and excluded from all aggregation.

**S-03c: Immutable audit trail**

All conversation data is stored with server-side timestamps, no deletions allowed, amendments marked. This is important for two reasons:
1. If abuse is later investigated, the record exists
2. The app can demonstrate it provided appropriate resources (988, Eldercare Locator)

---

### EC-04: Caregiver Self-Harm Risk Contaminating Patient Data

**Severity**: Critical
**Frequency**: Common — 30-50% of caregivers meet criteria for clinical depression

#### The Problem

When the safety gate fires for caregiver suicidal ideation, that conversation is saved alongside patient behavioral data. The keyword extraction picks up words like "can't," "anymore," "sleep," "die" and treats them as patient behavioral triggers. The patient's insights become contaminated with caregiver distress data.

#### Safeguards

**S-04a: Tag and exclude safety-gate conversations**

```python
# When safety gate fires
conversation.metadata["safety_gate_type"] = "caregiver_self_harm"

# In compute_profile_insights
conversations = select(Conversation).where(
    Conversation.profile_id == profile_id,
    ~Conversation.metadata.contains({"safety_gate_type": "caregiver_self_harm"})
)
```

**S-04b: Separate caregiver wellness tracking**

Caregiver distress patterns (frequency of use at night, language shifts toward hopelessness, safety gate activations) are clinically valuable but must not contaminate the patient dossier. Track separately:

- `caregiver_distress_trend` in the behavioral dossier tracks caregiver state over time
- This informs the AI's tone (more supportive, more empathetic, slower pacing) without affecting patient behavioral analysis
- If distress trend is escalating, proactively suggest: Alzheimer's Association 24/7 helpline (800-272-3900), local support groups, respite care options

**S-04c: Post-crisis wellness check-in**

After a safety gate activation, on the next non-crisis interaction:

> "Last time we talked, you were going through a really difficult time. How are you doing? Remember, the Alzheimer's Association helpline (800-272-3900) is available 24/7, and what you're feeling is a normal response to an incredibly hard situation."

---

## High: System Quality Degradation

These edge cases degrade the quality of insights and recommendations but don't pose immediate safety risks.

---

### EC-05: Multiple Caregivers, One Patient

**Severity**: High
**Frequency**: Common — most patients have 2+ caregivers

#### The Problem

A spouse, adult child, and paid aide all use the same access code. Their observations conflict. "Music works" (spouse, evening) vs "Music makes it worse" (aide, morning care). The system blends these without context.

Research: IDEO's multi-caregiver coordination research found that "what works" disagreements are almost always explained by different contexts, not wrong observations. Both caregivers are correct.

#### Safeguards

**S-05a: Optional caregiver role on interactions**

Add optional `caregiver_role` field to crisis requests and incident logging. No authentication required — soft identifier:

```
Who are you? (optional, helps us give better advice)
[ ] Spouse/Partner  [ ] Son/Daughter  [ ] Other family  [ ] Paid caregiver  [ ] Other
```

Store on `Conversation.metadata` and `Incident.caregiver_role`.

**S-05b: Context-aware strategy attribution in dossier**

When building the behavioral dossier, tag strategies with caregiver context:

```
EFFECTIVE:
- Music (Sinatra): Resolved 3/4 wandering episodes (spouse, evening/nighttime)
- Music (Sinatra): Escalated agitation 2/2 times (aide, morning care)
  → Context-dependent. Works in evening, not during morning routine.
- Warm towel before bathing: Resolved 2/2 resistance episodes (aide, morning care)
```

**S-05c: Per-role pattern computation**

In `compute_profile_insights`, compute `peak_time` and trend per caregiver role when role data is available. A spouse reporting nighttime crises and an aide reporting morning crises produce a bimodal distribution that should be preserved, not averaged.

---

### EC-06: Disease Stage Transitions

**Severity**: High
**Frequency**: Inevitable — every patient progresses

#### The Problem

Behavioral patterns "reset" at stage transitions. The NDB model (Algase et al., 1996) shows the same observable behavior has completely different drivers at different stages:

- Early-stage wandering = goal-directed (looking for something real)
- Middle-stage wandering = disorientation
- Late-stage wandering = psychomotor agitation

Old calming strategies based on verbal reasoning stop working when language comprehension deteriorates.

#### Safeguards

**S-06a: Stage transition tracking**

```python
# On Profile model
stage_changed_at: datetime | None  # Set when disease_stage changes
previous_stage: str | None         # Retain for context
```

**S-06b: Post-transition data weighting**

In `compute_profile_insights`, when `stage_changed_at` is within the last 90 days:
- Weight post-transition incidents at 3x
- Flag pre-transition patterns as "pre-transition" in the dossier
- Do not use pre-transition data for cycle detection

**S-06c: Prompt context for transitions**

```
STAGE TRANSITION: Changed from early to middle on 2026-03-15 (45 days ago).
Behavioral patterns are in flux. Pre-transition strategies may no longer apply.
Deeply embedded preferences (music, comfort objects) likely still work.
Surface-level triggers and calming approaches should be re-evaluated.
```

**S-06d: Caregiver-prompted strategy review**

When stage changes, prompt the caregiver:

> "Your loved one's care needs have changed. Some things that used to help might not work the same way now. Let's review what's working and update their profile."

Present current `calming_strategies` and `behavioral_patterns` for review and update.

---

### EC-07: Medication Changes Invalidating Behavioral History

**Severity**: High
**Frequency**: Common — medication changes happen every few months

#### The Problem

A new medication is started. All pre-medication behavioral data may be misleading. The system's cycle detector and risk scorer use stale data.

Standard clinical observation windows:
- Cholinesterase inhibitors (donepezil): 4-6 weeks
- Antipsychotics (quetiapine): 1-2 weeks acute, 6 weeks stable
- Antidepressants (SSRIs): 4-8 weeks
- Mood stabilizers: 2-4 weeks

#### Safeguards

**S-07a: Medication/care change events**

```python
class CareChangeEvent:
    id: UUID
    profile_id: UUID  # FK
    change_date: date
    description: str  # Encrypted — "New medication started" (not the med name)
    observation_window_days: int = 28  # Default 4 weeks
    created_at: datetime
```

**S-07b: Observation window handling**

During the observation window:
- Exclude pre-change data from `episode_cycle` detection
- Exclude pre-change data from `risk_score` calculation
- Display to caregiver: "Behavioral patterns are being re-evaluated after a recent change. Tracking new patterns."
- Prompt context: "A care change was recorded [X days ago]. Behavioral patterns may be in flux."

**S-07c: Pre/post comparison**

After observation window closes, generate a comparison:

> "Since the care change on April 1: Nighttime wandering decreased from 4x/week to 1x/week. Daytime agitation unchanged. Morning medication refusal is new (wasn't happening before the change)."

This is extremely valuable for physician visit reports — temporal medication-behavior correlation.

---

### EC-08: False Patterns from Sparse Data

**Severity**: High
**Frequency**: Guaranteed for new users

#### The Problem

With 3-5 incidents, the system "detects" a pattern that's statistical noise. Clinical standard: minimum 2 full predicted cycles observed to confirm (Burgio et al., 2001). The NPI requires 12+ observation points per behavior category.

Current threshold of 5 episodes over 14 days is too low for actionable predictions.

#### Safeguards

**S-08a: Raised thresholds with confidence tiers**

| Data Points | Over Period | Confidence Level | Display |
|-------------|------------|------------------|---------|
| 3-4 incidents | Any | None | No pattern shown |
| 5-7 incidents | 14+ days | Provisional | "A possible pattern may be emerging..." |
| 8-12 incidents | 21+ days | Low | "We're seeing a pattern forming..." |
| 13-20 incidents | 30+ days | Moderate | "There appears to be a pattern..." |
| 20+ incidents | 30+ days, 2+ full cycles confirmed | High | "A clear pattern has been detected..." |

**S-08b: Qualify provisional patterns in prompt**

```
PROVISIONAL PATTERN (5 incidents, limited data — treat with caution):
Possible evening clustering between 4-7pm. Needs more observations to confirm.
Do not present this as established fact to the caregiver.
```

**S-08c: Distinguish data sources**

A Moment Coach crisis conversation and a daily check-in marked "agitated" carry different weight. Weight crisis conversations at 1.0 and daily check-ins at 0.5 in pattern detection.

---

### EC-09: Data Volume Over Years (900+ Incidents)

**Severity**: High
**Frequency**: Guaranteed for long-term users

#### The Problem

After 5 years and 900+ incidents, generic words dominate keyword extraction ("confused," "upset," "wander"). The clinically useful signal is buried. Performance degrades (900+ decryption operations per insights computation).

#### Safeguards

**S-09a: Tiered temporal model**

| Window | Weight | Used For |
|--------|--------|----------|
| Last 30 days | 1.0 (full) | Crisis response, current dossier |
| 1-6 months | 0.5 | Pattern detection, trend computation |
| 6-12 months | 0.2 | Historical comparison only |
| 12+ months | 0.0 (unless milestone) | Archive, milestone scan only |

**S-09b: Milestone incidents**

Flag incidents that are always retained at full weight regardless of age:
- First aggressive episode
- First wandering/elopement attempt
- First ER visit or hospitalization
- First safety gate activation
- Stage transitions
- Any incident where the caregiver specifically flags it as significant

**S-09c: Weekly digest compression**

A weekly background job compresses older data into summary statistics:

> "6-month summary: 45% of crises involved sundowning, 30% medication refusal, 25% aggression during personal care. Music resolved 70% of sundowning. Physical redirection always escalated."

The dossier injects the compressed digest for historical context, not raw incident data.

**S-09d: Top triggers from recent data only**

Compute `top_triggers` from last 90 days only. This ensures keyword extraction reflects the current behavioral landscape, not 5 years of accumulated generic terms.

---

## Medium: Should Handle

These edge cases should be handled but are lower severity or frequency.

---

### EC-10: Dual Patients (Both Parents Have Dementia)

**Severity**: Medium
**Frequency**: ~15% of dementia caregivers (Alzheimer's Association, 2024)

#### The Problem

Caregiver has two access codes. At 3am, enters the wrong code. Gets wrong patient's context in the crisis response.

#### Safeguards

**S-10a: Persistent patient header**

If multiple profiles stored in local storage, show a large, colored patient name header at all times:

```
┌─────────────────────────────────┐
│  🟢  Talking about: Mom (Margaret)  │
│  Tap to switch to Dad (Robert)      │
└─────────────────────────────────────┘
```

**S-10b: Pre-crisis confirmation**

Before the first message in a crisis session:

> "You're asking about **Margaret**. Is that right?"
> **[Yes, continue]** · **[Switch to Robert]**

**S-10c: Cross-profile independence**

Ensure that two profiles sharing a caregiver are flagged in cross-patient aggregation — they share an observer, which violates statistical independence assumptions.

---

### EC-11: Retrospective Logging Accuracy

**Severity**: Medium
**Frequency**: Common — caregivers often log incidents hours or days later

#### The Problem

Caregiver logs incident from 3 days ago. Recall accuracy beyond 24 hours is unreliable (Brodaty et al., 2001):
- Within 1 hour: ~85% accuracy
- Same day: ~75%
- Next day: Severity over-reported, trigger recall drops to ~50%
- Beyond 48 hours: Statistically indistinguishable from retrospective questionnaire

#### Safeguards

**S-11a: Recall confidence flagging**

```python
def compute_recall_confidence(incident_time: datetime, logged_at: datetime) -> str:
    hours_diff = (logged_at - incident_time).total_seconds() / 3600
    if hours_diff <= 2:
        return "high"
    elif hours_diff <= 24:
        return "moderate"
    elif hours_diff <= 48:
        return "low"
    else:
        return "very_low"
```

**S-11b: Gentle accuracy note**

When `incident_time` is >24 hours before `created_at`:

> "You're logging something from a couple of days ago. Memory for details fades quickly — focus on the main thing that happened rather than exact times or sequences. Even a rough note helps track patterns."

**S-11c: Weighted pattern detection**

In cycle and trend detection, weight incidents by recall confidence:
- High: 1.0
- Moderate: 0.8
- Low: 0.5
- Very low: 0.3

---

### EC-12: Language Switching Across Sessions

**Severity**: Medium
**Frequency**: Common for bilingual families

#### The Problem

English + Spanish sessions for same patient. Current keyword extraction (`[a-z]{4,}`) only captures Latin-alphabet words. Hindi, Arabic, Tamil, Chinese sessions contribute zero keywords.

#### Safeguards

**S-12a: Language-aware keyword extraction**

Group keyword extraction by `locale_code`. Use language-appropriate stopword lists and Unicode word boundary regex for non-Latin scripts.

**S-12b: Language-neutral behavioral categories**

Store behavioral categories as enum values (already in our data model), not extracted keywords. The enum is language-neutral; the display label is localized.

**S-12c: Multi-language prompt context**

If a profile has sessions in multiple languages, note in the dossier:

```
Note: This patient's caregivers use English and Spanish. Behavioral observations 
have been reported in both languages. Category-level patterns are language-neutral.
```

---

### EC-13: Third-Party PII in Crisis Descriptions

**Severity**: Medium
**Frequency**: Very common — caregivers naturally mention names

#### The Problem

"My sister Karen from Portland came to visit and Mom got confused. Dr. Patel changed her medication." Contains: sister's name, city, doctor's name. Karen and Dr. Patel never consented.

Under CCPA/CPRA: "personal information" includes information "reasonably capable of being associated with a particular consumer." Sister's name + city + relationship = arguably PII about a third party.

#### Safeguards

**S-13a: NER scrubbing before storage**

Before encrypting conversation content, run Named Entity Recognition to replace third-party identifiers:

```
Input:  "My sister Karen came from Portland and Mom got confused. Dr. Patel said..."
Output: "My sister [family member] came from [location] and Mom got confused. 
         [Doctor] said..."
```

Preserve the patient name (from `patient_name` in request) as the exception.

Implementation options:
- **Microsoft Presidio** (open-source, Python) — purpose-built for PII detection
- **LLM-based scrubbing** — add to the extraction pipeline as a preprocessing step
- **Hybrid** — Presidio for high-confidence entities, LLM for contextual judgment

**S-13b: Entity-type filtering in keyword extraction**

Filter PERSON, LOCATION, ORGANIZATION entities from `top_triggers` keyword extraction regardless of PII scrubbing. "Portland" is not a behavioral trigger.

---

### EC-14: Seasonal and Environmental Patterns

**Severity**: Medium
**Frequency**: Predictable — affects most patients

#### The Problem

- Winter sundowning worsens (reduced daylight, Khachiyants et al., 2011: r = -0.43 correlation with photoperiod)
- Holiday agitation (routine disruption, visitors, decorations)
- Relocation trauma (2-6 week adjustment, Remer & Buckwalter, 1990)
- Weather changes (barometric pressure correlates with agitation, Friedman et al., 2008)

The system detects a "worsening trend" in November that's actually seasonal, not disease progression.

#### Safeguards

**S-14a: Seasonal context in insights**

Add month/season to insights computation. When displaying trends, overlay with season:

> "Episodes increase November through February each year. This is consistent with seasonal sundowning from reduced daylight."

**S-14b: Environmental context markers**

Allow caregivers to log context changes:
- "Recently moved" (triggers 4-6 week adjustment window)
- "Holiday period" (flags expected routine disruption)
- "New caregiver started" (flags adjustment period)
- "Home renovation / construction" (noise, disruption)
- "Visitor staying" (routine change, unfamiliar person)

When pattern analysis shows an anomaly near a context marker, attribute it:

> "Behavioral spike coincides with the move you logged on March 1. Relocation adjustment typically takes 4-6 weeks."

**S-14c: Proactive seasonal prompt injection**

If it's November–February and the patient has a sundowning history:

```
SEASONAL NOTE: Reduced daylight in winter months may be contributing to increased 
evening/overnight episodes. Consider: bright light exposure in the morning (30-60 min), 
maintaining well-lit environment during the day, consistent evening routine.
```

---

### EC-15: Crisis During Extraction (Race Condition)

**Severity**: Medium (data staleness, not corruption)
**Frequency**: Occasional

#### The Problem

New crisis arrives while post-stream processing (save, extract, compute insights) from the previous crisis is still running. The new crisis may not see the just-completed incident in its context.

#### Safeguards

**S-15a: Transaction isolation is sufficient for correctness**

SQLAlchemy async sessions are transaction-isolated. No data corruption risk. The new crisis will either see or not see the previous assistant response depending on commit timing. Both states are safe.

**S-15b: Always append current message**

The code already appends `[{"role": "user", "content": payload.message}]` to history. The current user message is always included even if the previous response hasn't committed.

**S-15c: Fire-and-forget background processing**

Move tag generation and insights computation to `asyncio.create_task` after response stream closes. Don't block the generator function. Accept eventual consistency for insights — they are statistical aggregates that don't need real-time accuracy.

**S-15d: Extraction queue**

If two crises happen within minutes, queue extractions to run sequentially per profile. This prevents duplicate or conflicting incident records from concurrent extraction.

---

## Cross-Cutting Architectural Patterns

Three patterns that address multiple edge cases simultaneously:

### Pattern 1: Conversation Metadata Tagging

Add a `metadata` JSONB column to `Conversation` for structured flags:

```python
metadata = {
    "caregiver_role": "spouse",           # EC-05
    "safety_gate_type": "caregiver_self_harm",  # EC-04
    "recall_confidence": "high",          # EC-11
    "environmental_context": "holiday",   # EC-14
    "profile_consistency": "mismatch_detected",  # EC-01
    "abuse_indicator": false,             # EC-03
    "language": "es"                      # EC-12
}
```

This avoids schema sprawl while enabling filtering in all downstream computations.

### Pattern 2: Temporal Partitioning in Insights

Nearly every edge case involves data from different time contexts being blended inappropriately. A single architectural change — partitioning all insights computation into temporal windows with explicit weighting — addresses:

- Stage transitions (EC-06): Pre/post transition weighting
- Medication changes (EC-07): Observation window exclusion
- Data volume (EC-09): Tiered temporal model
- Seasonal patterns (EC-14): Monthly/seasonal bucketing
- False patterns (EC-08): Minimum data requirements per window

```python
def compute_weighted_insights(profile_id, incidents):
    now = datetime.utcnow()
    stage_changed_at = profile.stage_changed_at
    care_change_events = get_care_change_events(profile_id)
    
    for incident in incidents:
        weight = 1.0
        
        # Temporal decay
        age_days = (now - incident.incident_time).days
        if age_days > 365:
            weight = 0.0  # Archive (unless milestone)
        elif age_days > 180:
            weight = 0.2
        elif age_days > 30:
            weight = 0.5
        
        # Stage transition penalty
        if stage_changed_at and incident.incident_time < stage_changed_at:
            weight *= 0.3  # Pre-transition data heavily discounted
        
        # Observation window exclusion
        for event in care_change_events:
            window_end = event.change_date + timedelta(days=event.observation_window_days)
            if incident.incident_time < event.change_date and now < window_end:
                weight = 0.0  # Exclude pre-change data during observation window
        
        # Recall confidence
        weight *= recall_confidence_weights[incident.recall_confidence]
        
        # Apply weight to all aggregations
        yield incident, weight
```

### Pattern 3: Data Source Attribution

Every data point entering the behavioral dossier carries metadata:

```python
class DataAttribution:
    reported_by: str          # caregiver_role
    occurred_at: datetime     # when the incident actually happened
    logged_at: datetime       # when it was entered into the system
    recall_confidence: str    # high/moderate/low/very_low
    source: str              # auto_extracted/manual/voice/daily_checkin
    context_flags: list[str]  # post_medication_change, post_stage_transition,
                             # post_relocation, holiday_period, etc.
    verified: bool           # caregiver confirmed extraction
    confidence_score: float  # extraction confidence (auto-extracted only)
```

The dossier builder applies weights and filters based on these attributes before injecting into the crisis prompt. This ensures the AI receives the most reliable, contextually appropriate data.

---

## Legal & Regulatory Implications

### Liability Framework

If a caregiver enters wrong data → AI gives guidance based on wrong data → harm results:

| Question | Analysis |
|----------|----------|
| Is "caregiver entered wrong data" a complete defense? | **No.** Courts examine whether reasonable safeguards were implemented (Sittig & Singh, 2010). |
| Does unintentional misreporting count as caregiver negligence? | **No.** A caregiver who genuinely believes the patient is early-stage is not at fault for not being a clinician. |
| What constitutes "reasonable safeguards"? | Behavioral-anchor staging (S-01a), consistency detection (S-01b), always-on delirium screening (S-02), periodic profile review (S-01d). |
| Does the medical disclaimer protect the app? | **Partially.** Courts give limited weight to ToS disclaimers when the app's design suggests clinical reliability and the user cannot evaluate data accuracy. |
| Could CalmGuide be classified as a medical device? | **Possibly.** FDA CDS exemption requires the software be intended for healthcare professionals to independently review. CalmGuide targets lay caregivers — weaker exemption claim. |

### Required Disclaimers

Every crisis response should include (per existing design, reinforced):

> "This guidance is based on information you provided about your loved one. It is not a medical diagnosis or treatment plan. If something seems different from usual or you're concerned, contact your healthcare provider."

### Documentation for Legal Defensibility

The safeguards above serve double duty — they improve care quality AND demonstrate that CalmGuide took reasonable steps to:
1. Help caregivers provide accurate data (behavioral anchors, periodic review)
2. Detect when data may be inaccurate (consistency checks, anomaly detection)
3. Catch dangerous misattributions regardless of data quality (always-on delirium screening)
4. Not amplify potential abuse (negative strategy tags, safety concern flagging)

---

## Summary: Safeguard Implementation Priority

### Phase 1 (Ship with incident memory MVP)

| ID | Safeguard | Edge Cases Addressed |
|----|-----------|---------------------|
| S-01a | Behavioral-anchor stage selection | EC-01 (wrong stage) |
| S-01b | Profile-crisis consistency detection | EC-01 (wrong data) |
| S-01c | Always-on acute change detection | EC-01, EC-02 (delirium) |
| S-02 | Profile-independent delirium screening | EC-02 (delirium) |
| S-03b | Negative strategy tag list | EC-03 (abuse) |
| S-04a | Tag and exclude safety-gate conversations | EC-04 (self-harm contamination) |
| S-08a | Raised pattern detection thresholds | EC-08 (false patterns) |
| S-09a | Tiered temporal model | EC-09 (data volume) |
| S-11a | Recall confidence flagging | EC-11 (retrospective logging) |
| S-12b | Language-neutral behavioral categories | EC-12 (language switching) |
| Pattern 1 | Conversation metadata tagging | Multiple |
| Pattern 2 | Temporal partitioning in insights | Multiple |
| Pattern 3 | Data source attribution | Multiple |

### Phase 2 (Fast follow)

| ID | Safeguard | Edge Cases Addressed |
|----|-----------|---------------------|
| S-01d | Periodic profile review (60-day) | EC-01, EC-06 |
| S-01e | Longitudinal anomaly detection | EC-01, EC-03, EC-07 |
| S-05a | Optional caregiver role | EC-05 (multi-caregiver) |
| S-05b | Context-aware strategy attribution | EC-05 |
| S-06a | Stage transition tracking | EC-06 |
| S-07a | Care change events | EC-07 (medication) |
| S-09b | Milestone incidents | EC-09 |
| S-10a | Persistent patient header (dual patients) | EC-10 |
| S-13a | NER scrubbing | EC-13 (third-party PII) |
| S-14b | Environmental context markers | EC-14 (seasonal) |

### Phase 3 (Roadmap)

| ID | Safeguard | Edge Cases Addressed |
|----|-----------|---------------------|
| S-01f | Caregiver wellbeing screening (PHQ-2) | EC-01 (depression distortion) |
| S-03a | Abuse indicator tagging pipeline | EC-03 |
| S-04b | Separate caregiver wellness tracking | EC-04 |
| S-05c | Per-role pattern computation | EC-05 |
| S-06d | Caregiver-prompted strategy review on transition | EC-06 |
| S-07c | Pre/post medication comparison | EC-07 |
| S-09c | Weekly digest compression | EC-09 |
| S-10b | Pre-crisis patient confirmation | EC-10 |
| S-14a | Seasonal context in insights | EC-14 |
| S-14c | Proactive seasonal prompt injection | EC-14 |
