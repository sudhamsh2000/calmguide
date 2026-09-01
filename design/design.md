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

## 24. Change Log

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
