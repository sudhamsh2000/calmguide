# CalmGuide Design System

**Status:** living document, source of truth for CalmGuide's visual design.
**Scope:** web (`frontend/`) today; §21 documents how these tokens are meant
to map onto `mobile/` when that redesign is scheduled — mobile is **not**
touched by this pass.
**Implementation:** `frontend/src/app/globals.css` (CSS custom properties)
+ `frontend/tailwind.config.ts` (semantic Tailwind tokens reading those
variables). Component code should consume the semantic Tailwind classes
(`bg-primary`, `text-foreground-muted`, `bg-accent-mint`, …), never a literal
hex value.

---

## 1. Design Philosophy

CalmGuide is used by someone standing in a hallway at 3 a.m., holding a
phone in one hand, trying to figure out what to do about their parent right
now. Every design decision is subordinate to that moment:

- **Calm, not clinical.** Warm paper backgrounds, teal rather than
  hospital blue, rounded corners, generous whitespace. The product should
  feel like a companion, not a chart.
- **Human, not robotic.** Copy and layout favor plain language and
  reassurance over dense information density. This is why the home screen
  audit flags "too many stacked sections" as a real problem, not a nitpick.
- **Safe, always visible.** Emergency access (911/988/Alzheimer's
  Association helpline) is never more than one tap away, and safety-critical
  UI (`SafetyDisclosure`, `MedicalDisclaimer`, `EmergencyBar`) is never
  styled to recede into the background the way a legal footnote would.
- **Accessible by default.** WCAG AA is the floor, not a stretch goal —
  a caregiver in a stressful moment, using one hand, in low light, in a
  second language, is the baseline user, not an edge case.
- **Low cognitive load.** One primary action per screen where possible.
  Progressive disclosure over exhaustive dashboards.
- **3 a.m. usable.** Large touch targets, high contrast, no fine print
  required to operate the app, works one-handed, works in the dark (literal
  dark mode, and figuratively — a scared, tired user).
- **Healthcare-aware, not healthcare-cosplay.** CalmGuide borrows credibility
  cues from digital health (calm palettes, clear hierarchy, disclaimers
  where appropriate) without imitating an EHR portal — see §22 for exactly
  which clinical claims are and are not safe to make in copy.

---

## 2. Brand Assets

### 2.1 Current, in-use brand mark (as of this pass)

The actual CalmGuide logo — confirmed against the marketing reference images
supplied for this redesign and the files dropped in `design/references/logos/` — is a
teal/mint gradient speech-bubble containing a heart and a winding path, next
to a wordmark reading **"Calm"** (navy) **"Guide"** (teal gradient) with a
small coral accent dot. This is consistent with the teal/navy color tokens
already live in `globals.css` (§3).

Source files (**do not redraw, recolor, or regenerate — use as-is**):

| File | Original source | Contents |
|---|---|---|
| `frontend/public/brand/calmguide-logo.png` | `design/references/logos/CALM GUID.png` | Full lockup: mark + "CalmGuide" wordmark, transparent-safe on light backgrounds |
| `frontend/public/brand/calmguide-x-leap-of-faith.png` | `design/references/logos/CalmGUID + LEAP OF FAITH.png` | Partnership lockup: CalmGuide mark+wordmark · "Partnered with" · Leap of Faith logo |
| `frontend/public/brand/leap-of-faith-logo.webp` | `design/references/logos/leap of FAITH.webp` | Standalone Leap of Faith logo (orange fish-spiral mark + wordmark) |

These are flattened raster exports (PNG/WebP), not vector source. They are
fine for nav bars, hero sections, and footers at the sizes used on the
landing page. They are **not** suitable as a source for regenerating
favicons or app icons at small sizes — that needs real vector source files
from whoever owns the brand assets.

**Where they're used in this pass:** landing page nav, hero, and footer
(§18). The in-app `PageBrand` component (used in the app shell header,
`components/ui/PageBrand.tsx`) continues to use its existing **text**
wordmark treatment (`Calm` in `font-bold` + `Guide` in `font-light`, both
`text-primary`) — this already matches the current brand's teal, so it was
left as-is rather than replaced with a raster image inside a 40px header
bar, where a photographic PNG would look soft.

### 2.2 ⚠️ Flagged: pre-existing SVG assets do not match the current brand

`frontend/public/` already contains a full icon/wordmark/lockup set —
`mark.svg`, `mark-ink.svg`, `mark-paper.svg`, `wordmark.svg`,
`wordmark-paper.svg`, `lockup-horizontal.svg`, `lockup-stacked.svg`,
`app-icon.svg`, `app-icon-night.svg`, `favicon.svg`, `favicon-16/32.png`,
`apple-touch-icon.png`, `og-image.svg/png` — but **these depict a different
logo**: a minimalist swirl-and-dot mark rendered in a serif display font
("Fraunces"), colored sage-green (`#3F5C50`) on a cream/tan background
(`#FBF7EE`–`#EFE7D6`), with near-black body text (`#2A2520`). This is a
different color family, different mark, and different type direction than
both (a) the teal/navy tokens already live in `globals.css` and (b) the
logo in the newly-supplied reference images and `design/references/logos/`.

Per this task's explicit instruction not to redraw, recolor, or approximate
the official logo, **this pass does not touch the SVG icon/favicon set** —
doing so would mean either inventing a vector redraw of the new mark (not
permitted) or leaving the site's actual favicon/app-icon mismatched with its
own landing page (worse). This is flagged here, not silently patched:

**Recommendation:** get real vector (SVG/AI/Figma) source files for the
current speech-bubble mark from whoever produced `CALM GUID.png`, then swap
`mark*.svg` / `wordmark*.svg` / `lockup-*.svg` / `app-icon*.svg` /
`favicon*` for vector re-exports of the *current* logo. Until then, the
favicon and browser tab icon will not visually match the landing page hero
— a known, documented gap, not an oversight.

### 2.3 Mobile assets

`mobile/assets/images/`: `icon.png`, `splash-icon.png`, Android
adaptive-icon layers, `tabIcons/`. Same mismatch likely applies (mobile app
icon was generated from the same old mark) — out of scope for this pass
per the brief (mobile UI redesign is a separate, later task), but worth
addressing together with §2.2 once vector source exists.

---

## 3. Color System

**Nothing below changes the *value* of an existing token** — every color
already in `globals.css` (`--color-primary`, `--color-background`,
`--color-foreground`, `--color-foreground-muted`, `--color-success`,
`--color-warning`, `--color-error`, `--color-surface`, `--color-border`,
and their `.dark` overrides) keeps its current hex value. This pass only
*adds* new tokens for surfaces, borders, and state colors that the app
needed but didn't have a name for yet (soft tinted backgrounds, an
elevated dark surface, a distinct "emergency" red separate from generic
"error" red, etc.). Everywhere marked "existing" below was already in
`globals.css` before this pass; everywhere marked "new" was added now.

### 3.1 Core brand

| Token | HEX | Mode | Purpose | Status |
|---|---|---|---|---|
| `--color-primary` | `#2B7A78` | Light | Primary CTA, links, brand teal | existing |
| `--color-primary-light` | `#3AAFA9` | Light (hover) / Dark (primary) | Hover state; becomes the primary brand teal in dark mode | existing |
| `--color-primary-dark` | `#17252A` | Light (active/press) | Pressed/active state for primary buttons | existing |
| `--color-primary-soft` | `#EAF7F6` | Light | Soft teal tint — badges, selected chip backgrounds | **new** |
| `--color-primary-soft` | `#244C4C` | Dark | Same, dark-mode equivalent | **new** |
| `--color-navy` | `#183B56` | Light | Marketing headline accent (landing page only) | **new** |
| `--color-navy` | *(= foreground)* | Dark | Falls back to standard dark-mode text color | **new** |
| `--color-ink` | `#1A2E3B` | Light | Alternate strong-heading tone | **new** |

### 3.2 Backgrounds & surfaces

| Token | HEX | Mode | Purpose | Status |
|---|---|---|---|---|
| `--color-background` | `#FAFAF5` | Light | Page background (warm paper) | existing |
| `--color-background` | `#1A2332` | Dark | Page background | existing |
| `--color-surface` | `#FFFFFF` | Light | Card/panel background | existing |
| `--color-surface` | `#243447` | Dark | Card/panel background | existing |
| `--color-surface-elevated` | `#FFFFFF` | Light | Same as surface in light mode (no extra elevation step needed) | **new** |
| `--color-surface-elevated` | `#2A3D52` | Dark | One step lighter than `--color-surface` — modals, popovers, raised cards | **new** |
| `--color-accent-mint` | `#DDF3EA` | Light | Soft mint tint — success-adjacent sections, feature highlights | **new** |
| `--color-accent-aqua` | `#DDF4F2` | Light | Soft aqua tint — coach/AI sections | **new** |
| `--color-accent-lavender` | `#EAE6F2` | Light | Soft lavender tint — behavioral-context / "smart" sections | **new** |
| `--color-accent-peach` | `#F7E4DC` | Light | Soft peach tint — warm, human-centered sections (never used for safety/error) | **new** |
| *(dark equivalents)* | low-alpha teal/lavender/peach washes | Dark | See `globals.css` `.dark` block | **new** |

### 3.3 Text

| Token | HEX | Mode | Purpose | Status |
|---|---|---|---|---|
| `--color-foreground` | `#2D3436` | Light | Primary text | existing |
| `--color-foreground` | `#E8E8E8` | Dark | Primary text | existing |
| `--color-foreground-muted` | `#636E72` | Light | Secondary/muted text — this remains the *one* secondary-text token app components use | existing |
| `--color-foreground-muted` | `#A0AEC0` | Dark | Secondary/muted text | existing |

We deliberately did **not** introduce a second, competing
"text-secondary/text-muted" pair for existing app components — the app
already has one muted-text convention (`foreground-muted`) used
consistently across dozens of components; adding a second, slightly
different gray would fragment it. `--color-navy` / `--color-ink` (§3.1) are
additive *heading* accents for the landing page, not replacements for body
text tokens.

### 3.4 Borders

| Token | HEX / value | Mode | Purpose | Status |
|---|---|---|---|---|
| `--color-border` | `rgba(0,0,0,0.1)` | Light | Default hairline border | existing |
| `--color-border` | `rgba(255,255,255,0.045)` | Dark | Default hairline border | existing |
| `--color-border-soft` | `#E9EEEC` | Light | Lighter divider, e.g. between list rows | **new** |
| `--color-border-soft` | `#33465c` | Dark | Same | **new** |
| `--color-border-strong` | `#C9D5D2` | Light | Emphasized border, e.g. focus-adjacent outlines | **new** |
| `--color-border-strong` | `#4A5D70` | Dark | Same | **new** |

### 3.5 State colors

| Token | HEX | Mode | Purpose | Status |
|---|---|---|---|---|
| `--color-success` | `#00B894` | Light | Success text/icon | existing |
| `--color-success` | `#43C9A8` | Dark | Success text/icon (brightened for dark contrast) | **new value in dark** — see note below |
| `--color-success-bg` | `#E8F8F3` | Light | Success banner/chip background | **new** |
| `--color-success-text` | `#087A64` | Light | Success text *on* `--color-success-bg` (AA contrast) | **new** |
| `--color-warning` | `#FDCB6E` | Light | Warning text/icon | existing |
| `--color-warning` | `#F4C96B` | Dark | Warning text/icon | **new value in dark** — see note below |
| `--color-warning-bg` | `#FFF7E3` | Light | Warning banner/chip background | **new** |
| `--color-warning-text` | `#805F18` | Light | Warning text on `--color-warning-bg` | **new** |
| `--color-error` | `#B84C36` | Light | Error text/icon | existing |
| `--color-error` | `#F0937F` | Dark | Error text/icon | existing |
| `--color-error-bg` | `#FBEDEA` | Light | Error banner/chip background | **new** |
| `--color-emergency` | `#A63D2C` | Light | 911/crisis-specific red — deliberately a touch darker/more saturated than generic `error` so the EmergencyBar reads as categorically different from a form-validation error | **new** |
| `--color-emergency` | `#F0937F` | Dark | (= dark-mode error; kept identical since dark-mode error is already reserved for this purpose) | **new** |
| `--color-emergency-bg` | `#FFF1EE` | Light | Emergency banner background | **new** |
| `--color-emergency-bg` | `#4A2928` | Dark | Emergency banner background | **new** |

**Note on `--color-success` / `--color-warning` dark-mode values:** the
`.dark` block previously did not override `--color-success` or
`--color-warning` at all (both silently fell back to their light-mode hex —
`#00B894` and `#FDCB6E` — even in dark mode). Both already pass AA against
the dark background (`#1A2332`) at those values, so this wasn't a visible
bug, but the slightly brighter `#43C9A8` / `#F4C96B` are a deliberate,
small dark-mode-only bump for consistency with how `--color-error` was
already handled (it *does* get a dedicated, brighter dark-mode value,
`#F0937F` vs. light's `#B84C36`). **Old → new:** `success` dark:
`#00B894` → `#43C9A8`; `warning` dark: `#FDCB6E` → `#F4C96B`. Both changes
verified AA (≥ 4.5:1) against `#1A2332` and `#243447`.

### 3.6 Landing-page footer

| Token | HEX / value | Mode | Purpose | Status |
|---|---|---|---|---|
| `--color-footer-bg` | `#1A2332` | Both | Solid fallback value for the footer band — kept for reference/`bg-footer`, but the rendered footer uses `.landing-gradient-footer` (§3.7) instead as of the 2026-09-01 palette pass | **new** |
| `--color-footer-text` | `#F5F6F8` | Both | Primary text on the footer band | **new** |
| `--color-footer-text-muted` | `#A7B3C4` | Both | Secondary/link text on the footer band | **new** |
| `--color-footer-border` | `rgba(255,255,255,0.08)` | Both | Hairline dividers inside the footer | **new** |

`text-footer-text` / `text-footer-muted` wired into Tailwind
(`tailwind.config.ts`). Landing-page only — no other surface in the app uses
these. Not overridden under `.dark`: the footer is a constant dark strip
regardless of site theme, a common marketing-site pattern.

### 3.7 Landing-page gradients & updated soft-tint values

Palette pass, 2026-09-01 — supplied hex values for the landing page. Three
of the existing soft-tint tokens (§3.2) changed *value* (landing-page-only
tokens, confirmed via `grep` that nothing outside `page.tsx` references
them, so this is safe and doesn't touch any other screen):

| Token | Old HEX | New HEX | Status |
|---|---|---|---|
| `--color-accent-mint` | `#DDF3EA` | `#EFF8F5` | changed |
| `--color-accent-aqua` | `#DDF4F2` | `#EAF7F6` | changed |
| `--color-accent-lavender` | `#EAE6F2` | `#F3F1F8` | changed — resolves the gap flagged in the 2026-09-01 rebuild entry below |
| `--color-accent-blue` | — | `#EAF4FB` | **new** — "Light Blue," hero blob gradient only |

Three CSS utility classes (`globals.css`, not Tailwind arbitrary values,
since these are fixed multi-stop gradients at non-standard angles):

- `.landing-gradient-hero` — `linear-gradient(135deg, #EAF7F6 0%, #EAF4FB 55%, #F3F1F8 100%)`, with a translucent-teal/blue/lavender `.dark` equivalent (the light pastel version would wash out on the dark background). Replaces the two separate blurred aqua/lavender circles behind the hero phones with one combined blob.
- `.landing-gradient-cta` — `linear-gradient(100deg, #13B8AA 0%, #079EB4 45%, #0877B7 100%)`. Replaces `bg-gradient-to-br from-primary to-navy` on the final-CTA panel. No `.dark` override needed — self-contained panel, reads fine on either page background.
- `.landing-gradient-footer` — `linear-gradient(120deg, #102D4E 0%, #0A3155 55%, #08294B 100%)`. Replaces the flat `bg-footer` on the footer band. Also theme-invariant, same rationale as §3.6.

**Deliberately not changed:** the requested "Secondary Text" (`#5F6B70`)
and "Muted Text" (`#738086`) were not added as new tokens — §3.3 already
documents a deliberate decision not to fragment the app's single
`foreground-muted` convention with near-duplicate grays, and the
differences here (vs. the existing `#636E72`) are only distinguishable in
a side-by-side swatch, not in practice. Same reasoning for "Default
Border" (`#DDE5E3`) — already extremely close to the existing
`--color-border-soft` (`#E9EEEC`).

---

## 4. Typography

| Family | CSS var | Usage |
|---|---|---|
| Nunito | `--font-body` | Body text, UI labels — `font-sans` |
| Nunito Sans | `--font-display` | Headings — `font-display` |
| Noto Sans Arabic | `--font-arabic` | `[lang^="ar"]` |
| Noto Sans JP | `--font-jp` | `[lang^="ja"]` |
| Noto Sans KR | `--font-kr` | `[lang^="ko"]` |
| Noto Sans SC | `--font-sc` | `[lang^="zh"]` |

All loaded via `next/font/google` in `frontend/src/app/[locale]/layout.tsx`
with `display: "swap"`. **Do not remove any of these** — they're what keeps
RTL/CJK locales from silently falling back to the system font.

### Type scale (landing page + app, current + newly formalized)

| Role | Size / line-height | Weight | Font | Notes |
|---|---|---|---|---|
| Display XL (landing hero) | 3rem–3.75rem / 1.1 (`text-5xl md:text-6xl`) | 700 | display | New — landing page only |
| Display (section headline) | 2.25rem / 1.15 (`text-4xl`) | 700 | display | New — landing page only |
| H1 (app page title) | 1.25rem (`text-xl`) | 500 | display | existing convention across app headers |
| H2 (section heading) | 1.125rem (`text-lg`) | 600 | display or sans | existing |
| H3 (card title) | 1rem (`text-base`) | 600 | sans | existing |
| Body / coach | 1.125rem / 1.6 (`text-coach`) | 400 | sans | existing — Moment Coach responses |
| Body | 1rem (`text-base`) | 400 | sans | existing default |
| Small / secondary | 0.875rem (`text-sm`) | 400–500 | sans | existing — this is the floor for anything read as body copy; `text-xs` (12px) is reserved for timestamps/badges/microcopy, not primary content |
| Caption | 0.75rem (`text-xs`) | 500 | sans | badges, timestamps only |

---

## 5. Spacing

Tailwind's default 4px-based scale is used as-is (no custom override needed
— `p-1`…`p-32` already covers this). Reference values used deliberately
across the redesign:

`4px · 8px · 12px · 16px · 20px · 24px · 32px · 40px · 48px · 64px · 80px ·
96px · 120px`

Landing-page section vertical rhythm uses the 64/96/120px steps
(`py-16 md:py-24 lg:py-32`); in-app card/list spacing stays in the
4–24px range, matching existing component code.

---

## 6. Border Radius

| Token | Value | Usage |
|---|---|---|
| XS | 8px (`rounded-lg`... Tailwind's `rounded-lg`=8px) | small chips |
| SM | 12px (`rounded-xl`) | inputs, buttons — matches existing `.field-shell` |
| MD | 16px | — |
| LG | 20px | — |
| XL | 24px (`rounded-2xl`) | cards — matches existing `.card-shell` |
| 2XL | 32px (`rounded-3xl`) | landing-page hero panels, large feature cards |
| Pill | 9999px (`rounded-full`) | tags/chips, EmergencyBar 911 badge |

These match Tailwind's default scale exactly (`rounded-xl` = 12px,
`rounded-2xl` = 24px), so no config changes were needed — this section
documents the *convention* (which radius for which component tier), since
none existed before.

---

## 7. Elevation / Shadows

CalmGuide uses restrained, low-opacity shadows — never a heavy drop shadow.

| Level | CSS | Usage |
|---|---|---|
| Inset highlight | `inset 0 1px 0 rgba(255,255,255,0.72)` | `.field-shell` top highlight (light mode) |
| Card resting | `0 1px 2px rgba(23,37,42,0.05)` | Card / message bubble default |
| Card hover | `0 1px 3px rgba(23,37,42,0.08)` | On hover for interactive cards |
| Primary CTA | `shadow-lg` (Tailwind default) | Hero/primary CTA buttons only |
| Focus halo | `0 0 0 6px rgba(255,255,255,0.85)` (light) / `rgba(0,0,0,0.7)` (dark) | `.focus-ring` — paired with the 3px outline, see §16 |

Dark mode never uses shadows for elevation (shadows disappear against a
dark background) — it uses a 1px border + subtle inset highlight instead
(`.dark .card-shell`), which is why `--color-surface-elevated` (§3.2)
exists: in dark mode, "elevated" means a *lighter fill*, not a shadow.

---

## 8. Buttons

Source: `frontend/src/components/ui/Button.tsx` (existing, refined here —
not replaced).

| Variant | Background | Text | Hover | Active | Disabled |
|---|---|---|---|---|---|
| `primary` | `bg-primary` | white | `bg-primary-light` | `bg-primary-dark` | `bg-primary/45` |
| `secondary` | `.outline-button` (teal-tinted outline) | `text-primary` | border darkens | fill darkens | `text-primary/55` |
| `danger` | `bg-error` | white | `bg-error/90` | `bg-error/80` | `bg-error/45` |
| `ghost` | transparent | `text-foreground` | `bg-foreground/5` | `bg-foreground/10` | `text-foreground-muted` |

New, documented-but-not-yet-componentized variant for landing-page/crisis
contexts — **`emergency`**: `bg-emergency text-white hover:bg-emergency/90`,
used only for the 911 call-to-action, never for a generic destructive
action (that's what `danger` is for).

| Size | Height | Padding | Radius | Font |
|---|---|---|---|---|
| `sm` | 32px (`h-8`) | `px-3` | `rounded-lg` (8px) | `text-sm` |
| `md` | 40px (`h-10`) | `px-4` | `rounded-xl` (12px) | `text-base` |
| `lg` | 48px (`h-12`, `min-w-tap`) | `px-6` | `rounded-xl` | `text-lg` |

**Touch targets:** `sm` (32px) and `md` (40px) fall under the 44px floor
by design — they're intended for desktop/pointer-dense contexts (e.g.
inline actions inside a dense facility table). Anywhere a button is a
*primary* action on a touch surface, use `lg` or apply `min-h-tap`
explicitly (see §11 for the audit fix on `DailyCheckinCard`, which now does
this).

Focus state: every button gets `.focus-ring` (§16) — a 3px solid outline in
`--color-primary` with a 2px offset and a white/black halo so it's visible
over any button color.

---

## 9. Cards

Source: `frontend/src/components/ui/Card.tsx` + `.card-shell*` classes in
`globals.css`.

| Variant | Class | Usage |
|---|---|---|
| Standard | `card-shell` | Default panel — `rounded-2xl border bg-surface` |
| Interactive | `card-shell-interactive` | Adds hover tint + border-color shift; use for tappable cards (`PatientCard`, `IncidentPatternCard`) |
| Selected | `card-shell-selected` | Teal-tinted fill + inset ring — chip/option selection state |
| Safety | *(new convention)* `border-error/20 bg-error-bg` | `SafetyDisclosure`, gate-triggered messages |
| Emergency | *(new convention)* `border-emergency/20 bg-emergency-bg` | Crisis-specific banners, distinct from generic safety copy |
| Feature (landing) | `rounded-3xl border border-theme-soft bg-accent-{mint,aqua,lavender,peach}` | Landing-page feature/benefit cards — soft tint background, no heavy border |
| Dashboard | `card-shell` + `p-4` | Home-screen summary cards (`KpiCard`, pattern cards) |

---

## 10. Inputs

Source: `.field-shell` / `.field-shell-error` / `.field-readonly-shell` in
`globals.css`, `components/ui/Input.tsx`.

- **Text field:** `.field-shell` — rounded-xl border, subtle inset
  highlight, teal focus ring (`0 0 0 3px rgba(58,175,169,0.18)`).
- **Textarea:** same shell, `min-h` set per use-site (e.g. incident notes).
- **Select:** `.field-shell` + `.select-chevron` (custom SVG chevron,
  RTL-aware — flips to the left edge under `[dir="rtl"]`).
- **Search:** same shell + a leading icon slot (no dedicated class; handled
  in the consuming component).
- **Access code field** (`login/page.tsx`): same `.field-shell`, with
  `tracking-[0.35em]` letter-spacing and `text-xl font-bold` — a deliberate
  one-off treatment for an 8-character code, not a new input variant.
- **Validation states:** `.field-shell-error` — red border + red focus
  ring, paired with an `aria-describedby` hint (already implemented in
  `login/page.tsx`).

---

## 11. Touch Targets

**Absolute minimum: 44×44px. Preferred: 48×48px** (`min-h-tap` /
`min-w-tap` in `tailwind.config.ts`, already `48px`).

Audit status as of this pass:

| Component | Before | After | Status |
|---|---|---|---|
| `EmergencyBar` (911/988/Alzheimer's helpline links) | `min-h-[48px]` already present on each `<a>` | unchanged | **Already compliant** — this was fixed in an earlier pass (see README "P0 — EmergencyBar 911/988 fix on web"); the 2026-04-28 audit predates that fix. |
| `DailyCheckinCard` severity buttons (calm/mild/tough) | `py-2.5 text-xs`, no explicit min-height (~34–38px effective) | `min-h-tap py-2.5 text-sm` | **Fixed this pass** |
| `DailyCheckinCard` time-slot buttons | `py-1.5 text-xs` (~26–28px) | `min-h-tap py-1.5 text-sm` | **Fixed this pass** |
| `DailyCheckinCard` "what helped" tag chips | `py-2 text-xs` (~32–36px) | `min-h-tap px-3 py-2 text-sm` | **Fixed this pass** |
| `DailyCheckinCard` "Done" button | already `min-h-[44px]` | now `min-h-tap` (48px, using the shared token instead of a one-off literal) | **Normalized this pass** |

---

## 12. Icons

Standard sizes: **16 · 20 · 24 · 32** (px). Existing inline SVGs across the
app already cluster around these (e.g. `EmergencyBar`'s checkmark icons at
16px, nav icons around 20–24px) — this section formalizes it rather than
changing anything. New landing-page section icons use 24px inside a 48px
soft-tint circle (matching the reference mockups' icon-in-circle pattern).

---

## 13. Motion

| Speed | Duration | Usage |
|---|---|---|
| Fast | 150ms | Hover/active color transitions (`transition-colors`) |
| Standard | 220ms | Card hover elevation, `card-shell-interactive` |
| Slow | 320ms–400ms | Page-level entrances (`animate-page-enter` = 400ms, `animate-slide-up` = 400ms) |

Easing: default `ease-out` for entrances, `ease-in-out` for
looping/ambient motion (`breathing`, `skeleton-shimmer`).

**Reduced motion:** already fully handled in `globals.css` — a
`@media (prefers-reduced-motion: reduce)` block disables all
`animate-page-enter` / `animate-slide-up` / `animate-fade-in-up` /
`skeleton` animations and clamps every animation/transition duration to
`0.01ms` globally. No changes needed here; new landing-page animations
inherit this automatically since they reuse the same utility classes.

---

## 14. Light Mode

Default mode. Warm paper background (`#FAFAF5`), white surfaces, teal
primary. This is the mode all reference marketing imagery for this
redesign was designed in.

## 15. Dark Mode

**Mechanism:** class-based (`darkMode: 'class'` in `tailwind.config.ts`),
toggled by adding/removing `.dark` on `<html>`.

**Preference resolution (already implemented, verified during this pass —
no change needed):**

1. Server reads the `THEME_COOKIE` cookie in
   `frontend/src/app/[locale]/layout.tsx`. If present, it wins —
   `<html class="dark">` is rendered server-side, no flash.
2. If **no** cookie exists (`useSystemTheme = true`), the server renders
   without `.dark`, and a `beforeInteractive` inline `<script>` checks
   `window.matchMedia('(prefers-color-scheme: dark)')` and adds `.dark`
   before the page becomes interactive — avoiding a hydration mismatch
   (the script mutates `<html>`, which React's hydration doesn't diff).
3. `ThemeToggle` (`components/ui/ThemeToggle.tsx`) sets the cookie on
   explicit user choice, which then wins on every subsequent load.

This already matches the desired logic from the audit ("no stored
preference → follow OS; explicit choice → cookie override"). **The
2026-04-28 audit's "dark mode doesn't default to OS preference" finding is
now stale** — it was fixed prior to this pass. No further change made here;
documenting current behavior for the record.

---

## 16. Accessibility

- **WCAG AA** contrast is the target for all text/background pairs; new
  state-color pairs in §3.5 (`success-bg`/`success-text`, etc.) were chosen
  specifically to hold ≥4.5:1.
- **Touch targets:** 44px minimum, 48px preferred — see §11 for current
  compliance status.
- **Font sizes:** 16px (`text-base`) is the floor for primary reading
  content (Moment Coach responses use `text-coach` at 18px); 14px
  (`text-sm`) is acceptable for secondary/UI-chrome text; 12px (`text-xs`)
  is reserved for badges/timestamps, never primary content.
- **Keyboard navigation:** all interactive elements are real `<button>`/
  `<a>`/form elements (no `div onClick`), so native tab order and Enter/
  Space activation work without extra wiring.
- **Focus:** `.focus-ring` (§7) gives every focusable element a 3px
  high-contrast outline with a halo, visible on both light and dark
  surfaces and over colored buttons.
- **Screen readers:** existing patterns already in place —
  `aria-live="polite"` on the streaming Coach response region, `aria-label`
  on icon-only buttons (`EmergencyBar`'s tel: links), `role="status"` for
  the streaming indicator. New landing-page sections use semantic
  `<section>`/`<nav>`/`<footer>` landmarks and a real heading hierarchy
  (one `<h1>`, nested `<h2>`s per section).
- **Reduced motion:** see §13 — already global.
- **Modal focus trapping:** `ConfirmDialog` already exists as the pattern
  to extend for any new modal; not modified in this pass.

---

## 17. Internationalization / RTL

- **3 supported locales (frontend):** `en` (default), `es`, `hi` — see
  `SUPPORTED_LOCALES` in `frontend/src/lib/locale.ts`, the single source of
  truth that `next-intl` routing/middleware derive from. `en` is the
  reference/complete locale; see `locales/REVIEW_STATUS.md` for per-locale
  review status. Support for `zh, ta, ar, fr, pt-BR, ja, de, ko` was removed
  from the frontend — see §24 change log. The `mobile/` app is out of scope
  for this doc and still tracks its own locale set separately in
  `mobile/locales/REVIEW_STATUS.md`.
- **RTL infrastructure (currently dormant):** none of the 3 active locales
  are RTL, so `isRtl()` in `frontend/src/lib/locale.ts` always returns
  `false` today. The plumbing is left in place as harmless groundwork in
  case an RTL locale is reintroduced — it is not exercised at runtime:
  - `dir="rtl"` wiring on `<html dir=...>` in `[locale]/layout.tsx`.
  - Logical properties/utilities (`ps-`, `pe-`, `ms-`, `me-`, `start-`,
    `end-`) used throughout instead of physical `pl-`/`pr-`/`left-`/`right-`.
  - `.select-chevron`'s `[dir="rtl"]` mirroring rule in `globals.css`.
  - Continue using logical properties on new UI regardless — it's the
    correct default even without an active RTL locale.
- **Font fallback removed:** the `[lang^="ar"|"ja"|"ko"|"zh"]` Noto Sans
  fallback rules in `globals.css` and their corresponding `next/font`
  loaders (`Noto_Sans_Arabic/JP/KR/SC`) in `[locale]/layout.tsx` were
  deleted along with the locales they served — those `lang` values can no
  longer occur. Only `--font-body` / `--font-display` (Nunito) remain.

---

## 18. Landing Page

New public marketing entry point, replacing the previous minimal
"Welcome" screen at `frontend/src/app/[locale]/page.tsx` (see §24 for
exactly what was there before and why it was expanded rather than added
as a second route).

**Layout escape hatch:** the shared `[locale]/layout.tsx` app shell (fixed
header, `max-w-lg` content column, fixed `EmergencyBar` footer, `h-dvh
overflow-hidden`) is correct for the in-app screens but wrong for a long,
wide, scrollable marketing page. Rather than duplicating the locale
layout tree (which would risk breaking `next-intl`'s routing), the landing
page opts out of that shell's chrome using the **same technique already in
production for facility mode** — a `data-*` attribute on `<html>` set by a
`beforeInteractive` script, matched by a CSS rule in `globals.css`:

```css
html[data-landing] #root-chrome-header,
html[data-landing] #root-chrome-footer { display: none !important; }
html[data-landing] #root-content { max-width: none; }
```

The landing page renders its own `<nav>` and `<footer>`, and the page
itself scrolls normally (it doesn't inherit the app shell's
`overflow-hidden`).

### Sections (in order) — rebuilt 2026-09-01 against an approved reference

The section list below reflects a full rebuild against a supplied
landing-page reference and six product-screen mockups (see §24's
2026-09-01 entry for the full brief and rationale). It **replaces** the
16-section list from the 2026-08-27 pass — three of that pass's sections
(standalone RAG-flow diagram, standalone DICE framework, standalone Voice)
were folded into other sections rather than dropped as content (see notes
inline below); nothing was deleted outright except duplicate structure.

1. **Sticky nav** — unchanged from the 2026-08-27 pass (CalmGuide lockup,
   same link set, "Try CalmGuide" CTA, scroll-triggered blur/shadow, mobile
   menu). Not touched in this pass.
2. **Hero** — two-column on `lg:` and wider (stacks on mobile). Left:
   eyebrow, headline with the word **"caregiving"** isolated into its own
   translation key (`hero.title_pre` / `title_highlight` / `title_post`)
   so it can be styled `text-primary` independent of locale word order,
   new shorter subtitle copy, primary/secondary CTA, the preserved
   "I have an access code" / "I'm care facility staff" entry points
   (functional-preservation note below still applies verbatim), and the
   Leap of Faith mark + partnership line directly under the CTA row. Right:
   two overlapping real product screenshots (`calmguide-home-coach.png` +
   `calmguide-moment-coach-response.png`, both from
   `design/references/landing-page/product-screens/`, copied into
   `frontend/public/brand/screens/`) over soft aqua/lavender blur shapes.
   - **On the screenshots' provenance:** these are supplied concept
     mockups, not captures of the shipped app — different nav chrome
     (a bottom tab bar the real app doesn't have), different copy. This
     conflicts with this document's own §23 "no fabricated screenshots"
     rule. Flagged explicitly to the user before use; **the user
     confirmed using them as-is**, so this is a documented, deliberate
     exception, not an oversight. Swap for real captures when available —
     no other page code changes needed, just the six files in
     `frontend/public/brand/screens/`.
   - **Functional preservation:** unchanged from 2026-08-27 — still
     wrapped in `WelcomeGate`, still redirects returning users before the
     marketing content renders.
3. **Value strip** — new. A `card-shell` panel ("Calm guidance. Confident
   care.") with 4 features (AI-guided support, personalized context,
   multilingual support, privacy first), each with a small line-icon drawn
   in the same stroke weight as the existing checkmark icon — not pulled
   from an external icon set.
4. **What is CalmGuide** — new, replaces the old standalone "Problem"
   section as the `#what-we-do` nav target. Two-column: text explaining
   what CalmGuide combines (caregiver input, patient context, behavioral
   history, trusted dementia-care knowledge, safety pathways, caregiver
   feedback — this is where the old RAG-pipeline section's content now
   lives, as prose + a checklist rather than a 7-step flow diagram) beside
   a `card-shell` checklist card.
5. **How CalmGuide works** — same 4-step structure as before, step titles
   reworded to imperative/active phrasing ("You describe what's
   happening" / "CalmGuide considers relevant context" / ... / "Feedback
   helps refine future support").
6. **Moment Coach showcase** — promoted to a larger, two-column "major
   product section" per the brief: the four real response-structure cards
   (unchanged copy) beside `calmguide-moment-coach-response.png` (large)
   with `calmguide-moment-coach-why.png` layered as a smaller offset
   accent — both from the same six-image set as the hero.
7. **Behavioral context** — same copy as before, now with an explicit
   5-item checklist (recurring triggers, previous episodes, strategies
   that helped, caregiver feedback, recent patterns) and
   `calmguide-behavior-profile.png` alongside it.
8. **Safety** — flow simplified from the old 5-step
   (Caregiver Input → Deterministic Gate → Safety Classification →
   Acute-Change Screening → Coach or Escalation) to the brief's 4-step
   (Caregiver Input → Safety Screening → Acute-Change Check → Coach or
   Escalation) — the "Deterministic Gate"/"Safety Classification" split is
   still accurate internally (`docs/SAFETY_ARCHITECTURE.md`) but is
   presented as one "Safety Screening" step here for a cleaner marketing
   flow. Disclaimer copy unchanged.
9. **3 a.m. experience** (`#for-caregivers`) — retitled "Designed for real
   life. Anytime, anywhere." Items list now explicitly includes
   "Voice-friendly experience" as one of five bullets — this is also
   where the old standalone Voice section's content now lives. That old
   section's "in development" badge was flagged separately (outside this
   rebuild) as stale marketing copy, since `MicButton`/`SpeakButton` are
   already wired into Coach, check-in, and scenario practice; folding
   voice into this list rather than keeping a standalone "in development"
   section resolves that staleness rather than just rewording it.
   `calmguide-daily-checkin.png` alongside the list.
10. **Healthcare / Technology** (`#technology`, with `#for-healthcare` as
    a nested anchor inside it) — the old separate Interoperability and
    Technology sections merged into one concise section per the brief,
    divided by a hairline rule: FHIR/HL7/OMOP/SNOMED CT/LOINC standards +
    caveat, then the tech-stack chip list. Copy unchanged, just combined.
    The old standalone DICE section's content did not carry forward into
    the new structure at all — it's still accurate internally (Moment
    Coach genuinely uses a DICE-adjacent workflow) but the brief's
    12-section list has no slot for it; the `landing.dice.*` locale keys
    are left in place (harmless, simply unreferenced) rather than deleted
    across all locale files for a section that may come back.
11. **Final CTA** — new copy and treatment: a `rounded-3xl
    bg-gradient-to-br from-primary to-navy` panel ("Ready to explore
    CalmGuide?"), replacing the old bare CTA-only section.
12. **Footer** — restructured from 2 nav columns to 3 (Explore / For You /
    Resources) plus the Leap of Faith mark on the right, matching the
    brief. Deliberately a fixed deep-navy band regardless of site theme
    (§3.6) rather than following `bg-surface` — a common, intentional
    marketing-site pattern, not a dark-mode bug. The old standalone
    "About / acknowledgments" section was folded into a compact paragraph
    inside the footer (still names Leap of Faith Technologies, Frank
    Naeymi-Rad PhD MBA, John Trzesniak, Heyt Gala, David M. Liebovitz MD,
    and Illinois Institute of Technology in full — nothing was cut, only
    moved) rather than kept as a full page section, since the brief's
    12-section list has no separate "About" slot; the footer's "About"
    link anchors to it (`#about`). A "Contact" resources link was
    requested by the brief but intentionally **not** added — no contact
    email or page exists anywhere in the repo, and inventing one would
    violate this document's own "don't fabricate" principle (§23); flag
    this to the user if a real contact channel exists to wire in.

### 18.1 Single source of truth for partnership copy

"Partnered with Leap of Faith" now lives in exactly one place: the
`common.landing.partner_line` translation key. **Important:** the true
source of truth is the repo-root `locales/<locale>/common.json` files, not
`frontend/locales/<locale>/common.json` — the latter is gitignored and is
silently overwritten on every build by the `prebuild` script (`cp -r
../locales/. ./locales`). All 11 locales' `landing` keys (including
`partner_line`) were added at the root path — see §24 for exact locale
coverage. The landing page and footer both reference that one key rather
than each hardcoding the string, so it can never drift.

---

## 19. Caregiver Web App

App-shell-level guidance for the existing authenticated screens
(`home`, `coach`, `check-in`, `profile`, `incidents`, `learn`, `journey`,
`impact`, `privacy`, `terms`):

- Keep the existing `max-w-lg` single-column shell — it's correct for a
  mobile-first, one-handed, 3 a.m. tool; do not widen it to desktop-app
  proportions.
- `card-shell` is the default container for any grouped content; avoid
  introducing a new container class per feature.
- Home-screen density (§1, §23): prefer grouping related cards under a
  shared section heading and progressive disclosure (e.g. collapsed
  "What we're noticing" until there's something to notice, per
  `docs/DEFERRED.md`'s push-notification alternative) over reducing
  functionality.
- Moment Coach should read as the primary action on the home screen —
  larger CTA, higher visual weight than secondary cards like
  `CarePatternCard`.

*(Note: this pass ships the design-system foundation, the landing page, and
the two concrete audit fixes in §11. Full page-by-page visual migration of
`home` / `coach` / `check-in` / `profile` / `incidents` / `learn` /
`journey` / `impact` is scoped but not executed in this pass — see the
Change Log entry in §24 for exactly what's done vs. queued.)*

---

## 20. Facility Interface

`components/facility/` (`Sidebar`, `TopBar`, `FacilityNav`, `KpiCard`,
`ResidentCard`, `StaffSelector`, `PinPad`) stays on the same brand tokens
(colors, type, focus, buttons) but may keep tighter spacing and a denser
information layout than the caregiver app — this is a B2B tool used by
staff scanning many residents at once, and forcing 3 a.m.-caregiver-level
whitespace onto it would hurt usability, not help it. Not restyled in this
pass; documented here so the next pass has the rule to follow.

---

## 21. Mobile Mapping

Not implemented in this pass — mobile UI is explicitly out of scope. For
when it is scheduled, the mapping is direct because the token *names*
(not the CSS-variable mechanism, which is web-only) translate 1:1:

| Web token | Suggested RN equivalent |
|---|---|
| `--color-primary` / `-light` / `-dark` / `-soft` | `theme.colors.primary.{default,light,dark,soft}` in `mobile/src/lib/theme` (or equivalent) |
| `--color-background`, `--color-surface`, `--color-surface-elevated` | `theme.colors.background`, `.surface`, `.surfaceElevated` |
| `--color-foreground`, `--color-foreground-muted` | `theme.colors.text.default`, `.muted` |
| `--color-{success,warning,error,emergency}` + `-bg`/`-text` | `theme.colors.state.{success,warning,error,emergency}.{default,bg,text}` |
| `--color-accent-{mint,aqua,lavender,peach}` | `theme.colors.accent.{mint,aqua,lavender,peach}` |
| Tailwind `min-h-tap`/`min-w-tap` (48px) | RN `theme.spacing.tap = 48` |
| Radius scale (§6) | `theme.radius.{xs,sm,md,lg,xl,2xl,pill}` |

Mobile already has its own `ThemeContext`/theme file
(`mobile/src/components/ThemeContext` per earlier architecture notes) —
the work is renaming/aligning its token keys to this table, not building a
parallel system from scratch.

---

## 22. Content / Clinical Claims

Safe, repo-verified public language:

- "CalmGuide is not a diagnostic tool."
- "CalmGuide does not replace healthcare professionals."
- "CalmGuide does not replace emergency services."
- "Guidance informed by trusted caregiving resources" (RAG sources are
  Alzheimer's Association, NIA, Mayo Clinic, HelpGuide, Family Caregiver
  Alliance, CDC — per `rag/scraper/crawl.py`'s docstring) — do **not** say
  "clinically validated" or "doctor-recommended" anywhere; neither is true
  today (`docs/SAFETY_ARCHITECTURE.md` explicitly disclaims clinical
  validation for the safety layers, and there's no clinical trial or
  provider endorsement in the repo to point to).
- Any statistic used publicly must ship with: value, description, source,
  year, URL, and a verification date. **No statistic is included in the
  landing page copy in this pass** — the brief flagged the existing
  caregiver-prevalence stat as needing correction (README roadmap P3-16,
  not yet done), so nothing numeric was added that would need the same
  fix later.
- Voice: "Voice-friendly experience in development" — not "voice-enabled"
  or "hands-free," since `MicButton`/`SpeakButton` exist but aren't
  presented elsewhere in the repo as a finished, guaranteed-available
  feature path.
- Interoperability: "CalmGuide is being designed with healthcare
  interoperability standards in mind so caregiver-observed information may
  eventually be represented in structured, clinically meaningful formats"
  — exact wording from the brief, deliberately non-committal about
  timeline or which EHRs.

---

## 23. Do / Don't Examples

**Do:**
- Warm paper background + white cards + teal CTA + generous whitespace
  (matches the reference marketing images supplied for this task).
- One clear primary action per screen/section, secondary actions visually
  quieter (ghost/outline buttons).
- Soft, single-hue tinted section backgrounds (mint/aqua/lavender/peach at
  low opacity) to differentiate sections without hard borders.
- Real, labeled, scoped claims ("Guidance informed by trusted caregiving
  resources") over generic AI-hype language ("revolutionary," "powered by
  advanced AI").

**Don't:**
- Neon gradients, glassmorphism, oversaturated color, huge/dramatic
  shadows — these all fight the "calm" brief.
- Chatbot-demo styling (message bubbles with avatars, "typing…" ellipses
  as a centerpiece) — Moment Coach is presented as structured guidance,
  not a generic chat toy.
- Fabricated screenshots, invented statistics, or claims like "clinically
  validated" (§22) — this project's own safety docs are explicit that no
  clinical validation has occurred.
- A dense, hospital-portal information grid on the caregiver-facing home
  screen — that's the facility interface's job (§20), not the caregiver
  app's.

---

## 25. Web + Responsive Mobile Redesign (2026-09-01)

Applies the approved CalmGuide mobile screen references
(`design/references/landing-page/product-screens/`) to the **in-app**
caregiver experience — desktop and responsive mobile web. Visual system
only: no backend, route, parsing, SSE, auth, or persistence changes.

### 25.1 Mobile reference → web screen mapping

| Reference screen | Web route / component | Treatment |
|---|---|---|
| Home / Coach | `/home` (`HomeScreen`) | Restyled; 2-column on `lg+` |
| Moment Coach response | `CoachResponseRenderer` | Four semantic section tints (§25.3) |
| Why This Is Happening | same component | Same — it's one of the four sections |
| Behavior Profile | `/profile` (`ProfileView`) | Card language + chip treatment (§25.5) |
| Daily Check-In | `DailyCheckinCard` | Icon selector + chips (§25.5) |
| Incident Log | `/incidents/new` (`IncidentLogger`) | Real line icons, 8 categories 1:1 |

**Two references could not be implemented literally**, and were adapted to
real data by explicit decision rather than by inventing fields:

- **Behavior Profile** draws a patient photo, "Age 78 • Alzheimer's Disease",
  "↓25% vs last week", and "Overall Stability 78%". None of that exists: the
  profile model stores disease stage, behavioral patterns, calming strategies
  and safety concerns, and the patient's name is deliberately **device-local,
  never sent to the server**. The reference's *card language* was adopted —
  "What Works Best" → calming strategies as teal chips, "What to Avoid" →
  safety concerns as coral chips — with no invented metrics (§22).
- **Daily Check-In** draws a 5-point *caregiver* mood scale and loved-one
  state chips (Slept well / Ate well / Took medications). The app records a
  3-point *loved-one* severity (`calm` / `mild` / `tough`) and tags that are
  *caregiver interventions* (music, redirection, calm approach) — a different
  subject entirely. The reference's selector treatment was adopted over the
  three real levels; no new fields were added.

### 25.2 Navigation

New `BottomNav` (`components/ui/BottomNav.tsx`), mobile only (`lg:hidden`),
mapped onto **existing routes** — no new pages, no route changes:

| Tab | Route |
|---|---|
| Coach | `/coach` |
| Insights | `/incidents` |
| Resources | `/learn` |
| More | `/profile` |

Nested routes keep their section active (`/incidents/new` → Insights lit).
Hidden on the landing page and all `/facility` routes, which have their own
chrome (`shouldShowBottomNav`). The references show a 5th "Log" tab on the
Incident Log screen only and disagree on tab count between screens; we
standardised on four everywhere rather than a nav bar that changes shape
per screen, which is exactly the cognitive load §1 argues against.

### 25.3 Moment Coach section colours

Four fixed semantic tints so the hierarchy reads at a glance under stress.
Tokens in `globals.css`, applied via `.coach-section-*` utility classes.

| Section | Light bg / text | Meaning | Contrast |
|---|---|---|---|
| Right Now | `#EAF7F6` / `#1F5F5D` | act now | 6.71:1 |
| Why This Is Happening | `#F3F1F8` / `#3F3A63` | context | 9.39:1 |
| What Not To Do | `#FBEDEA` / `#8F3A28` | avoid | 6.56:1 |
| When To Get More Help | `#EEF2F5` / `#2C4457` | escalate | 9.01:1 |

All four pass WCAG AA for **normal** text, not just large. Dark mode
re-derives each as a low-alpha wash of the same hue (see `.dark` block) so
they stay recognisably the same four categories without glowing.

Not exposed as Tailwind colour utilities on purpose: `text-coach` is already
a `fontSize` token, so a `coach` colour namespace would collide.

### 25.4 Responsive strategy

| Breakpoint | Shell width | Layout |
|---|---|---|
| Mobile 320–430 | `max-w-lg` (512px) | single column, bottom nav |
| Tablet 768–1024 | `max-w-lg` | single column, wider grids inside |
| Desktop 1280+ | `max-w-app` (**1040px**, new token) | 2-column where useful, no bottom nav |

The shell previously rendered a 512px column at *every* width — the single
biggest "desktop is just stretched mobile" gap. `max-w-app` is deliberately
narrower than the landing page's 1200px so reading columns don't get
uncomfortably long.

**Home 2-column split (`lg+`, 7fr/5fr):** left = the primary act-now path
(greeting, patient card, Moment Coach, quick actions, today's check-in);
right = supporting context (patterns, incident history, journey links).
Because sections 1–7 already preceded 8–11 in source order, collapsing to
one column below `lg` reproduces the previous mobile order exactly.

### 25.5 Card, chip and button patterns

- **Cards** — `.card-shell` (`rounded-2xl`, 1px themed border, surface bg).
  `p-5` for content cards. Profile sections converted from divider-separated
  blocks to discrete cards, matching the references.
- **Chips** — `rounded-full`, `min-h-tap`, `px-4 py-2.5`. Selected = solid
  `bg-primary` + white; unselected = `card-shell` on background. Semantic
  variants: teal (`success-bg`/`success-text`) for what helps, coral
  (`error-bg`/`error`) for what to avoid.
- **Category tiles** (Incident Log) — line icon in a soft-tinted circle
  (`h-11 w-11`, category colour at 12% alpha), label beneath, `min-h-[100px]`,
  2-col on mobile → 4-col from `sm`. Replaced single-letter placeholders
  ("A", "?", "W") which read as codes rather than categories.
- **Primary button** — `bg-primary`, white text, `rounded-xl`, `min-h-tap`,
  full-width when it's the screen's single commit action.
- **Icons** — all drawn in-repo on a 24px grid at 1.75 stroke weight. No
  external icon set is used anywhere in this pass.

### 25.6 Accessibility rules applied

- Touch targets `min-h-tap` (48px) on every interactive control added or
  restyled — above the 44px floor.
- All four Moment Coach sections verified ≥ 6.5:1 (AA normal text).
- Toggle controls (severity, time slot, tags) now expose `aria-pressed`;
  previously selection was conveyed by a `✓` glued onto the label text,
  which screen readers announced as part of the name.
- Chip groups wrapped in `role="group"` with an accessible name.
- Bottom nav uses `aria-current="page"` for the active section.
- Icons are `aria-hidden`; the accessible name always comes from real text.
- No RTL-unsafe directional utilities introduced — logical properties only.

### 25.7 Known gaps

- **RTL is dormant, not broken.** `isRtl()` returns true only for `ar`, and
  Arabic was removed from `SUPPORTED_LOCALES` in the earlier 3-locale
  reduction (a product decision, not part of this pass). The RTL
  infrastructure is intact and none of this pass's markup would break it,
  but no currently-shipping locale exercises it. Re-adding Arabic is a
  product call, not a redesign call.
- **Desktop density is conservative.** Home is the only screen with a true
  two-column layout. Learn and Impact use responsive grids; the remaining
  screens (Coach, Check-In, Incident Log, Profile) centre a single column
  in the wider shell rather than inventing a second column of content that
  doesn't exist. That is deliberate — these are focused, one-task screens —
  but it does mean desktop has more whitespace than the references imply.
- **`ThemeToggle` still has 6 failing tests**, unchanged by this pass. Its
  `aria-label` describes the *target* state ("Switch to dark mode") while
  the test expects a name matching `/theme/i`. Which is correct is a
  content decision, so it was left alone here too — see
  `docs/feature-audit-2026-09-01.md`.

---

## 24. Change Log

### 2026-09-19 — Global navigation removed entirely

At the client's request, `BottomNav` is deleted too. The web app now has
no global navigation at any width; sections are reached through in-page
links.

What survives in `#root-chrome-footer` is the emergency bar, and only
that. It is the one thing that has to be reachable from every screen, and
removing navigation does not change that.

The `bottom_nav.*` translation keys are deliberately left in `common.json`
across all three locales — they are now unused, but keeping them means
restoring the bar is a revert rather than a re-translation.

### 2026-09-19 — Desktop navigation removed (same day)

`PrimaryNav`, added earlier today, is reverted. It leaked app navigation
onto pre-auth screens: on `/profile/setup` — the invite gate, before a
visitor has any access at all — it rendered Coach / Insights / Resources
with **More** lit, because `/profile/setup` starts with `/profile`.
Someone who cannot get into the app was being offered its sections.

`shouldShowBottomNav` only excludes the landing page and facility routes.
It was never an authentication check, and I reused it as if it were. The
bottom bar has the same hole at phone width, but it is long-standing and
was not part of this change.

Desktop is back to having no global nav — the state described in the
entry below, still true, still a real gap. Any future attempt needs a
signed-in check, not a route-prefix check.

### 2026-09-19 — Desktop navigation (`PrimaryNav`) — REVERTED, see above

At `lg:` and up the app had **no navigation at all**. `BottomNav` is
`lg:hidden`, and its own comment said it was hidden "where the desktop
layout uses its own wider navigation" — that navigation was never built.
The comment described an intention, not the code. On desktop, `/learn`,
`/incidents` and `/profile` were reachable only by URL or by whatever
in-page link happened to point at them.

`PrimaryNav` imports `NAV_ITEMS` and `shouldShowBottomNav` from
`BottomNav` rather than restating them. Two nav definitions drift, and the
whole value of naming a place "Resources" is that it is called that
everywhere.

Two placements, because the desktop layout has two shapes:
- **header** — horizontal, centred in the shell header, on every screen
  that has one.
- **rail** — vertical, at the foot of the dashboard's left rail. The
  dashboard hides the shell header at `lg+`, so it needs its own. It sits
  *below* the profile card and the Practice / Check-In actions: wayfinding
  must not push down the things a caregiver taps at 3am. (First attempt
  put it above them — caught on screenshot.)

A bottom bar is a phone idiom; repeating it at 1440px would put the
primary navigation as far from the content as it can physically get.

The active fill is `bg-accentSky-soft`, not `bg-primary/10` — the
bare-`var()` opacity bug again, which would have made the indicator
invisible.

Verified: exactly one nav visible at every width tested — rail on the
dashboard at 1280, header on `/learn` (with Resources correctly active),
bottom bar only at 375, and none on the landing page or facility routes.
`PrimaryNav.test.tsx` pins the destination list to `BottomNav`'s, the
nested-route active rule (`/incidents/new` keeps Insights lit), the
landing/facility exclusion, and that this nav is the exact `lg` complement
of the bottom bar so the two can never both be on screen.

### 2026-09-19 — Sign out actually signs out

Signing out bounced straight back into the same profile.

`clearAll()` removed the four legacy keys but never `calmguide_profiles`
or `calmguide_active_profile_index`. Sign-out routes to `/`, where
`WelcomeGate` treats a surviving `getActiveProfile()` as a session to
resume — it rewrites the access code and name *from that list* and
redirects to `/home`. The sign-out was undone on the next render.

The bug predates this work, but was dormant: the wizard only ever wrote
the two legacy keys, so the profile list was usually absent. The
`saveActiveProfile()` change above always materialises it, which turned a
latent bug into one that fired every time — worth noting as the cost of
that change, not a coincidence.

`clearAll()` now clears the list and the active index too. Guarded by two
tests in `storage.test.ts`, including the multi-profile case; both were
confirmed to fail with the two removals taken back out, so they are not
passing vacuously.

### 2026-09-19 — Dashboard scrolls again on desktop

The single-screen desktop dashboard hid sections 8–11 (`lg:hidden`) —
pattern insights, log/recent incidents, conversation history, journey
links. **That was a mistake, and worse than a layout one.** The comment I
left claimed each was "still reachable from the nav"; it isn't. `BottomNav`
is *also* `lg:hidden`, and `#root-chrome-header` is hidden on the dashboard
at lg+, so at desktop width there was no nav at all — `/incidents` had no
route from anywhere on the screen. Measured at 1440×900: `document`
scrollHeight 900, `body` overflow `hidden`, both blocks `display: none`.

**Scroll restored, not bolted on.** `main` already carried
`overflow-y-auto` at every width; the only thing suppressing it was
`lg:h-full lg:overflow-hidden` on the HomeScreen root. Removing those two
classes is the whole fix.

**Laid out for the width it now has, rather than un-hidden.** The revealed
sections were ordered and sized for a phone. In the main column they pair
into two columns from `xl` (`xl:grid xl:grid-cols-2 xl:items-start`),
where that column is ~900px and a single stack of full-width cards would
just look stretched; at `lg` (~605px) it stays one readable column.

**The rail sticks.** `lg:sticky lg:top-5` on the left column, so who
you're caring for and the two things you might do next stay on screen
while the supporting material scrolls past. `top-5` matches the section's
`pt-5` rather than pinning flush to the edge.

Verified at 375 / 1024 / 1280 / 1440: block `flex → flex → grid → grid
(420.5px × 2)`, rail `static → sticky@20`, and at full scroll the last
card's bottom sits inside the container at every width (802 vs 851 at
1440), so nothing is clipped.

### 2026-09-19 — Portrait chosen at signup

The portrait is now picked while the profile is being created, on the
**name step of the wizard** rather than as a seventh step. Name and
portrait answer the same question — who is this? — and a six-step setup
should not grow a seventh for a one-tap cosmetic choice.

Keeping them on one step also makes the monogram option live: it previews
the initial of whatever has been typed, so the three options are compared
as pictures rather than as labels. Picking one is never required, and
never blocks Next.

**`saveActiveProfile()` replaces the wizard's two loose writes.** It used
to set `calmguide_patient_name` and `calmguide_access_code` and nothing
else, which left `getProfiles()` on its fallback path — and that path
invents `disease_stage: 'unknown'`, which ProfileSwitcher then displayed.
One idempotent write now stores code, name, real stage and portrait, keyed
on access code so repeat calls update in place. (`addProfile()` turned out
to be dead outside tests.)

**ProfileSwitcher rebuilt on the shared avatar.** It held the third and
fourth copies of the avatar markup, both with `bg-primary/10` — the
bare-var opacity bug again, so those discs were transparent. Its selected
row used `bg-primary/5`, also transparent, leaving the active profile
distinguishable only by its checkmark; now `bg-accentSky-soft`. The
switcher is the one place the portraits do real work: two profiles can
share a name, and a face separates them instantly.

### 2026-09-19 — Profile portraits

Two illustrated portraits (`avatar-male.png`, `avatar-female.png`) now sit
on the profile card and the profile page, in place of the lettered
monogram.

**Why it is a choice and not an inference.** The backend stores no name and
no gender — `Profile` is explicitly PII-free — so nothing server-side can
select a portrait, and picking one from the name would misgender people.
The portrait is an explicit selection kept in `localStorage` next to the
name (`StoredProfile.avatar`), set in a three-option radio group on the
edit screen. **The monogram is one of the three options, not a fallback**:
a caregiver who would rather not attach a gendered figure to someone keeps
a lettered mark and loses nothing.

**Assets.** Source art is 1254px square with the disc centred at
(626, 635), r≈549. Cropped to the disc's bounding square — so the disc
touches all four edges and clips cleanly in a round container — and
downscaled to 256px: 830KB → ~60KB each. The disc tint is #D7EBF8, near
enough to `--color-accent-sky-soft` (#E3F0FA) that the art already sits
inside the palette.

**Round, against a screen of squircles.** The portraits are drawn inside a
circle, so a squircle would crop them; more usefully, the round form is the
one human shape among the rectangles and tiles.

**Two bugs found while consolidating.** `PatientCard` and `ProfileView` each
carried their own copy of the avatar, and both used Tailwind opacity
modifiers on bare-`var()` tokens (`bg-success/20`, `bg-error/15`,
`bg-foreground/10`) — which compile to transparent, which is why the
early-stage monogram rendered as green type on a blank disc. Rebuilt on
`color-mix`. The copies had also drifted on the late-stage tint: one used
`error` red, the other a soft grey. Consolidating forced a choice and the
grey won — tinting a person's avatar red to mark late-stage dementia frames
them as an error state, and this palette keeps red for actual safety.

### 2026-09-19 — Progress chart: the data it needs, on the right days

The "Your Progress" card was drawing at most one point, and the user asked
why the graph wasn't there. Two separate faults, both mine.

**The card was structurally starved.** I built a weekly chart on top of
`/checkin/daily/{access_code}/today`, which filters to `check_date ==
today` — it answers "has she checked in yet today?", not "how has the week
gone?". No amount of seeded data could have produced a line. Added a
read-only `/checkin/daily/{access_code}/history?days=N` (default 7, capped
at 31) in `backend/app/routers/checkin_daily.py`, scoped to one profile by
access code exactly as `/today` is, plus `getDailyCheckinHistory()` in
`lib/api.ts`. **This is a functional change** in a pass that was otherwise
design-only, and was flagged as such before being made — a chart that
cannot be fed is not a design problem.

**Entries landed on the wrong day west of UTC.** `new Date('2026-09-13')`
parses as UTC midnight; keying it through a local-time `startOfDay()`
shifted every check-in back a calendar day in any negative-offset zone —
which silently dropped *today* off the chart and forced the streak to 0.
Replaced with `parseCheckDate()`, which splits the `YYYY-MM-DD` string and
builds a local date. Guarded by `ProgressCard.test.tsx`, which runs the
full-week case under UTC / Los Angeles / Kolkata / Auckland; the fix was
verified by reintroducing the bug and confirming only the Los Angeles case
fails, so the matrix is not passing vacuously.

**What the card still refuses to show.** The reference design's "Calm
practices" tile stays replaced by the day streak (nothing records practice
completions), and the y-axis stays Tough / Mild / Calm rather than a
0–100% score the product does not compute.

### 2026-09-19 — Orb: halo removed, lobes rotate, motion given a rhythm

**Halo deleted.** It read as a blue cast parked behind the form rather than
light coming off it. The rim carries the luminosity now, with a tight bloom
(`shadowBlur` 0.22 → 0.1 of base) that belongs to the edge itself. Removing
it also retires the clipping problem it caused — nothing large is drawn any
more, so there is no glow to guillotine.

**"Different angles" was the missing piece.** Previous passes only grew the
amplitude, so the blob bulged in the same places — a pulse, not a turn.
Each harmonic's lobes now drift around the perimeter at its own slow,
counter-running rate (`LOBE_DRIFT`), so bulges arrive from different
directions without the whole thing looking like it is simply spinning.

**Rhythm, so it reads as thinking.** A new `activityAt(t)` envelope built
from three incommensurate periods (2.6s / 1.7s / 0.9s) returns ~0.45–1.35
and drives *both* how far the blob deforms and how fast it changes — morph
time is `t * (0.55 + activity * 0.85)`. The result has spells of working at
something and spells of settling, which is what separates considering from
idling. Amplitudes roughly doubled (sum ~0.115 before the envelope) and
harmonic speeds roughly doubled again on top of the previous pass.

**Measured:** silhouette aspect ratio now travels 1.121 → 0.905 in about
2.5s — a spread of 0.216 against 0.09 before, so ~2.4x the deformation and
faster with it. Edge alpha remains 0 on all four sides, so the background
still merges. `tsc` clean, 33 files / 256 tests pass, and the
reduced-motion path re-checked (paints a still frame and holds it).

### 2026-09-19 — Orb: halo clipping fixed, morph sped up and varied

**The visible rectangle was the halo hitting the canvas wall.** Reported as
"the background is not merged". Measured rather than guessed: canvas 290px
(145px of radius available), halo drawn to `base * 1.8` = **188px** —
overflowing 43px on every side and still at **alpha 50** where it met the
boundary, so it was cut flat into a lighter box on the card. Exactly the
same failure as the `decor-blob` edges earlier in the day: a soft glow
guillotined by a hard bound.

Fixed by clamping the halo to what the canvas can actually hold
(`min(base * 1.8, min(w,h) * 0.495)`) and shrinking `base` 0.36 → 0.30 to
leave it room; the canvas grew 290 → 350px so the orb keeps its on-card
size. Edge alpha is now **0 on all four sides**, so there is nothing left
to cut.

**Faster, and through different shapes.** Harmonic speeds roughly
quadrupled and breath 7.6s → 4.2s. More importantly each harmonic's
*amplitude* now swings on its own long period (7.3–15.5s), so the dominant
lobe changes over time — it goes oval, then round, then softly faceted,
rather than looping one wobble. The swing floors at 0.35 rather than zero
so no harmonic fully mutes and the form stays organic. Measured: aspect
ratio travels 1.05 → 0.96 across three seconds, i.e. wider-than-tall to
taller-than-wide.

**Verified:** `tsc` clean, 33 files / 256 tests pass. Edge alpha 0 on every
side; aspect-ratio samples confirm the shape varies; two screenshots two
seconds apart show a different silhouette and no box.

### 2026-09-19 — Orb rebuilt as a hollow morphing membrane

The particle-globe approach was the wrong primitive and two rounds of
tuning it (links, signals, brightness) never fixed that — a lattice of
dots reads as *data being displayed* no matter how it moves. Replaced
wholesale, per a supplied reference of a soft blue droplet.

**Shape.** The outline is a sum of four sine harmonics at non-integer
frequency ratios, so the silhouette is always rounded, never a circle, and
never repeats. First attempt summed to ~14% radial deviation and looked
like an amoeba; the reference is unmistakably round with a gentle wobble,
so amplitudes came down to ~5% total.

**Hollow.** The fill is a radial gradient that stays transparent to ~46%
of the radius and only lights up past ~70%, with a bloomed stroke on the
outline and two fainter membranes drifting inside on their own phases —
enough structure that the middle reads as an interior rather than a hole.

**One bug worth recording.** The first hollow version measured *more*
opaque at the centre (alpha 87) than at the rim (40). The outer halo was
`createRadialGradient(..., base*0.7, ..., base*1.8)` with 0.34 alpha at
stop 0 — every pixel inside `base*0.7` got painted at 0.34, so the glow
was flooding the hollow it was meant to surround. Rebuilt to ramp from
fully transparent and peak *outside* the body. Radial profile now reads
`0,0,0,2,6,10,14,18,56,93,149` centre→edge.

Cheaper than what it replaced: three traced paths per frame instead of
620 points, ~1,240 link candidates and 7 slerped signals.

**Verified** at the real 290px this time, not enlarged: silhouette width
varies frame to frame (morphing), the radial profile confirms the hollow,
and two screenshots three seconds apart show the bright band travelling
around the rim. `tsc` clean, 33 files / 256 tests pass.

### 2026-09-19 — Moment Coach sphere reworked to read as agentic

The first sphere was a rotating particle globe, which reads as *data*. An
agent should look like it is attending to something, so three behaviours
replace uniform spin:

- **Breath.** The whole form swells and settles on a ~7.2s cycle, near a
  resting breathing rate. The core glow and rim brighten with it.
- **Associations.** Each point links to its two nearest neighbours, and
  every link fades in and out on its own slow cycle, so the mesh is never
  fully drawn — connections look considered rather than wireframed.
- **Signals.** Five bright heads trace great circles (slerp, so they follow
  the surface) with short trails, re-aiming from wherever they arrive so
  paths chain instead of teleporting.

Paced deliberately slowly. This sits on the screen a caregiver opens
mid-crisis; it should look like it is listening, not like a machine
working — §1's "calm, not clinical" applies to motion as much as colour.

**Kept linear per frame.** The neighbour graph is O(n²) but built once at
init; each frame skips any link with both endpoints behind the sphere and
any link currently faded out, so the stroke count stays a few hundred.
Point count dropped 900 → 620 to pay for the links. Frame delta is clamped
to 64ms so a stalled tab resumes smoothly instead of jumping.

**The `document.hidden` gate had to go, and it was hiding the whole
rework.** The first version only animated when `entry.isIntersecting &&
!document.hidden`. That second condition is redundant — browsers already
stop delivering rAF to a backgrounded tab — and it is actively wrong in
embedded contexts (preview panes, webviews) which report `hidden` while
the user is plainly watching. There the sphere froze on one frame; since
all three new behaviours are *temporal*, a frozen frame is nearly
indistinguishable from the old static globe, so the rework looked like it
had never landed. Gated on the intersection check alone now.

**Tuned for the size it actually renders at.** The effects were first
judged at 560px during inspection; the card shows the sphere at 290px,
where the mesh and signal heads were close to invisible. Link alpha
ceiling roughly doubled, line width 0.7 → 0.9, signal heads 2.1 → 2.8px
and seven of them instead of five, breath amplitude 2.2% → 3.2%.

**Verified:** `tsc` clean, 33 files / 256 tests pass. In-browser at the
real 290px: 61fps, frame hashes differ across samples, lit-pixel count
climbs between frames (the breath changing the footprint), and two
screenshots two seconds apart show a visibly different mesh and diameter.
`prefers-reduced-motion` re-checked by stubbing `matchMedia` and
remounting — paints a considered still frame and holds it, rather than
going blank or animating anyway.

### 2026-09-19 — New brand mark rolled out; duplicate logo removed

**New logo.** `design/references/logos/calguid logo transp.png` — a blue
speech-bubble mark with a coral heart and a white winding path, beside a
near-black "CalmGuide" wordmark. It happens to sit exactly on the current
palette (sky `#3E8FD0`, coral, near-black), so nothing had to be adjusted
around it. Both supplied files were verified genuinely transparent by
decoding the PNGs and sampling corner alpha, not by eye — a white-boxed
logo on the icy-blue page would have been the obvious failure mode.

Installed to `frontend/public/brand/calmguide-logo{,-transparent}.png` and
`mobile/assets/images/calmguide-lockup.png`. The icon set was regenerated
by **cropping the mark out of the supplied lockup** (columns 122–554,
trimmed to its own bbox and re-padded square) — extraction of the real
artwork, not a redraw, so §2.1's standing "don't redraw the logo" rule
holds: favicons 16/32, apple-touch 180, PWA 192/512, `og-image.png`, and
mobile `icon`/`splash-icon`/`favicon`/`android-icon-foreground`.

**The favicon was the real bug.** `/favicon.svg` was listed *first* in
`layout.tsx`'s icon array, and every browser that supports SVG icons
prefers it — so the tab kept showing the pre-2026 sage-green serif swirl
(the mismatch §2.2 has flagged since August) no matter what the PNGs held.
Reference dropped rather than the file redrawn; there is still no vector
source for the current mark. `site.webmanifest` likewise pointed at
`app-icon.svg` (same old mark) and still carried the pre-palette
`#2B7A78`/`#FBF7EE` colours — now the new PNGs and `#10141C`/`#EEF5FB`.

**Duplicate logo.** The dashboard showed two: the shell header's `PageBrand`
text wordmark and the rail's image logo. The shell header is now hidden at
lg+ under `html[data-dashboard]`, leaving one. `SignOutButton` moved into
the rail so hiding the header strands nothing. The phone keeps the header —
it has no rail.

**Theme toggle.** New `variant="pill"` on `ThemeToggle` renders the
design's segmented sun/moon track; `variant="icon"` stays the default, so
the shell header and all existing tests are untouched. The thumb marks the
theme that is currently on and slides on click — the mockup shows the
filled side on the moon while the page is light, which reads as a static
illustration rather than a state, so the standard behaviour was kept.

**Verified:** `tsc` clean, 33 files / 256 tests pass. Confirmed in-browser
that the served logo is byte-identical to the supplied file (354,214 bytes)
and that exactly one `<img>` renders on the dashboard.

### 2026-09-19 — Home dashboard rebuild + Moment Coach sphere

Built to a supplied dashboard mockup: a narrow left rail (brand + theme
toggle, greeting, patient card, Practice and Check-In as full-width rows)
beside a wide column holding the Moment Coach hero, then the day's check-in
next to the week's progress.

**The sphere — why Canvas 2D.** `AiSphere.tsx`, no dependency. three.js
would look marginally richer for ~600KB on the one screen a caregiver opens
mid-crisis, and this is ornament; the budget belongs to the guidance. ~900
points on a Fibonacci lattice (even coverage, no pole clustering), spun
around Y, perspective-divided, sorted back-to-front so depth reads without
a z-buffer, plus a core glow, a rim light and two orbital arcs. It runs
only when on screen *and* in a foreground tab (IntersectionObserver +
`visibilitychange`), and renders a single static frame under
`prefers-reduced-motion` — a caregiver who asked the OS to stop animations
should not get a spinning globe. One turn takes ~48s: ambient, not busy.

It also paints one frame immediately at mount. Without that the canvas sits
empty until those gates open, which is exactly what happens when the page
loads in a background tab — you'd switch to it and find a blank hole. Found
by reading back canvas pixels (0 painted) rather than by eye.

**Single screen.** The desktop dashboard is `lg:h-full lg:overflow-hidden`
and does not scroll, per the design. Sections 8–11 (pattern insights,
incident log/history, conversations, journey) are `lg:hidden` — they'd have
forced a scrollbar, and each stays reachable from the nav. Phones keep the
full scrollable stack: six cards don't fit on a phone and hiding them there
would lose real function.

**Width.** The dashboard is a grid, not a reading column, so it opts into a
1280px shell via `html[data-dashboard]` — the same `data-*` technique the
landing page already uses. `max-w-app` (1040px) stays the default
everywhere else, for the line-length reason in §25.4.

**Numbers are counted, not invented.** `ProgressCard` derives everything
from real `DailyCheckinEntry` rows: check-ins this week, calm days, and the
current streak. The mockup's fourth tile, "Calm practices", has no source —
nothing in the app records practice completions — so it is replaced by the
streak rather than faked. The chart's y-axis is the three severities the
app actually stores, not the mockup's 0–100%, so it can't imply a clinical
score the product doesn't compute. Same rule as the landing page's refused
stat wall.

**Also:** `coach_card.title` lost its baked-in `\n` (it was set for the old
narrow centred card) and gained an `eyebrow` key, across en/es/hi with key
parity checked. The hero's scrim was written as a real `color-mix()`
gradient because `via-panelDark/80` is the Tailwind-3.4 opacity-on-variable
bug again — it compiles to fully transparent.

**Verified:** `tsc` clean, 33 files / 256 tests pass. Confirmed live: no
scroll at 1440×900 (`scrollHeight === clientHeight`), sphere paints
(~181k px) and advances across three sampled frames once visible, and
pauses when the tab is hidden.

### 2026-09-19 — Blend pass: hard edges and unswept colour

Follow-up to the palette pass below, from a screenshot showing a hard-edged
rectangle of lighter colour on the profile wizard.

**The rectangle was a clipped glow.** `.decor-blob` carries `filter:
blur(48px)` and was positioned to hang *past* its wrapper (`-top-8 -end-16`),
while the wrapper was `overflow-hidden`. A blurred shape cut by a hard clip
doesn't fade — it ends in a straight line. Measured: the blurred glow reached
1px *past* the clip on both axes, so the cut was guaranteed.

Fixed structurally rather than by tuning insets per blob, which would break
again the moment anyone resized one: new `.decor-layer` replaces the raw
`overflow-hidden` on all five wrappers and masks its own edges (two
linear-gradient masks intersected, since one gradient only fades two sides).
Any blob, any size, any position now dissolves into the page. Blobs were
restored to their original off-corner placements, which the mask makes safe.
Degrades to the previous hard clip where `mask-composite` is unsupported,
which is acceptable for decoration.

**Unswept colour, found while verifying.** The earlier pass re-hued `rgba()`
values in `globals.css` and Tailwind token classes but missed arbitrary
`bg-[#hex]` classes and SVG `stroke="#hex"` attributes in TSX. On the Home
screen that left a teal gradient on the hero card and a purple/green/amber
rainbow of icon tiles sitting on the new palette. Swept on both platforms:
- **Decorative** → the sky family: the three Home icon tiles (glyphs moved to
  `currentColor` so they follow the token into dark mode), the old dark-teal
  gradient end `#1F5454` on two hero cards, 28 old-navy dark-mode borders
  (`#31445f`/`#3a4f6d`), leftover teals, three warm-paper off-whites, and the
  mobile category taxonomies (labelled in text, so colour was variety).
- **Semantic** → converted to the real tokens rather than flattened *or* left
  as hex: incident severity (mild/moderate/severe → `success`/`warning`/
  `error` backgrounds), dementia stage (early/middle/late), and the success
  confirmation circles. Same meaning, now theme-aware. Web has **zero**
  arbitrary hex colours left in `.tsx`.

**One bug caught in dark mode, self-inflicted.** Re-pointing the Home and
Impact hero cards at `from-primary to-primary-light` made them near-*white*
in dark mode — their text is white. They're "always dark" panels, so they
now use `bg-panelDark`, the theme-invariant token added for exactly this on
the landing page. The existing radial sheen overlay supplies the depth the
gradient was giving. Verified legible in both themes.

**Verified:** web `tsc` clean, 33 files / 256 tests pass; mobile `tsc` clean,
6 suites / 28 tests pass. Checked live in both themes: profile wizard (the
reported screen), check-in, and home.

### 2026-09-19 — Palette applied to every screen, web + mobile

The landing page's near-black/icy-blue system is now the product's palette,
not a marketing-page exception. Design and colour only — no functional,
routing, API or persistence changes on either platform.

**The rule the palette encodes**, and the reason it was safe to apply to a
safety-critical app: near-black is the action colour and nothing that isn't
tappable uses it; sky blue is informational (icons, links, chips); coral is
a marker dot only. Everything else is neutral. Status and safety colours —
`success`/`warning`/`error`/`emergency` and the four Moment Coach section
tints — were deliberately **not** folded in. Neutralising the general UI is
precisely what leaves them as the only saturated things on screen, so the
911 bar and the coach's "what not to do" band read louder than before, not
quieter.

**Web.** The `[data-landing]` override was deleted and its values promoted
into `:root`/`.dark` in `globals.css`, so all 34 pages and 53 components
inherited the palette without being touched individually. Beyond that:
- **`--color-on-primary`, new.** `--color-primary` has to invert in dark
  mode (a near-black fill on a near-black ground is not a button), which a
  hardcoded `text-white` on every button cannot follow. 33 `text-white`
  occurrences that sat on a primary fill became `text-onPrimary`; ones on
  `bg-error`/`bg-emergency`/the partner band were left alone.
- **`--color-panel-dark`, new.** The landing "How it works" band and final
  CTA are deliberately dark in *both* themes, so they can't ride on
  `--color-primary` — they'd have flipped to near-white in dark mode with
  white text on them. Theme-invariant, like the footer band.
- **~40 hardcoded teal rgba values** in component states (card hover, focus
  rings, `outline-button`, chips, in-app decor blobs) re-hued to sky by
  script, with the semantic rows excluded by name.
- **Inline links** are sky, not near-black: 17 `text-primary hover:underline`
  occurrences: at near-black they were indistinguishable from body text.
- **Buttons are pills** at every size (`Button.tsx` plus 29 raw action
  elements), matching the landing CTAs.
- `Button.tsx`'s `disabled:bg-primary/45` → `disabled:opacity-45` — another
  instance of the Tailwind-3.4 opacity-on-CSS-variable bug logged below.
  `.landing-ghost-button` → `.ghost-button`, now used app-wide.

**Mobile.** Same values, same roles, via `ThemeContext.tsx` (`lightColors`/
`darkColors`), which every screen already reads through `useTheme()`. The
old indigo-action/teal-brand split is gone: `palette.indigo`→`palette.ink`,
`palette.teal`→`palette.sky`, plus a new `onPrimary` mirroring the web's.
`constants/theme.ts`'s pure black/white Expo-template leftovers were
re-valued to match. Outside the theme: 8 hardcoded white labels sitting on
primary fills → `colors.onPrimary` (these would have gone invisible once
primary inverts), 4 inline links → `colors.accent`, and the old teal/purple
decorative tints (`#2B7A78`, `#7C4DBA` and their soft fills) → sky. Whites
on the partner band and on semantic green were left alone, checked
individually.

**Verified:** web `tsc --noEmit` clean, 33 test files / 256 tests pass (one
Chip assertion updated — it asserted the literal `text-white` that is now
`text-onPrimary`). Mobile `tsc --noEmit` clean, 6 suites / 28 tests pass.
Checked live: landing, `/login` and `/facility/login` in both themes; the
dark-mode primary inversion confirmed by computed style (near-white fill
`#EEF2F7`, near-black label `#10141C`, pill radius); both theme-invariant
dark panels confirmed still dark under `.dark`; the mobile welcome and
access-code screens confirmed against the running Expo web build.

**Known gap, not a code issue:** the Expo dev server on :8081 had been
running since 2026-09-13 and its file watcher had gone partially stale — it
picked up `ThemeContext.tsx` but not same-minute edits to screen files, so
the per-screen mobile changes (links, `onPrimary` labels) could not be
visually confirmed in that session. Source, typecheck and tests are correct;
a Metro restart is all that's needed to see them.

### 2026-09-19 — Scroll motion pass

Third same-day pass: "add scroll animation, make it look premium." Per
this document's own §13/motion guidance and the frontend-design skill's
explicit warning that "fade-and-slide-up entrances on each section" is
the generic AI-page tell, this is deliberately restrained rather than a
library of scroll effects — one reveal per section, not per card, plus one
functional (not decorative) nav enhancement.

**Added, `ScrollReveal.tsx`** (new client component, mounted once
alongside `LandingChromeSync`): every top-level section below the hero
(`data-reveal` attribute, nine sections) fades and rises in exactly once
the first time it crosses into view, then is unobserved — no re-trigger on
scrolling back up, no per-child stagger inside a section. No-JS and
pre-hydration fallback via a `<noscript>` block that forces full opacity.
Same component also writes a single rAF-throttled `--landing-scroll` CSS
variable, which the hero's two glass shapes read for a few pixels of
parallax drift — layered onto a wrapping `<div>` rather than the `<svg>`
itself, since a CSS animation already targets that element's `transform`
(rotation) and a second static `transform` on the same node would just
override it, not compose.

**Added, `LandingNav.tsx` scroll-spy**: the pill nav now highlights
whichever section is actually being read (a thin intersection band 30–40%
down the viewport, not simply "has its top pixel appeared"), via a second
IntersectionObserver keyed to each nav link's target `id`. This is the
honest version of the fake bold-vs-gray "current" link style skipped
during the 2026-09-19 palette pass for being static and therefore
misleading — now it reflects a real, continuously-updated state.

**Bug found while wiring the above, same root cause as twice already
today**: `bg-foreground/5`/`/10` (hover/active tint on the hero's outline
button and, newly, the nav's hover/current-link tint) and three
`text-foreground-muted/NN` instances (the hero's "/" separator, its
disclaimer line, the safety-steps arrow) all silently drop their opacity
modifier under Tailwind 3.4 for the same reason as the header background
bug — `bg-*` failure mode is fully transparent (invisible hover
feedback), `text-*`'s is full-opacity-anyway (visible, just not as subtle
as intended). Fixed with the same `color-mix()` pattern: two new reusable
classes (`.landing-nav-link`, `.landing-ghost-button`) for the two
hover/active cases, inline `color-mix()` styles for the three static
text-opacity cases. Not a full app-wide audit — still flagged as one,
scoped to what this pass actually touched.

**Verified:** `tsc --noEmit` clean. Confirmed live: `--landing-scroll`
updates with `window.scrollY` and the glass shape's computed `transform`
reflects it; scroll-spy's `aria-current` moves correctly between sections;
reveal sections settle to fully legible (not stuck at partial opacity);
ghost-button hover now visibly tints. Mobile (375px) and desktop (1440px).

### 2026-09-19 — Nav bar rebuild, dark-mode fix, footer recolor

Same-day follow-up: the user sent a close-up reference of just the nav bar
and asked to match it exactly, then flagged dark mode as not matching and
the footer as still off-palette.

**Nav rebuilt** (`LandingNav.tsx`) to the closer reference: transparent
over the hero (no bar of its own — logo and CTA sit directly on the
gradient), the link set collected into one white pill, centered. Gains a
translucent backing only once scrolled past the hero, for legibility over
whatever's beneath it further down. This replaces the two-tier utility-bar
version from earlier the same day, built off a different, ambiguous
screenshot crop that — on this cleaner reference — turned out to just be
one bar, not two.

**Two real bugs found and fixed while matching the reference, not
consequences of the color choice itself:**
- *Seam between the header and hero.* The header sits above `<main>` in
  the DOM, so a transparent header revealed flat `--color-background`
  behind it while the hero section's own gradient started only at the
  header's bottom edge — two different blues meeting at a hard line.
  Fixed by pulling the hero section up under the header with a
  `-mt-20`/`pt-20` pair (cancels out for layout, lets the gradient paint
  from y=0) rather than changing either color.
- *`position: sticky` silently not sticking.* `LandingNav`'s header never
  actually stayed pinned while scrolling — confirmed via
  `getComputedStyle` (`top` tracked `-scrollY` instead of clamping to
  `0`). Root cause: `html[data-landing]` and `html[data-landing] body`
  both carried their own `overflow` value, making `body` a second
  scroll-container ancestor for sticky-positioning purposes even though
  body itself never actually overflows (it grows to fit content instead).
  Fixed in `globals.css` by scoping the overflow reset to `html` alone and
  setting `body`'s to `visible` (overriding the app-shell's unconditional
  `overflow: hidden` on bare `body`, which `body` was otherwise still
  inheriting).

**Dark mode fixed.** `html[data-landing]` (an attribute selector on
`html`) is more specific than `.dark` (a bare class), so the light-mode
`--color-background` and the four `--color-accent-*` tokens set
unconditionally in the 2026-09-19 palette pass were winning even under
`.dark` — pale near-white panels kept showing up down an otherwise-dark
page (value strip, What Is CalmGuide, the FHIR/tech chips). Added real
`html.dark[data-landing]` values for all of them plus
`--color-landing-sky-soft`, instead of leaving them to fall through.

**Footer recolored.** `.landing-gradient-footer` was still the
2026-09-01 pass's teal-adjacent navy gradient (`#102d4e…#08294b`), left
over from before today's near-black palette existed. Now
`#10141c…#05070a` — the same near-black as `--color-primary` and the "How
It Works"/final-CTA panels, so the page has one consistent dark rather
than two different ones.

**Verified:** `tsc --noEmit` clean. Checked live — dark mode scrolled
through every section (the specific thing that was broken), light mode,
sticky nav confirmed pinned via `getComputedStyle` after the fix.

### 2026-09-19 — Landing-page palette swap to match a supplied reference, exactly

Same-day follow-up to "Real caregiver photography" below — the user
supplied two more screenshots of the same reference site and asked,
explicitly and repeatedly, to match its color usage exactly rather than
adapt it to CalmGuide's teal brand. Landing page only, `[data-landing]`
scoped as usual; app-wide teal/navy tokens (`globals.css` `:root`) are
untouched.

**New landing-only tokens** (`globals.css`): `[data-landing] --color-primary`
now resolves to a near-black (`#10141c`) instead of the app's teal —
every `bg-primary`/`text-primary`/`border-primary` use on the landing page
(buttons, checkmarks, the nav) follows automatically. `--color-background`
becomes a pale icy blue (`#eef5fb`). The four `accent-{mint,aqua,lavender,
peach}` section-tint tokens all collapse to one near-white
(`#f3f6f9`) — the reference doesn't use CalmGuide's rainbow of soft
section tints, just white with one black panel for contrast. Two new
landing-only accents, not part of the shared app palette: `--color-landing-sky`
(`#3e8fd0`, illustration/icon/link accent) and `--color-landing-coral`
(`#e8663d`, small eyebrow-marker dot only).

**Buttons**: every landing CTA changed from `rounded-xl` to `rounded-full`
(pill) to match the reference exactly, including the mobile menu's.

**Eyebrow labels**: were colored text (`text-primary` or an inline indigo
hex). Now a small coral dot + plain muted text, matching the reference's
"● About the Platform" pattern instead of inventing a colored-label
convention the reference doesn't use.

**Headline**: the hero's per-locale-isolated highlighted word
(`title_highlight`, kept as its own `<span>` for the same i18n reason as
before) lost its color and underline — the reference's headline is one
plain color throughout, no accent word.

**One dark panel**: "How CalmGuide works" and the final CTA are now solid
near-black (`bg-primary`) with white text, directly echoing the
reference's own black "How It Works" panel — previously these were a
mint-tinted card grid and a teal-to-blue gradient respectively. This is
deliberately the *only* dark section on the page (plus the always-dark
footer), not a second and third recurrence of it — restraint, not a new
pattern to repeat further.

**Two-tier nav** (`LandingNav.tsx`): added a slim, desktop-only utility
bar above the main nav row — small circular "CG" mark on the start, a
compact theme toggle and a small "Sign In" pill on the end — mirroring the
thin secondary bar visible above the reference's main nav in the user's
screenshot. The main row keeps the full logo, link set, and primary CTA,
i.e. "the whole bar" as the user put it. Mobile is unaffected (utility bar
is `hidden lg:block`; the hamburger panel already carried the same
controls).

**Animated shape instead of the sent video**: the user asked to add "the
video animation" to the hero. Both video files they sent (see the entry
below) are a screen-recording of the reference site's own custom-rendered
3D glass shape — another company's specific brand asset, not something to
reproduce. Built two small SVG shapes with a blue/white gradient behind
the hero photo, rotating slowly and independently (`.landing-glass-shape`,
`landing-glass-rotate` keyframe, 22s/28s, opposite directions), inheriting
the global `prefers-reduced-motion` freeze already in place — same mood
(a soft, glassy, gently turning form), original geometry.

**Bug found and fixed, not introduced by this pass**: `LandingNav`'s
header used `bg-surface/90` for its frosted-glass background. Tailwind
3.4 can't apply an opacity modifier to a color defined as a bare
`var(--color-surface)` string (`tailwind.config.ts` doesn't use the
`withOpacityValue`-function pattern for it) — the utility silently
compiled to fully transparent (`rgba(0,0,0,0)`, confirmed via
`getComputedStyle`), which just happened to look plausible against light
page content and was never visibly broken until today's dark hero exposed
it. Fixed locally in `LandingNav.tsx` with an explicit
`color-mix(in srgb, var(--color-surface) 90%, transparent)` inline style
rather than a config-wide fix, since the same `/NN`-on-CSS-variable
pattern likely appears elsewhere in the app and a full audit is out of
scope for a landing-page pass — flagged here for whoever picks that up.

**Verified:** `tsc --noEmit` clean. Checked live — light and dark mode
(dark mode particularly, since the previous "How It Works" and final-CTA
treatments plus the nav fix all changed there), mobile (375px) and desktop
(1440px), mobile hamburger menu.

### 2026-09-19 — Real caregiver photography on the landing page

Follow-up to 2026-09-18: swaps the abstract/product-only hero for real
caregiver-and-parent photography, using four AI-generated reference photos
the user supplied and asked to be worked in (originals in
`design/references/landing-page/Care giver /`, copied into
`frontend/public/brand/caregivers/` as `caregiver-companionship.png`,
`caregiver-mobility-support.png`, `caregiver-telehealth.png`,
`caregiver-medication-review.png`). Landing page only; no locale/copy
changes (every section reuses existing `landing.*` translation keys), no
backend/route changes.

**Reference materials reviewed, not copied wholesale:** the user shared two
screenshots and two short video clips of a "Carefinity" healthcare site as
a style reference (device-framed hero, floating detail cards over a big
visual, alternating light sections, trust line under the hero CTA). Both
videos turned out to be the same source — a screen-recording demo of that
same Carefinity site, its logo visible throughout, showing its custom
rotating 3D glass-shape render. That render is another company's actual
brand asset, not a stock/style asset, so it was not reproduced; the
*structure* (photo/screenshot pairing, floating cards, alternating
sections) was reused, not the artwork. One of the two video files
(`large-thumbnail...mp4`) was unrelated — a generic web-design-agency demo
reel ("Design your vision... Get in Touch") — and was disregarded
entirely.

**Hero:** replaced the 2026-09-18 dark "3 a.m." navy panel with a bright
hero again — the four supplied photos are all warm, daylight, in-home
photography, and forcing them onto a dark panel fought the source material
more than it suited it. `caregiver-companionship.png` (nurse and older
woman, hands clasped) is the large hero visual; the real
`calmguide-home-coach.png` product screenshot floats on top of it at
smaller scale, in the same "photo proves the human moment, floating
screenshot proves the product is real" pairing used twice more below.
`.hero-night` / `.hero-glow` / `.hero-glow-pulse` (2026-09-18) removed as
dead code now that nothing references them.

**Photo placements**, one photo per section, chosen by theme rather than
arbitrarily:
- **What Is CalmGuide** — `caregiver-medication-review.png`, with the
  existing 6-item checklist as a floating card over it (was a separate
  plain card with no image before this pass).
- **Behavioral Context** — `caregiver-mobility-support.png`, with the
  existing `calmguide-behavior-profile.png` product screenshot now
  floating on top of it (was a lone product screenshot before this pass).
- **Technology / For Healthcare** — `caregiver-telehealth.png` (a tablet
  video call with a clinician), paired with the existing FHIR/HL7/tech
  content, which had no image at all before this pass; restructured from
  a single centered column to two columns to fit it.

**Deliberately not done:** no "trusted by" logo wall was added, even
though the Carefinity reference has one — CalmGuide has exactly one real
partner (Leap of Faith, already credited under the hero CTA); inventing
placeholder logos for other companies would be exactly the kind of
fabricated claim §23/§22 already rule out. No stat-dashboard tiles
(engagement %, calorie/hydration trackers) were added either, for the same
reason — the Carefinity reference's "Wellness Programs" section invents
metrics that don't correspond to anything CalmGuide tracks.

**Verified:** `tsc --noEmit` clean. Checked live in dev server — light and
dark mode, mobile (375px) and desktop (1440px). One mobile-only layout bug
was caught and fixed during review: the What Is CalmGuide floating
checklist card originally overlapped ~90% of its photo on narrow screens,
leaving only a sliver of faces visible; it now sits in normal flow below
the photo on mobile (`sm:` and up keeps the floating/overlapping
treatment, which has room to breathe at that width).

### 2026-09-18 — Landing page visual identity pass

Focused re-design of the landing page's visual execution (layout/copy
structure from the 2026-09-01 rebuild kept; this pass is about how it
looks, not what it says). Landing page only — no locale/copy changes, no
backend/route changes.

**Fixed — off-brand primary color:** removed the `[data-landing]`
`--color-primary: #E1BFFB` override (added 2026-09-01, §3.7 as originally
written) that had every CTA, link, and icon on the landing page resolving
to a low-contrast pale lavender instead of the brand's actual teal
(`#2B7A78`, used everywhere else in the app and on the real logo, §2.1).
The override is deleted outright rather than repointed, since with no
override the landing page now simply inherits the same teal `:root`
tokens as the rest of the app — one visual identity, not two.

**Redesigned — hero.** Replaced the light hero card + four animated,
mix-blend-mode, cross-page-fixed decorative bubbles with a single
full-bleed dark-navy hero panel (`.hero-night`, theme-invariant like the
footer — §3.6) and one static-then-slow-breathing warm amber glow
(`.hero-glow`) behind the phone mockups. This is a literal rendering of
§1's own design anchor — "someone standing in a hallway at 3 a.m.,
holding a phone" — rather than generic pastel gradient-wash decoration.
The previously-recolored single headline word ("caregiving") keeps its
own `<span>` (still needed to isolate it per-locale, §18 point 2) but is
now marked with a warm underline stroke instead of a plain color swap.
`LandingNav` no longer has a transparent/scrolled state toggle — it's
always the same solid, bordered light bar, since the fixed brand logo PNG
(§2.1, "transparent-safe on light backgrounds" — not dark) can't be
recolored to stay legible floating over a dark hero.

**Removed — repeated decoration.** Deleted the per-section blurred
`blur-3xl` corner circles that sat behind What Is / How It Works /
Behavioral Context / Safety / Technology (six near-identical glow shapes
down one page) — the soft section-tint backgrounds (mint/aqua/lavender/
peach) already do the work of differentiating sections; the added blobs
were decoration without a job, the kind of "gradient wash as decoration"
this document's own §23 "Don't" list already warns against.

**Restyled — eyebrow labels.** `Eyebrow` no longer renders
`uppercase tracking-wide text-sm` — now sentence-case at `text-base`.
Applies site-wide on the landing page (one shared component), not
section-by-section.

**Restructured — value strip.** The four value-strip items were four
identical `rounded-2xl` icon-in-circle cards inside an outer card, next to
near-identical card treatments two sections later (How It Works) and again
in the Moment Coach showcase — three uses of the same SaaS-card formula in
one scroll. Value strip is now a plain divided row (icon + text, thin
rule between items on `sm+`) so the numbered/card treatment is reserved
for the sections where it's actually meaningful (How It Works and Safety
are genuine sequences).

**Cleanup:** removed the `bubble-a/b/c/d` keyframes/animations
(`tailwind.config.ts`) and `.hero-bubble` (`globals.css`), both dead once
the bubbles they animated were removed; removed `--color-accent-blue`
(`globals.css` + `tailwind.config.ts`), unused since it existed solely for
the old bubble gradient.

**Verified:** `tsc --noEmit` clean. Checked live in dev server — light and
dark mode, mobile (~390px) and desktop (~1440px) viewports, hero/value
strip/footer specifically re-checked in dark mode since the hero panel is
now theme-invariant by design (must look intentional, not like a dark-mode
bug, in both site themes). No automated test suite covers the landing page
visually; no test run needed since no component logic changed.

### 2026-09-07 — Extend landing-page decorative language into the app (static, in-app)

Extends the landing page's soft radial-gradient "blob" language (§18) into
three authenticated caregiver screens, per §19's brief that the app still
carries the older, flatter treatment. New `.decor-blob` / `.decor-blob-{aqua,
mint,lavender,peach}` utility classes in `globals.css`, reusing the exact
rgba stops already used by the landing page's blobs/bubbles — no new colors
invented. Deliberately **not** the landing page's animated/blended
treatment: no `animate-bubble-*`, no `mix-blend-mode`. Motion and additive
blending suit a marketing page's ambient feel; a caregiver reading a
streamed response or filling in a form one-handed needs the background to
stay put and stay quiet, so these are static, single low-opacity radial
glows confined to their own `inset-0 overflow-hidden` layer (so they never
clip a dropdown/popover sibling), applied via `aria-hidden`.

**Added, one or two blobs each:**
- `HomeScreen.tsx` — aqua behind the top-left greeting, lavender behind the
  right-column "journey" card. The primary "act now" screen (§19), so both
  are positioned over open background rather than the Moment Coach CTA or
  alert cards.
- `CheckInScreen.tsx` — one mint blob behind the header only, clear of the
  textarea and the streamed-response card.
- `ProfileView.tsx` — one peach blob behind the header/name card.

**Deliberately not changed, with reasoning:**
- **Moment Coach** (`coach/page.tsx`, `CoachResponseRenderer`) — no blobs
  added. This is the mid-crisis, 3 a.m., text-dense streaming screen §1 and
  §25.7 both center the whole design philosophy on; the four
  `.coach-section-*` tints already carry the section hierarchy, and a
  background glow competing with a caregiver actively reading guidance
  would cut against the "calm, legible, nothing decorative competing for
  attention" rule this document already states (§23 "Don't"). Left
  untouched intentionally, not by oversight.
- **`PageBrand.tsx`** — still the text wordmark, not the new transparent
  `calmguide-logo-transparent.png`. §2.1's original reasoning (a raster
  image reads soft at a ~40px header height, whereas real text stays
  crisp at any size) is about size, not the opaque-white-box bug the
  transparent PNG fixes — a clean transparent background doesn't change
  how soft a detailed illustrated mark looks scaled down that small. Text
  wordmark kept.
- **Facility portal** (`app/[locale]/facility/**`) — not touched. These are
  operational, table-heavy dashboards (§20); adding decoration risks
  competing with data legibility for a use case this document already
  says should stay denser and quieter than the caregiver app, not warmer.
- **`/login`, `/facility/login`** — not touched, to keep this pass scoped
  to the four screens named in the brief (Home, Coach, Check-in, Profile);
  same static-blob treatment would apply cleanly if extended here later.

**Verified:** `tsc --noEmit` clean; `vitest run` 256 passed, 1 skipped (no
change from baseline). Visually checked in a live dev server (light + dark,
desktop + mobile viewport) — Home, Check-in confirmed directly; Profile's
live render could not be exercised (no seeded backend profile data in this
session) so it was verified by code review plus `ProfileView.test.tsx`
(6/6 passing, unchanged) instead.

### 2026-09-01 — Web + responsive mobile redesign (phases 1–6)

Applied the approved mobile references to the in-app caregiver experience.
Full detail in §25. Summary: new `max-w-app` desktop shell width and a
2-column Home; four semantic Moment Coach section tints; a mobile bottom
nav mapped onto existing routes; real line icons on the Incident Log; card
+ chip treatment on Profile and Daily Check-In.

Two references were adapted rather than copied because they depict data the
app does not store (Behavior Profile's age/diagnosis/stability metrics,
Daily Check-In's 5-point caregiver mood and loved-one state chips) — see
§25.1. No backend, route, parsing, SSE, auth or persistence changes.

**Functionality changed: none.** Tests: 242 passed, 1 skipped, 6 failed —
all six pre-existing `ThemeToggle` failures documented in
`docs/feature-audit-2026-09-01.md`. `tsc --noEmit` clean.

### 2026-09-01 — Landing-page palette pass + Leap of Faith logo fix

**Fixed:** the Leap of Faith logo was unreadable in both hero and footer
placements. Root cause: `leap-of-faith-logo.webp` is a wide horizontal
lockup (1500×449, ~3.3:1) with a solid **black** wordmark, and it was
being force-cropped into small `rounded-full` circles (`h-7 w-7` /
`h-16 w-16`) — squishing the aspect ratio illegibly in the hero, and in
the footer additionally rendering black-on-navy (near-invisible). Fixed
by: (1) using the logo at its natural aspect ratio (`h-6 w-auto` hero,
`h-8 w-auto` footer, no rounding/cropping), and (2) wrapping the footer
instance in a small white rounded card so the black wordmark stays
legible against the dark footer band — the asset itself was not redrawn,
recolored, or approximated, per the standing rule (§2.1).

**Changed:** applied a supplied color palette to the landing page — see
§3.6/§3.7 for the full token table and the three new gradient classes
(hero blob, final CTA, footer). Most of the supplied hex values already
matched existing tokens exactly (primary, primary-light, navy, ink,
background, surface, primary-soft, error, emergency, success, warning —
all unchanged); only `accent-mint`/`accent-aqua`/`accent-lavender` values
and the new `accent-blue` token were added/changed, plus three CSS
gradient utility classes replacing three flat/two-tone backgrounds
(hero blob, final-CTA panel, footer band).

### 2026-09-01 — Landing page rebuild against approved reference

Full rebuild of the 12 sections in §18 against a written brief treating a
supplied reference image + the six `product-screens/` mockups as the
visual source of truth. Landing page only — no backend, API, auth,
database, RAG, safety-gate, SSE, or mobile code touched, and no design
token's existing *value* changed (only additive new tokens, §3.6).

**Added:**
- `frontend/public/brand/screens/` — the six supplied product-screen
  mockups, copied in with clean kebab-case names
  (`calmguide-home-coach.png`, `calmguide-moment-coach-why.png`,
  `calmguide-moment-coach-response.png`, `calmguide-behavior-profile.png`,
  `calmguide-daily-checkin.png`). `calmguide-incident-log.png` was copied
  but not placed on the page — no section needed a sixth image without
  forcing it.
- `--color-footer-*` tokens (§3.6) for the fixed deep-navy footer band.
- New locale keys across `locales/{en,es,hi}/common.json`:
  `landing.value_strip`, `landing.what_is`, `landing.final_cta`,
  `landing.footer.for_you_heading` / `.resources_heading`,
  `landing.behavioral_context.items`, plus `hero.title_pre` /
  `.title_highlight` / `.title_post` replacing the single `hero.title`
  string so "caregiving" can be isolated and styled per-locale.
- Optional `triggerClassName` prop on `LocaleSwitcher`
  (`frontend/src/components/ui/LocaleSwitcher.tsx`) — additive, defaults
  to the previous hardcoded classes, so its only other call site
  (this same footer) is the only thing affected. Needed because the
  footer's fixed-dark background made the switcher's default
  `text-foreground-muted` unreadable.

**Changed:**
- `frontend/src/app/[locale]/page.tsx` — full rewrite to the new 12-section
  order (§18 has the complete section-by-section rationale, including
  what happened to the old Problem/RAG-diagram/DICE/Voice/Partnership/
  About sections — folded into other sections, not deleted).
- `locales/{en,es,hi}/common.json` — `landing.how.steps.*.title` reworded,
  `landing.safety.steps` simplified from 5 items to 4, `landing.three_am`
  title + items updated (now includes "Voice-friendly experience" as a
  bullet — see §18 section 9 for why this also resolves the previously
  separately-flagged stale "Voice — in development" badge).

**Flagged, not silently resolved:**
- The six product-screen mockups are concept UI, not real app captures —
  see §18 section 2's provenance note. User was asked and explicitly chose
  to use them as-is.
- A "Contact" footer link from the brief was skipped — no real contact
  channel exists in the repo to point it at (§18 section 12).

**Known visual gaps against the brief** (not yet resolved):
- The brief specified `#F3F1F8` for "soft lavender"; this pass reused the
  existing `--color-accent-lavender` (`#EAE6F2`) rather than adding a
  near-duplicate token — the two are visually indistinguishable at the
  low opacities used for section backgrounds.
- No literal reference-image pixel diff was performed — no such image file
  exists anywhere in this repo or in `design/references/`; the brief's own
  detailed written spec (copy, hex values, section order) was treated as
  the source of truth instead, per its own explicit instruction to do so
  when a reference file isn't available.
- Scrolled-state screenshots could not be captured in this session's
  browser-preview tool once the page passed one viewport height (a tooling
  limitation specific to this page's use of real `window`-level scroll,
  confirmed via `document.elementFromPoint`/`getBoundingClientRect`/
  `get_page_text` instead) — full-page visual QA was completed on mobile
  viewport instead, where the same capture path worked correctly end to
  end.

### 2026-09-01 — Reorganize design reference assets under `design/references/`

**Added:**
- `design/references/landing-page/product-screens/` — new, currently-empty
  drop zone for real product screenshots, with its own README explaining
  why the hero doesn't have a phone mockup yet (§18, section 2) and what
  happens once screenshots land here.

**Moved:**
- `design/logos/` → `design/references/logos/` (all three brand raster
  files, filenames unchanged, plus its README) — consolidating all design
  reference material (logos, and now product screenshots) under one
  `design/references/` root instead of loose top-level folders. Every path
  reference to the old `design/logos/` location in this document (§2.1,
  §2.2, §24) was updated to match.

**Functional changes:** none. No production assets in `frontend/public/`
or `mobile/assets/` were touched — this only reorganizes the design-source
staging area.

### 2026-08-27 — Design system foundation + landing page (this pass)

**Added:**
- This document (`design/design.md`).
- New, additive CSS custom properties in `globals.css` for surfaces,
  borders, and state-color backgrounds/text pairs (§3) — no existing
  token's value changed except the two documented dark-mode brightenings
  of `--color-success` / `--color-warning` (§3.5), both AA-verified.
- Matching semantic Tailwind tokens in `tailwind.config.ts`
  (`primary.soft`, `surface.elevated`, `navy`, `ink`, `success.bg/text`,
  `warning.bg/text`, `error.bg`, `emergency.DEFAULT/bg`,
  `accent.{mint,aqua,lavender,peach}`, `theme-soft`/`theme-strong` borders,
  `max-w-landing`).
- `frontend/public/brand/` — the three real brand raster assets copied
  as-is from `design/references/logos/` (§2.1).
- A new public landing page replacing the previous minimal Welcome screen
  at `frontend/src/app/[locale]/page.tsx` (§18), using the `data-landing`
  attribute technique (mirroring the existing `data-facility` pattern) to
  opt out of the app-shell chrome for this one route, plus a new
  `LandingNav` client component (`frontend/src/components/landing/`).
- A `common.landing.*` translation tree (nav, hero, problem, how, coach,
  behavioral_context, rag, safety, dice, voice, three_am, interop,
  technology, partnership, about, footer) added to all 11 locale files at
  the repo-root `locales/<locale>/common.json` (§18.1) — English written
  directly, the other 10 locales translated and structurally verified
  (same key nesting and array lengths as the English source) before the
  full production build was re-run to confirm the `prebuild` copy step
  propagates correctly end-to-end.
- Fixed three real sub-44px touch targets in `DailyCheckinCard` (§11) —
  the only concrete, verified-in-code touch-target gap found; the
  `EmergencyBar` issue the 2026-04-28 audit flagged was already fixed in
  an earlier pass.

**Corrected mid-pass:**
- Initial translation work was mistakenly applied to
  `frontend/locales/<locale>/common.json`, which is gitignored and gets
  wiped and regenerated from the repo-root `locales/` directory on every
  `npm run build`. Discovered via a build run that silently reverted the
  English `landing` key; re-applied all 11 locales' `landing` content to
  the correct root-level files and re-verified with a full build (§18.1).
- `LandingNav`'s CTA originally pointed to `/login`, inconsistent with the
  hero's and footer's primary CTA of `/profile/setup`. Changed both the
  desktop and mobile nav CTAs to `/profile/setup` so all three "primary
  action" buttons on the page agree (§18, section 1).
- The original Welcome screen exposed a language switcher; the first
  landing-page draft did not carry it over. Added the existing
  `LocaleSwitcher` component to the footer's copyright row (§18, section
  16), the only spot on the page where its upward-opening dropdown reads
  correctly.

**Flagged, not changed:**
- `frontend/public/mark*.svg` / `wordmark*.svg` / `lockup-*.svg` /
  `app-icon*.svg` / `favicon*` depict an older, different logo (sage-green
  serif swirl mark) than the current brand (§2.2) — needs real vector
  source files before it can be corrected; left untouched rather than
  redrawn.
- Full page-by-page visual migration of the authenticated app (`home`,
  `coach`, `check-in`, `profile`, `incidents`, `learn`, `journey`,
  `impact`, `facility`) is scoped (§19, §20) but not executed in this
  pass.

**Functional changes:** none. No API contracts, routing behavior (other
than the landing page's own content), auth flow, safety-gate logic, RAG
logic, or persistence logic were touched.

### 2026-08-27 — Reduce frontend to 3 locales (en, es, hi)

**Removed:**
- Frontend support for 8 of the 11 previously-supported locales — `zh, ta,
  ar, fr, pt-BR, ja, de, ko` — leaving `en` (default), `es`, `hi` (§17).
  Driven by product decision to launch with 3 languages; not a technical
  limitation.
- `SUPPORTED_LOCALES` and its dependent maps (`BASE_LANGUAGE_TO_LOCALE`,
  `LOCALE_MESSAGE_DIRS`, `LOCALE_NAMES`) in `frontend/src/lib/locale.ts`
  trimmed from 11 to 3 entries; `next-intl` routing (`routing.ts`),
  middleware, and `ProfileView`'s language picker all derive from this
  array generically and required no direct edits.
- Hardcoded locale-list duplicates trimmed to match, one-by-one, in:
  `[locale]/layout.tsx` (`landing-layout-detect` path regex),
  `facility/settings/page.tsx` and `facility/staff/new/page.tsx`
  (default-language `<select>` options), `SafetyDisclosure.tsx`
  (`EMERGENCY_NUMBERS` per-locale emergency/helpline map), and
  `useSpeechRecognition.ts` (`LOCALE_TO_BCP47` map).
- The 8 removed locales' translation directories under the repo-root
  `locales/` (source of truth) and the gitignored, build-regenerated
  `frontend/locales/` copy; `locales/REVIEW_STATUS.md` rewritten to
  reflect only `es`/`hi` review status.
- Dead RTL font-fallback CSS (`[lang^="ar"|"ja"|"ko"|"zh"]` rules in
  `globals.css`) and their `next/font` loaders (`Noto_Sans_Arabic/JP/KR/SC`
  in `[locale]/layout.tsx`) — these `lang` values can no longer occur
  (§17).

**Retained as dormant groundwork (not removed):** `isRtl()`, the
`dir="rtl"` wiring on `<html>`, logical-property CSS usage, and
`.select-chevron`'s `[dir="rtl"]` mirror rule — none are currently
exercised (no active locale is RTL) but they cost nothing to keep and
would matter again if an RTL locale is reintroduced (§17).

**Explicitly out of scope for this pass:** `ARCHITECTURE.md`'s
cross-system "11 Languages" section and the `mobile/` app's own, separate
11-locale i18next setup (`mobile/locales/`, `mobile/src/lib/i18n.ts`) were
left untouched — this pass targets `frontend/` only, consistent with this
document's scope. Backend locale-handling code was likewise not touched.

**Functional changes:** locale-picker UI (web `LocaleSwitcher`,
`ProfileView`, facility language `<select>`s) now offers 3 options instead
of 11; no other behavior changed.
