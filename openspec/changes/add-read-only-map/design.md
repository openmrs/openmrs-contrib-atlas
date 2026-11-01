# Design

## Context

See proposal.md for motivation and the project context in `openspec/config.yaml` for settled architecture. The `atlas-3.0` branch starts as a copy of `master` (Express 4, EJS, MySQL, jQuery/gmap3). Nothing from 2.0 runs in 3.0; the only things carried forward are its data (via migration) and its `/?marker=<id>` URLs. The 2.0 demo data (`db/03_demo_data.sql`) is kept as a test fixture for the migration.

Data volume is small: 451 markers today, a few edits a week. Visitors are global and often on slow connections.

## Goals / Non-Goals

**Goals:**
- A code layout that Phase 2 (sign-in and editing) extends without restructuring.
- One validation module shared by the publisher, the migration and later the edit endpoints.
- Nothing for a maintainer to patch: no VMs, no database, no long-lived credentials.

**Non-Goals:**
- Server-side rendering or SEO pages per marker.
- Offline support.
- Production environment setup (created at cutover, by repeating the staging steps).

## Decisions

### Repository layout: npm workspaces in one repo

```
shared/       types, validation (plain TypeScript, no schema library), snapshot builders (pure TS, no I/O)
web/          React + Vite map site
service/      Cloud Run service (Hono): /publish now; edit endpoints in Phase 2
apps-script/  sheet-bound Apps Script (onEdit bookkeeping, debounce, admin menu)
migration/    one-off CLI: Atlas 2.0 MySQL -> sheet + logos
.github/workflows/  CI and staging deploy
firebase.json, .firebaserc
```

Node 24 LTS throughout. The 2.0 files are deleted from the branch in the first commit.
*Alternatives:* separate repos per component (more overhead for a two-person project); a single package (web and service would share a dependency tree they don't need).

### Front end: React, MapLibre layers, URL as state

- **React + Vite + TypeScript.** OpenMRS 3.x front-end contributors already know React, which matters more for long-term maintenance than bundle size. No router, no state library, no component kit. View state lives in `URLSearchParams`, which also satisfies the shareable URL requirement.
- **Markers as MapLibre layers, not HTML markers.** One GeoJSON source with `cluster: true` and `clusterProperties: { sites: ['+', ['coalesce', ['get','site_count'], 1]] }` gives count-aware clusters natively. Symbol layers draw teardrop pins (images generated in the browser, one per colour), site-count labels and cluster totals. The cluster radius is 0.25 px, so pins that merely overlap stay separate and the world view shows how many sites there are. Because everything is drawn on the WebGL canvas, PNG export captures it. *Alternative:* Supercluster + HTML markers, which would be easier to style but invisible to canvas export.
- **Colour-by and filters as layer expressions.** Changing colour-by updates a `match` expression; filters rebuild the source data from the in-memory marker list (around 500 items, so this is cheap) so clusters and stats stay consistent.
- **Fading computed in the browser** from `confirmed_at` against today's date, written to a feature property at load time. Freshness then never depends on a republish.
- **Search** is a diacritic-insensitive substring match over name, organisation and country name in memory. Country names come from `Intl.DisplayNames` using the ISO code in the snapshot, so no country-name data is shipped.
- **Base map:** the OpenFreeMap "liberty" style (coloured land and water, chosen over the muted "positron" after review on staging), set through a single `VITE_MAP_STYLE_URL`.

### Snapshot publishing

- **Service** (Hono on Cloud Run, min instances 0) reads every tab in one Sheets `batchGet` call, validates with `shared/`, writes the `problems` tab, applies the 80% safety check against the current `atlas.json`, then writes `atlas.json`, `markers.geojson` and `markers.csv` to the public bucket with `Cache-Control: public, max-age=300`. It also writes a timestamped copy under `history/` (a 90-day lifecycle rule deletes old copies) so a bad publish can be rolled back by copying a file.
- **Country** is derived at publish time with `@rapideditor/country-coder` (offline, ISO alpha-2, the form `Intl.DisplayNames` accepts).
- **Callers and auth.** Cloud Scheduler calls nightly with a Google OIDC token for a dedicated service account, and the service verifies the token's audience and email. Apps Script calls with a shared secret held in Secret Manager and copied to Script Properties. `force=true` is accepted only from the Apps Script admin menu path. *Alternative:* IAM-only invocation, but Apps Script can't easily mint tokens for a service account.
- **Sheet access** uses the Cloud Run service account, which is shared on the sheet as an editor. No key files.

### Apps Script: bookkeeping and debounce only

An installable `onEdit` trigger does three things:
- assigns a UUID to rows without an `id`
- sets `updated_at`
- appends to `changes` with `e.user`

It then requests a publish through a debounce: if no publish trigger is pending, it creates a one-off time-based trigger 60 s out, and that trigger calls `/publish`. This gives at most one publish a minute (see specs/snapshot-publishing). A custom menu, "Atlas → Publish now" and "Atlas → Force publish", serves the admin path. Apps Script does no validation, so the rules live in one place (`shared/`).

### Stable download URLs via Firebase redirects

`/data/atlas.json`, `/data/markers.csv` and `/data/markers.geojson` on the site domain redirect (302) to the bucket objects. The bucket allows CORS GET from the site origins. The URL people bookmark stays on atlas-stg.openmrs.org / atlas.openmrs.org even if the bucket changes. *Alternative:* serving data through Cloud Run, which adds cold starts to every visit.

### PNG export

The export creates an off-screen container at the on-screen CSS size and a second MapLibre map with `pixelRatio` = 1, 2 or 4, `preserveDrawingBuffer: true`, and the same style, camera, sources and filters. It waits for `idle`, then composites the map canvas with title, legend, date and attribution onto a 2D canvas and saves it with `toBlob`. If the browser can't allocate the canvas, the visitor is told to try a smaller size.

### Migration

A Node CLI in `migration/` connects to MySQL using `mysql2` with a read-only user, either over an SSH tunnel to production or against a restored dump in Docker. It maps rows with pure functions in `shared/` (so they are unit-tested), resizes logos with `sharp` to WebP within 300 × 300, uploads them to `logos/<id>.webp`, and replaces the data tabs in one Sheets `batchUpdate`. A `--dry-run` flag prints the report only. Credentials come from `gcloud auth application-default login` impersonating the service account.

### Local development and testing: a real test sheet, no Sheets fake

There is no Sheets emulator, so the service is not given a fake Sheets layer. Instead:

- **Unit tests** (`npm test`, CI) exercise `shared/` with fixture rows (arrays of cell values), never the Sheets API. The service's Sheets reader/writer stays a thin layer of a few calls.
- **Sheet integration tests** (`npm run test:sheet`) run only when `TEST_SHEET_ID` is set, against a developer's personal test sheet with the same tabs. They are run locally before merging changes to the Sheets layer, not in CI.
- **Local stack** (`docker compose up`): MySQL loaded with the 2.0 demo data for the migration, and `fake-gcs-server` standing in for Cloud Storage. The service and web run with `npm run dev`, pointed at the test sheet and the fake bucket.
- **Apps Script** is bound to the test sheet. When it needs to call a locally running service, a tunnel (ngrok or `cloudflared`) exposes it.
- **Credentials** come from the developer's own Google account (`gcloud auth application-default login` with the Sheets scope), in a personal Google Cloud project. No key files, and no OpenMRS project access is needed before staging.

*Alternative:* a local file-backed sheet interface. It would let CI run end to end, but it is one more abstraction to keep faithful to real Sheets behaviour.

### CI/CD

- On pull requests: GitHub Actions runs typecheck, lint, Vitest, a web build, and a Playwright smoke test against a fixture snapshot.
- On push to `atlas-3.0`: deploy `web` to the Firebase Hosting site for atlas-stg, and `service` to Cloud Run (built with Cloud Build from `service/Dockerfile`), authenticating through Workload Identity Federation with no stored keys.
- Apps Script is pushed with `clasp` by hand, since it changes rarely.

### Configuration

| Component | Settings |
| --- | --- |
| web (build time) | `VITE_DATA_BASE_URL`, `VITE_MAP_STYLE_URL`, `VITE_GA_ID` (empty on staging) |
| service | `SHEET_ID`, `BUCKET`, `PUBLISH_SECRET` (Secret Manager), `SCHEDULER_SA_EMAIL` |
| Apps Script | `SERVICE_URL`, `PUBLISH_SECRET` in Script Properties |

## Risks / Trade-offs

- [OpenFreeMap has no SLA] → the style URL is one setting; any OpenMapTiles-compatible provider can replace it in minutes.
- [MapLibre (~220 KB gzipped) strains the 3 s Fast 3G budget] → light style, a single code bundle with no other heavy dependencies, snapshot loaded in parallel with the map; measured by a Lighthouse CI check on the staging URL.
- [Direct sheet edits bypass validation] → invalid rows are left out rather than published, `problems` makes them visible, and the safety check plus `history/` copies cover mass deletions.
- [Apps Script triggers can fail silently] → the nightly publish catches anything missed within 24 hours.
- [4x export can exhaust memory on phones] → offer 4x only when the device can allocate the canvas, and show a clear error otherwise.
- [A shared secret for Apps Script can leak] → it can only trigger a publish of data already in the sheet, and rotating it is one Secret Manager update plus one Script Property.

## Migration Plan

1. (manual) Create the GCP resources, the staging sheet, the bucket, Workload Identity Federation and the DNS record (see tasks.md).
2. Deploy the service and web to staging from `atlas-3.0`.
3. Run the migration with `--dry-run`, review the report, then run it for real against the staging sheet.
4. Trigger a publish; compare the marker count and a sample of markers with atlas.openmrs.org.

Rollback: staging only. Redeploy the previous build from CI, or copy a `history/` snapshot back to `atlas.json`. Atlas 2.0 is untouched throughout.

## Open Questions

- The GA4 measurement ID for production. It isn't needed until cutover; staging builds have none.
- Final bucket and service names. These are cosmetic and get chosen during setup.
