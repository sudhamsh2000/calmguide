# CalmGuide Mobile — Store Launch Checklist

Last updated: 2026-05-09

## Code Fixes Applied (committed)

- [x] Package name changed to `com.calmguide.app`
- [x] Patient name removed from all API requests
- [x] HTTPS enforcement in production builds
- [x] XHR stream timeout (60s)
- [x] JWT `expires_at` passed on login and refresh
- [x] `accessCode` state crash fix in HomeScreen
- [x] ErrorBoundary with EmergencyBar fallback
- [x] `useMemo` for parseCoachResponse during streaming
- [x] Loading guard for facility login race condition
- [x] Shared `useFacilitySessionGuard` hook on all facility screens
- [x] Access code hidden by default with show/hide toggle
- [x] Profiles and patient name migrated to SecureStore
- [x] `allowBackup=false` + `fullBackupContent=false`
- [x] `SYSTEM_ALERT_WINDOW` blocked via `app.json`
- [x] Release manifest disables cleartext traffic — now set explicitly via
      `expo-build-properties` (`usesCleartextTraffic: false`). Previously this
      relied only on the API-28+ platform default and was not declared anywhere;
      debug builds still allow cleartext so LAN dev over http keeps working.
- [x] R8 minification and resource shrinking enabled — **this was previously
      recorded as done but was not.** Both Gradle flags default to `false` and
      nothing set them, so every release build shipped unminified. Now enabled
      through `expo-build-properties`. Because R8 can strip reflectively-used
      classes, the first release APK must be smoke-tested before submission.
- [x] EAS build profiles created (dev/preview/production) — `development`,
      `preview` and `production` now actually `extends: base`. The `base`
      profile existed but nothing referenced it, so its Node pin never applied.
- [x] `@xmldom/xmldom >=0.8.13` override for CVEs
- [x] Access code removed from error messages
- [x] Feedback API calls log warnings on failure
- [x] iOS minimum OS version set to 16.0
- [x] iOS splash screen configured in app.json
- [x] iOS submit config placeholder in eas.json

## Pre-Submission: Both Platforms

### Production Environment
- [ ] Create `.env.production` with `EXPO_PUBLIC_API_URL=https://<your-production-api>`
- [ ] Deploy backend to production with HTTPS
- [ ] Verify all API endpoints work over HTTPS

### Privacy Policy
- [ ] Host privacy policy at a public HTTPS URL (e.g., `https://calmguide.app/privacy`)
- [ ] Verify the hosted version matches the in-app `privacy.tsx` content
- [ ] URL required by both App Store and Play Store during submission

### Crash Reporting
- [ ] Install `@sentry/react-native` (or Crashlytics)
- [ ] Configure with DSN for production environment
- [ ] Verify crash reports appear in dashboard

### Regenerate Native Projects
- [ ] Run `npx expo prebuild --clean` to regenerate both `ios/` and `android/` from `app.json`
- [ ] Verify `com.calmguide.app` appears in generated native files
- [ ] Verify `allowBackup=false` in generated AndroidManifest.xml
- [ ] Verify `SYSTEM_ALERT_WINDOW` is absent from release manifest
- [ ] Verify iOS deployment target is 16.0

## Pre-Submission: Google Play Store

### Signing
- [ ] Generate production keystore:
  ```bash
  keytool -genkey -v -keystore calmguide-release.jks -alias calmguide \
    -keyalg RSA -keysize 2048 -validity 10000
  ```
- [ ] Store keystore securely (losing it = can never update the app)
- [ ] Configure in `eas.json` or EAS credentials

### Store Listing
- [x] App icon: `store-assets/play-icon-512.png` — 512x512, flattened on white.
      Play applies its own rounded mask, so the icon must be a full-bleed square
      with no alpha; a pre-rounded icon with transparent corners double-rounds.
- [x] Feature graphic: `store-assets/play-feature-graphic-1024x500.png`. The
      existing `feature-graphic.png` is 2048x1000 and would be rejected — Play
      requires exactly 1024x500.
- [ ] Screenshots: Minimum 2, recommended 4-8 (1080x1920 or 1080x2340)
  - Home screen with patient card
  - Moment Coach conversation
  - Incident logger
  - Learning mode
- [ ] Short description (80 chars max). Do **not** claim 11 languages — the app
      ships translated UI in 3 (English, Spanish, Hindi). Claiming 11 in a store
      listing is a misrepresentation. e.g. "AI guidance for dementia caregivers,
      in English, Spanish and Hindi" (63 chars).
- [ ] Full description (4000 chars max)

### Compliance
- [ ] Complete Data Safety form:
  | Data type | Collected | Sent off-device | Encrypted | Purpose |
  |-----------|-----------|-----------------|-----------|---------|
  | App activity (conversations) | Yes | Yes — backend | Yes (HTTPS) | App functionality |
  | App activity (incidents) | Yes | Yes — backend | Yes (HTTPS) | App functionality |
  | User preferences (language) | Yes | No — device only | N/A | App functionality |
- [ ] Content rating questionnaire (select Health & Fitness category)
- [ ] Confirm no advertising/tracking SDKs
- [ ] Target API level 34+ (currently 36 — compliant)

### Build & Submit
- [ ] `eas build --platform android --profile production`
- [ ] `eas submit --platform android --profile production`
- [ ] Submit to internal testing track first
- [ ] Test on at least 2 physical Android devices

## Pre-Submission: Apple App Store

### Apple Developer Account
- [ ] Enroll in Apple Developer Program ($99/year)
- [ ] Update `eas.json` with real `appleId`, `ascAppId`, `appleTeamId`

### App Store Connect
- [ ] Create app in App Store Connect with bundle ID `com.calmguide.app`
- [ ] Select "Health & Fitness" as primary category

### Store Listing
- [ ] App icon: 1024x1024 PNG without alpha channel (existing Xcode asset is correct)
- [ ] Screenshots required for:
  - iPhone 6.7" (Pro Max)
  - iPhone 6.5" (Plus/Max)
  - iPad 12.9" (if `supportsTablet: true`)
- [ ] App description, keywords, support URL, marketing URL

### Privacy
- [ ] Privacy manifest (`PrivacyInfo.xcprivacy`) already exists and covers required API categories
- [ ] App Privacy section in App Store Connect — declare data practices matching Play Store data safety form
- [ ] `NSPrivacyTracking` is `false` — confirm no tracking SDKs added

### Compliance
- [ ] Export compliance: App uses AES-256-GCM encryption — select "Yes" for encryption usage
  - Exempt under ECCN 5D002 if encryption is only for data protection (not communication)
  - May need to file a year-end self-classification report with BIS
- [ ] Sign in with Apple: NOT required (no third-party social login is offered)
- [ ] Age rating: 17+ recommended (health/medical content, crisis situations)

### Build & Submit
- [ ] `eas build --platform ios --profile production`
- [ ] `eas submit --platform ios --profile production`
- [ ] Submit to TestFlight first
- [ ] Test on at least 2 physical iOS devices (iPhone + iPad)

## Post-Launch

- [ ] Monitor crash-free rate in Play Console Vitals and App Store Connect
- [ ] Set up alerts for 1-star reviews mentioning crashes
- [ ] Plan push notifications for v1.1 (medication reminders, daily check-ins)
- [ ] Plan Universal Links for iOS (requires server-side `apple-app-site-association`)
- [ ] Regenerate adaptive icon assets at 1024x1024 for better rendering on large screens
