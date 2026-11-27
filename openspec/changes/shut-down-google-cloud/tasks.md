# Tasks

## 1. Before deleting anything

- [ ] 1.1 (manual) Confirm production has run on `goba` for a few days: the nightly publish ran each night (`docker compose logs -t atlas | grep '"caller":"scheduler"'`), and nothing in `problems` points at the move.
- [ ] 1.2 (manual) In both projects, check that nothing still calls Cloud Run. Its request count since the DNS switch should be near zero (Cloud Run › the service › Metrics). Track down anything that still does before going on.
- [ ] 1.3 (manual) List each project's service accounts (`gcloud iam service-accounts list --project <project>`), and note the exact addresses to delete and the `*-sheets-access@` one to keep.

## 2. Staging (`atlas-stg-513316`)

- [ ] 2.1 (manual) Copy the pre-4.0 snapshot history into staging's data folder:
  - download `gs://openmrs-atlas-stg/history` on a machine with `gcloud`;
  - copy it to `gode`;
  - put it in `atlas-stg_atlas-data` under `history/` with a throwaway `alpine` container, owned by uid 1000, as for the logos in 4.0.
  The file counts before and after should match.
- [ ] 2.2 (manual) Delete, in the design's order:
  1. the two Cloud Scheduler jobs;
  2. the Cloud Run service `atlas-service-stg`;
  3. the Artifact Registry repository `atlas`;
  4. Firebase Hosting's custom domain, then turn hosting off;
  5. `gs://openmrs-atlas-stg`;
  6. the four Secret Manager secrets;
  7. the Workload Identity provider and pool;
  8. the service accounts `atlas-deploy@`, `atlas-scheduler@` and `atlas-service@`, and any IAM bindings that still name them;
  9. the unused APIs.
  Keep the project, the Sheets API and `atlas-stg-sheets-access@` with its key.
- [ ] 2.3 (manual) In the `id-stg.openmrs.org` realm, remove any `*.web.app` and `*.firebaseapp.com` entries from the `atlas` client's redirect URIs, post-logout redirect URIs and web origins.
- [ ] 2.4 (manual) Check staging:
  - **Publish now** in the staging sheet succeeds (`docker compose logs -t atlas`);
  - the site loads with logos;
  - sign-in works;
  - a logo upload works;
  - `docker compose exec atlas ls /atlas_data/history | head` shows the copied history.

## 3. Production (`openmrs-atlas`)

- [ ] 3.1 (manual) Copy `gs://openmrs-atlas/history` into `atlas_atlas-data` on `goba`, as in 2.1.
- [ ] 3.2 (manual) Delete production's resources in the same order as 2.2: the Cloud Run service is `atlas-service` and the bucket `gs://openmrs-atlas`. Keep the project, the Sheets API and `atlas-sheets-access@` with its key.
- [ ] 3.3 (manual) In the `id.openmrs.org` realm, remove the `openmrs-atlas.web.app` and any other `*.web.app` or `*.firebaseapp.com` entries from the `atlas` client.
- [ ] 3.4 (manual) Check production as in 2.4, and the next morning that the nightly publish ran.

## 4. DNS

- [ ] 4.1 (manual) In openmrs-contrib-itsm-terraform, remove anything left over from Firebase Hosting, such as `atlas_firebase_sites` and any Firebase verification TXT records, and apply. `dig atlas.openmrs.org` and `dig atlas-stg.openmrs.org` still answer with `goba` and `gode`.

## 5. Repository

- [ ] 5.1 In `infra/README.md`, remove "Moving an environment off Google Cloud", with its project and bucket table and its rollback steps. Add one sentence near the top saying that before 4.0 Atlas ran on Google Cloud, with a link to the archived `move-to-jetstream` change. Check that the rest of the file mentions Google Cloud only for the Sheets service account.
- [ ] 5.2 In `service/README.md`, reword "The service also serves what Firebase Hosting and the bucket used to" to describe what it serves. Give the "Moving logo addresses" example neutral addresses instead of the staging bucket.
- [ ] 5.3 Reword the Firebase comments in `service/src/site.ts` to say what is done, not what Firebase did. Give the example in `service/src/scripts/move-logo-urls.ts`, and the `BUCKET` example addresses in `service/src/logo-move.test.ts`, neutral addresses such as `https://old.example.org/logos/`. Keep the check in `site.test.ts` that the policy doesn't allow `storage.googleapis.com`.
- [ ] 5.4 In `openspec/backlog.md`, remove "Remove the `openmrs-atlas.web.app` addresses from the production `atlas` Keycloak client". Task 3.3 does it.
- [ ] 5.5 Run format, typecheck, lint, unit tests and the build. `git grep -i -E "firebase|cloud run|storage\.googleapis|gs://"` outside `openspec/changes/archive` should find only the CSP test, and the spec scenarios about the retired bucket.

## 6. Wiki

- [ ] 6.1 After sections 2 and 3, update the Service-Atlas page in openmrs-contrib-itsmresources. Cut "Leftovers on Google Cloud" down to the two projects, kept only for their Sheets service accounts and the Sheets API. Remove any other mentions of the deleted resources, then push with the maintainer's go-ahead.

## Workflow follow-up

- Archive this change once sections 1–6 are done. It changes no specs, so there is nothing to sync.
- No release is needed: nothing in the image changes. The repository edits reach `staging` with the next push to `main`, and production with the next release.
