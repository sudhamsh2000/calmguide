# CalmGuide UI/UX Audit — 2026-04-28

**Scope:** Web (`frontend/src/app/[locale]/`) + Mobile (`mobile/src/app/`). 11 locales. Primary persona: family caregiver 55–70, stressed, often 3 AM, small phone, reading glasses.

---

## Global Layout & Shell (Web)

### Issues

**P0 — Layout cap at `max-w-lg` on tablet/desktop breaks utility**
The root layout wraps everything in `max-w-lg md:max-w-2xl`, but the body and html also have `overflow-hidden` and `h-dvh`. This means on a 1280px desktop the content is a narrow centered column with no sidebar, no secondary navigation, and no use of the additional space. That is intentional for a mobile-first product, but the `md:max-w-2xl` bump gives roughly 672px — still too narrow to comfortably use with reading glasses on a 13-inch laptop. Consider `md:max-w-xl` (560px) as a minimum readable column, or explicitly document that desktop is not a supported viewport. If desktop matters, it should be audited separately.

**P1 — `overflow-hidden` on `<body>` suppresses browser text-zoom reflow**
`body { overflow: hidden }` combined with `h-dvh` means that when a user with reading glasses increases browser zoom to 150–200%, horizontal scrolling is clipped entirely — they cannot pan to read content that wraps or overflows. WCAG 1.4.4 (Resize Text) and 1.4.10 (Reflow) require content to be readable at 200% without horizontal scrolling. Individual screens (Home, Crisis, CheckIn) do use inner scrollable containers with `overflow-y-auto`, which partially mitigates this, but the outer `overflow-hidden` blocks browser scroll entirely. Fix: remove `overflow: hidden` from `body`; rely on the inner flex container to constrain layout. ([WCAG 2.2 SC 1.4.10](https://www.w3.org/TR/WCAG22/#reflow))

**P1 — EmergencyBar touch targets critically undersized**
All three emergency links (`911`, `988 Crisis Line`, `Alz Helpline`) use `py-0.5` (4px vertical padding) and `text-[11px]`, producing buttons roughly 20px tall — less than half the WCAG 2.5.5 enhanced target of 44px and Apple HIG minimum of 44pt. For a caregiver in crisis with shaky hands at 3 AM this is dangerous. Fix: set `min-height: 44px` on each link and increase font to at least 13px. On mobile the same component (`mobile/src/components/EmergencyBar.tsx`) uses `paddingVertical: 2` — identical failure. ([WCAG 2.5.5](https://www.w3.org/TR/WCAG22/#target-size-enhanced); [Apple HIG Touch Targets](https://developer.apple.com/design/human-interface-guidelines/accessibility))

**P1 — EmergencyBar absent from web `login` / `profile/setup` / `terms` / `privacy` pages**
The EmergencyBar is in the root `[locale]/layout.tsx`, so it should appear on every page in that layout. Verify the `terms` and `privacy` pages are inside the locale layout subtree (they are, via `LegalLayout`). However, the standalone root redirect page (`page.tsx`) just redirects to `/home` — no layout renders there, so the EmergencyBar is briefly absent at startup. This is a minor edge case, but during the blank-screen moment on first load the bar is gone. Acceptable unless the redirect takes >500ms.

**P2 — Dark mode: no `prefers-color-scheme` auto-detection**
The theme is set from a cookie (`THEME_COOKIE`). If no cookie is present, the page renders in light mode regardless of OS dark-mode preference. A 55–70 user who has set their OS to dark mode for reduced eye strain will see an unexpected flash to light mode. Fix: read `prefers-color-scheme` as a fallback when no cookie is set. ([WCAG 1.4.3 contrast note](https://www.w3.org/TR/WCAG22/#contrast-minimum))

---

## `/login` (Web) + `login` (Mobile)

### Issues

**P0 — Mobile login: hardcoded English validation errors, no i18n**
`mobile/src/app/login.tsx` uses three literal English strings as validation messages: `'Please enter your complete 8-character access code.'`, `'Please enter your loved one\'s name.'`, `'Access code not found. Please check and try again.'`. These are not wrapped in `useTranslation` and will never localise. For Arabic, Tamil, or French caregivers this is an accessibility failure at the entry gate. Fix: move these strings into `common.json` and use `tc()`.

**P1 — Web CodeInput: each input box is 40×48px, but the perceived clickable gap between boxes is 8px**
At 40px wide each box meets the minimum, but grouped 8 boxes at 40px with 8px gaps = 376px total. On a 320px iPhone SE viewport this overflows, causing boxes to stack or clip depending on the viewport. With 8px gaps and no `flex-wrap`, the boxes may be cut off. Test on 320px. Fix: use `gap: 4px` and `width: clamp(32px, 10vw, 44px)` so all 8 fit on the smallest supported viewport. ([NNg: older adults on mobile benefit from clearly separated touch targets](https://www.nngroup.com/articles/mobile-ux-for-older-users/))

**P1 — Web login subtitle and hint text at `text-sm` (14px)**
The subtitle (`t('login.subtitle')`) and the code hint (`t('login.code_hint')`) use `text-sm` (14px). For the 55–70 persona, body text should be ≥16px; secondary text ≥14px is marginal, especially at low contrast. The hint text below the code input (`text-xs text-foreground-muted`) is 12px — too small without glasses. Fix: promote subtitle to `text-base` (16px), hint to `text-sm` (14px).

**P1 — No `autocomplete="one-time-code"` on the access code input group**
While `autoComplete="off"` on each box prevents autofill, caregivers who receive their access code by SMS should be able to trigger iOS/Android one-time-code autofill to avoid manually copying an 8-character alphanumeric string at 3 AM. The paste handler is implemented correctly — the autofill path is not. Fix: on the first box, add `autoComplete="one-time-code"` and ensure paste handler fires on iOS autofill. ([MDN: autocomplete one-time-code](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete#one-time-code))

**P2 — "Don't have an access code?" link (`/profile/setup`) uses raw `<a href>` not `<Link>`**
The link at line 237 in `login/page.tsx` uses a plain `<a href="/profile/setup">` which does a full navigation rather than a Next.js client-side transition. This loses the current locale prefix. The URL should be `/en-US/profile/setup` (or the active locale). Fix: use `<Link href="/profile/setup">` from `@/i18n/navigation`.

---

## `/home` (Web) + `(tabs)/home` (Mobile)

### Issues

**P0 — Journey navigation links are hardcoded English on both platforms**
In `HomeScreen.tsx` (web, lines 309–322) the four journey deflection links use literal strings: `"Noticing changes?"`, `"New diagnosis"`, `"Thinking about hospice"`, `"After loss"`. Same on mobile (`(tabs)/home.tsx` lines 297–300). These never go through `useTranslations`. For all 10 non-English locales this section is always in English. Fix: add these four labels to `home.json` under a `journey` namespace and use `t()`.

**P1 — Home screen cognitive load: up to 8 distinct UI sections visible after scroll**
In a loaded state, a caregiver scrolling down encounters: greeting + hero, PatientCard, CrisisButton, 2 quick actions, 4 journey links, FeedbackCard (conditionally), DailyCheckinCard (conditionally), TonightOutlookCard (conditionally), PatternInsights (conditionally), ConversationHistory, and an impact link. That is a worst-case of 11 sections. For a stressed 3 AM user this is overwhelming. The primary CTA (crisis button) is positioned correctly above the fold, but everything below it competes for attention. Consider: hide journey deflection links behind a collapsible or move them to the profile/learn tab; suppress feedback card until the user explicitly opens it; move impact link to profile. ([NNg: Reducing Cognitive Load](https://www.nngroup.com/articles/minimize-cognitive-load/))

**P1 — Home screen loads 6 parallel API calls with no unified loading state**
`HomeScreen.tsx` fires `getProfile`, `getConversations`, `getInsights`, `getPendingFeedback`, `getDailyCheckinStatus`, and `getPrediction` in parallel. Only `getProfile` controls the `loading` spinner; the rest fail silently. If any non-profile call is slow, sections pop in asynchronously after the page is already interactive, causing layout shift. For a user who taps the crisis button while the page is still loading, this is fine (crisis is a direct link). But the DailyCheckinCard and FeedbackCard may appear mid-interaction and distract. Fix: show skeleton cards for sections that are loading, or load them lazily below the fold.

**P1 — DailyCheckinCard severity and time-slot buttons: `py-2.5` / `py-1.5` are below 44px minimum**
The three severity buttons (`calm`, `mild`, `tough`) in `DailyCheckinCard.tsx` use `py-2.5 text-xs`, which produces a tap target of approximately 32px. The four time-slot buttons use `py-1.5 text-xs` — approximately 26px. Both are well below WCAG 2.5.5. A stressed caregiver trying to quickly tap "tough" at 3 AM will frequently mis-tap. Fix: set `min-h-[44px]` on all buttons in this card.

**P2 — "Today at" / "Yesterday at" in mobile ConversationHistory are hardcoded English**
`formatTimestamp()` in `(tabs)/home.tsx` (lines 25–29) builds these strings with template literals. The time is locale-formatted via `toLocaleTimeString`, but the surrounding words are English. Fix: pass these strings through `i18n.t()` with date as a parameter.

---

## `/crisis` (Web) + `crisis` (Mobile)

### Issues

**P1 — MedicalDisclaimer: "Before you continue" and "I understand — continue" are not translated**
Both the web (`MedicalDisclaimer.tsx` line 25, 55) and mobile (`MedicalDisclaimer.tsx` lines 44, 92) render these headings and CTA in hardcoded English. The disclaimer is the gate users see before accessing any AI feature. For a non-English speaker this is opaque. Fix: move both strings into `common.json` and use `tc()`. Title and CTA are the minimum; all body text should follow.

**P1 — Crisis page "Back to home" label is hardcoded English in two places**
In `crisis/page.tsx` lines 171 and 199, `<BackButton href="/home" label="Back to home" />` uses a literal string. The `BackButton` accepts a `label` prop that appears as screen-reader text and visible ARIA label. Fix: use `tc('nav.back_to_home')` (already defined for other pages).

**P1 — "Speak now..." voice prompt is hardcoded English in three web components**
`CrisisInput.tsx` (line 96), `CheckInScreen.tsx` (line 124), and `ScenarioInteraction.tsx` (line 272) all render `'Speak now...'` as a literal string. This is visually displayed above the textarea while voice recognition is active. Fix: add to `common.json`.

**P1 — Mobile crisis footer send button is 36px tall — below touch target minimum**
In `mobile/src/app/crisis.tsx` line 424, the send `Pressable` has `height: 36`. This is 8px below the iOS HIG minimum of 44pt. The mic button is correctly 44×44. The send button is the higher-urgency action. Fix: set `height: 44` and increase `paddingHorizontal` proportionally. ([Apple HIG: Accessibility — target size](https://developer.apple.com/design/human-interface-guidelines/accessibility))

**P2 — No auto-scroll to new content when history loads on session resume (web)**
When a caregiver resumes a previous session via `?session_id=`, `loadingHistory` shows a spinner, then the history renders. The page does not scroll to the bottom after history loads. The user sees the oldest exchange at the top, not the most recent. Fix: after `setHistory(exchanges)` completes, scroll the content container to the bottom.

**P2 — Streaming "still working" indicator uses a pulsing dot with no text alternative on mobile**
On mobile (`crisis.tsx` line 360), the in-progress indicator is a filled circle (`width: 8, height: 8`) plus muted text. The dot has no `accessibilityRole` or `accessibilityLabel`. For VoiceOver users, this decorative status indicator is invisible. The text beside it is fine. The dot itself should have `accessibilityElementsHidden={true}`.

---

## `/check-in` (Web) + `check-in` (Mobile)

### Issues

**P1 — MedicalDisclaimer wraps check-in but check-in is emotional support, not AI medical guidance**
The web `check-in/page.tsx` wraps `CheckInScreen` in `MedicalDisclaimer`, so every new user must acknowledge the disclaimer before journaling. The disclaimer is appropriate for the crisis/moment-coach feature (AI responding to behavioral crises), but a check-in / journaling prompt is lighter in nature. Showing the same clinical disclaimer conflates the two and may feel alarming to a caregiver who just wants to write how their day went. Consider: either use a lighter variant of the disclaimer for check-in, or gate the disclaimer at the app level on first use rather than per-feature. The mobile check-in correctly wraps in `MedicalDisclaimer` for consistency, but the question is whether this wrapper is right for this feature.

**P1 — On mobile, the MicButton is placed outside the `TextInput` at `flex-start` alignment**
`mobile/src/app/check-in.tsx` lines 114–137 place the `TextInput` (`flex: 1`) and `MicButton` side by side in a row. With `alignItems: 'flex-start'`, the mic icon sits at the top of the text area. On a 5-line input this means the mic is near the top-left, but the voice indicator (listening state) is hidden because the component has no visible listening feedback in this layout. The web version correctly shows a "Listening..." badge inside the textarea. Add the listening indicator to the mobile check-in input.

**P2 — No character counter on web check-in textarea**
The crisis input shows a `0 / 500` character counter. The check-in textarea (`CheckInScreen.tsx`) has no limit indicator. If the API has a maximum payload size, users could silently be truncated. Define and display a limit (or confirm there is none).

---

## `/learn` + `/learn/[id]` (Web) + `(tabs)/learn` + `learn/[id]` (Mobile)

### Issues

**P1 — Scenario cards use `role="button"` on a `<div>` instead of a `<button>` or `<a>`**
`ScenarioList.tsx` lines 117–129 render scenario cards as a `<div role="button" tabIndex={0}>`. While the keyboard handler is implemented, `role="button"` on a div does not inherit native button behaviors (activation on Space bar via the OS, touch feedback on mobile web, reliable focus-visible styling). Fix: replace with a `<button>` element or an `<a href>` pointing to `/learn/${scenario.id}`. Using a semantic `<button>` also removes the need for the manual `onKeyDown` handler. ([MDN: ARIA button role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/button_role))

**P2 — Category filter chips use `role="listbox"` + `role="option"` but only one item is selectable at a time**
`ScenarioList.tsx` wraps the category filter in `role="listbox"` with chips as `role="option"`. Listbox is a single- or multi-select widget per ARIA spec — this use is correct for single-select. However, the selected chip label does not announce the change via `aria-live`. Screen reader users pressing Tab through chips won't hear which filter is currently active. Fix: add `aria-live="polite"` on a visually hidden element that announces the current filter, or use `role="radiogroup"` + `role="radio"` which more naturally models a single-select group. ([WAI-ARIA listbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/))

---

## `/profile/setup` (Web) + `profile/setup` + `profile/edit` (Mobile)

### Issues

**P1 — Profile wizard success screen: access code has no copy-to-clipboard button**
`ProfileWizard.tsx` lines 185–193 display the access code in a large typographic display with `select-all cursor-text` and a tooltip "Click to select and copy". This is a desktop pattern. On mobile touch, users must long-press > select > copy from a context menu — multiple steps. At this moment (profile just created, caregiver is excited/anxious) a single-tap "Copy code" button prevents losing the code. Fix: add a `<button>` that calls `navigator.clipboard.writeText(successCode)` with a brief "Copied!" confirmation toast.

**P2 — Disease-stage color coding in avatar uses red for "late" stage**
`ProfileView.tsx` uses `bg-error/15 text-error` (red) for the late-stage avatar. Red carries implicit negative/danger connotation. For a caregiver who is already in the late stage of caring for their loved one, seeing red on the patient avatar every time they open the app is emotionally loaded. Consider a neutral palette (slate, indigo) that communicates stage without evaluative color semantics. ([NIA: Supporting Caregivers — Emotional Considerations](https://www.nia.nih.gov/health/caregiving/caring-person-alzheimers-disease))

---

## Journey Deflection Pages (`/journey/{noticing,diagnosis,hospice,bereavement}`)

### Issues

**P2 — All four journey page titles, subtitles, and body content are hardcoded English in server components**
`frontend/src/app/[locale]/journey/noticing/page.tsx` (and the other three) render all prose as JSX string literals. They live under `[locale]/` but none of the text is behind `useTranslations` or `getTranslations`. For a user browsing in French, Tamil, or Arabic, these pages are entirely in English. Fix: extract all strings to `journey.json` and use `getTranslations('journey.noticing')` in each server component.

**P2 — `DeflectionLayout` BackButton label is hardcoded "Back to home"**
`DeflectionLayout.tsx` line 21 passes `label="Back to home"` as a literal. Fix: accept the label as a prop and pass the translated value from the parent page, or pass `tc('nav.back_to_home')` inside `DeflectionLayout` by wiring a translations call.

**P2 — External resource links open in `_blank` with no visual warning**
The resource links in `DeflectionLayout` for non-phone resources open in a new tab (`target="_blank"`). There is no icon or text indicating this. For a screen reader user or a caregiver who is disoriented, an unexpected new tab can be confusing. Fix: add a visually displayed external-link icon and visually hidden `(opens in new tab)` text to each external link. ([WCAG 2.4.4 Link Purpose](https://www.w3.org/TR/WCAG22/#link-purpose-in-context))

---

## `/impact` (Web)

### Issues

**P2 — Impact page is a server component with no loading state visible to the user**
`impact/page.tsx` is an `async` server component that calls `fetchImpact()`. If the backend is slow, Next.js will block rendering the page entirely. There is no `loading.tsx` sibling file for this route. Fix: add a `loading.tsx` with a skeleton or spinner for this route, or use `Suspense` to stream the page.

**P2 — Impact page has no back navigation**
The page is reached via a `<Link>` in `HomeScreen.tsx` but has no `BackButton` or breadcrumb. The browser back button works, but given the shallow app structure a consistent "Back to home" button is expected by this persona. Fix: add a `<BackButton href="/home" />` at the top of the page.

---

## Mobile-Only Issues

**P1 — Welcome/index screen (`index.tsx`) is almost entirely hardcoded English**
The welcome screen renders "Calm guidance when your loved one needs you most.", "Get Started", "I have an access code", and "Your conversations are private. No personal data is stored on our servers." as literal strings. None are behind `i18n.t()`. This is the first screen every new user sees. Fix: add a `welcome` namespace to `common.json` and use `tc()` throughout.

**P1 — Mobile tab bar has no `check-in` tab — the feature is only reachable from home**
The bottom tab bar has three tabs: Home, Practice, Profile. Check-in is accessed only via the home screen quick-actions grid. During a 3 AM crisis a caregiver who lands on the home tab after an emergency may miss the check-in entirely. The web has the same structure (no bottom nav, check-in is a quick action). This is a navigation depth issue — consider whether check-in (which is a daily repeated action) warrants a tab, or at least a persistent shortcut. ([NN/g: Navigation in Mobile Apps](https://www.nngroup.com/articles/mobile-navigation-patterns/))

**P2 — Mobile profile screen language picker (`▴` / `▾` chevrons) has no `accessibilityLabel`**
The language selector `Pressable` in `profile.tsx` lines 283–316 uses text `▴` / `▾` as the expand/collapse indicator. Screen readers will announce these as "black up-pointing small triangle" — not meaningful. Fix: set `accessibilityLabel={languageOpen ? 'Collapse language picker' : 'Expand language picker'}` on the outer Pressable.

**P2 — Mobile profile screen sign-out uses `Alert.alert` — the destructive action is `style: 'destructive'` but cancel is listed first**
iOS presents `Alert.alert` buttons in the order given. In `profile.tsx` line 109 the buttons array is `[Cancel, Sign Out]`. On iOS the destructive button should typically be the last item, which it is — this is correct. However, the Android presentation renders buttons differently and "Sign Out" may appear first visually. Verify on Android that the cancel/confirm ordering is safe.

---

## Cross-Cutting Themes

1. **Hardcoded English throughout mobile.** The welcome screen, login errors, medical disclaimer, journey page titles, "Today at / Yesterday at", and multiple UI prompts ("Speak now...", "Back to home", "No profile loaded") are never translated. This is the highest-volume i18n gap. A single pass over all `.tsx` files in `mobile/src/app/` to replace literals with `tc()` would fix most of these.

2. **EmergencyBar touch targets are dangerously small on both platforms.** The `py-0.5` / `paddingVertical: 2` styling produces ~20px buttons. These are life-safety links. They must meet 44px minimum on every screen they appear.

3. **MedicalDisclaimer is untranslated and gatekeeping too broadly.** The gate before every AI feature shows English-only copy. Given the 55–70 caregiver persona and 11-locale target, this is both an accessibility and a trust failure at the entry point.

4. **Secondary body text is consistently at `text-sm` (14px) or `text-xs` (12px).** Hints, labels, subtitles, and metadata throughout both platforms use 12–14px text. For the target persona with reading glasses this is at or below threshold. NIA and NNg guidance recommends 16–18px body text for older adults. A global pass to promote secondary text from `text-xs` → `text-sm` and `text-sm` → `text-base` would address this. ([NIA: Making Your Website Senior Friendly](https://www.nia.nih.gov/health/websites-and-online-tools/making-your-website-senior-friendly))

5. **DailyCheckinCard buttons are below 44px across the board.** Severity and time-slot buttons are 26–32px tall. This entire component needs a height audit.

6. **Home screen is too dense with conditional sections.** Up to 11 sections stack below the fold. Conditional cards (feedback, check-in, tonight's outlook) should be collapsed or paginated to reduce cognitive load for a stressed user.

7. **No copy-to-clipboard affordance on the access code at profile creation.** Caregivers lose their access code if they don't screenshot it. A one-tap copy button with confirmation is the correct UX for this moment.

8. **Journey pages are entirely untranslated server components.** All prose on 4 deflection pages is hardcoded English. These pages often address emotionally vulnerable users (hospice, bereavement) — encountering them in a foreign language undermines trust.

9. **External links on deflection pages have no new-tab warning.** Missing visual indicator and screen reader text for `target="_blank"` links. A simple `aria-label` addition per link resolves the accessibility concern.

10. **`prefers-color-scheme` is not respected as a fallback.** Users who rely on OS-level dark mode for eye strain (common in the 55–70 age group) will see the light theme until they manually toggle. Cookie-based theme is fine for persistence; OS preference should be the default.
