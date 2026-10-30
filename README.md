# OpenMRS Atlas 3.0

A world map of OpenMRS implementations, at [atlas.openmrs.org](https://atlas.openmrs.org).

> **Status:** Atlas 3.0 is being built on the `atlas-3.0` branch and will be previewed at
> atlas-stg.openmrs.org. Atlas 2.0 (Express + MySQL) remains on `master` and keeps serving
> atlas.openmrs.org until cutover.

## How it works

- **Data lives in a Google Sheet.** One row per marker; private fields (owners, contact details)
  sit on a separate tab and are never published.
- **Visitors never read the sheet.** A small Cloud Run service validates the sheet and publishes
  snapshot files (`atlas.json`, GeoJSON, CSV) to a public Cloud Storage bucket, both whenever the
  sheet is edited and nightly.
- **The map is a static site** (React, Vite, MapLibre GL JS with OpenFreeMap tiles) that loads
  the snapshot.
- **Sign-in** (Phase 2) uses OpenMRS Keycloak.

The requirements and design live in [`openspec/`](openspec/). Each piece of work is an OpenSpec
change: proposed, applied, then archived into `openspec/specs/`. Background and rationale are in the
[Atlas 3.0 design spec](https://claude.ai/artifact/GKHHVKkbSRPtCpya5DZVfZ).

## Repository layout

| Path           | What it is                                                                |
| -------------- | ------------------------------------------------------------------------- |
| `shared/`      | Sheet schema, validation, snapshot builders. Pure TypeScript, no I/O.     |
| `web/`         | The map site.                                                             |
| `service/`     | Cloud Run service: validate and publish. Also `npm run setup:sheet`.      |
| `apps-script/` | Apps Script bound to the sheet: edit bookkeeping and publish triggers.    |
| `migration/`   | One-off copy of Atlas 2.0 data into the sheet; `fixtures/` holds 2.0 SQL. |
| `openspec/`    | Specs and change proposals.                                               |

## Local development

Prerequisites: Node 24+, Docker, and (for anything touching Google) the
[Google Cloud CLI](https://cloud.google.com/sdk/docs/install).

```sh
npm install
npm test            # unit tests (no network, no Google account needed)
npm run typecheck
npm run lint
```

### The map site

```sh
npm run dev -w web                                    # sample data, http://localhost:5173
npm run fixtures -w web -- --live                     # once: fetch ~450 real markers from Atlas 2.0
VITE_DATA_FILE=live.json npm run dev -w web           # the map with real data
npm run e2e -w web                                    # Playwright tests (offline map style)
```

Run `npx -w web playwright install chromium` once before the first `e2e` run.

### Local services

`docker compose up -d` starts the local stack:

- **mysql** on port 3306: an Atlas 2.0 database with the 2.0 schema and demo data
  (database `atlasdb`, user `atlas`, password `atlas`), the source for the migration.
- **gcs** on port 4443: [fake-gcs-server](https://github.com/fsouza/fake-gcs-server) with a bucket
  named `atlas-local`, standing in for Cloud Storage.

## Test sheet

Code that talks to Google Sheets is tested against a real sheet in your own Google account. There
is no Sheets emulator, and the unit tests don't need one.

1. **Create a Google Cloud project** for personal development (free), and enable the Google Sheets
   API in it.
2. **Sign in with Application Default Credentials**, including the Sheets scope, and set the quota
   project:

   ```sh
   gcloud auth application-default login \
     --scopes=https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/cloud-platform
   gcloud auth application-default set-quota-project <your-project-id>
   ```

3. **Create an empty Google Sheet**, and copy its id from the URL
   (`https://docs.google.com/spreadsheets/d/<id>/edit`).
4. **Set it up:**

   ```sh
   npm run setup:sheet -- <id> --sample
   ```

   This adds every tab with its headers and seed lookups, plus five clearly labelled sample markers.
   It is safe to re-run, and never changes existing data rows. It finishes by printing the tab
   names.

5. **Save the id** in `.env` (copy `.env.example`) as `TEST_SHEET_ID`. Then
   `npm run test:sheet` runs the sheet integration tests.

Sheet integration tests (`*.sheet.test.ts`) are not run in CI. Run them before merging changes to
code that reads or writes the sheet.

## Contributing

Changes go through OpenSpec: propose a change (`/opsx:propose` in Claude Code, or by hand under
`openspec/changes/`), get it reviewed, implement it, then archive it. Pull requests target
`atlas-3.0` until cutover.
