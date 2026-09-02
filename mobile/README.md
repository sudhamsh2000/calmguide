# CalmGuide Mobile

The iOS and Android app for CalmGuide, built with Expo (React Native) and
expo-router. Feature parity with the web app in `../frontend`, including the
facility (B2B) section, and it talks to the same FastAPI backend.

See the repo-root [`README.md`](../README.md) for what CalmGuide is and how the
backend is structured.

## Getting started

```bash
npm install
npm start          # syncs locales, then starts the Expo dev server
```

Then press `i` for the iOS simulator, `a` for an Android emulator, or scan the
QR code with Expo Go.

Native builds (needed for anything using a config plugin — speech recognition,
secure storage):

```bash
npm run ios
npm run android
```

## Layout

```
src/
  app/          expo-router routes — the file tree IS the navigation
    (tabs)/     home, learn, profile
    facility/   B2B: dashboard, residents, staff, audit, trends, executive
  components/   shared UI
  hooks/        speech, network, theme
  lib/          api clients, storage, i18n, response parsing
locales/        synced from ../locales — see below
```

## Locales

**`mobile/locales/` is generated, not authored.** It's an rsync of the
repo-root `../locales/`, run by `prestart` and again by EAS before a build.

Edit translations in `../locales/` only. Anything added directly here is
overwritten on the next sync.

The sync uses `rsync --delete`, so a language removed at the repo root is
removed here too. That matters: it previously used `cp`, which only ever added
files, so eight languages dropped from the product stayed behind and kept
shipping in the app bundle.

Supported locales are declared in `src/lib/i18n.ts` and must match the
directories present. Adding a language means adding it there *and* at the repo
root — the static imports won't resolve otherwise.

## Configuration

The API base URL comes from `EXPO_PUBLIC_API_URL`. Production is set in
`eas.json`; for local development against a local backend, use a `.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:8000
```

Note that `localhost` won't resolve from a physical device — use your machine's
LAN IP, and make sure it's in the backend's `CORS_ORIGINS`.

## Tests

```bash
npm test
npx tsc --noEmit
```

## Building and releasing

Builds run through [EAS](https://docs.expo.dev/build/introduction/). Profiles
are in `eas.json`:

| Profile | Purpose |
|---|---|
| `development` | Dev client, internal distribution |
| `preview` | Internal testing — Android APK |
| `production` | Store builds — Android App Bundle, iOS auto-increment |

```bash
eas build --profile preview  --platform all   # internal testing
eas build --profile production --platform all # store submission
```

**Before the first store submission**, fill in the placeholders in `eas.json`
under `submit.production.ios` (`appleId`, `ascAppId`, `appleTeamId`). They come
from an enrolled Apple Developer account and can't be guessed.

Bundle identifiers are already claimed as `com.calmguide.app` on both
platforms.

## Known gaps

- The visual redesign applied to the web app hasn't been carried across, so
  mobile is internally coherent but doesn't match the web look yet.
- Test coverage is thin (5 files) relative to the web app's.
- The facility section is built but untested past login — it needs
  `JWT_SECRET_KEY` set on the backend, without which facility auth fails closed
  on every client.
