# Translation Review Status

This file is the single source of truth. `mobile/locales/REVIEW_STATUS.md` is a
generated copy — edit this one.

CalmGuide ships UI translations for 3 locales: English (`en`, default), Spanish
(`es`), and Hindi (`hi`). Translation files for zh, ta, ar, fr, pt-BR, ja, de,
ko were removed — see `design/design.md` §17 / §24 change log.

Those 8 removed languages are still listed as `EXPERIMENTAL` in
`backend/app/services/language_support.py`, which serves `GET /languages`. That
registry describes which languages the *model* may be asked to answer in; it is
no longer a claim that translated UI chrome exists for them. The two counts are
meant to differ.

"MVP-validated" (English, Spanish, Hindi) is a support-priority designation,
not a claim that review is complete — as the tables below show, the
safety-critical namespace is still pending for Spanish and Hindi.

## Safety-Critical Files (require professional review)

| File | es | hi |
|------|----|----|
| coach.json | pending | pending |
| incidents.json | not tracked | not tracked |

`coach.json` carries the Moment Coach guidance, including crisis and escalation
copy. It was previously named `crisis.json`; this file tracked that old name
long after the rename, so the row above is the same obligation under its
current filename.

## Standard Files (LLM-generated, review optional)

| File | es | hi |
|------|----|----|
| common.json | done | done |
| home.json | done | done |
| checkin.json | done | done |
| learn.json | done | done |
| profile.json | done | done |
| facility.json | not tracked | not tracked |
| impact.json | not tracked | not tracked |
| journey.json | not tracked | not tracked |

**"not tracked"** means exactly that — these namespaces exist and are shipping,
but no review decision has been recorded for them either way. They are listed
here so the gap is visible rather than invisible. `incidents.json` is placed
under safety-critical because incident copy feeds clinical escalation paths;
that classification needs confirming by someone with clinical context.
