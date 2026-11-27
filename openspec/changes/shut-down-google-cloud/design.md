# Design

## Context

See proposal.md, "Why". What is left in each Google Cloud project after 4.0:

| Resource | Production (`openmrs-atlas`) | Staging (`atlas-stg-513316`) | Used since 4.0? |
| --- | --- | --- | --- |
| Cloud Run service (`us-central1`) | `atlas-service` | `atlas-service-stg` | No. Serves only someone who calls its `run.app` address |
| Artifact Registry repository | `atlas` | `atlas` | No |
| Firebase Hosting | `openmrs-atlas` site, custom domain atlas.openmrs.org | `atlas-stg-513316` site, custom domain atlas-stg.openmrs.org | No. DNS points at `goba` / `gode`; the `web.app` addresses still answer |
| Bucket | `gs://openmrs-atlas` | `gs://openmrs-atlas-stg` | No. Stale public copies; holds the only copy of pre-4.0 snapshot history |
| Cloud Scheduler | `atlas-nightly-publish`, `atlas-daily-reminders` (paused) | the same (paused) | No |
| Secret Manager | `atlas-publish-secret`, `atlas-keycloak-service-secret`, `atlas-mandrill-api-key`, `atlas-link-signing-key` | the same | No. The values are in the vault-encrypted `.env` |
| Service accounts | `atlas-service@`, `atlas-scheduler@`, `atlas-deploy@` | the same | No |
| Workload Identity pool and provider | for GitHub deploys | the same | No. Deploys push to Docker Hub |
| **`atlas-sheets-access@`** / **`atlas-stg-sheets-access@`** and its key | | | **Yes: the running service reaches the sheet with it** |
| **Sheets API** | | | **Yes** |

Since 4.0 the repository holds no Google Cloud deploy code, and the GitHub environments hold no Google Cloud variables. No repository secret refers to Google Cloud. The service's only Google dependency is the Sheets API, reached with `GOOGLE_SERVICE_ACCOUNT_KEY`. Without that key, local development falls back to Application Default Credentials, using a developer's own project (root README, "Test sheet").

## Goals / Non-Goals

**Goals:**

- Delete everything in the table that isn't used, with nothing the running Atlas needs at risk.
- Keep the pre-4.0 snapshot history for its normal 90 days.
- Leave docs that describe only how Atlas runs now.

**Non-Goals:**

- Closing the projects or unlinking billing. The Sheets service accounts live in them. Billing can be revisited once nothing billable is left; the Sheets API itself is free.
- Any runtime code change.

## Decisions

### Staging first, then production, checking the sheet after each

Each project is shut down completely, then its environment is checked: **Publish now** in the sheet succeeds, and the site, sign-in and a logo upload work. Only then does the next project start. Staging goes first as a rehearsal. The check proves the one thing that matters, that the Sheets service account and its key still work. Everything else being deleted has had no traffic since the cutover.

Before starting, check that nothing still uses Cloud Run. Its request count since the DNS switch should be near zero (Cloud Run › the service › Metrics). Anything still calling it, such as an old `SERVICE_URL` somewhere, should be found first.

### Deletion order within a project

Dependents go before the things they depend on, so nothing is left half-working in between:

1. **Cloud Scheduler jobs.** They call Cloud Run as `atlas-scheduler@`.
2. **Cloud Run service**, then the **Artifact Registry** repository that held its images.
3. **Firebase Hosting:** remove the custom domain, then turn hosting off (`firebase hosting:disable --project <project>`). A project's default Firebase site can't be deleted; turned off, it serves nothing.
4. **Buckets**, after copying the history out (below).
5. **Secret Manager** secrets.
6. **Workload Identity** provider and pool, then the service accounts `atlas-deploy@`, `atlas-scheduler@` and `atlas-service@`, along with any project IAM bindings that still name them.
7. **APIs** nothing uses: Cloud Run, Cloud Scheduler, Artifact Registry, Secret Manager, Firebase Hosting, IAM Service Account Credentials and Security Token Service. Leave the Sheets, IAM, Service Usage and Cloud Resource Manager APIs on. Leave Cloud Storage on as well; it's on by default, and turning it off gains nothing.

Before step 6, list the project's service accounts and name each deletion exactly. The `*-sheets-access@` account must survive.

### Snapshot history goes into the data folder

The buckets' `history/` holds every snapshot published before 4.0, under the same names the service uses (`history/atlas-<time>.json`). Copying them into the environment's `/atlas_data/history/`, owned by uid 1000 like the logos, keeps them in the nightly backups, where they can be restored like any other snapshot. The nightly publish then deletes each one when it turns 90 days old, as it would have in the bucket. A tarball kept elsewhere is the alternative, but it would need its own home and retention; the data folder already has both.

The other bucket contents aren't needed:
- the logos were copied at the cutover and checked twice;
- the cards and published files are rebuilt by every publish.

### Docs: remove the move, keep one line of history

"Moving an environment off Google Cloud" and its rollback steps in `infra/README.md` are removed. Its introduction leaves one sentence saying that Atlas ran on Google Cloud before 4.0, with a pointer to the archived `move-to-jetstream` change. Comments that explain why something is done, such as "with the headers Firebase Hosting used to send", are reworded to say what is done. Test and README examples use neutral addresses (`https://old.example.org/logos/`) instead of the bucket. `move:logos` itself stays: it is how logo addresses move if the site's address ever changes.

The specs are left as they are (proposal, "Capabilities").

### The wiki is updated after the deletions

The Service-Atlas page should describe what exists. So its "Leftovers on Google Cloud" section is cut down only once both projects are done.

## Risks / Trade-offs

- **The deletions can't be undone.** There is no rolling back to Cloud Run and Firebase afterwards. That is intended, and it's why the change waits until production has run on `goba` for a few days. A deleted bucket stays restorable for its soft-delete period (7 days), which covers a mistake noticed soon after.
- **Deleting the Sheets service account, or its key, would stop the Atlas.** Mitigation: name each service account explicitly, and check **Publish now** after each project. If it happens anyway, create a new key for a new account, share the sheet with it, update the `.env` and redeploy, as in `infra/README.md`, "Setting up an environment".
- **Removing the wrong Keycloak address would break sign-in.** Remove only `*.web.app` and `*.firebaseapp.com` entries, then sign in on the site.
- **Lost secret values.** Secret Manager's copies go, but the same values are in the vault-encrypted `.env` files, which are what the running stacks use.
- **Old public addresses stop answering.** Anyone still reading `storage.googleapis.com/openmrs-atlas/atlas.json`, or loading the `web.app` site, gets an error. Nothing in the OpenMRS organization does, and the 4.0 release notes announced the new addresses.
