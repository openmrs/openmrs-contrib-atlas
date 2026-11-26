# Proposal

## Why

Atlas 3.x runs on Google Cloud: Cloud Run for the service, Firebase Hosting for the map site, Cloud Storage for published files and logos, Cloud Scheduler for nightly jobs. That makes Atlas the odd one out among OpenMRS sites, which run as Docker containers on Jetstream 2 and are looked after with the same tools. Moving Atlas onto that setup lets OpenMRS infrastructure volunteers run it the way they run everything else, and it removes the cold starts that made the first request after a quiet spell slow.

This re-opens three settled architecture decisions in `openspec/config.yaml`: Firebase Hosting for the front end, a public Cloud Storage bucket for snapshots, and Cloud Run with one Google Cloud project per environment. The Google Sheet stays the source of truth, and what Atlas does for visitors, owners and admins does not change.

## What Changes

- **One container per environment.** The service also serves the built map site, the published files and the logos, with the security headers Firebase Hosting sent. Everything is on the site's own origin: `/data/atlas.json`, `/data/markers.csv`, `/data/markers.geojson`, `/rss`, `/data/logos/…` and `/data/cards/…`.
- **Images on Docker Hub.** GitHub Actions builds `openmrsinfra/atlas` and pushes `staging` for each push to the staging branch, and `production` and `latest` for each approved release. Each release is also tagged with its number, such as `4.0`. Pushing uses the repository's `DOCKER_HUB_USERNAME` and `DOCKER_HUB_TOKEN` secrets.
- **Files in a folder, not a bucket.** The service writes published files, history, social cards and logos to one folder inside the container (`/atlas_data`), which the compose stack mounts as a named volume. Each file is written whole, so a visitor never sees half of one. The service prunes snapshot history older than 90 days, which the bucket's lifecycle rule used to do.
- **Jobs run inside the service.** The nightly publish (03:00 UTC) and the daily reminders (14:00 UTC) are started by the service's own timer instead of Cloud Scheduler. The sheet's Apps Script trigger and admins can still start a publish, and admins can still start reminders.
- **Google credentials from a key.** Outside Google Cloud, the service reads the Sheets service account's key from its settings.
- **Staging stays safe.** Each image knows which environment it was built for. A non-production image delivers email only to its allowlist, and to no one when there isn't one, and refuses to start with the allowlist `*`. Only the production image includes Google Analytics.
- **Logo addresses move.** A one-off script rewrites `logo_url` values in an environment's sheet from the old bucket address to the new `/data/logos/` address, so the map and the nightly logo sweep keep finding them.
- **BREAKING (for maintainers): deploys change.** The Cloud Run, Firebase and Workload Identity deploy steps, `firebase.json`, `.firebaserc` and the Google Cloud setup script are removed. `infra/README.md` describes the image, its settings and the volume instead. Local development uses a folder instead of fake-gcs-server, and the 2.0 migration writes logos to a folder.
- **Work on the `jetstream` branch.** Until it merges, pushes to `jetstream` build the `staging` image, and `main` keeps deploying Cloud Run staging. After the merge, pushes to `main` build `staging`. The release that first deploys production this way should be `4.0`.

### Out of scope

- The compose stacks in `openmrs-contrib-ansible-docker-compose` (`files/atlas-stg/`, `files/atlas/`), the Ansible runs in `openmrs-contrib-itsmresources`, TLS and the reverse proxy on `gode` (staging) and `goba` (production), and backups with `openmrsinfra/cron-backup`. The maintainer sets these up; this change documents what the image needs.
- DNS changes for atlas-stg.openmrs.org and atlas.openmrs.org, which the maintainer makes.
- Shutting down the Google Cloud projects. Cloud Run staging and production stay as a fallback until production has run on Jetstream 2 for a while; removing them is a later change.
- Moving off Google Sheets, Keycloak or Mandrill. They are used exactly as now.
- Changes to what visitors, owners or admins can do.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deployment`:
  - staging and production get Docker Hub images instead of Cloud Run deploys;
  - environments are kept apart by image builds and approvals instead of Google Cloud projects;
  - one container serves the site with its security headers;
  - scheduled jobs run in the service;
  - files are restored from the host's backups instead of bucket soft delete.
- `snapshot-publishing`:
  - published files are served from the site's own origin and written whole;
  - history is pruned after 90 days;
  - timing lines name file steps instead of bucket steps.
- `marker-editing`:
  - logo addresses and the unused-logo sweep refer to the Atlas's `logos/` folder instead of the bucket;
  - timing lines name file steps.

## Impact

- **Service:**
  - `storage.ts` is replaced by a folder store.
  - `server.ts` gets new settings: `DATA_DIR`, the Google key and the environment name.
  - `auth.ts` drops the Cloud Scheduler OIDC check.
  - New: a job timer, static and data file serving with headers, and history pruning.
  - `@google-cloud/storage` is removed from the service and the migration.
- **Web:** the data base URL becomes `/data`, and the security policy no longer lists `storage.googleapis.com`.
- **Build and CI:**
  - `service/Dockerfile` becomes a multi-stage build that includes the map site.
  - `ci.yml` and `deploy.yml` build and push to Docker Hub.
  - `firebase.json`, `.firebaserc`, `infra/setup.sh`, `infra/*.env` and `infra/firebase.test.ts` are removed.
  - `docker-compose.yml` drops fake-gcs-server.
- **Docs:** the root README, `infra/README.md`, `service/README.md` and `apps-script/README.md`. The Apps Script `SERVICE_URL` becomes the site URL.
- **Operations (manual):**
  - a Google service account key for Sheets;
  - copying each bucket's `logos/` into the volume;
  - running the logo-address script;
  - pausing Cloud Run's scheduler jobs when an environment moves;
  - DNS.
- **Project context:** the architecture decisions in `openspec/config.yaml` are updated to the new hosting.
