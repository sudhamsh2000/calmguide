# Logos (design source files)

Drop any new logo files here — PNG, SVG, AI, Figma exports, whatever you have.
This folder is a staging area, separate from the production brand assets
already in use across the apps:

- `frontend/public/` — web favicons, app icons, wordmark/lockup/mark SVGs
  (`mark.svg`, `wordmark.svg`, `lockup-horizontal.svg`, `lockup-stacked.svg`,
  `app-icon.svg`, etc.)
- `mobile/assets/images/` — mobile app icons/splash images

Once you've added logos here, point me at this folder and tell me what you
want done with them — e.g.:
- Pull colors/typography/style cues from a logo to inform the app's design
  system (Tailwind theme, CSS variables, etc.)
- Replace/update the existing icons or wordmarks in `frontend/public/` or
  `mobile/assets/images/`
- Generate derived assets (favicons, app-icon sizes, dark-mode variants)

Nothing in this folder is wired into the apps automatically — it's just a
drop zone until we decide what to do with what's in it.

## Current contents

The three files already here (`CALM GUID.png`, `CalmGUID + LEAP OF
FAITH.png`, `leap of FAITH.webp`) are the source-of-record for the raster
assets live at `frontend/public/brand/` — see `design/design.md` §2.1 for
the exact file mapping and usage. Moved here (from `design/logos/`) as part
of consolidating all design reference material under `design/references/`
— see `design/references/landing-page/product-screens/README.md` for the
sibling drop zone for real product screenshots.
