# Web and Mobile Differences, and Future Work

**As of:** 2026-09-30, `main` @ `108a2fe` plus this session's uncommitted changes · **Replaces:** the web/mobile note in
`WEEKLY_REPORT_2026-09-24.md` §7, which is now out of date.

The web app (`frontend/`, Next.js) and the mobile app (`mobile/`, Expo/React
Native) share one backend and nearly the same screen set: every caregiver and
facility route exists on both, except those listed below. Differences are in
behaviour, not in reach.

How this was checked: route-by-route comparison of `frontend/src/app` and
`mobile/src/app`, code search for each feature, and today's test runs
(web 303 passed / 1 skipped, mobile 44 / 44, both type-check clean). Items
marked *code-verified* have not been checked on a device.

---

## 1. At parity (changed since 24 Sep)

| Feature | Status | Notes |
| --- | --- | --- |
| Palette and icons | Parity | 19 Sep |
| OpenMRS health-record link in Care Profile | Parity | Mobile `HealthRecordLink.tsx`, 29 Sep |
| Animated Moment Coach sphere on Home | Parity | Mobile `AiSphere.tsx`, 29 Sep; pauses when the app is backgrounded |
| Red emergency alert on 911-level messages | Parity | Mobile `EmergencyAlert.tsx`, 30 Sep (`108a2fe`). Mobile uses a warning haptic where web plays a tone. **Not yet tested on a device; EAS update not yet published.** |
| Response-guard repairs shown to the caregiver | Parity | Mobile coach and check-in now apply the `replace` event (`108a2fe`). Before this, repaired replies (medication dosing, wrong language, provider fallback) were never shown on mobile. |
| SSE event split across network chunks | Parity | Mobile parser now carries a partial event forward (`108a2fe`) |
| Sign-out clears the stored profile list | Parity (*code-verified*) | Mobile `clearAll()` deletes `calmguide_profiles` from SecureStore and AsyncStorage, so the web bug fixed on 24 Sep does not occur on mobile |
| Incident verification cards, pattern insights, feedback | Parity | Both platforms |
| Neural read-aloud and voice input | Parity | Both call `/api/speech`, with fallback to device speech |

## 2. Remaining differences

| # | Feature | Web | Mobile | Impact | Suggested priority |
| --- | --- | --- | --- | --- | --- |
| D1 | **Read-aloud while streaming** | Speaks each sentence as it arrives, through to the end (`a6a28c3`) | Auto-speak waits for the whole reply (`coach.tsx`) | Mobile caregivers hear nothing until the whole reply has streamed, which is the moment the coach is for | **High** |
| D2 | **Inactivity sign-out** | Caregivers signed out after inactivity (`SessionExpiryGuard`, `0ed8081`) | Only facility sessions have a guard (`useFacilitySessionGuard`); caregiver sessions never expire | A shared or lost phone stays signed in to a care profile | **High** |
| D3 | Weekly progress chart | Home, from `/api/checkin/daily/{code}/history` | Not present | Mobile caregivers can't see their check-in trend | Medium |
| D4 | Portrait picker | Signup and edit (`AvatarPicker`) | Not present; monogram only | Cosmetic, but a portrait chosen on web is not shown on mobile | Medium |
| D5 | In-app language switcher | `LocaleSwitcher` | Follows device language only | Bilingual households can't choose per app | Low |
| D6 | Facility profile page | `/facility/profile` | Not present | Staff edit their profile on web only | Low |
| D7 | Public landing page | `/` | Not applicable (app opens to sign-in) | None | n/a |
| D8 | Emergency alert sound | Attention tone | Haptic only | Deliberate: mobile avoids an unexpected loud sound. Confirm with LOF. | Decision |

## 3. Gaps on both platforms

| # | Gap | Notes |
| --- | --- | --- |
| G1 | No client for the acute-change screen | `POST /api/coach/acute-change-screen` exists and is tested, but neither app calls it |
| G2 | No UI to record a care change | `care-changes` API functions exist on both clients, and the coach prompt uses recent care changes, but no screen writes one |
| G3 | No push notifications | Daily check-in reminders would need `expo-notifications` on mobile and web push on web |

## 4. Engineering debt

| # | Item | Notes |
| --- | --- | --- |
| E1 | Unused `mobile/src/components/BehavioralAnchorStage.tsx` | Not imported anywhere; delete or wire in |
| E2 | No mobile end-to-end tests on a device or emulator | Only jest unit tests (44). The emergency alert and repair path from `108a2fe` are untested on hardware. |
| E3 | Android APK only | EAS `preview` profile builds an APK; no iOS build or store listing yet |
| E4 | Mobile EAS update for `108a2fe` not yet published | Installed builds don't have the emergency alert until it is |

## 5. Future-work list (ordered)

1. **Publish the EAS update for `108a2fe` and test the emergency alert and repair
   path on a physical Android device** (E4, E2). This is safety-relevant and already built.
2. **Streaming sentence-by-sentence read-aloud on mobile** (D1). Port the web
   sentence queue (`frontend/src/features/coach/speakableText.ts` and
   `useSpeechSynthesis`) to `mobile/src/app/coach.tsx`.
3. **Caregiver inactivity sign-out on mobile** (D2), mirroring web's timeout, using `AppState`.
4. **Weekly progress chart on mobile** (D3). The backend endpoint already exists.
5. Portrait picker on mobile (D4), so a profile looks the same on both platforms.
6. Acute-change screen UI (G1) and care-change entry (G2), on both platforms.
7. Device E2E coverage for mobile (E2), starting with sign-in → coach → emergency.
8. iOS build (E3); in-app language switcher (D5); remove `BehavioralAnchorStage` (E1).
