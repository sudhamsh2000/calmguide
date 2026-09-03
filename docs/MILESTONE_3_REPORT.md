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

## 7. Reference Documents

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
