# CalmGuide — Milestone 3 Report

**Date:** 2026-09-03
**Prepared for:** Milestone 3 / Gate 3 submission

---

## 1. Executive Summary

CalmGuide is a multilingual (English, Spanish, Hindi) AI companion for dementia caregivers, delivering structured, safety-screened guidance through a web app, a native mobile app (Android/iOS via Expo), and a FastAPI backend with a Postgres + pgvector retrieval layer. Since the last milestone, the project moved from a shared/third-party-hosted backend to fully independent infrastructure under the team's own accounts, closed out a round of voice-interaction and UX defects, and stood up an over-the-air mobile update pipeline so future fixes reach installed devices without a new APK.

### What CalmGuide does

A family caregiver signs in with a private access code (no public sign-up; codes are issued per care profile) and gets two core tools:

- **Moment Coach** — describe what's happening in the moment, by typing or speaking, and receive structured guidance broken into "Right Now" (immediate steps), "Why This May Be Happening," "When To Get More Help," and "What Not To Do." Every input passes through a deterministic safety check *before* it reaches the AI model — a message indicating crisis or self-harm risk is routed straight to emergency resources (911, the 988 Crisis Lifeline, the Alzheimer's Association Helpline) rather than to the AI.
- **Daily Check-in** — a lighter-weight, reflective prompt for the caregiver's own wellbeing, not just the care recipient's — also safety-screened the same way.

Guidance is personalized against a **care profile** (disease stage, known behavioral patterns, calming strategies that have worked before, safety concerns) that the caregiver builds during setup, and responses can pull relevant context from a retrieval layer (see §3) grounded in dementia-care reference material rather than relying on the AI model's training data alone.

---

## 2. What Shipped This Milestone

### 2.1 Independent infrastructure (new this milestone)

Previously the app ran against a backend (`cgapi.trybabble.io`) hosted by a collaborator, outside the team's control. This milestone moved to fully owned infrastructure:

| Layer | Before | Now |
|---|---|---|
| Frontend | — | **Vercel**, auto-deploys from `main` |
| Backend | Collaborator-hosted (`cgapi.trybabble.io`) | **Railway** (Docker), own account |
| Database | Collaborator-hosted | **Railway Postgres**, own instance |
| Mobile backend URL | `cgapi.trybabble.io` | `calmguide-production.up.railway.app` |

Getting there involved evaluating and ruling out several hosting options (Oracle Cloud's free-tier Ampere shape was blocked by persistent regional capacity exhaustion across all three availability domains; Fly.io and Cloudflare Workers were considered) before landing on Vercel + Railway as the fastest path to a fully self-owned, zero-cost stack.

### 2.2 Voice interaction fixes

Voice is a core interaction mode for this product (caregivers using it one-handed, at night, under stress), so this milestone included a focused pass on it:

- **Double-speak bug**: every AI response using the neural voice was read aloud twice — once correctly, then again in the browser's robotic fallback voice. Root cause: cleanup code cleared the `<audio>` element's `src`, which itself fires the element's `error` event, which was wired to trigger the fallback path. Fixed by detaching handlers before cleanup.
- **Silent voice-input failures**: tapping the mic and speaking produced no feedback at all when recognition failed (no on-device speech service, permission denied, network error). Added user-facing error messages mapped to each failure mode.
- **Auto-speak replies**: new persisted setting (Profile → Voice, both web and mobile) so AI replies are read aloud automatically without tapping the speaker button each time.
- **Voice auto-submit**: finishing a spoken message now submits it automatically — previously required an extra manual tap after dictation, across Moment Coach, its footer input, Daily Check-in, and Learn scenario practice.
- **TTS pacing**: the neural voice's "calm, unhurried" delivery read as sluggish rather than calm; nudged the synthesis speed up (1.0x → 1.15x) while keeping the warm tone.

### 2.3 Other UX fixes

- Check-in responses were rendering raw Markdown syntax (`##`, `**`) as literal characters instead of formatted text — brought it onto the same sanitized-Markdown renderer Moment Coach already used.
- The header's Sign Out icon appeared even before a session existed (e.g. on the "Enter Access Code" screen), sitting right next to the code-entry flow — a caregiver tapping near it would land on a sign-out confirmation instead. Now hidden until a session is actually present.
- Mobile signup 403 (missing invite-code step) and an EmergencyBar layout overlap were fixed.

### 2.4 Mobile OTA update pipeline (new this milestone)

Previously every fix — no matter how small — required a full native rebuild and manual reinstall of the app's installable package (an APK, Android's equivalent of an .exe installer). This milestone wired up **EAS Update** (Expo Application Services' over-the-air update system): JS/UI-level changes now push to installed devices automatically on next app launch, the same way a web page reloads with the latest version, no rebuild or reinstall needed. Native-level changes (new native modules, permissions, app icon) still require a rebuild, but that's now the exception rather than the norm.

Setting this up surfaced and fixed a corrupted local Android NDK installation (a casualty of an earlier disk-space incident) that was silently breaking native builds.

---

## 3. Architecture

Full detail in [`ARCHITECTURE.md`](../ARCHITECTURE.md). Summary:

- **Frontend**: Next.js 16 (App Router), next-intl for i18n, deployed on Vercel
- **Mobile**: Expo/React Native (expo-router), EAS Build + EAS Update, targets Android and iOS
- **Backend**: FastAPI (Python), deployed on Railway via Docker
- **Database**: PostgreSQL, extended with **pgvector** (a similarity-search extension) to power **RAG** — Retrieval-Augmented Generation, where relevant reference passages are fetched from a knowledge base and given to the AI model as grounding context alongside the caregiver's message, rather than the model answering from training data alone
- **AI model**: OpenAI (chat completions for Moment Coach/Check-in text responses, plus `gpt-4o-mini-tts` for the neural read-aloud voice)
- **Safety**: a deterministic, rule-based safety check runs on every caregiver message *before* it ever reaches the AI model — this is what routes crisis/self-harm language straight to emergency resources instead of an AI response. A second layer of response-quality guardrails then screens the AI's own output (language/script checks, disrespectful-language filters, known-bad-phrase detection) before it's shown to the caregiver. Full detail in [`docs/SAFETY_ARCHITECTURE.md`](SAFETY_ARCHITECTURE.md)

---

## 4. Testing

| Suite | Count |
|---|---|
| Frontend (Vitest) | 282 test cases across 33 files — all passing |
| Backend (pytest) | 63 test files |
| Mobile (Jest) | 6 test files |

Frontend test suite was run and confirmed green after every change this milestone (type-check + full suite, not spot-checked).

---

## 5. Known Limitations

See [`docs/DEFERRED.md`](DEFERRED.md) for the full, actively-maintained list of features designed but intentionally deferred (push notifications, SMS alerts, day-of-week pattern detection, etc.), each with rationale and conditions for building.

Additional limitations surfaced this milestone:

- **RAG retrieval logged as unavailable in production** (`RAG: unavailable — Connection refused`) during backend testing — the retrieval service dependency isn't yet deployed alongside the Railway backend. Coach responses currently fall back to the base LLM without the retrieval-augmented context. Needs follow-up before the next milestone.
- **Mobile test coverage** is thin (6 files) relative to the frontend's 282 — native-side behavior (voice, notifications, OTA update handling) is largely unverified by automated tests today.

### Android-only, by deliberate choice, not oversight

This milestone shipped Android only. iOS distribution requires an Apple Developer Program account, which needs its own registration and a $99/year payment — a business decision outside the scope of engineering work, and not something to commit to speculatively. The infrastructure is otherwise iOS-ready: the app is built with Expo/React Native, which targets both platforms from the same codebase, and EAS Build/EAS Update both already support iOS in configuration (`eas.json`'s `ios` blocks exist, just with placeholder credentials pending an account). Once an Apple Developer account exists, standing up an iOS pilot build is expected to be a short, low-risk task — not a rebuild.

### Honesty on current state

This is a working, deployed system, not a finished one. Bugs have been found and fixed continuously through this milestone (see §2.2–2.3), and more are expected to surface with real caregiver use — voice interaction in particular (across devices, accents, and background noise) is the highest-risk surface for undiscovered issues. Ongoing testing and bug-fixing is active and expected to continue past this submission.

---

## 6. Third-Party Services & Sources

Everything CalmGuide runs on, across backend, frontend, and mobile:

| Service | Used for | Tier |
|---|---|---|
| **Vercel** | Frontend hosting (Next.js), auto-deploy from GitHub | Free (Hobby) |
| **Railway** | Backend hosting (FastAPI, Docker) + PostgreSQL database | Free trial credit |
| **OpenAI** | LLM chat completions (Moment Coach, Check-in) and neural text-to-speech (`gpt-4o-mini-tts`) | Pay-as-you-go, team's own API key |
| **Expo / EAS** | Mobile build pipeline (EAS Build) and over-the-air update delivery (EAS Update) | Free tier |
| **GitHub** | Source control, CI trigger for Vercel/Railway deploys | Free |
| **pgvector** (Postgres extension) | Vector similarity search for RAG retrieval | Self-hosted on Railway Postgres |

No infrastructure runs on shared or third-party-controlled accounts as of this milestone — see §2.1 for the migration off the previously collaborator-hosted backend.

---

## 8. Addendum — 2026-09-07: Safety Fix and RAG Reconnection

This addendum covers two significant, safety-relevant fixes made after this
report's original writing (2026-09-03). Both are described here because they
directly affect claims made in §2 and §5 above.

### 8.1 Safety-classifier false positive: ordinary caregiver question routed to crisis response

§3 of this report describes a deterministic safety check that runs on every
message before it reaches the AI model, and routes anything indicating
crisis or self-harm risk straight to emergency resources instead of an AI
answer. Behind that deterministic check sits a second, fallback layer — a
heuristic classifier — that catches paraphrases the deterministic check
might miss (see [`docs/SAFETY_ARCHITECTURE.md`](SAFETY_ARCHITECTURE.md) for
the full two-layer design).

A defect in that fallback layer caused a completely ordinary Moment Coach
question — "he keeps wandering at night and I don't know what to do" — to be
misclassified as expressing suicidal ideation and routed to the crisis
fallback instead of an actual answer. The cause was a text-similarity
comparison that scored the substring "what to do" as highly similar to the
self-harm phrase "want to die" purely because the two share most of the same
letters, despite meaning opposite things. "I don't know what to do" is one
of the most common things a caregiver says, so this was a real, likely
frequent, production-impacting defect, not an edge case.

The fix adds a word-level check ahead of the existing letter-similarity
comparison: before two phrases are allowed to be scored as similar, every
meaningful word in the safety-concept phrase must have a plausible match
among the actual words in the caregiver's message. "want" and "die" have no
such match in "what to do," so that comparison is now skipped entirely,
while genuine paraphrases and typos ("hart attak" for "heart attack") still
match as before. The fix was verified against the project's red-team safety
test suite (a set of engineering-authored test messages built to probe this
exact kind of failure) with zero false positives and no loss of detection
sensitivity, and against the full backend test suite (1,572 tests passing).
The specific message that triggered the original defect was added
permanently to that test suite so this exact failure cannot silently
reappear. Full technical detail in
[`docs/SAFETY_ARCHITECTURE.md`](SAFETY_ARCHITECTURE.md) §3.

### 8.2 RAG retrieval reconnected

§5 of this report flagged, as a known limitation, that RAG retrieval was
logging as unavailable in production and Coach responses were falling back
to the base LLM without retrieval-augmented context — needing follow-up
before the next milestone. That follow-up has happened: the retrieval
pipeline is now connected to and populated against the Railway database
(41 pages, 231 chunks from Alzheimer's Association, Mayo Clinic, and other
trusted sources), and Moment Coach responses are grounded in that reference
material again. The root cause was that the infrastructure migration
described in §2.1 left the retrieval service pointed at a default/localhost
database configuration rather than the new Railway instance, so it silently
had nothing to query.

### 8.3 Data-quality fix: behavioral insights surfacing the patient's name

Also fixed since this report was originally written: the `/api/insights`
endpoint's "top behavioral triggers" list was surfacing the patient's own
name (typed naturally by the caregiver in nearly every message) and generic
filler words ("should," "keeps") as if they were behavioral triggers.
Showing a caregiver their own loved one's name labeled as a "trigger" is a
data-quality defect worth calling out on a product handling this kind of
sensitive family information, even though it is not a safety-classification
issue like §8.1. Fixed with a heuristic that treats a word capitalized in
100% of its occurrences as a name rather than a trigger (no patient name is
stored server-side to filter against directly, by design — see §1's privacy
note), plus an expanded stopword list. Verified against the full backend
test suite (1,572 tests passing).

---

## 9. Reference Documents

| Document | Contents |
|---|---|
| [`README.md`](../README.md) | Project overview, setup instructions |
| [`ARCHITECTURE.md`](../ARCHITECTURE.md) | Full system architecture |
| [`docs/SAFETY_ARCHITECTURE.md`](SAFETY_ARCHITECTURE.md) | Safety gate design, red-team testing |
| [`docs/DEFERRED.md`](DEFERRED.md) | Deferred features & roadmap |
| [`docs/product-guide.md`](product-guide.md) | Product/feature guide |
| [`docs/prd.md`](prd.md) | Product requirements |
| [`docs/mobile-launch-checklist.md`](mobile-launch-checklist.md) | Mobile store-readiness checklist |
| [`docs/AUDIT.md`](AUDIT.md) | Prior repo-wide audit log |
