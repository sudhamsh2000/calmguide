# CalmGuide — What It Is and Who It Is For

## The one-sentence version

CalmGuide is a multilingual AI "moment coach" for family caregivers of people
living with dementia. It gives structured, personalised guidance in the middle
of a hard moment, such as a parent trying to leave the house at 2 a.m., a spouse
who no longer recognises the caregiver, or a sudden burst of agitation.

## The user

- Family caregivers, typically 55–70 years old.
- Often alone, often at night, often exhausted, often holding a phone in one
  hand while the person they care for needs them.
- Frequently not native English speakers. CalmGuide ships in English, Spanish
  and Hindi.
- Also used in a B2B mode by care-facility staff (for example a night-shift
  nursing assistant alone with 12 residents).

The design team describes the target moment as "standing in a hallway at 3 a.m.
trying to figure out what to do about their parent right now." Every
architectural and UI decision is measured against that moment.

## What the caregiver gets

Each reply from the Moment Coach has exactly four parts, always in this order:

1. **Right Now (the first 60 seconds)**: two to four concrete actions,
   using the patient's own proven calming strategies by name.
2. **Why This Is Happening**: a plain-language explanation tied to the
   patient's disease stage (early, middle, late).
3. **What NOT To Do**: counter-intuitive mistakes, the instincts that feel
   helpful but make things worse (arguing with their reality, quizzing
   "don't you remember?", reasoning logically, rushing or grabbing).
4. **When To Call For Help**: specific, observable escalation criteria,
   never a vague "call if it gets worse."

## The surfaces

- **Web app** (Next.js), live at calmguide.vercel.app, in private testing behind
  an invite code.
- **Mobile app** (React Native / Expo, Android), with the same features.
- **Facility portal**: staff accounts, resident assignment, incident tracking
  and admin dashboards for care homes.

## Other features around the coach

- **Care Profile**: disease stage, behavioural patterns, calming strategies,
  and safety concerns for the person being cared for.
- **Learn Mode**: practice scenarios (sundowning, wandering, refusing to bathe,
  refusing medication, repetitive questions, caregiver burnout), used between
  crises.
- **Daily Check-In**: a one-tap log of how the day went ("calm", "mild" or
  "tough", plus the time of day), which feeds pattern detection.
- **Tonight's Outlook**: a warning card shown only when the person's episode
  cycle suggests a hard night is likely.
- **Feedback loop**: thumbs up or down plus strategy tags after each session.
  What worked is fed back into future prompts.
- **Read-aloud and voice input**: replies can be spoken in a natural neural
  voice, and the caregiver can dictate instead of typing.
- **Health Record Link (new)**: a Care Profile can be linked to the patient's
  electronic health record (OpenMRS), so the coach knows about recent fevers,
  conditions and medications. This is the subject of this update.

## Deployment in one table

| Layer | Where |
|---|---|
| Web app | Vercel |
| Backend API | FastAPI (Python) in Docker on Railway |
| Database | PostgreSQL 16 with pgvector, on Railway |
| Test health record system | OpenMRS 3.7.1 on Railway, reached over Railway's private network, holding only fictional demo patients |
| Mobile | Android APK with over-the-air JavaScript updates |
| AI models | OpenAI gpt-4o-mini by default (gpt-4o for Spanish and Hindi), switchable to Anthropic Claude |
