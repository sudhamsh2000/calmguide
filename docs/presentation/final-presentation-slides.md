# CalmGuide — Final Presentation (NotebookLM Slides)

**Format:** 10 slides + speaker notes | **Target:** 7:30 (buffer to 8:00 hard stop)
**Team:** Sharan, Sriram, Sudhamsh, Santhosh, Priya, Varun
**Rule:** No verbal handoffs. Next speaker starts talking when it's their part.
**Focus:** B2C core functionality. B2B mentioned briefly in Slide 6.
**Stage anxiety plan:** Sharan never speaks alone for more than 60 seconds. Priya opens Slide 1 to break the ice. Buddy seated next to Sharan for pickup if needed.

---

## NARRATIVE STRUCTURE

10 slides following a deliberate story arc. Each slide answers the question the previous one raises.
~1 slide per 45 seconds — the research-backed sweet spot for 8-minute presentations.

| # | Slide | Narrative Role | Audience Question | Arc | Density |
|---|-------|---------------|-------------------|-----|---------|
| 1 | The Human Story | **Hook** — feel the pain | "Why should I care?" | Emotion | Very low (1 quote + 3 lines) |
| 2 | The Scale | **Context** — how big is this | "How many people?" | Emotion | Low (4-5 stats) |
| 3 | The Pivot | **Honesty** — what we changed and why | "What did you do?" | Logic | Very low (3 lines) |
| 4 | What We Built | **Framework** — 3 modes + 4 deflections | "What does it do?" | Logic | Medium (short list) |
| 5 | Demo: Web | **Proof** — home screen + Moment Coach | "Does it work?" | Evidence | High (screenshots) |
| 6 | Demo: Mobile + Incident | **Proof** — mobile voice + incident logger | "Does it work on phone?" | Evidence | High (screenshots) |
| 7 | Memory Layer | **Differentiator** — behavioral dossier | "What makes this special?" | Depth | Medium (simple diagram) |
| 8 | Safety Architecture | **Trust** — 3-layer safety pipeline | "Is it safe?" | Trust | Medium (3-layer visual) |
| 9 | Tech Stack + Numbers | **Credibility** — architecture summary | "Is it real engineering?" | Trust | Low (5 key stats) |
| 10 | B2B + Lessons | **Maturity** — extension + reflection | "Did you learn anything?" | Wisdom | Low (6 one-liners) |

**The arc: Emotion -> Logic -> Evidence -> Depth -> Trust -> Wisdom**

Do not rearrange the slides. Each one sets up the next:
- Slides 1-2 create empathy -> Slides 3-4 channel it into a plan
- Slides 3-4 describe the plan -> Slides 5-6 prove it's real
- Slides 5-6 show the UI -> Slide 7 explains the intelligence behind it
- Slide 7 shows smart AI -> Slides 8-9 prove it's safe and well-built
- Slides 8-9 build technical trust -> Slide 10 closes with business thinking and humility

---

**Visual aids:** Mermaid diagrams available in `docs/mermaid/` — render as static images for slides:
- `b2c-user-flow.mmd` — full caregiver user flow (Slide 3)
- `coach-data-flow.mmd` — complete Moment Coach data pipeline (Slide 4)
- `safety-pipeline.mmd` — pre-LLM gate + post-LLM guard (Slide 5)
- `personalization-engine.mmd` — how the dossier feeds the prompt (Slide 4)
- `backend-architecture.mmd` — full system architecture (Slide 5)
- `encryption-privacy.mmd` — what's encrypted, hashed, never stored (Slide 5)

---

## SLIDE 1: The Human Story (0:30)
**Speaker: Priya Roy**
**Density: Very low — 1 quote, 3 short lines. Speaker IS the content.**

### Title: Who Is This For?

### On the slide:
> "New behaviors. No training. Not an emergency. Still scary."

- This isn't a 911 moment. But it still feels like an emergency.
- The helpline has a wait. Google gives you articles you can't read right now.
- You are alone.

### Image suggestion: A dimly lit hallway with a warm window glow. Watercolor style. Conveys solitude and quiet urgency. No people visible.

### Speaker Notes:
Priya opens the presentation. Reads the hook slowly: "New behaviors. No training. Not an emergency. Still scary." Pause 2 seconds. Then the supporting lines. This is emotional, not informational. Do NOT rush to the next slide.

---

## SLIDE 2: The Scale (0:45)
**Speaker: Sharan Karthikeyan**
**Density: Low — 4-5 stats with one anchor line.**

### Title: 24 Million Caregivers. No One to Call.

### On the slide:
- 24M Americans care for someone with dementia — 31 hrs/week unpaid
- 66% daughters, aged 45-64, balancing jobs and children
- 40% develop clinical depression
- Alzheimer's helpline: 800+ calls per day — demand is proven
- Every competitor: English-only or English-Spanish

**CalmGuide is built for family caregivers of dementia patients — untrained, stressed, often bilingual — during the thousands of tough moments between emergencies.**

### Image suggestion: A simple infographic-style visual showing "24M" prominently, or a map showing language coverage gaps.

### Speaker Notes:
Sharan: Stats land because Priya already set the emotional hook. The audience pictures the person, now they learn how many people are in that situation. End by reading the positioning statement exactly — it's the sentence that answers "who is this app for?"

---

## SLIDE 3: The Pivot (0:30)
**Speaker: Sharan Karthikeyan**
**Density: Very low — 3 lines. Evolution slide.**

### Title: From Crisis to Companion

### On the slide:
- Original scope: "Real-time crisis guidance" — too broad
- Prof. Carlson's feedback + our own research: life-threatening emergencies belong to 911
- Narrowed to where we can genuinely help: **the thousands of non-emergency moments where caregivers feel alone**

### Image suggestion: A simple visual showing "Crisis Guidance" evolving into "Journey Companion" — an arrow or transformation, not a crossed-out label.

### Speaker Notes:
Sharan: 3 sentences, maximum. "Our original scope was too broad — real-time crisis guidance. After Prof. Carlson's feedback and our own research, we narrowed to where we can genuinely help: the non-emergency moments between 911 calls where caregivers feel alone and uncertain." This slide should feel deliberate — a strategic decision, not an apology. Then move on.

---

## SLIDE 4: What We Built (0:45)
**Speaker: Priya Roy**
**Density: Medium — structured list, but brief.**

### Title: 3 Real Modes + 4 Honest Deflections

### On the slide:

**3 Modes We Built:**
- Learning — practice scenarios (5 categories)
- Moment Coach (flagship) — AI coaching for tough behavioral moments
- Coping — daily check-ins, emotional support

**4 Phases We Deflect To Humans:**
- Noticing changes -> Alzheimer's Association
- After diagnosis -> support groups + helpline
- Hospice -> end-of-life resources
- Bereavement -> grief resources + 988

**11 Languages | Web + Mobile**

### Image suggestion: A simple journey timeline showing 7 phases with 3 highlighted (modes) and 4 grayed out with arrows to external resources.

### Speaker Notes:
Priya: "We don't pretend to serve every phase of the journey. For four of the seven phases, we deflect to trusted human resources. That's a design choice, not a limitation." Mention 11 languages — "Every competitor is English-only. We serve bilingual caregivers in 11 languages."

---

## SLIDE 5: Demo — Home Screen + Moment Coach (0:50)
**Speaker: Sriram Ravichandran**
**Density: High — screenshots fill the slide. Minimal text.**

### Title: What a Caregiver Sees at 3 AM

### On the slide: 2 screenshots side by side

**Screenshot 1 — Home Screen:**
- Time-based greeting, patient card, Moment Coach CTA
- Pattern insights, journey navigation, verification cards

**Screenshot 2 — Moment Coach Response (4 sections):**
1. **Right Now** — patient-specific actions ("Try Sinatra on the kitchen speaker")
2. **Why This Is Happening** — plain-language explanation
3. **What NOT to Do** — instincts that backfire for THIS patient
4. **When to Escalate** — specific signs to call for help

### Speaker Notes:
Sriram: Point at screenshot 2. "Notice it says 'Try Sinatra on the kitchen speaker' — that's from this patient's profile, not generic advice. The AI remembers what worked last time." Then: "Right Now is always first because at 3 AM you need the action step, not the explanation. 200-400 words total."

---

## SLIDE 6: Demo — Mobile + Incident Logger (0:40)
**Speaker: Varun Pastaria**
**Density: High — screenshots fill the slide.**

### Title: Voice Input + Incident Logging

### On the slide: 2 screenshots

**Screenshot 1 — Mobile Moment Coach:**
- Voice input button visible (expo-speech-recognition)
- Same streaming 4-section response
- 11 languages with locale-aware voice

**Screenshot 2 — Incident Logger:**
- 4-level progressive disclosure (2 taps minimum)
- 8 behavior categories with large touch targets
- Auto-save at every level

### Speaker Notes:
Varun: "When your hands are shaking and you can't type, you speak. The app understands you in 11 languages and reads the guidance back to you." On the incident logger: "Designed for 3 AM — 2 taps to log the basics, auto-saves, you can add detail later."

---

## SLIDE 7: The Memory Layer (1:15)
**Speaker: Sri Sudhamsh Undavalli**
**Density: Medium — one simplified diagram + key points.**

### Title: AI Without Memory Is Like a New Doctor Every Visit

### Visual: Simplified 3-box flow diagram (NOT the full personalization-engine.mmd):
```
7 Data Sources -> Behavioral Dossier -> Injected into Every Prompt
```

### On the slide:

**7 data sources feed the AI:**
Profile | Auto-extracted incidents | Manual logs | Feedback | Check-ins | Care changes | RAG

**Behavioral Dossier (pre-computed per patient):**
- What NOT to do (with dates and evidence)
- What works (with success rates)
- Frequency trends + spike detection
- Delirium screening (7 questions) | Pain screening (5 questions)

**Cross-patient learning:** anonymized, k-anonymity (min 5 profiles)

### Image suggestion: A simple pipeline diagram with icons for each data source flowing into one "dossier" box, with an arrow to the LLM.

### Speaker Notes:
Sudhamsh: Open with the analogy: "If you go to a new doctor every time, you spend the visit explaining your history instead of getting help. That's what stateless AI does." Then walk the flow: "Data comes in from 7 sources, gets weighted by recency and confidence, pre-computed into a dossier, and injected into every prompt. The AI knows what worked, what didn't, and whether something sudden might be a medical issue like delirium."

---

## SLIDE 8: Safety Architecture (1:00)
**Speaker: Santhosh Kumar Kathiresan**
**Density: Medium — 3-layer visual with key details.**

### Title: Safety Is Architectural, Not Aspirational

### Visual: 3 stacked boxes (top to bottom):
```
Layer 1: PRE-LLM — Deterministic Gate (no AI involved)
Layer 2: IN-LLM — 7 Non-Negotiable Prompt Rules
Layer 3: POST-LLM — Response Guard + Auto-Repair
```

### On the slide:

**Layer 1 — Before the AI is ever called:**
- 27 life-threat patterns + 17 self-harm patterns
- 10 languages, locale-specific emergency numbers
- Deterministic. Testable. Court-defensible.

**Layer 2 — System prompt rules:**
- Never contradict reality. Never diagnose. Never restrain.
- Caregiver distress -> 988 | Elder abuse -> Eldercare Locator

**Layer 3 — After the AI responds:**
- Script validation, disrespect detection, auto-repair
- 33 fallback messages (3 modes x 11 languages)

### Image suggestion: The 3-layer diagram with red (Layer 1), yellow (Layer 2), green (Layer 3) color coding.

### Speaker Notes:
Santhosh: "Active lawsuits — Character.AI, OpenAI — involve AI chatbots and vulnerable users. Our users have a 40% depression rate. Prompt-only safety is what courts call insufficient." Walk through the 3 layers. Key phrase: "If someone types 'mom is not breathing,' Layer 1 fires in milliseconds — a 911 button, no AI generation, no hallucination risk. A Japanese caregiver sees 119, not 911."

---

## SLIDE 9: Technical Architecture (0:30)
**Speaker: Sharan Karthikeyan**
**Density: Low — 5 key stats. Speaker highlights, doesn't read.**

### Title: Under the Hood

### On the slide:
- **No PII in database** — patient name only in browser/device storage
- **AES-256-GCM** encryption on all narrative fields
- **LLM provider abstraction** — OpenAI default, Anthropic switchable
- **SSE streaming** with post-stream validation and correction
- **20 API routers | 14 models | 698 tests**

### Image suggestion: A simplified version of backend-architecture.mmd — just the major blocks (Clients -> FastAPI -> PostgreSQL -> LLM Providers) without internal detail.

### Speaker Notes:
Sharan: 30 seconds max. Don't read the list. Hit 3 points: "No patient names in the database — ever. Everything narrative is encrypted with AES-256-GCM. And we have 698 tests across the stack." Stop.

---

## SLIDE 10: B2B + What We Learned (1:15)
**Speaker: Priya Roy (0:15) -> Sharan Karthikeyan (1:00)**
**Density: Low — brief B2B mention, then 6 one-line lessons.**

### Title: Beyond B2C + Lessons Learned

### On the slide:

**B2B:** Same memory system extends to care facilities — 3 roles, 13 pages, 11 languages.
Family knowledge transfers when a patient enters a facility.

**What We Learned:**
1. Narrowing scope made us stronger.
2. Safety must be architecture, not aspiration.
3. AI without memory is just a chatbot.
4. 11 languages is a real moat.
5. Scope discipline matters — ship what you can defend.
6. User research should come first, not after the pivot.

### Image suggestion: None needed — clean text slide. The lessons speak for themselves.

### Speaker Notes:
Priya: One sentence on B2B: "We extended the same memory system to care facilities — a CNA on their first night shift sees what works and what to avoid for each resident." Then stop.
Sharan: These are your anchor points. Speak from experience, not memorization. End on: "CalmGuide walks with dementia families every day of the journey — and it's honest about when to hand off to a human." Stop. Don't say "thank you" or "any questions."

---

## TIMING SUMMARY

| Slide | Content | Speaker(s) | Time |
|-------|---------|------------|------|
| 1 | The Human Story | Priya | 0:30 |
| 2 | The Scale | Sharan | 0:45 |
| 3 | The Pivot | Sharan | 0:30 |
| 4 | What We Built | Priya | 0:45 |
| 5 | Demo: Web | Sriram | 0:50 |
| 6 | Demo: Mobile + Incidents | Varun | 0:40 |
| 7 | Memory Layer | Sudhamsh | 1:15 |
| 8 | Safety Architecture | Santhosh | 1:00 |
| 9 | Tech Stack | Sharan | 0:30 |
| 10 | B2B + Lessons | Priya -> Sharan | 1:15 |
| **Total** | | | **7:40** |

## SPEAKER TIME BREAKDOWN

| Speaker | Total Time | Slides | Max continuous |
|---------|-----------|--------|----------------|
| Sharan Karthikeyan | ~2:05 | 2, 3, 9, 10 (second half) | 1:00 (Slide 10) |
| Priya Roy | ~1:30 | 1, 4, 10 (first half) | 0:45 (Slide 4) |
| Sriram Ravichandran | ~0:50 | 5 | 0:50 |
| Varun Pastaria | ~0:40 | 6 | 0:40 |
| Sri Sudhamsh Undavalli | ~1:15 | 7 | 1:15 |
| Santhosh Kumar Kathiresan | ~1:00 | 8 | 1:00 |

**Sharan never speaks alone for more than 60 seconds. Priya opens the presentation (Slide 1). Sharan's longest stretch is the lessons in Slide 10. All 6 members speak.**

## STAGE ANXIETY MANAGEMENT

1. **Priya opens** — Sharan doesn't have to break the silence. By the time he speaks, the audience is already engaged.
2. **Sharan's longest solo stretch: 60 seconds** (Slide 6 lessons learned). These are 6 bullet points he lived through — speak from experience, not memorization.
3. **Anchor phrases, not scripts** — Sharan memorizes 3-4 key phrases per section, talks naturally around them:
   - Slide 2: "24 million... 3 AM... helpline 800 calls... bilingual underserved"
   - Slide 3: "Original scope too broad... narrowed to where we genuinely help... companion not crisis"
   - Slide 9: "No PII... AES-256... 20 routers, 698 tests"
   - Slide 10: "Narrowing made us stronger... safety is architecture... memory not chatbot"
4. **Point at the screen** — when showing diagrams or screenshots, gesture at them. Shifts audience attention from you to the visual.
5. **Buddy system** — Priya or Sriram seated next to Sharan. If he freezes, they pick up the next bullet naturally. No "are you okay?" — just continue.
6. **Practice transitions** — rehearse the exact moment where one speaker stops and the next starts. Do each transition 5 times. Make it muscle memory.
7. **One breath between slides** — panic speeds you up. One deliberate inhale before starting each section.

## SCREENSHOTS TO CAPTURE

Take these from the running app before the presentation:

1. **Home screen** (web) — patient card, Moment Coach CTA, pattern insights, journey grid, verification card
2. **Moment Coach streaming response** (web) — all 4 sections visible, patient-specific strategies highlighted
3. **Incident logger** (web) — Level 1 behavior category grid with large touch targets
4. **Mobile Moment Coach** — phone screen with voice input button visible
5. **Safety gate 911 deflection** — type "mom is not breathing" to trigger deterministic gate
6. **Journey deflection page** — one of the 4 (e.g., bereavement with 988 link)
7. **CNA "My Residents Tonight"** (web) — behavioral cards with risk badges (brief B2B reference)

## DIAGRAMS TO RENDER AS IMAGES

Render these mermaid diagrams as static PNG/SVG for slides:

1. `docs/mermaid/safety-pipeline.mmd` — for Slide 5 (3-layer safety architecture)
2. `docs/mermaid/personalization-engine.mmd` — for Slide 4 (how data feeds the AI)
3. `docs/mermaid/coach-data-flow.mmd` — for Slide 4 (full Moment Coach pipeline, optional)
4. `docs/mermaid/encryption-privacy.mmd` — for Slide 5 (what's encrypted vs. never stored, optional)

**Render command:** `npx -p @mermaid-js/mermaid-cli mmdc -i docs/mermaid/safety-pipeline.mmd -o docs/presentation/safety-pipeline.png -t dark`

---

## Q&A PREP (If Professor Allows 1-2 Questions)

**Assign Q&A by topic so Sharan doesn't have to answer everything:**

| Topic | Answerer |
|-------|----------|
| Safety / compliance | Santhosh |
| Moment Coach / streaming UI | Sriram |
| Mobile / voice | Varun |
| Memory / dossier / RAG | Sudhamsh |
| Design / UX / languages | Priya |
| Architecture / pivot / business | Sharan |

**Likely questions and prepared answers:**

**Q: How do you handle hallucinations / wrong advice?**
Answerer: Santhosh
A: Three layers. (1) Deterministic safety gates catch life-threats before the LLM is called. (2) System prompt has 7 non-negotiable rules including "never fabricate." (3) Response guard validates output post-generation and repairs if needed. Plus RAG grounds responses in Alzheimer's Association content.

**Q: What about HIPAA / privacy?**
Answerer: Sharan
A: No patient PII in the database — patient name stored only in browser localStorage, never sent to the server for storage. All narrative fields encrypted with AES-256-GCM. Access codes are SHA-256 hashed. B2B has full audit logging of every data access event.

**Q: How is this different from just asking ChatGPT?**
Answerer: Sudhamsh
A: Three things ChatGPT can't do: (1) Remember your specific patient's behavioral patterns and what worked last time — our behavioral dossier injects this into every prompt. (2) Screen for delirium or pain based on incident frequency trends. (3) Respond in 11 languages with locale-specific emergency numbers and deterministic safety gates that fire before the AI.

**Q: What would you do differently?**
Answerer: Priya
A: User research earlier. We built the entire product on desk research. The caregiver interviews should have happened in month 1, not after the pivot. Every design assumption we made is untested against real caregivers.

**Q: Does the B2B product work?**
Answerer: Sharan
A: Fully built — 13 web pages, 13 mobile screens, 3 roles, JWT auth, audit logging, staff management, trends analytics. Demo data includes 1 facility with 10 staff, 6 residents, and 24 incidents. Ready for a pilot deployment.

**Q: What's your competitive moat?**
Answerer: Priya
A: 11 languages. No competitor has multilingual AI + journey-spanning + behavioral memory + family-facing. The Alzheimer's Association helpline is English/Spanish only and gets 800+ calls per day — proving there's demand we can serve in 9 more languages.

**Q: How does the voice input work on mobile?**
Answerer: Varun
A: expo-speech-recognition for input, expo-speech for output. Locale-aware — it detects the user's language and processes speech in that language. We built a custom SSE streaming client because React Native's fetch API doesn't handle streaming reliably.

**Q: How do you handle the system prompt getting too long?**
Answerer: Sudhamsh
A: Token budget is managed. The full prompt with all context layers is approximately 5,600-8,100 input tokens. We use temporal weighting to keep only relevant incident data, and the dossier is pre-computed so we inject a summary, not raw incidents. Max generation is 4,096 tokens.
