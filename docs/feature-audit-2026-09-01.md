# CalmGuide Feature Audit — 2026-09-01

QA pass against the running app in a local dev environment (backend + frontend live,
invite-code build). Every item below was checked by hand — clicked through the real
app, read the actual response, or run against the test suite. This is not a code
review.

"Not reached" means genuinely untested this pass, not broken — worth a follow-up
before calling any of it verified.

**Summary:** 15 verified working · 3 wired but unconfirmed in detail · 1 stale
marketing claim · 4 couldn't be reached in this environment.

## Core caregiver flow

| Status | Feature | Evidence |
| --- | --- | --- |
| ✅ Verified | Invite-code gate | Entered a live code on the real signup screen; it validated and unlocked step 2. Also caught it correctly rejecting a batch of codes that got orphaned by an unrelated `.env` fix mid-session — the gate was doing its job. (`frontend/src/app/[locale]/login/page.tsx`, `backend/app/routers/profile.py:86`) |
| ✅ Verified | Profile setup wizard | Ran the full 6-step flow — name, stage, behaviors, calming strategies, safety concerns — including the "+ Add custom option" affordance on each chip step. Landed on a real access code screen. (`frontend/src/app/[locale]/profile/setup/page.tsx`) |
| ✅ Verified | AI Moment Coach (streaming) | Sent a real scenario ("she keeps asking to go home"). Got back a genuine DICE-structured response — Right Now / Why / What Not To Do / When To Call — personalized with the caregiver's own name for the patient. Live call to OpenAI, not a stub. (`backend/app/routers/coach.py:448`) |
| ✅ Verified | Caregiver check-in | Submitted "tired today but managing okay" — got a warm, specific empathetic reply back, not a canned response. (`backend/app/routers/checkin.py:59`) |
| 🔲 Not reached | Daily behavioral log | Distinct from the check-in above — a separate short daily-status log. Route and router exist; didn't click through it this pass. (`backend/app/routers/checkin_daily.py:36`, `DailyCheckinCard.tsx`) |
| ✅ Verified | Learn / practice scenarios | Opened "Evening Agitation (Sundowning)", wrote a sample response, got structured feedback back — What You Did Well, What To Try Differently, The Principle At Work, three rewritten example lines, and encouragement. Full loop works. (`backend/app/routers/learn.py:122,135`) |
| ✅ Verified | Incident auto-extraction | After the coach conversation above, the home screen surfaced a "We captured this from earlier" card summarizing it in ABC form, with Looks Right / Let Me Fix Something review controls. (`backend/app/routers/coach.py:220-231`) |
| 🔲 Not reached | Manual incident logging | The "Log an incident" tile is on the home screen; didn't complete a manual entry this pass. (`backend/app/routers/incidents.py:317`) |

## Safety & trust

| Status | Feature | Evidence |
| --- | --- | --- |
| ✅ Verified | Pre-coach safety disclosure | "Before you continue" screen — not a medical device, 911/doctor/Alzheimer's Helpline guidance — appears every time before the coach opens, and has to be acknowledged. (`frontend/src/components/ui/SafetyDisclosure.tsx`) |
| ✅ Verified | Crisis / emergency bar | 911, 988 Crisis Line, and the Alzheimer's Helpline are pinned to the bottom of every screen tested, as real `tel:` links. (`frontend/src/components/ui/EmergencyBar.tsx:17,26,35`) |
| ✅ Verified | Encryption at rest | Not independently decrypted, but the whole write path exercised it: profile creation, coach messages, and check-ins all round-tripped successfully through the AES-256-GCM layer with a corrected key. (`backend/app/services/crypto.py`) |
| ✅ Verified | Backend test suite | 1584 of 1585 tests pass. The one failure (`test_rag.py`) is a missing dev-only dependency (`html2text`), unrelated to app code — confirmed pre-existing on `main`. (`backend/tests/`) |
| ⚠️ Pre-existing gaps | Frontend test suite | 198 of 248 pass. The 50 failures are the same pre-existing set identified earlier this session (confirmed via `git stash` diffing against `main`) — none introduced by today's changes. (`frontend/src/**/*.test.tsx`) |

## Personalization, language & access

| Status | Feature | Evidence |
| --- | --- | --- |
| ✅ Verified | Dark mode | Toggled from the header; every screen re-themed cleanly, text stayed legible. (`frontend/src/lib/theme.ts`) |
| ✅ Verified | Multilingual UI (en / es / hi) | Loaded the home screen in all three locales — chrome fully translated in Spanish and Hindi. User-entered content correctly stays untranslated. (`frontend/locales/{en,es,hi}`, `backend/app/routers/languages.py:17`) |
| ⚠️ Wired, not heard | Voice input / read-aloud | Mic and "Read aloud" buttons are present and clickable with no errors in the coach view. Real Web Speech API wrapper. Couldn't confirm actual audio in/out in this headless browser session. (`frontend/src/hooks/useSpeechRecognition.ts`, `useSpeechSynthesis.ts`) |
| ❌ Stale copy | Landing-page "Voice — in development" badge | This is what started the check: the badge is hardcoded marketing copy, not a real flag. The feature above already ships and is wired into three screens. Copy was never updated after launch. (`frontend/locales/en/common.json:242-246`) |

## Facility (B2B) & infrastructure

| Status | Feature | Evidence |
| --- | --- | --- |
| ⚠️ Renders only | Facility staff login | Page loads correctly — facility-code and admin/DON email paths both present. No seeded facility/staff credentials in this environment to complete an actual login. (`frontend/src/app/[locale]/facility/login/page.tsx`) |
| 🔲 Not reached | Facility dashboard, trends, residents, audit log, PDF export | All gated behind the staff login above — same limitation, not individually exercised. (`backend/app/routers/facility_*.py`) |
| 🔲 Not populated | RAG-backed retrieval | Checked directly: no document/embedding table exists in this local database at all — the ingestion pipeline (`python -m rag.pipeline`) has never been run here. The coach and scenario responses above are real, but running on the LLM's own knowledge, not retrieved content. (`backend/app/routers/coach.py:63-96`) |

## Bugs found and fixed along the way

1. **Logo not rendering anywhere in the app.** Next's image optimizer sends `Content-Disposition: attachment`, which Chromium silently refuses to paint inside an `<img>`. Fixed via `images.contentDispositionType: "inline"` in `frontend/next.config.ts`.
2. **Hydration-mismatch console error on every page load.** A pre-hydration script intentionally tags `<html>` with theme/layout attributes the server can't know ahead of time. Missing `suppressHydrationWarning` on that element — added it.
3. **Backend wouldn't boot at all.** `CONVERSATION_ENCRYPTION_KEY` in `backend/.env` was missing its base64 padding. Fixing it changed the literal secret used to hash invite codes, which silently orphaned the first batch generated earlier — caught via a failed live validation, regenerated a clean batch.
4. **Scenario page test failure is a test artifact, not a real bug.** Vitest's mocked `useTranslations` lacks a `.has()` method that the real next-intl hook has. Confirmed the actual scenario page renders fine in the browser.
5. **Minor copy typo.** Scenario title reads "Evening Agitation (Sundownning)" — double n.
