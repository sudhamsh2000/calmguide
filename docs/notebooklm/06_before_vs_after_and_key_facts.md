# Architecture Before vs After, and Key Facts

## Before (early September 2026)

```
message
  → identify patient
  → rewrite query to English (AI call)
  → search trusted guidance (RAG)
  → read CalmGuide memory (dossier, incidents, cross-patient)
  → build prompt
  → SAFETY CHECK  ← ran last: an emergency waited for all of the above
  → AI streams reply
  → response guard (language, respect)
```

Problems: an emergency message paid for retrieval, database reads and an extra
AI call before it was recognised. The coach also knew nothing about the
patient's medical situation.

## After (29 September 2026)

```
message
  → identify patient, language, country
  → SAFETY GATE v2  ← runs first
        EMERGENCY → fixed 911/112 message + red alert. STOP. (no AI, no record)
        HIGH      → acute-change advisory. STOP.
        MODERATE / LOW → continue
  → look up linked health record (only now)
  → IN PARALLEL (wait only for the slowest):
        ├─ trusted guidance search (RAG, top 3 of 231 chunks)
        ├─ CalmGuide memory of this patient
        └─ OpenMRS clinical summary (1.5 s budget, warm cache)
  → build prompt (safety rules + patient + guidance + record + 4-section format)
  → AI streams reply → read aloud sentence by sentence
  → response guard (language, respect, NEW: medication-dosing check) → repair if needed
  → background: save encrypted, tag, extract incident, refresh dossier
```

## Three layers of protection around the AI

1. **Before the AI**: Safety Gate v2 (deterministic regex, then a heuristic
   classifier, combined into one structured risk decision).
2. **Inside the AI's instructions**: seven non-negotiable principles, the
   clinical-record rules, handling for prompt injection and fiction-framed
   requests.
3. **After the AI**: the response guard (script, romanisation, disrespectful
   phrases, medication dosing), repair, then a safe fallback.

## Key numbers

| Fact | Value |
|---|---|
| Trusted source pages / chunks | 41 pages / 231 chunks |
| Sources | Alzheimer's Association, Mayo Clinic, CDC, caregiver.org, HelpGuide |
| Embedding model | OpenAI text-embedding-3-large (3,072 dimensions) |
| Retrieval | Hybrid meaning + keyword search, 9 candidates reranked to the top 3 |
| Chat models | gpt-4o-mini (English), gpt-4o (Spanish, Hindi); Anthropic Claude available |
| Reply length | 200–400 words, four fixed sections |
| Languages | English, Spanish, Hindi |
| Safety regression corpus | 117 fixed cases, plus a red-team harness |
| Backend automated tests | More than 1,800 |
| OpenMRS time budget per message | 1.5 s |
| Clinical cache | Fresh for 5 min, served while refreshing up to 24 h, background fetch up to 30 s |
| Clinical summary caps | 8 conditions, 10 medications, 6 allergies, 8 vital-sign series, 14-day window |
| Fever alert | 37.8 °C or higher within the last 3 days |
| Encryption | AES-256-GCM on every conversation, profile field, feedback item, check-in and health-record link |
| Cross-patient privacy | Groups of at least 5 families; only predefined strategy tags are shared |
| Web session timeout | 30 minutes idle, or 12 hours after sign-in |

## Glossary for the narrator

- **LLM**: large language model, the AI that writes the reply.
- **RAG (retrieval-augmented generation)**: looking up trusted documents first
  and giving them to the AI, so it answers from sources instead of memory.
- **Safety gate**: a deterministic filter (it behaves the same way every time)
  that runs before the AI.
- **FHIR R4**: the international standard for exchanging health records.
- **OpenMRS**: an open-source electronic medical record system.
- **Delirium**: a sudden, treatable confusion, often caused by infection. It is
  commonly mistaken for dementia getting worse.
- **Stale-while-revalidate**: serve the last known copy immediately while
  fetching a fresh one in the background.
- **SSE (Server-Sent Events)**: how the reply streams to the phone word by
  word.
- **k-anonymity**: aggregate data is only shared when enough people (here, 5)
  contribute, so no individual can be singled out.
