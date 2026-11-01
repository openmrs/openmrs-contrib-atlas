# Tasks

## 1. Repository scaffolding

- [x] 1.1 Remove the 2.0 app from `atlas-3.0` (Express app, routes, views, public, db, Docker files, 2.0 package files), keeping `db/01_database.sql` and `db/03_demo_data.sql` copied to `migration/fixtures/`; verify `git ls-files` shows no 2.0 runtime files
- [x] 1.2 Create the npm workspaces (`shared`, `web`, `service`, `apps-script`, `migration`) on Node 24 with TypeScript, ESLint, Prettier and Vitest configured at the root; verify `npm install`, `npm run typecheck`, `npm run lint` and `npm test` succeed on the empty packages
- [x] 1.3 Add a CI workflow that runs install, typecheck, lint, test and build on pull requests to `atlas-3.0`; verify it passes on a draft PR
- [x] 1.4 Add `docker-compose.yml` for local development (MySQL seeded from `migration/fixtures/`, `fake-gcs-server`); verify that `docker compose up` starts both, the demo markers are queryable, and a test object can be written to and read from the fake bucket
- [x] 1.5 Create a personal test sheet with the tabs, headers and seed lookups from specs/marker-data, and document `TEST_SHEET_ID` and the credentials setup; verify a script lists the tab names using the developer's own Google credentials
- [x] 1.6 Replace README.md with a 3.0 overview (architecture, workspace layout, local development, link to the design spec and `openspec/`); verify the local-development steps work from a fresh clone

## 2. Shared model and validation

- [x] 2.1 Define the sheet tab schemas and TypeScript types for markers, private rows and lookups in `shared/`; verify with unit tests that parse sample rows from each tab
- [x] 2.2 Implement row validation with every rule in specs/marker-data (required fields, value rules, duplicate ids, per-row multi-reason output); verify one unit test per scenario
- [x] 2.3 Implement the snapshot builders: `atlas.json`, GeoJSON and CSV from validated rows, active-only, public fields only, derived country; verify with tests that the three outputs contain the same ids and no private field names
- [x] 2.4 Implement the publish safety check (fewer than 80% of the current count refuses unless forced); verify with unit tests for refuse, pass and force

## 3. Google Cloud and sheet setup (staging)

- [x] 3.1 (manual) Create or choose the OpenMRS GCP project; enable Cloud Run, Cloud Build, Artifact Registry, Cloud Scheduler, Secret Manager, Sheets API and Firebase; verify with `gcloud services list --enabled`
- [x] 3.2 (manual) Create the staging bucket (`openmrs-atlas-stg`, the name `firebase.json` redirects to) with public read, CORS for the atlas-stg origin and a 90-day lifecycle rule on `history/`; verify an uploaded test file is readable anonymously and from the atlas-stg origin
- [x] 3.3 (manual) Create the staging Google Sheet with the tabs and headers from specs/marker-data, seed `types`, `distributions` and `versions`, and share it with the Cloud Run service account as editor; verify the service account can read it with a one-off script
- [x] 3.4 (manual) Create the publish secret in Secret Manager and the Cloud Scheduler service account; verify both exist with `gcloud`
- [x] 3.5 (manual) Configure Workload Identity Federation for the GitHub repo with deploy rights to Cloud Run and Firebase Hosting; verify a test workflow can run `gcloud auth list` without a key file

## 4. Publish service

- [x] 4.1 Implement the Sheets reader (one `batchGet` for all tabs) and the `problems` tab writer; verify with `npm run test:sheet` against the test sheet (opt-in via `TEST_SHEET_ID`, not run in CI)
- [x] 4.2 Implement `POST /publish`: validate, safety check, write the three files and a `history/` copy with `Cache-Control: public, max-age=300`; verify with tests using a fake storage client, and by a manual publish to the staging bucket
- [x] 4.3 Implement auth for `/publish` (scheduler OIDC token or shared secret; `force` only with the secret); verify that tests reject missing, wrong and expired credentials
- [x] 4.4 Add `service/Dockerfile` and the staging deploy job (Cloud Build to Cloud Run on push to `atlas-3.0`); verify the deployed service answers a health check
- [x] 4.5 (manual) Create the nightly Cloud Scheduler job calling `/publish`; verify one scheduled run shows success in the logs and refreshes `atlas.json`
- [ ] 4.6 Document the service endpoints, configuration and rollback (copying a `history/` file) in `service/README.md`; verify the rollback steps on staging

## 5. Sheet automation (Apps Script)

- [x] 5.1 Implement the installable `onEdit` handler: assign missing ids, set `updated_at`, append to `changes`; verify by editing the test sheet and checking each effect
- [x] 5.2 Implement the publish debounce (one pending time-based trigger, 60 s) and the "Atlas" menu (Publish now, Force publish); verify that 20 rapid edits cause at most 2 publishes, per the service logs
- [x] 5.3 Set up `clasp` push for `apps-script/` and document installation and the Script Properties in `apps-script/README.md`; verify by reinstalling from the README onto a copy of the sheet

## 6. Legacy migration

- [x] 6.1 Implement the field mapping, version normalisation and owner/editor derivation as pure functions in `shared/`; verify one unit test per scenario in specs/legacy-migration, using `migration/fixtures/03_demo_data.sql` rows
- [x] 6.2 Implement the CLI: MySQL read (read-only), logo resize to WebP within 300 × 300 and upload, full replacement of the data tabs, report and `--dry-run`; verify against the demo data loaded into a local MySQL container
- [x] 6.3 Document running the migration (tunnel or restored dump, credentials, dry run, cutover re-run) in `migration/README.md`; verify a dry run follows the README exactly
- [x] 6.4 (manual) Run the migration against production data into the staging sheet, dry run first; verify the report shows 451 markers (or the current 2.0 count) and that a publish succeeds with the same count

## 7. Map site

- [x] 7.1 Scaffold `web/` with React, Vite and MapLibre on the OpenFreeMap positron style, loading `atlas.json` from `VITE_DATA_BASE_URL`, with the load error and retry state; verify that `npm run dev` shows the map with fixture markers, and that a broken data URL shows the retry message
- [x] 7.2 Draw markers as clustered GeoJSON layers with site-count labels, cluster totals summing site counts, and cluster click-to-zoom; verify with a Playwright test on a fixture with known counts (the 50 + blank + 3 = 54 case)
- [x] 7.3 Implement colour-by (type, distribution, version) with a legend that includes "Unknown"; verify with component tests and a Playwright check of the legend entries
- [x] 7.4 Implement freshness fading (full to 2 years, linear to 35% at 5 years, floor 35%); verify with unit tests at 8 months, 3.5 years and 9 years
- [x] 7.5 Implement marker details (blank fields omitted, plain-text notes with linkified URLs, logo); verify with component tests, including the `<script>` case
- [x] 7.6 Implement search (name, organisation, country via `Intl.DisplayNames`, diacritic-insensitive) with keyboard-navigable results; verify with unit tests and a keyboard-only Playwright test
- [x] 7.7 Implement filters (type, distribution, version, country, confirmed within N years, clear all) applied to markers, clusters, legend and stats; verify with Playwright tests for the spec scenarios
- [x] 7.8 Implement headline stats (markers, countries, total sites, confirmed in last 2 years) for the filtered set; verify with unit tests on a fixture
- [x] 7.9 Implement URL state (view, colour-by, filters, selected marker) and legacy `/?marker=<id>`, including the not-found notice; verify with Playwright tests for the copied-view, legacy-link and unknown-id scenarios
- [x] 7.10 Make the layout responsive and touch-friendly at 360 px; verify with Playwright at a 360 × 740 viewport with no horizontal scroll
- [x] 7.11 Add GA4 page view and events (search, filter change, marker opened, download), enabled only when `VITE_GA_ID` is set; verify that a build without the ID makes no requests to Google Analytics

## 8. Export

- [x] 8.1 Add the Firebase redirects for `/data/atlas.json`, `/data/markers.csv` and `/data/markers.geojson`, plus download links with dated file names; verify the links download correctly named files with no private fields
- [x] 8.2 Implement PNG export at 1x, 2x and 4x with off-screen rendering, title, legend and date toggles, mandatory attribution and dated file name; verify that a Playwright test checks the image dimensions for a 1280 × 720 view at 4x, and inspect a sample image by eye
- [x] 8.3 Handle canvas allocation failure with a "try a smaller size" message; verify by forcing the failure path in a component test

## 9. Staging deployment and integration

- [x] 9.1 Configure the Firebase Hosting site for atlas-stg and the web deploy job on push to `atlas-3.0`; verify the deploy succeeds from CI
- [x] 9.2 (manual) Point `atlas-stg.openmrs.org` at Firebase Hosting in Cloudflare DNS; verify HTTPS loads the site
- [ ] 9.3 End-to-end check on staging: edit a marker in the sheet and confirm it appears on atlas-stg within 10 minutes; confirm `/?marker=<id>` works for 5 ids taken from atlas.openmrs.org; confirm the counts match the migration report
- [ ] 9.4 Run Lighthouse against atlas-stg with Fast 3G throttling; verify the map with markers is visible within 3 seconds, or record the gap and the fixes chosen

## Workflow follow-up

- Review with Burke on atlas-stg, then archive this change so its specs become the baseline in `openspec/specs/`.
- Next change: Phase 2 (Keycloak sign-in, editing, ownership, reminders, RSS) proposed against those specs.
