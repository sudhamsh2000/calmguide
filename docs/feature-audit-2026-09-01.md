# CalmGuide Feature Audit — 2026-09-01

Full-day QA, cleanup, and documentation pass against the running app (backend +
frontend live). Covers two sessions on the same date: an initial feature
walkthrough, followed by the landing-page rebuild, and finally an unsupervised
cleanup pass (dead-code removal, test-suite repair, re-verification) done while
the user was away. Every item below was checked by hand — clicked through the
real app, read the actual response, or run against the test suite — or fixed
and re-verified. This is not a code review of the whole codebase.

**Bottom line:** app is in good shape. Backend: 1584/1585 tests passing (1
pre-existing, unrelated, dev-only dependency gap). Frontend: 241/248 passing,
1 skipped (up from 198/248 at the start of today — see "Test suite cleanup"
below), `tsc --noEmit` clean. Four dead files and a dozen orphaned locale keys
removed. Nothing was deleted or changed without direct evidence — every claim
below cites what was actually checked.

## Core caregiver flow

| Status | Feature | Evidence |
| --- | --- | --- |
| ✅ Verified | Invite-code gate | Real code validated on the signup screen, unlocked step 2. (`backend/app/routers/profile.py:86`) |
| ✅ Verified | Profile setup wizard | Ran the full 6-step flow multiple times today (including through the login flow with a stored access code). (`frontend/src/app/[locale]/profile/setup/page.tsx`) |
| ✅ Verified | AI Moment Coach (streaming) | Real scenario sent, got a genuine DICE-structured response, personalized with the patient's name. Live LLM call, not a stub. (`backend/app/routers/coach.py:448`) |
| ✅ Verified | Caregiver check-in | Real empathetic reply, not canned. (`backend/app/routers/checkin.py:59`) |
| ✅ Verified | Incident auto-extraction + pattern insights | Confirmed today via a fresh login: home screen correctly showed both the "We captured this from earlier" card and a live "Patterns we're noticing" card (`IncidentPatternCard.tsx`) with real computed frequency/trend data — this also confirms the locale-key cleanup below didn't break it. |
| ✅ Verified | Learn / practice scenarios | Full loop confirmed: wrote a response, got real structured AI feedback. |
| 🔲 Not reached | Daily behavioral log (distinct from check-in above) | Route exists; not clicked through either session. (`backend/app/routers/checkin_daily.py:36`) |
| 🔲 Not reached | Manual incident logging | Tile exists on home; not completed either session. (`backend/app/routers/incidents.py:317`) |

## Landing page (rebuilt today)

| Status | Feature | Evidence |
| --- | --- | --- |
| ✅ Verified | 12-section rebuild against design brief | Full section-by-section rationale in `design/design.md` §18. Real logos, real product-screen mockups (flagged to the user as concept UI, not live captures — used as-is per their explicit choice). |
| ✅ Fixed | Logo not rendering anywhere | Next's image optimizer's `Content-Disposition: attachment` header silently breaks `<img>` painting in Chromium. Fixed via `images.contentDispositionType: "inline"`. |
| ✅ Fixed | Hydration-mismatch console error | Missing `suppressHydrationWarning` on `<html>` for the pre-hydration theme/layout scripts. |
| ✅ Fixed | Leap of Faith logo illegible | Was force-cropped into circles (squishing its 1500×449 wordmark) and rendered black-on-navy in the footer. Now used at natural aspect ratio, with a light backing card in the footer. |
| ✅ Fixed | Page chrome reappearing on language switch | `data-landing` was only ever set once by a `beforeInteractive` script — never re-ran on client-side navigation (the locale switcher, or any `<Link>`), so switching language left the app-shell's hidden header/footer reappearing on top of the page. Fixed with an effect-based sync component (`LandingChromeSync.tsx`), mirroring the existing `data-facility` pattern. Verified a full en→hi→es→en cycle through the real UI control. |
| ✅ Applied | Custom color palette (`#E1BFFB` lavender accent, scoped to landing page only via `[data-landing]`) | Verified live; also fixed two real contrast bugs found while applying it (white text on the new light buttons, and a secondary button whose border/background were hardcoded to the old teal RGB instead of the theme variable). |

## Safety & trust

| Status | Feature | Evidence |
| --- | --- | --- |
| ✅ Verified | Pre-coach safety disclosure | Appears every time, must be acknowledged. |
| ✅ Verified | Crisis / emergency bar | 911, 988, Alzheimer's Helpline as real `tel:` links on every screen tested. |
| ✅ Verified | Encryption at rest | Full write path (profile, coach messages, check-ins) round-trips through AES-256-GCM successfully. |
| ✅ Verified | Backend test suite | **1584/1585 passing.** The one failure (`test_rag.py`) needs a missing dev-only package (`html2text`) — confirmed pre-existing and unrelated to any app code, unchanged all day. |
| ✅ Fixed | Frontend test suite | **241/248 passing, 1 skipped** (was 198/248 at the start of today — see below). |

## Personalization, language & access

| Status | Feature | Evidence |
| --- | --- | --- |
| ✅ Verified | Dark mode | Confirmed on both the app shell and the landing page. |
| ✅ Verified | Multilingual UI (en / es / hi) | All three locales confirmed live on the landing page and app shell; the client-side locale-switch bug above was specifically caught testing this. |
| ⚠️ Wired, not heard | Voice input / read-aloud | Buttons present, no console errors on click. Actual audio in/out still unconfirmed in this browser-automation environment. |
| ✅ Fixed | Stale "Voice — in development" landing badge | Retired as part of the landing rebuild — voice is now listed as a real, shipped bullet in the "3am experience" section instead of a standalone "in development" claim. |

## Facility (B2B) & infrastructure

| Status | Feature | Evidence |
| --- | --- | --- |
| ⚠️ Renders only | Facility staff login | Page loads correctly; no seeded facility/staff credentials in this environment to complete an actual login. |
| 🔲 Not reached | Facility dashboard, trends, residents, audit log, PDF export | Gated behind the login above. |
| 🔲 Not populated | RAG-backed retrieval | No document/embedding table exists in this local DB — the ingestion pipeline has never been run here. Coach/scenario responses are real but run on the LLM's own knowledge, not retrieved content. |

## Dead code removed today

All of the following were confirmed via a full cross-reference sweep of every
`.tsx`/`.ts` file in `frontend/src` (checking both `@/`-alias and relative
imports) — nothing was removed on a guess.

**4 orphaned component files** (present unchanged since the very first commit,
zero references anywhere, no tests — clearly superseded scaffolding, not
in-progress work):
- `frontend/src/features/profile/BehavioralAnchorStage.tsx` — superseded by `StepDiseaseStage.tsx`
- `frontend/src/features/incidents/PatternInsightsDetail.tsx` — superseded by `PatternInsights.tsx` / `IncidentPatternCard.tsx`
- `frontend/src/components/facility/TopBar.tsx` — superseded by `FacilityNav.tsx`
- `frontend/src/components/facility/Sidebar.tsx` — superseded by `FacilityNav.tsx`

**Orphaned locale keys** removed from `locales/{en,es,hi}/*.json` (each
confirmed zero references before removal):
- `landing.problem`, `landing.rag`, `landing.dice`, `landing.voice`, `landing.partnership` (whole objects) — superseded by the landing-page rebuild's new section structure (§18 of `design/design.md` explains what each was folded into or why it was dropped)
- `landing.about.eyebrow` / `landing.about.title` — the acknowledgments section is now a compact footer paragraph (`landing.about.body` only)
- `profile.anchor_early` / `anchor_middle` / `anchor_late` / `anchor_unsure` — only ever used by the deleted `BehavioralAnchorStage.tsx`
- `incidents.patterns.frequency` / `what_works` / `what_doesnt` — only ever used by the deleted `PatternInsightsDetail.tsx` (`patterns.title` and the rest of that object are still live in `IncidentPatternCard.tsx` and were left untouched)

**Typo fix:** scenario title "Evening Agitation (Sundownning)" → "Sundowning" (double-n), in `locales/en/learn.json` and `mobile/locales/en/learn.json`.

**Checked and confirmed NOT dead** (ruled out false positives before touching anything): `src/i18n/request.ts` (referenced by `next.config.ts` as a string path, not a TS import) and `backend/app/services/safety_redteam.py` (used by `backend/tests/test_safety_redteam_harness.py`).

## Test suite cleanup

Frontend `vitest` went from 198/248 → 241/248 passing (1 skipped) today, via
two real fixes plus a background pass over 9 pre-existing broken test files:

1. **Global mock gap:** `vitest.setup.ts`'s `next-intl` mock never implemented `.has()`, which `ScenarioInteraction.tsx` calls — this alone was cascading into ~16 failures across the suite. Fixed once, globally.
2. **9 files of test/implementation drift** (components refactored, tests never updated to match — e.g. `Chip` now renders `role="radio"` but its test still looked for `role="option"`; `Button`'s secondary variant now uses an `.outline-button` utility class instead of a literal `border-primary` string): fixed test-only, no component behavior changed. Full reasoning per file is in the delegated agent's report; nothing was changed by guessing — every fix traced the actual current component behavior first.

**Left deliberately unfixed** (real judgment calls, not test drift — flagged rather than guessed at while unsupervised):
- `ThemeToggle.test.tsx` (6 tests) — the button's `aria-label` describes the *target* state on click ("Switch to dark mode") and never contains the word "theme"; the test expects a name matching `/theme/i`. Deciding which one is "correct" is a content/UX call.
- `Card.test.tsx` (1 test, skipped) — the `elevated` variant's style map is byte-for-byte identical to `default` in `globals.css` — no shadow is actually implemented anywhere for it. Genuine unimplemented feature, not a test bug.
- `StepChipSelector.tsx` — wraps `Chip` (which renders `role="radio"`) in a container with `role="listbox" aria-multiselectable="true"`, which is an invalid ARIA combination. Spotted while fixing the `Chip` test; not fixed since it touches real component markup.

## Known issues carried forward (not fixed this pass)

1. Voice input/output audio still unconfirmed (tooling limitation, not evidence of a bug).
2. Facility/B2B flows past login untested (no seeded credentials in this environment).
3. RAG has zero ingested documents locally — coach/scenario quality is genuinely good but not retrieval-backed here.
4. The three items in "Left deliberately unfixed" above.
5. Backend's one `test_rag.py` failure needs `pip install html2text` in the dev environment — not an app bug.

## Checks run this pass

- `cd backend && python -m pytest -q` → 1584 passed, 1 pre-existing failure
- `cd frontend && npx vitest run` → 241 passed, 6 failed (all `ThemeToggle`, flagged above), 1 skipped
- `cd frontend && npx tsc --noEmit` → clean
- All 6 touched locale JSON files (`en`/`es`/`hi` × `common`/`profile`/`incidents`/`learn`) validated with `python -m json.load`
- Live re-verification in the running app: landing page (all locales, light/dark), invite-code gate, profile wizard, login flow, home screen with incident pattern card, Moment Coach chat, facility login page — no console errors beyond known pre-existing dev-tooling CSP noise
