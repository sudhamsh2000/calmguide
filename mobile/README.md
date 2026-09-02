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
directories present. Adding a language means adding it there _and_ at the repo
root — the static imports won't resolve otherwise.

## Configuration

The API base URL comes from `EXPO_PUBLIC_API_URL`. Production is set in
`eas.json`; for local development against a local backend, use a `.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:8000
```

Note that `localhost` won't resolve from a physical device — use your machine's
LAN IP, and make sure it's in the backend's `CORS_ORIGINS`.

## Tests and formatting

```bash
npm test
npx tsc --noEmit
npm run format          # Prettier — shared config in the repo root
npm run format:check    # verify without writing
```

## Building and releasing

Builds run through [EAS](https://docs.expo.dev/build/introduction/). Profiles
are in `eas.json`:

| Profile       | Purpose                                               |
| ------------- | ----------------------------------------------------- |
| `development` | Dev client, internal distribution                     |
| `preview`     | Internal testing — Android APK                        |
| `production`  | Store builds — Android App Bundle, iOS auto-increment |

```bash
eas login                                     # required first — free Expo account
eas build --profile preview  --platform all   # internal testing
eas build --profile production --platform all # store submission
```

### Building an Android APK locally (no Expo account needed)

EAS is not required for Android. A release APK can be built on any machine with
the Android SDK, and it is signed with the debug keystore — installable for
testing, but not publishable to Play.

React Native's Gradle plugin compiles against a **Java 17 toolchain**. A newer
JDK as `JAVA_HOME` is fine, but a 17 must exist somewhere on the machine or
Gradle tries to auto-download one and crashes: the bundled Foojay resolver is
incompatible with Gradle 9 and fails with a confusing
`JvmVendorSpec … IBM_SEMERU` error that says nothing about Java versions.

```bash
brew install openjdk@17          # once

npx expo prebuild --platform android --clean
cd android
ANDROID_HOME=~/Android/Sdk ./gradlew assembleRelease \
  -Porg.gradle.java.installations.paths=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
```

Homebrew's JDK is keg-only, so Gradle will not auto-detect it — hence the
explicit `installations.paths`. The APK lands at
`android/app/build/outputs/apk/release/app-release.apk`.

Install it on an emulator or device:

```bash
~/Android/Sdk/platform-tools/adb install -r app-release.apk
```

Genymotion registers itself with adb once its ADB setting points at the same
SDK (Settings → ADB → "Use custom Android SDK tools"). The build packages
`arm64-v8a`, `armeabi-v7a`, `x86` and `x86_64`, so it installs on both ARM and
x86 emulator images.

Release builds are minified with R8. That can strip reflectively-used classes,
so **smoke-test the APK after any dependency change** rather than assuming a
green build means a working app.

### The two platforms are not symmetric

**Android needs no developer account.** EAS generates and stores the signing
keystore itself, so `--platform android` produces an installable APK as soon as
you're logged into Expo.

**iOS cannot produce an installable build without an Apple Developer Program
membership.** Every iOS binary must be code-signed with Apple-issued
certificates — there is no unsigned `.ipa`. EAS will stop and ask for Apple
credentials to mint the certificate and provisioning profile. This is a
prerequisite for building at all, not just for submitting.

A DUNS number is only required for an _organization_ Apple account. An
_individual_ account needs just an Apple ID, and skips the DUNS verification
wait — at the cost of the App Store seller name being a person rather than a
company.

**Before the first store submission**, fill in the placeholders in `eas.json`
under `submit.production.ios` (`appleId`, `ascAppId`, `appleTeamId`). They come
from an enrolled Apple Developer account and can't be guessed.

Bundle identifiers are already claimed as `com.calmguide.app` on both
platforms.

## Known gaps

- The visual redesign applied to the web app hasn't been carried across, so
  mobile is internally coherent but doesn't match the web look yet.
- Test coverage is thin (6 files, 28 tests) relative to the web app's (32 files,
  250 tests).
- The facility section is built but untested past login — it needs
  `JWT_SECRET_KEY` set on the backend, without which facility auth fails closed
  on every client.
