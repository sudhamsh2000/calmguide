# Why Not Just Use ChatGPT, Claude or Gemini? How CalmGuide Differs From a General Chatbot

CalmGuide uses the same kind of large language model (LLM) as ChatGPT, and its
provider can be switched between OpenAI and Anthropic. The difference is not a
smarter model. It is everything built **around** the model, designed for one
situation: a frightened caregiver, a person with dementia, a moment that
matters.

A useful way to say it: *a general chatbot is a brilliant stranger. CalmGuide
is a trained companion that already knows your dad, checks for danger before it
speaks, and only draws on trusted dementia-care sources.*

## Side-by-side

| | General chatbot (ChatGPT, Gemini, Claude app) | CalmGuide |
|---|---|---|
| **Emergency handling** | The model decides for itself, in free text, whether something is an emergency. The result can vary from one attempt to the next. | A deterministic safety gate runs **before** the AI. "He's not breathing" never reaches the AI. It gets a fixed, pre-written 911 or 112 response and a full-screen red alert, every time. |
| **Knows the patient** | Only what you type into this chat. You start from zero at 3 a.m. | Loads the Care Profile, the calming strategies that worked for *this* person, past incidents, what made things worse, weekly trends, and (new) their health record. |
| **Knows the medical context** | No. It can't see that he had a fever yesterday. | With a linked OpenMRS record, it knows recent vitals, conditions and allergies, and turns them into "call the doctor today because…". |
| **Source of advice** | Whatever the model learned from the whole internet. | Grounded in 41 pages from the Alzheimer's Association, Mayo Clinic, CDC, caregiver.org and HelpGuide, retrieved fresh for each question. |
| **Answer shape** | Long, variable, often a wall of text with caveats. | Always the same four sections: Right Now, Why, What NOT To Do, When To Call For Help. 200–400 words, readable in a hallway. |
| **Medication questions** | May discuss doses or suggest changes. | Forbidden by the prompt, and a post-reply check catches any sentence that pairs the patient's medication with dosing language and repairs it. |
| **Tone** | Neutral assistant. | Written for a tired, scared family member: short sentences, no jargon, never "just", never blames the caregiver. |
| **Dementia-specific rules** | Might tell you to gently correct a false belief. | Hard rules: never contradict the patient's reality, never suggest restraint, never quiz "don't you remember?". |
| **"What not to do"** | Rarely offered. | A dedicated section of counter-intuitive mistakes, the instincts that make things worse. |
| **Learns what works** | No memory of outcomes. | Thumbs up or down and strategy tags feed a pattern engine. Anonymised "what worked for similar patients" data (from groups of at least 5 families) is fed back into prompts. |
| **Predicts hard nights** | No. | Detects episode cycles from sessions and check-ins and shows a "Tonight may need extra care" card. |
| **Languages** | Many, with variable quality. | Three, done properly: English, Spanish, Hindi. A response guard rejects wrong-script or romanised output and repairs it. Emergency numbers match the country. |
| **Privacy** | Conversations may be retained and used by the provider under its own policy. | Patient names never leave the browser. Everything stored is encrypted with AES-256-GCM. The access code is stored only as a hash. One tap erases everything. |
| **If the AI fails** | You get an error message. | The caregiver gets a safe, localised fallback message. They are never left with a blank screen. |
| **Voice** | Available in some apps. | Built for one hand in the dark: dictation that auto-submits, and replies read aloud sentence by sentence as they stream. |

## The architectural idea in one line

**Deterministic where it must be, generative where it helps.**

- Deterministic (rules that behave the same every time and can be tested):
  emergency detection, escalation messages, the four-section format, stripping
  medication doses from the record, the medication-dosing check, language and
  script checks, privacy.
- Generative (the AI): the warm, personalised, situation-specific wording of
  the actual guidance.

A general chatbot is generative everywhere, including in the places where a
wrong answer can hurt someone.

## Why "purpose-built" matters for this moment

- **Time**: an emergency is answered before any AI work starts, and the three
  context sources are fetched in parallel. Replies stream immediately, and
  read-aloud starts on the first sentence.
- **Cognitive load**: one button, one input box, four predictable sections.
- **Trust**: every safety behaviour is backed by tests. The backend has more
  than 1,800 automated tests, including a fixed 117-case safety regression
  set and a red-team harness.
- **Escalation**: the health-record link helps catch treatable causes such as
  infection. Delirium is frequently missed at home, and this is exactly where
  "call the doctor today" matters.

## Honesty note (important for the video)

- These are **design differences**, not measured outcomes. A head-to-head
  benchmark of CalmGuide against ChatGPT, Claude and Gemini, using
  Alzheimer's Association guidance as the reference, is assigned but has not
  been run yet.
- The safety gate's numbers come from an engineering-written test set, not a
  clinically validated one. Clinician verification of scenarios is planned
  with LOF.
- CalmGuide is not a medical device and does not diagnose. It tells caregivers
  when and how urgently to contact a professional.
