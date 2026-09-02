# CalmGuide — Audit Log

Running record of repo-wide audits. Newest entry first. Every entry is stamped
with the date it was taken and the commit it was taken against, because most of
the numbers below (test counts, vulnerability counts, corpus state) are only
true for a specific commit at a specific moment.

Point-in-time reports that are too large to inline live beside this file:

| Date | Report |
|---|---|
| 2026-09-01 | [feature-audit-2026-09-01.md](feature-audit-2026-09-01.md) — feature-by-feature verification |
| 2026-04-28 | [ui-ux-audit-2026-04-28.md](ui-ux-audit-2026-04-28.md) |

---

## 2026-09-02 — Repo-wide audit

**Taken:** 2026-09-02 14:53 CDT
**Commit at start:** `2cbed43` (branch `main`)
**Scope:** whole repo — backend, frontend, mobile, rag; tests, types, lint,
formatting, dependency CVEs, production builds, and the read-aloud voice path.

### Verification matrix

Every row below was executed, not asserted. Commands are in *Reproducing this
audit* at the end of the entry.

| Area | Check | Result |
|---|---|---|
| Backend | `pytest` | **1601 passed**, 0 failed |
| Backend | Python runtime | 3.12.14 |
| Backend | `ruff check` (backend + rag) | All checks passed |
| Backend | `ruff format --check` | 211 files already formatted |
| Frontend | `tsc --noEmit` | clean |
| Frontend | `vitest run` | **251 passed**, 1 skipped, 32 files |
| Frontend | `prettier --check` | clean |
| Frontend | `next build` | **Compiled successfully** (3.8s) |
| Frontend | `npm audit --omit=dev` | **0 vulnerabilities** (was 6) |
| Mobile | `tsc --noEmit` | clean |
| Mobile | `jest` | **28 passed**, 6 suites |
| Mobile | `prettier --check` | clean |
| Mobile | `expo-doctor` | 20/20 checks passed |
| Mobile | Android release build | **BUILD SUCCESSFUL**, APK installs and launches |
| Voice | Neural TTS synthesis (live) | 34,560 bytes of valid MP3 returned |

### Inventory

| Area | Tracked files | Source lines |
|---|---|---|
| backend | 227 | 25,981 py |
| frontend | 202 | 19,879 ts/tsx |
| mobile | 151 | 16,987 ts/tsx |
| rag | 17 | 1,065 py |
| locales | 31 | — |
| docs | 29 | — |
| design | 12 | — |

Alembic migrations: 10.

### Fixed during this audit

**Frontend dependency CVEs — 6 resolved, including 4 high.** All were fixable
within existing semver ranges (`npm audit fix`, no `--force`), so no major
version jumps were involved. `tsc`, the full test suite, and `next build` were
re-run afterwards and all pass.

| Severity | Package | Issue | Now |
|---|---|---|---|
| HIGH | `next` | DoS via Server Components | 16.3.4 |
| HIGH | `postcss` | XSS via unescaped `</style>`; arbitrary `.map` file read via attacker-controlled `sourceMappingURL` | 8.5.23 |
| HIGH | `sharp` | inherited libvips CVE-2026-33327/33328/35590/35591 | 0.35.4 |
| HIGH | `nanoid` | non-secure generators can loop indefinitely | 3.3.18 |
| MODERATE | `next-intl` | **open redirect**; prototype pollution via translation catalog keys | 4.14.2 |
| LOW | `icu-minify` | DoS via unsanitised `select` key lookup | patched |

The `next-intl` open redirect is the one worth noting beyond the count: locale
routing is on every request path in this app, so it was reachable.

**Read-aloud reliability — three defects.** Found by reading the whole path
rather than re-testing the happy case.

1. *The read-aloud button hid itself on browsers that could still read aloud.*
   `SpeakButton` gated on `isSupported` (presence of the Web Speech API), but
   neural read-aloud plays through an `<audio>` element and never touches that
   API. On a browser without `speechSynthesis`, the control vanished even
   though server-side voice worked perfectly. Now gated on a new `canSpeak`
   (`isSupported || neuralAvailable`). Regression test added.

2. *Long responses cut off mid-sentence on Chrome.* Chrome silently stops
   `speechSynthesis` about 15 seconds into an utterance — no error, no `onend`.
   A full four-section Moment Coach answer read through the local fallback runs
   well past that. A keep-alive now calls `resume()` every 10s while speaking,
   guarded by a `userPaused` flag so it can never undo a pause the caregiver
   asked for.

3. *First press could use the wrong voice.* Chrome returns an empty voice list
   until it has asynchronously loaded voices and fired `voiceschanged`. The hook
   warmed the cache on mount but never re-read it, so an early press fell
   through to the flat default. A `voiceschanged` listener now keeps it current.

### Open findings

Ordered by consequence. None of these were introduced by this audit.

**1 — RAG corpus is empty; the product claims otherwise.** The `rag_chunks`
table does not exist, so no content has ever been ingested. `_fetch_rag_context`
degrades correctly (catches, logs a warning, returns `""`, Coach still answers),
so nothing is broken — but every response is currently **ungrounded**, while the
README and landing page describe answers as grounded in 41 pages from the
Alzheimer's Association, Mayo Clinic and others. For a dementia-care product
this is a claim/behaviour gap, not just a missing feature. Fix: run
`python -m rag.pipeline`.

**2 — `JWT_SECRET_KEY` is unset, so the facility portal cannot be used.**
Facility auth fails closed on every client. The entire B2B surface (staff
accounts, resident assignment, dashboards, audit) is unreachable and therefore
untested past login.

**3 — Mobile read-aloud has no neural voice.** `mobile/src/hooks/useSpeechSynthesis.ts`
uses `expo-speech` (the device voice) only and never calls `/api/speech`. The
neural TTS work exists to replace exactly that robotic delivery, and mobile
never received it, so mobile users still get the voice this feature set was
built to get away from. The endpoint is platform-neutral; wiring it is the same
fetch-then-play pattern the web hook already uses.

**4 — `mobile/assets/images/icon.png` carries an alpha channel.** Fine for
Android, which is all that ships today. The App Store rejects icons with
transparency, so an opaque variant is needed before any iOS submission.

**5 — Mobile test coverage is thin.** 28 tests / 6 files against 16,987 lines,
versus 251 tests / 32 files for a comparable frontend. There is no test at all
for the speech hooks on either platform.

**6 — 18 moderate advisories in mobile dependencies.** All transitive through
Expo's own toolchain (`@expo/cli`, `@expo/config-plugins`, `xcode`) and
react-navigation's `query-string`. They are build-time dependencies pinned by
the Expo SDK; `npm audit fix --force` would break SDK 55 alignment and
reintroduce the `expo-doctor` failure. Deliberately left.

**7 — ~~Language tiering is wider than the shipped UI.~~ RESOLVED 2026-09-02.**
`GET /languages` advertised 11 languages while translated UI existed for 3, so a
caregiver on one of the other 8 would have got English chrome with no
explanation. Product scope was confirmed as **three languages — English,
Spanish, Hindi** — and the 8 extra entries were removed from the registry. A
test now pins that the registry matches the shipped locales. See
[../locales/REVIEW_STATUS.md](../locales/REVIEW_STATUS.md).

**8 — Safety-critical translation review is incomplete.** `coach.json` review is
pending for both Spanish and Hindi, and five namespaces have no recorded review
decision either way. Tracked in `locales/REVIEW_STATUS.md`.

### Incidents during this audit

**2026-09-02 — backend virtualenv broken by a Homebrew install (caused by this
audit; resolved).** Installing `openjdk@17` (needed for local Android builds)
triggered Homebrew's automatic post-install cleanup, which removed the
`python@3.12` keg that `backend/.venv` symlinks its interpreter to. Symptoms
were misleading: the already-running dev server began returning `503
TTS_UNAVAILABLE` with `[Errno 1] Operation not permitted` on an `openai`
submodule, which reads like a sandbox or permissions problem rather than a
missing interpreter.

Resolved by reinstalling `python@3.12` with `HOMEBREW_NO_INSTALL_CLEANUP=1`. The
venv and all 1601 backend tests were verified working afterwards, and live
neural TTS synthesis was confirmed returning valid MP3.

Two follow-ups this leaves:

- Set `HOMEBREW_NO_INSTALL_CLEANUP=1` when installing anything on a machine
  whose virtualenvs point at Homebrew interpreters.
- The dev server on `:8000` had **two** listeners (PIDs 44616 and 96265), one
  started via a sandbox helper. Stale servers survive across sessions and will
  keep serving pre-incident code; restart it rather than trusting it.

### Reproducing this audit

```bash
# Backend
cd backend && .venv/bin/python -m pytest -q
.venv/bin/python -m ruff check ..           # covers backend/ and rag/
.venv/bin/python -m ruff format --check ..

# Frontend
cd frontend && npx tsc --noEmit && npm run test:run
npm run format:check && npm run build
npm audit --omit=dev

# Mobile
cd mobile && npx tsc --noEmit && npm test
npm run format:check && npx expo-doctor@latest

# Android release build + install (see mobile/README for the JDK 17 requirement)
npx expo prebuild --platform android --clean
cd android && ANDROID_HOME=~/Android/Sdk ./gradlew assembleRelease \
  -Porg.gradle.java.installations.paths=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
~/Android/Sdk/platform-tools/adb install -r app/build/outputs/apk/release/app-release.apk

# Voice path, end to end
curl -s localhost:8000/api/speech/status
curl -s -o /tmp/tts.mp3 -w '%{http_code}\n' -X POST localhost:8000/api/speech \
  -H 'Content-Type: application/json' -d '{"text":"Take a slow breath."}'
```

Note that the voice check bills a real OpenAI request. `/api/speech/status`
reports whether TTS is *configured*, not whether synthesis currently *works* —
during this audit status returned `available: true` while every synthesis
returned 503. Check both.
