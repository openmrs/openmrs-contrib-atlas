# OpenMRS Atlas 3.0

A world map of OpenMRS implementations, at [atlas.openmrs.org](https://atlas.openmrs.org).

> **Status:** Atlas 4.x is built on `main`; every push to `main` builds the image
> atlas-stg.openmrs.org runs, and release tags (`4.0`, `4.1`) build the one atlas.openmrs.org
> runs. Atlas 2.0
> (Express + MySQL) is retired; its code is kept, unmaintained, on the `2.x` branch. See
> [`infra/README.md`](infra/README.md) for the environments.

## How it works

- **Data lives in a Google Sheet.** One row per marker; private fields (owners, contact details)
  sit on a separate tab and are never published.
- **Visitors never read the sheet.** A small service validates the sheet and publishes snapshot
  files (`atlas.json`, GeoJSON, CSV), both whenever the sheet is edited and nightly. It runs as
  one Docker container per environment on OpenMRS infrastructure, and also serves the map site
  and the published files.
- **The map is a static site** (React, Vite, MapLibre GL JS with OpenFreeMap tiles) that loads
  the snapshot.
- **Sign-in** uses OpenMRS Keycloak. People add and edit markers on the site, and the service
  writes those changes to the sheet.
- **Sharing.** Every marker has a permalink, `/marker/<id>`, with link preview tags and a social
  card drawn when publishing. The Share dialog offers the link, the social networks, the card and
  an "On the OpenMRS Atlas" badge (`/badges/on-the-atlas-light.svg` and `-dark.svg`) for
  implementations' own websites.
- **Claims.** A signed-in person can claim a marker that has no owner. An admin approves or
  declines each claim in the Atlas, and the claimant is told by email.

The requirements and design live in [`openspec/`](openspec/). Each piece of work is an OpenSpec
change: proposed, applied, then archived into `openspec/specs/`. Background and rationale are in the
[Atlas 3.0 design spec](https://claude.ai/artifact/GKHHVKkbSRPtCpya5DZVfZ).

## Repository layout

| Path           | What it is                                                                |
| -------------- | ------------------------------------------------------------------------- |
| `shared/`      | Sheet schema, validation, snapshot builders. Pure TypeScript, no I/O.     |
| `web/`         | The map site.                                                             |
| `service/`     | The service: validate, publish, serve. Also `npm run setup:sheet`.        |
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

`docker compose up -d` starts **mysql** on port 3306: an Atlas 2.0 database with the 2.0 schema
and demo data (database `atlasdb`, user `atlas`, password `atlas`), the source for the migration.

### The service

The service needs a [test sheet](#test-sheet). It writes published files, cards and logos to a
local folder, `.data/` (git-ignored), and serves them as the deployed Atlas does:

```sh
SHEET_ID=<test sheet id> DATA_DIR=.data SITE_URL=http://localhost:5173 PUBLISH_SECRET=local \
  SCHEDULED_JOBS=off node service/src/server.ts
curl -X POST -H "Authorization: Bearer local" http://localhost:8080/publish
npm run dev -w web       # forwards /api, /data, /rss and /marker to the service
```

`SCHEDULED_JOBS=off` keeps the nightly publish and the reminder job from starting on their own.
See [`service/README.md`](service/README.md) for every setting, and
[`infra/README.md`](infra/README.md) for building and running the Docker image.

## Test sheet

Code that talks to Google Sheets is tested against a real sheet in your own Google account. There
is no Sheets emulator, and the unit tests don't need one.

1. **Create a development service account** in a personal Google Cloud project (free), and allow
   your account to act as it. Google no longer lets the gcloud CLI request the Sheets scope
   directly, so local code reaches Sheets as this service account, just as the deployed service
   does.

   ```sh
   P=<your-project-id>
   SA=atlas-dev@$P.iam.gserviceaccount.com
   gcloud services enable sheets.googleapis.com iamcredentials.googleapis.com --project $P
   gcloud iam service-accounts create atlas-dev --display-name="Atlas local development" --project $P
   gcloud iam service-accounts add-iam-policy-binding $SA \
     --member=user:<your-google-account> --role=roles/iam.serviceAccountTokenCreator --project $P
   ```

2. **Sign in with Application Default Credentials** that impersonate it:

   ```sh
   gcloud auth application-default login --impersonate-service-account=$SA
   ```

3. **Create an empty Google Sheet**, share it with the service account (`$SA`) as an Editor, and
   copy its id from the URL (`https://docs.google.com/spreadsheets/d/<id>/edit`).
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
`main`.
