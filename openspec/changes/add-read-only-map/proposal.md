# Proposal

## Why

The live Atlas 2.0 shows 18 of its 451 markers on first load, because fading hides anything not edited in about 30 months, and its login depends on the retired OpenMRS ID LDAP. Atlas 0.1 (Phase 1 of the 3.0 roadmap) puts every existing marker back on a fast, current world map at atlas-stg.openmrs.org, on the low-maintenance Sheet + snapshot architecture, before any sign-in or editing work begins.

## What Changes

- New Google Sheet data store (markers, private, changes, lookup tabs) with validation rules shared by every component.
- A repeatable migration that copies all Atlas 2.0 markers, owners and logos from its MySQL database into the sheet, keeping marker ids.
- A Cloud Run service that validates the sheet and publishes public snapshots (JSON, GeoJSON, CSV) to Cloud Storage, triggered by direct admin edits in the sheet and by a nightly job.
- A new static map site built with React and MapLibre GL JS on OpenFreeMap tiles:
  - colour by type, distribution or version (M3)
  - markers and clusters that show site counts (M4)
  - search and filters (M5) and shareable URLs, including 2.0's `/?marker=<id>` (M6)
  - gradual fading that never hides markers (M7), and headline stats (M9)
- Public data downloads without contact details (A4) and a PNG download of the current view at 1x, 2x or 4x (X1).
- A staging environment at atlas-stg.openmrs.org, deployed from the `atlas-3.0` branch by GitHub Actions.
- **BREAKING** (for the 3.0 branch only): the 2.0 Express app, views and SQL files are removed from `atlas-3.0`. They remain on `master`, which keeps serving atlas.openmrs.org until cutover.

Out of scope for this change:
- Keycloak sign-in, adding or editing markers in the UI, ownership, delegation and transfer (Phase 2).
- Reminder emails, "still current" links, new-entry notifications, the RSS feed (Phase 2, needed before cutover).
- Contact relay form, list view, nightly pre-rendered images, share cards (Phase 3).
- Production deployment and DNS cutover of atlas.openmrs.org.

## Capabilities

### New Capabilities

- `marker-data`: the sheet's structure, validation rules, and the public/private split of marker fields.
- `snapshot-publishing`: how and when the sheet is validated and turned into public snapshot files, plus the safety checks that stop a bad publish.
- `legacy-migration`: the repeatable copy of Atlas 2.0 data into the sheet.
- `map-view`: the public map: markers, clustering, colouring, fading, popups, search, filters, headline stats and shareable URLs.
- `map-export`: public data downloads and PNG image download of the current view.

### Modified Capabilities

None. This is the first change; no specs exist yet.

## Impact

- Code: replaces the repository contents on `atlas-3.0` with npm workspaces for `web` (map site), `service` (Cloud Run), `shared` (types and validation), `apps-script` (sheet trigger), and `migration`.
- Systems: one Google Cloud project with Firebase Hosting (staging site), Cloud Run, Cloud Scheduler, Cloud Storage, Secret Manager; one staging Google Sheet; Cloudflare DNS record for atlas-stg.openmrs.org; a GA4 property ID.
- Data: reads the production Atlas 2.0 MySQL database (read-only) to seed staging.
- Dependencies: React, MapLibre GL JS, Vite, Hono, @googleapis/sheets, google-auth-library, @google-cloud/storage, @rapideditor/country-coder, Vitest, Playwright.
- Atlas 2.0 on `master` and atlas.openmrs.org are unaffected.
