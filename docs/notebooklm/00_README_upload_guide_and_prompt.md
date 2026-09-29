# NotebookLM Pack — CalmGuide Architecture Update (29 Sep 2026)

## Upload these as sources

Core (from this folder):
1. `01_what_is_calmguide.md`: product, users, features
2. `02_how_a_coach_reply_is_built.md`: step-by-step pipeline, with a worked example
3. `03_the_new_update_health_record_link.md`: the OpenMRS update in depth
4. `04_why_not_just_chatgpt.md`: comparison with general chatbots, and honesty notes
5. `05_the_ui.md`: UI walkthrough
6. `06_before_vs_after_and_key_facts.md`: before/after flow, numbers, glossary
7. `07_coach_prompt_template.txt`: the real system prompt, as evidence

Supporting (from the repo):
8. `docs/SAFETY_ARCHITECTURE.md`: the two-layer safety design and its caveats
9. `docs/CalmGuide_Safety_Gate_v2_Sprint_Report.pdf`: the safety-first reordering
10. Optional: 4–6 screenshots (Home sphere, Moment Coach reply, red emergency
    alert, Care Profile → Connected services → "Link to Frank?").

**Don't upload** `ARCHITECTURE.md`'s top-level data flow,
`CalmGuide_Architecture_Overview.pdf` (9 Sep) or `docs/mermaid/coach-data-flow.mmd`.
They show the old order, where safety ran last, and will confuse the video.

## Video Overview prompt (paste into "Customize")

See the chat reply, or copy from below.

---

Create an explainer video about CalmGuide's newest architecture update, for an
audience of healthcare partners, clinicians and non-technical stakeholders
(the Leap of Faith / LOF review team). Target length: 8–10 minutes.

Structure it in this order:

1. **The moment (hook).** Open on a caregiver at 3 a.m.: "Dad is suddenly much
   more confused tonight and keeps getting up to use the bathroom." Explain
   who CalmGuide serves (family caregivers of people with dementia, often aged
   55–70, alone, at night, in English, Spanish or Hindi).
2. **What CalmGuide gives them.** The four-part reply: Right Now, Why This Is
   Happening, What NOT To Do, When To Call For Help.
3. **How one reply is built.** Walk through the pipeline in order: identify
   the patient without storing their name → Safety Gate v2 runs FIRST
   (emergencies get a fixed 911/112 answer and a red alert with no AI
   involved) → only then look up the linked health record → fetch three
   things in parallel (trusted Alzheimer's Association / Mayo / CDC guidance,
   CalmGuide's memory of this patient, and the OpenMRS clinical summary) →
   build the prompt → stream the reply → check it after writing → learn in
   the background. Stress the before/after: safety used to run last.
4. **The new update: the health-record link.** Explain OpenMRS and FHIR
   simply. Show how Frank Kowalski's (fictional) record, with a fever
   yesterday and a history of urinary tract infections, changes the answer:
   "Call Frank's doctor today. He had a fever yesterday and has had urine
   infections before; a sudden change like this can be a sign of infection."
   Explain why this matters: delirium is treatable and often mistaken for
   dementia getting worse. Cover the five design rules: safety never waits on
   the record; a 1.5-second budget; a warm stale-while-revalidate cache
   (OpenMRS is slow); summarise, never dump (no names, no doses); the record
   informs escalation and never gives medical advice, backed by a
   medication-dosing check after each reply.
5. **Why not just use ChatGPT?** Contrast a general chatbot with a
   purpose-built one: deterministic where it must be, generative where it
   helps. Use the comparison table: emergency handling, patient memory,
   medical context, trusted sources, fixed format, medication guardrails,
   privacy, fallback behaviour.
6. **The UI.** Calm-not-clinical design; the breathing Moment Coach sphere
   ("listening, not working"); the four colour-coded reply cards; read-aloud
   sentence by sentence as the reply streams; the red emergency alert with a
   soft two-pulse tone instead of a siren, and why; the "Link to Frank?"
   confirmation in Care Profile.
7. **Honest limits and next steps.** Not a medical device and doesn't
   diagnose. Safety metrics come from an engineering-written test set.
   Clinician verification with LOF is next. The benchmark against ChatGPT,
   Claude and Gemini is planned, not done. The cache is single-server. Only
   one clinical alert (fever) exists today. Demos are in the first week of
   October.

Tone: warm, clear and credible, with no hype. Explain every technical term
the first time it appears (LLM, RAG, FHIR, delirium). Use diagrams for the
pipeline and the before/after flow. Do not claim clinical validation or
measured superiority over other chatbots; present differences as design
choices. Keep all patient examples fictional (Frank Kowalski).
