# Design

## Context

See proposal.md for why. Today each environment is split across five Google services:

- Firebase Hosting serves `web/dist`. It sends the security headers, rewrites `/api/**` and `/marker/**` to Cloud Run, and redirects `/rss` and `/data/*` to the bucket.
- Cloud Run runs `service/Dockerfile` with at most one instance, so its in-memory write queue serialises every sheet write.
- A public Cloud Storage bucket holds:
  - `atlas.json`, `markers.csv`, `markers.geojson` and `rss.xml`;
  - `history/atlas-<stamp>.json`, deleted after 90 days by a lifecycle rule;
  - `cards/` (the cards, `manifest.json` and `world.png`);
  - `logos/`, holding the 2.0 logos and uploads.

  Soft delete keeps removed files for 30 days.
- Cloud Scheduler calls `POST /publish` at 03:00 UTC and `POST /reminders` at 14:00 UTC with an OIDC token for `atlas-scheduler@`. `auth.ts` tells that token apart from the Apps Script's shared secret.
- The service reaches Sheets with its Cloud Run identity, through Application Default Credentials.

Some settings are decided when the image is built:

- The map site reads `VITE_*` values at build time: data base URL, site URL, Keycloak issuer and client, and analytics ID.
- `deploy.yml` enforces the staging safety rules. It forces staging's allowlist to `none` and builds without analytics.
- Inside the service, an unset `EMAIL_ALLOWLIST` means everyone.

`logo_url` cells hold absolute bucket addresses, such as `https://storage.googleapis.com/openmrs-atlas/logos/<id>.webp`. The upload check and the nightly sweep both compare them against the store's `publicPrefix`.

On `goba`, OpenMRS stacks follow one pattern:

- Images come from Docker Hub, with settings in a `.env` file next to `docker-compose.yml`.
- A host reverse proxy terminates TLS and forwards to a mapped port.
- `deploy-compose-if-newer` redeploys when a pulled tag has changed.
- `openmrsinfra/cron-backup` archives named volumes into a host folder.

## Goals / Non-Goals

**Goals:**
- One self-contained image per environment that runs anywhere Docker runs, with no Google Cloud runtime dependency except the Sheets API.
- File names and public URLs that survive a straight copy of the bucket into the volume.
- Keep everything that can be checked in CI: header tests, store tests and e2e.

**Non-Goals:**
- Running more than one container per environment, or more than one replica. The write queue still needs exactly one.
- Promoting the exact staging image to production. See Decision 1.
- Any change to the API, sheet layout or front-end behaviour beyond where files are fetched from.

## Decisions

### 1. Build one image per environment

The workflow builds the image twice in its life: once for staging on `main` (`jetstream` while on the branch), and once for production on an approved release tag. Each build passes the environment's GitHub Environment variables as build arguments:
- `VITE_SITE_URL`, `VITE_KEYCLOAK_ISSUER` and `VITE_KEYCLOAK_CLIENT_ID`;
- `VITE_GA_ID`, production only;
- `ATLAS_ENVIRONMENT`.

Any value that is not a secret, needed by the map site, is baked in.

*Alternative:* one image, with the site reading its settings at runtime from a `/config.json`. That would let production run the very image staging tested. But analytics would have to stay out of the staging bundle by other means, and the change would reach into the web app's startup. Today's flow already rebuilds for production, so we keep it.

### 2. The service serves everything

Hono serves:
- `web/dist`, with `cleanUrls`-style lookup, so `/reminder` serves `reminder.html`;
- `/data/*` from `DATA_DIR`;
- `/rss` from `DATA_DIR/rss.xml`.

The `/api`, `/marker`, `/publish`, `/reminders` and `/health` routes stay as they are. A middleware sends the headers Firebase sent:
- the CSP, built at start-up from `KEYCLOAK_ISSUER`'s origin and no longer listing `storage.googleapis.com`;
- `nosniff`, `Permissions-Policy` and `Referrer-Policy`;
- cache headers:
  - `/assets/*` immutable;
  - `index.html` and `reminder.html` `no-cache`;
  - published files `max-age=300`;
  - cards immutable;
  - `cards/world.png` one hour;
  - logos one year.

Responses are compressed for clients that accept it.

`/data/` serves only a closed set: the four published files, `cards/` and `logos/`. Anything else, including `history/` and any path containing `..`, gets a 404. The header tests in `infra/firebase.test.ts` move to a service test that checks the same rules against the app.

*Alternative:* an nginx sidecar in front of the service. That would add a second image, and the headers and routes would be kept in two places. With one container the compose stack stays one service plus backups.

### 3. A folder store

`storage.ts` gets `folderSnapshotStore`, `folderCardStore` and `folderLogoStore`, all rooted at `DATA_DIR` (default `/atlas_data`), using the same relative names as the bucket keys. So `gcloud storage rsync gs://<bucket> <volume>` produces a working folder.
- **Writing whole files:** each write goes to a temporary file in the same directory, which is then renamed into place.
- **Logo dates:** `listLogos` takes "created" from each file's modification time, and the sweep's one-day rule is unchanged.
- **Logo addresses:** `publicPrefix` becomes `${SITE_URL}/data/`, so an uploaded logo's address is `https://atlas-stg.openmrs.org/data/logos/<id>.webp`.
- **History pruning:** the nightly (scheduler) publish deletes `history/atlas-*.json` files more than 90 days old, with the same "held back" logging style as the logo sweep.
- **Permissions:** the Dockerfile creates `/atlas_data` owned by `node`, so a fresh named volume inherits that owner.

*Alternative:* S3. You've chosen the OpenMRS convention instead: a volume, backed up by `cron-backup` to S3.

### 4. Jobs on the service's own timer

A small scheduler in the service:
- sets a timer for the next 03:00 UTC and runs the same code path as a scheduler `POST /publish` (with the sweep and the nightly card redraw);
- does the same at 14:00 UTC for reminders.

Each run goes through the existing write queue, so it never overlaps a save. `SCHEDULED_JOBS=off` turns both off, and the root README's local-development instructions set it.

`auth.ts` drops the Google OIDC branch, along with `SCHEDULER_SA_EMAIL` and `SERVICE_URL`. `/publish` still accepts only the Apps Script's secret, with or without `force`. `/reminders` still accepts a signed-in admin. If the container is down at 03:00, that night's run is missed. The next night's run corrects it, as the nightly requirement already allows.

*Alternative:* a cron container that posts to `/publish` with a token. That needs a new secret, or a way to tell the scheduler apart from the Apps Script, plus a second container, so it doesn't earn its place.

### 5. Google credentials from a settings value

`googleSheetStore` reads `GOOGLE_SERVICE_ACCOUNT_KEY`: the JSON key as one line, base64 or raw. This fits the `.env`-only stacks. Without it, it falls back to Application Default Credentials, as now, which serves local development with `gcloud auth application-default login`. The key never appears in logs. The sheet stays shared with the same `atlas-service@` account, so nothing changes in the sheet.

### 6. Safety baked into the image

`ATLAS_ENVIRONMENT` is baked in as `ENV` (`staging` or `production`), and `server.ts` applies the rules that `deploy.yml` used to:
- **Any other environment:** an unset allowlist means "none", and `*` stops start-up with a logged reason.
- **Production:** an unset allowlist still means everyone.

`/health` reports the environment and the image's commit, which helps check what the host is running.

### 7. CI pushes to Docker Hub

`deploy.yml` becomes:
1. Log in with `docker/login-action`.
2. Run `docker/build-push-action` with `linux/amd64`, and tags chosen by the workflow from `inputs.environment`:
   - staging pushes `staging` and `staging-<sha>`;
   - production pushes `production`, `latest` and `<tag>`.

The production job keeps its GitHub Environment approval and the release-guard. The steps for Google auth, Cloud Run and Firebase go, along with the `GCP_*`, `SERVICE`, `HOSTING_TARGET` and `DATA_URL` variables.

While on the branch, `ci.yml` also runs on pushes to `jetstream`, and `deploy-staging` accepts that ref. Before the merge, a task takes both back to `main` only.

### 8. Moving logo addresses

`service/src/scripts/move-logo-urls.ts` takes `--from`, `--to` and `--apply` (default is preview), and uses the same key settings. It:
- reads the `markers` tab;
- sends one batch update of just the matching `logo_url` cells.

It doesn't touch `changes`, `confirmed_at` or the queue: it's like an admin's edit, and is run while nothing else is saving (see Migration Plan). The upload check accepts only the new prefix, so the old bucket address is refused once the image moves.

### 9. Local development and the 2.0 migration

`docker-compose.yml` drops fake-gcs-server. Local runs use `DATA_DIR=./.data`, which is git-ignored. The migration CLI replaces `--bucket`/`--storage-endpoint` with `--data-dir`, and takes the logo base address from `--logo-base`. `@google-cloud/storage` leaves both packages.

### 10. Timing step names

`timedStore("bucket", …)` becomes `timedStore("files", …)`, so timing lines read `files.write` and so on. `service/README.md` swaps the Logs Explorer query for `docker logs … | grep '"event":"timing"'` equivalents.

## Risks / Trade-offs

- [The Google Cloud organization may block service-account key creation (`iam.disableServiceAccountKeyCreation`)] → Check before starting staging (manual). If it's blocked, an org admin can exempt the two projects, or a new service account in an unrestricted project can be shared on the sheets.
- [The Docker Hub token is repository-wide, so any workflow on any branch could push any tag] → Only the reviewed workflow picks tags, and production pushes stay behind approval. Optionally, move the token into the `staging` and `production` GitHub Environments, so production's copy is released only after approval (manual).
- [During a production DNS switch, both Cloud Run and `goba` can take writes for a few minutes, and their queues don't know about each other] → Cut over at a quiet hour. Lower the DNS TTL a day ahead. Re-run the logo copy and the address script after propagation to catch logos uploaded to Cloud Run.
- [Losing Cloud Run's automatic restarts and TLS] → `restart: always`, the `/health` check, and the host proxy and certificates the other OpenMRS sites already use.
- [Cloud Run staging keeps deploying from `main` while the branch is open, and its nightly sweep would see bucket logos as unused once the staging sheet's addresses move] → Pause both Cloud Run staging scheduler jobs before running the address script (manual). The sweep's safety limits would hold it back anyway.
- [No more CDN in front of public files and logos] → Traffic is small. The cache headers are unchanged, and compression is on.
- [The volume is the only copy of logos between backups] → Daily `cron-backup` (maintainer). The sweep only deletes logos more than a day old, so every deleted logo is in at least one backup.

## Migration Plan

**Staging (on the `jetstream` branch):**
1. Push the branch. CI pushes `openmrsinfra/atlas:staging`.
2. (manual) Create a key for `atlas-service@atlas-stg-513316`. Copy the staging secrets from Secret Manager into the `atlas-stg` `.env` on `goba`: the publish secret, the Keycloak service secret, the Mandrill key and the link key. Then set `SHEET_ID`, `SITE_URL`, `KEYCLOAK_*`, `EMAIL_ALLOWLIST` and `NOTICE_EMAIL`, and start the stack.
3. (manual) Copy logos with `gcloud storage rsync gs://openmrs-atlas-stg/logos <volume>/logos` (history is optional).
4. (manual) Pause the `atlas-nightly-publish` and `atlas-daily-reminders` jobs in the staging project.
5. (manual) Run the address script on the staging sheet, from `https://storage.googleapis.com/openmrs-atlas-stg/logos/` to `https://atlas-stg.openmrs.org/data/logos/`: preview first, then apply.
6. (manual) Set the staging Apps Script's `SERVICE_URL` to `https://atlas-stg.openmrs.org`.
7. (manual) Point atlas-stg.openmrs.org at `goba`, and confirm TLS.
8. Publish from the sheet menu, then test on staging.

**Production (after the merge):**
1. Merge `jetstream` into `main`, then tag `4.0` and approve it. Cloud Run production keeps running `3.6` throughout.
2. Repeat steps 2–7 for `openmrs-atlas` and atlas.openmrs.org, at a quiet hour, with a lowered TTL.
3. After propagation, copy the logos and run the address script again to catch stragglers.

**Rollback (either environment):**
1. Point DNS back at Firebase.
2. Copy any new logos from the volume back to the bucket.
3. Run the address script in reverse.
4. Resume the scheduler jobs.
5. Restore the Apps Script `SERVICE_URL`.

The sheet is shared, so no data needs merging. Cloud Run and the buckets stay until a later change removes them.

## Open Questions

- The host port each stack maps, and the proxy's upload size limit. Logos are at most 2 MB, so the limit needs to be above that. Both are set in the compose repo, not here.
