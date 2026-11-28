# Proposal

## Why

Since Atlas 4.0 (openspec `move-to-jetstream`), both environments run on OpenMRS infrastructure on Jetstream 2: production on `goba`, staging on `gode`. The Google Cloud hosting they used before is still in place, but idle: the Cloud Run services, Firebase Hosting, the Cloud Storage buckets, and the paused Cloud Scheduler jobs. It was kept as a fallback until production had run on Jetstream 2 for a while. Leaving it there costs a little, keeps secrets and deploy credentials alive that nothing uses, and keeps stale public copies of the data that look current. The docs also still describe moving to Jetstream 2 and rolling back to Google Cloud.

## What Changes

- **The idle Google Cloud hosting is deleted** in both projects, "OpenMRS Atlas" (`openmrs-atlas`) and "atlas-stg" (`atlas-stg-513316`):
  - the Cloud Run services and the Artifact Registry repository;
  - Firebase Hosting and its custom domains;
  - the `gs://openmrs-atlas` and `gs://openmrs-atlas-stg` buckets. The snapshot history from before 4.0 is copied into each environment's data folder first, and pruned there after 90 days as usual;
  - the paused Cloud Scheduler jobs and the Secret Manager secrets;
  - the service accounts `atlas-service@`, `atlas-scheduler@` and `atlas-deploy@`, and the Workload Identity pool and provider;
  - the APIs nothing uses any more.
- **Kept:** each project, its Sheets API, and its `*-sheets-access` service account with its key. Those are how the running service reaches the sheet.
- **Leftovers outside Google Cloud are removed:**
  - the Firebase addresses (`*.web.app`, `*.firebaseapp.com`) in the `atlas` Keycloak clients' redirect URIs and web origins;
  - any Firebase records left in Terraform.
- **The docs stop describing Google Cloud hosting:**
  - `infra/README.md` loses "Moving an environment off Google Cloud" and its rollback steps;
  - the remaining mentions of the bucket and Firebase in the READMEs, code comments and test examples are reworded;
  - the backlog item about the Firebase Keycloak addresses is removed;
  - the ITSM wiki's "Leftovers on Google Cloud" section is cut down to the projects and their service accounts.
- **No longer possible afterwards:** rolling an environment back to Cloud Run and Firebase. Rolling back a release on Jetstream 2 is unchanged.

### Out of scope

- Moving off Google Sheets or the Sheets service accounts. The service still reaches each sheet as that project's service account.
- Closing the Google Cloud projects or changing their billing.
- Anything on `goba`, `gode`, nginx, backups or Docker Hub, which 4.0 set up.
- Fixing the automatic image updates on the hosts.
- Retiring Atlas 2.0 or its MySQL database, which the backlog tracks separately.
- Changes to what visitors, owners or admins can do.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. No spec mentions the Google Cloud hosting since 4.0, and nothing visitors, owners, admins or the service rely on changes. So the change declares `skip_specs`. The marker-editing scenarios that refuse an "Old bucket address" and hold back the sweep for "Addresses not yet moved" stay true after the bucket is gone.

## Impact

- **Google Cloud (manual):** deletions in both projects, in the order the design gives, each checked before the next.
- **Keycloak and Terraform (manual):** the Firebase addresses and records.
- **Repository:**
  - `infra/README.md`;
  - `service/README.md`;
  - comments in `service/src/site.ts` and `service/src/scripts/move-logo-urls.ts`;
  - the example addresses in `service/src/logo-move.test.ts`;
  - `openspec/backlog.md`.
  - No runtime code changes. The service already needs only the Sheets API and its key.
- **Wiki:** the Service-Atlas page in openmrs-contrib-itsmresources.
- **Public URLs:** the old `storage.googleapis.com/openmrs-atlas/…` and `openmrs-atlas.web.app` addresses stop answering. A search of the OpenMRS GitHub organization found nothing outside Atlas's own docs that uses them.
