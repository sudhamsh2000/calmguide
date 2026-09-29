# How One Moment Coach Reply Is Built, Step by Step

This walks through what happens between a caregiver tapping "Get Guidance" and
the reply appearing and being read aloud. The code lives in
`backend/app/routers/coach.py`, function `coach_chat`.

Worked example used throughout: the caregiver types
**"Dad is suddenly much more confused tonight and keeps getting up to use the bathroom."**
The patient is Frank Kowalski, a fictional demo patient: middle-stage
Alzheimer's, a Korean War veteran with PTSD, and a history of urinary tract
infections.

---

## Step 1 — Identify the patient, without storing who they are

- A family caregiver sends an 8-character **access code**. The server stores
  only a SHA-256 hash of it. Facility staff instead send a patient ID along
  with a signed login token, and the server checks that this staff member is
  allowed to see this resident.
- The patient's **name** travels with the request so the AI can use it, but it
  is never written to the database. It lives only in the caregiver's browser.
- The Care Profile (stage, behaviours, calming strategies, safety concerns) is
  loaded. All of those fields are encrypted at rest with AES-256-GCM.

## Step 2 — Work out language and country

The app's locale decides three things: the language of the answer (English,
Spanish or Hindi), which model is used (gpt-4o for non-English), and which
emergency number is shown (911, or 112 for India, and so on). A caregiver in
France gets an English answer that still tells them to call 15 or 112.

## Step 3 — Safety Gate v2, run BEFORE anything else

This is the most important architectural change of the last month.

- A **deterministic regex gate** checks the raw message for life-threat,
  self-harm, caregiver-harm-risk, and elder-abuse or neglect signals, in every
  supported language regardless of the app's language setting.
- If the gate stays silent, a **heuristic fallback classifier** looks for
  paraphrases and typos ("hart attak").
- The two outputs are combined into one structured **SafetyDecision**:
  a risk level (LOW, MODERATE, HIGH or EMERGENCY), a fine category (breathing,
  consciousness, fall or head injury, acute change, medication risk, and
  others), and an action.
- **EMERGENCY** (for example "he's not breathing"): the AI is never called.
  A fixed, pre-written escalation message is streamed back, and the app shows a
  full-screen red alert with the local emergency number.
- **HIGH** (a sudden acute change): also no AI. The caregiver gets the
  acute-change advisory message.
- **MODERATE** (a medication concern): continues to the AI, whose instructions
  forbid any medication advice.
- **LOW**: normal path.

Before this change, safety ran *last*, after document retrieval, database
reads and prompt building. An emergency message had to wait for all of that
work first. Now an emergency is answered before any of it starts.

In our example, "suddenly much more confused" is a concerning change but not
a 911 message. It is allowed through to the AI.

## Step 4 — Find the linked health record (new)

Only now, after the safety gate has said "the AI may answer", does the server
check whether this Care Profile is linked to an OpenMRS health record. The
linked patient ID is stored encrypted. **An emergency message never gets this
far**, so a slow health-record system can never delay a 911 prompt.

## Step 5 — Gather three kinds of context at the same time

Three jobs run in parallel with `asyncio.gather`, so the caregiver waits only
as long as the slowest one, not the sum of all three:

1. **Trusted guidance (RAG).** The message is rewritten into an English search
   query if needed. It is then searched against 231 chunks from 41 pages
   published by the Alzheimer's Association, Mayo Clinic, the CDC,
   caregiver.org and HelpGuide. The search is hybrid: it combines meaning-based
   vector similarity with keyword matching. The top 3 passages are kept.
2. **CalmGuide's own memory of this patient.** This includes a behavioural
   dossier, past incidents similar to this one, interventions that worked,
   interventions that made things worse (marked contraindicated), weekly
   frequency trends, delirium and pain screening flags, any recent change in
   care, and anonymised "what worked for similar patients" strategies. Those
   come from groups of at least 5 families and are shown in random order so
   the AI doesn't lock onto one favourite.
3. **The clinical record summary (new).** This is a short summary of the
   OpenMRS record with no personal identifiers. It covers active conditions,
   current medications (name and frequency, never doses), allergies, and
   whitelisted vital signs from the last 14 days, plus plain-language alerts
   such as "Fever: 38.1 °C yesterday". It has a 1.5-second budget and is
   usually served instantly from a warm cache.

## Step 6 — Build the instructions for the AI

A Jinja2 template (`coach_system.jinja2`) assembles:

- seven non-negotiable safety principles (never contradict the patient's
  reality, never give medical or medication advice, never suggest restraint,
  never make things up, always use the patient's name, always lead with their
  own proven strategies, always give specific escalation criteria);
- the patient context and the three blocks of retrieved context;
- the strict four-section output format with machine-readable section markers;
- tone rules ("speak as if to a tired, scared family member at 3 a.m.",
  200–400 words, short sentences, no jargon, never say "just");
- instructions for caregiver distress, elder abuse, off-topic questions and
  prompt-injection attempts;
- when a health record is linked, a specific rule for the "When To Call For
  Help" section (see step 7).

## Step 7 — What the health record changes in the answer

If the caregiver describes a *new or sudden* change and something in the record
could explain it, the first bullet of "When To Call For Help" must start with
"Call Frank's doctor today" and name the actual finding in plain words. For
example:

> Call Frank's doctor today. Frank had a fever of 38.1 °C yesterday and has had
> urine infections before, and a sudden change like this can be a sign of
> infection.

The AI is told to treat the record as background: don't recite it, never
diagnose, and never touch medications.

## Step 8 — Stream the answer, then check it

- The reply streams to the phone word by word over Server-Sent Events.
- When it finishes, a **response guard** checks it. The guard looks for:
  - the wrong script or romanised Hindi;
  - disrespectful phrases ("burden", "control him", and similar);
  - **new: any sentence that pairs one of the patient's listed medications
    with dosing language**, such as "give Frank an extra 5 mg of donepezil".
- If a check fails, the AI is asked to repair the reply and the phone swaps in
  the corrected text. If the repair also fails, a safe pre-written fallback is
  shown. If the AI provider goes down mid-reply, the same fallback replaces the
  partial text so the caregiver is never left with nothing.

## Step 9 — Learn from the session, in the background

After the reply is complete, a background task saves the encrypted
conversation, generates strategy tags, extracts a structured incident, and
marks the dossier for refresh. None of this delays the caregiver.

---

## The whole flow on one line

message → identify patient → language → **Safety Gate v2** (emergency? answer
now, stop) → read health-record link → **in parallel:** trusted guidance +
CalmGuide memory + OpenMRS summary → build prompt → AI streams reply →
response guard (language, respect, medication dosing) → background learning
