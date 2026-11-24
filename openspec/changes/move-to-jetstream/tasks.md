# Tasks

## 1. Folder storage

- [x] 1.1 In `service/src/storage.ts`, add `folderSnapshotStore`, `folderCardStore` and `folderLogoStore`, all rooted at a data folder and using the bucket's relative names. Each write goes to a temporary file in the same directory and is then renamed. `listLogos` uses modification times, and `publicPrefix` is `${SITE_URL}/data/`. Unit tests against a temporary folder:
  - a reader during a write sees the old file or the new one complete;
  - `currentCount` reads `atlas.json`, and is `undefined` when it is missing;
  - logos are listed with their dates, and removed;
  - cards are listed and removed by prefix.
- [x] 1.2 Prune `history/atlas-*.json` files more than 90 days old during the scheduler publish, and log how many were removed. Tests: a 91-day-old copy is deleted, an 89-day-old one is kept, and a publish not started by the scheduler deletes nothing.
- [x] 1.3 Remove the GCS stores and `@google-cloud/storage` from the service. Rename the timing prefix `bucket` to `files`. Update the existing timing tests and the timing-log section of `service/README.md`.

## 2. Serving the site and files

- [x] 2.1 Serve `web/dist` from the service, with clean URLs (`/reminder` serves `reminder.html`), and serve `/rss` from `rss.xml`. Serve `/data/` for only the four published files, `cards/` and `logos/`, and answer 404 for `history/`, `..` and anything else. Compress responses. API tests:
  - each published file answers with its content type;
  - `/data/history/…` and `/data/../x` answer 404;
  - `/reminder` serves the reminder page.
- [x] 2.2 Add a headers middleware matching what `firebase.json` sent. The CSP is built from `KEYCLOAK_ISSUER`'s origin, without `storage.googleapis.com`. It also sends `nosniff`, `Permissions-Policy`, the referrer policies, and the cache rules from design Decision 2. Port `infra/firebase.test.ts` to a service test: the policy differs only by Keycloak host, framing is self only, `/assets/*` is immutable, `index.html` is `no-cache`, and published files are `max-age=300`.
- [x] 2.3 In `web/`, default the data base URL to `/data` for builds, and drop `storage.googleapis.com` from any web-side policy or config. Point the Vite dev proxy at the service for `/data`, `/rss` and `/marker`, as well as `/api`. The e2e suite still passes.

## 3. Runtime settings

- [x] 3.1 In `service/src/sheets.ts`, read `GOOGLE_SERVICE_ACCOUNT_KEY` (raw JSON or base64), falling back to Application Default Credentials. Unit test: both forms parse to the same credentials, and a bad value fails at start-up with a message that doesn't contain the value.
- [x] 3.2 In `service/src/server.ts`, read `DATA_DIR` (default `/atlas_data`) and `ATLAS_ENVIRONMENT`. Outside production, an unset allowlist means none, and `*` stops start-up with a logged reason. `/health` reports the environment and the commit. Tests cover all three allowlist cases in each environment.
- [x] 3.3 Add the in-process scheduler: the nightly publish at 03:00 UTC and reminders at 14:00 UTC, run through the write queue as the `scheduler` caller, and turned off by `SCHEDULED_JOBS=off`. Remove the OIDC branch, `SCHEDULER_SA_EMAIL` and `SERVICE_URL` from `auth.ts`. Tests with fake timers: the next run time is computed correctly across midnight, a run calls publish with the sweep, two runs never overlap, and `off` schedules nothing. The existing auth tests for the secret and admins still pass.
- [x] 3.4 Update the settings table and local-run instructions in `service/README.md`: `DATA_DIR`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `ATLAS_ENVIRONMENT` and `SCHEDULED_JOBS`, with the removed Cloud Run settings taken out.

## 4. Image

- [ ] 4.1 Make `service/Dockerfile` a multi-stage build:
  - a build stage runs `npm ci` and `npm run build -w web` with the `VITE_*` build arguments;
  - the runtime stage copies `web/dist`, sets `ATLAS_ENVIRONMENT` and the commit from build arguments, and creates `/atlas_data` owned by `node`, declared as a volume;
  - `.dockerignore` lets the web sources in.

  Verify that `docker build` succeeds locally, and that `docker run` with `SCHEDULED_JOBS=off`, a test sheet and a named volume serves `/`, `/data/atlas.json` after a publish, and `/health`.
- [x] 4.2 Drop fake-gcs-server from `docker-compose.yml`, and git-ignore `.data/`. Update the root README's local development section to use `DATA_DIR=./.data` and `SCHEDULED_JOBS=off`, then follow it as written.

## 5. CI and Docker Hub

- [x] 5.1 Rewrite `.github/workflows/deploy.yml`:
  - log in to Docker Hub with `DOCKER_HUB_USERNAME`/`DOCKER_HUB_TOKEN`, then build `linux/amd64` with the environment's variables as build arguments;
  - push `staging` and `staging-<sha>` for staging, and `production`, `latest` and `<tag>` for production;
  - drop the Google auth, Cloud Run and Firebase steps, and refuse any environment other than `staging` or `production`.

  Check it with `actionlint` if available, or by reading it, and confirm the tag logic against design Decision 7.
- [ ] 5.2 In `.github/workflows/ci.yml`, add `jetstream` to the push branches. Let `deploy-staging` run for `refs/heads/jetstream` as well as `main`, with a comment that this is temporary. Verify that a push to `jetstream` publishes `openmrsinfra/atlas:staging` on Docker Hub.
- [ ] 5.3 (manual) In GitHub Settings › Environments:
  - remove `GCP_*`, `SERVICE`, `HOSTING_TARGET` and `DATA_URL`;
  - keep `SITE_URL`, `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID` and `GA_ID`;
  - optionally, move the Docker Hub secrets into the two environments.

## 6. Moving off Google Cloud hosting

- [x] 6.1 Add `service/src/scripts/move-logo-urls.ts`, with `--from`, `--to` and `--apply`, plus an npm script. It previews by default, and writes only matching `logo_url` cells, in one batch. Tests against the fake sheet store:
  - the preview writes nothing;
  - applying changes only those cells, and leaves `changes` and `confirmed_at` alone;
  - running it a second time changes nothing.
- [x] 6.2 In `migration/`, replace `--bucket`/`--storage-endpoint` with `--data-dir` and `--logo-base`, and remove `@google-cloud/storage`. Update `migration/README.md`. The existing migration tests pass, and a dry run works.
- [x] 6.3 Remove `firebase.json`, `.firebaserc`, `infra/setup.sh`, `infra/staging.env`, `infra/production.env` and `infra/firebase.test.ts`. Rewrite `infra/README.md`:
  - what the image needs: its settings, the `/atlas_data` volume, port 8080 behind a TLS proxy, and a `node`-based healthcheck for `/health`;
  - an example compose service for `files/atlas-stg/`;
  - how to restore a file from a backup;
  - the migration and rollback steps from design.md.

  Update `apps-script/README.md`: `SERVICE_URL` is now the site URL.
- [x] 6.4 Update the architecture decisions in `openspec/config.yaml`: one container on Jetstream 2 from Docker Hub, files in a volume, and Sheets reached with a service account key. Run `openspec validate move-to-jetstream --strict`.

## 7. Checks and staging

- [x] 7.1 Run the typecheck, lint, format check, unit tests, the e2e suite (`cd web && npx playwright test`) and `npm run build`. Check that `git grep -i "storage.googleapis\|firebase\|cloud run"` finds only history and archive mentions.
- [ ] 7.2 (manual) Check that a key can be created for `atlas-service@atlas-stg-513316`, under the organization's key policy. Create it.
- [ ] 7.3 (manual) Set up the `atlas-stg` compose stack on `goba` with the staging settings and secrets, and copy `gs://openmrs-atlas-stg/logos` into the volume.
- [ ] 7.4 (manual) Pause the staging Cloud Scheduler jobs. Run the address script on the staging sheet: preview, then apply. Set the staging Apps Script's `SERVICE_URL`. Point atlas-stg.openmrs.org at `goba`.
- [ ] 7.5 (manual) On staging:
  - load the map and the downloads;
  - sign in, then add a marker with a logo, edit it and add an editor;
  - publish from the sheet, and open a `/marker/<id>` permalink;
  - check that the console shows no CSP errors, that a reminder reaches an allowlisted address, and that the nightly publish ran the next morning (`docker logs`).

## Workflow follow-up

- Before merging: take `jetstream` out of `ci.yml`. Merge into `main`, tag `4.0`, and approve it. Then cut production over as in design.md's Migration Plan (manual: key, stack, logo copy, scheduler pause, address script, Apps Script, DNS).
- Archive this change once production runs on `goba`.
- Later change: shut down Cloud Run, Firebase Hosting, the buckets and the scheduler jobs in both Google Cloud projects, keeping each project for its Sheets service account.
