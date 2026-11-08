# Environments

Atlas runs in two Google Cloud projects, each set up the same way by [`setup.sh`](setup.sh):

| Environment | Site                                                   | Project            | Deploys from                          |
| ----------- | ------------------------------------------------------ | ------------------ | ------------------------------------- |
| staging     | [atlas-stg.openmrs.org](https://atlas-stg.openmrs.org) | `atlas-stg-513316` | every push to `main` that passes CI   |
| production  | [atlas.openmrs.org](https://atlas.openmrs.org)         | `openmrs-atlas`    | release tags (`3.0`, `3.1`), approved |

The script creates everything except the parts that need a browser (Firebase, the sheet,
Keycloak, DNS). It is safe to run again, and it records the setup until it moves to Terraform.
Its per-environment settings are in [`staging.env`](staging.env) and
[`production.env`](production.env).

## Resources

Names that differ are shown as staging / production. Everything else is named the same in both
projects.

| Resource                       | Name                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| Public bucket                  | `gs://openmrs-atlas-stg` / `gs://openmrs-atlas` (CORS, 90-day `history/` rule)      |
| Publish service (Cloud Run)    | `atlas-service-stg` / `atlas-service`, runs as `atlas-service@…`                    |
| Shared secret (Secret Manager) | `atlas-publish-secret`                                                              |
| Other secrets                  | `atlas-keycloak-service-secret`, `atlas-mandrill-api-key`, `atlas-link-signing-key` |
| Nightly publish                | Cloud Scheduler job `atlas-nightly-publish`, 03:00 UTC                              |
| Daily reminders                | Cloud Scheduler job `atlas-daily-reminders`, 14:00 UTC                              |
| Service images                 | Artifact Registry repository `atlas`                                                |
| CI deploys                     | `atlas-deploy@…` through Workload Identity Federation                               |
| Map site                       | Firebase Hosting site `atlas-stg-513316` / `openmrs-atlas`                          |
| Keycloak                       | `id-stg.openmrs.org` / `id.openmrs.org`, realm `openmrs`                            |

The service accounts are `atlas-service` (reads and writes the sheet, writes the bucket, reads
the secrets), `atlas-scheduler` (signs the scheduled requests) and `atlas-deploy` (GitHub
Actions). Each project's deploy account trusts only its own environment: staging accepts tokens
from pushes to `main`; production accepts only tokens issued to the `production` GitHub
environment on a tag, which GitHub grants only after the release checks and approval.

`firebase.json` lists one hosting target per environment, because its rewrites and redirects
can't read variables. Each sends `/api/**` and the `/marker/**` permalink pages to its Cloud Run
service. They must differ only in the service and bucket names;
[`firebase.test.ts`](firebase.test.ts) fails CI if they drift apart.

## GitHub environments

Deploy settings live in the GitHub Environments `staging` and `production` (Settings ›
Environments). There are deliberately no repository variables: a job that uses an environment
also sees repository variables, so a setting missing from production would silently take the
staging value. Each deploy starts by failing if a required variable is empty.

| Variable                            | staging                                            | production                                     |
| ----------------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| `GCP_PROJECT`                       | `atlas-stg-513316`                                 | `openmrs-atlas`                                |
| `GCP_REGION`                        | `us-central1`                                      | `us-central1`                                  |
| `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA` | printed by `setup.sh`                              | printed by `setup.sh`                          |
| `SERVICE`                           | `atlas-service-stg`                                | `atlas-service`                                |
| `HOSTING_TARGET`                    | `staging`                                          | `production`                                   |
| `SITE_URL`                          | `https://atlas-stg.openmrs.org`                    | `https://atlas.openmrs.org`                    |
| `DATA_URL`                          | `https://storage.googleapis.com/openmrs-atlas-stg` | `https://storage.googleapis.com/openmrs-atlas` |
| `KEYCLOAK_ISSUER`                   | `https://id-stg.openmrs.org/realms/openmrs`        | `https://id.openmrs.org/realms/openmrs`        |
| `KEYCLOAK_CLIENT_ID`                | `atlas`                                            | `atlas`                                        |
| `EMAIL_ALLOWLIST`                   | addresses staging may email                        | at first `burke@openmrs.org`; then removed     |
| `NOTICE_EMAIL`                      | optional                                           | `infrastructure@openmrs.org`                   |
| `GA_ID`                             | not used                                           | `G-9XFSTG4KZ0` (required)                      |

The deploy workflow enforces two rules whatever these say:

- **Only production may email people who aren't on an allowlist.** Staging without
  `EMAIL_ALLOWLIST` emails no one, and a `*` there fails the deploy. Production without it emails
  everyone (the service is given `EMAIL_ALLOWLIST=*`).
- **Only production is built with Google Analytics.**

The `staging` environment accepts deploys only from `main`. The `production` environment accepts
only tags matching `[0-9]*.[0-9]*`, and waits for a required reviewer's approval.

## Releasing and rolling back

- **Release:** tag a commit on `main` as `<major>.<minor>` and push the tag:

  ```sh
  git tag -a 3.1 -m "Atlas 3.1" && git push origin 3.1
  ```

  CI runs the tests on the tagged commit, `release-guard` checks the tag is a release on `main`,
  and `deploy-production` then waits for approval (Actions › the run › _Review deployments_).
  After it deploys, a GitHub Release is created with notes generated from the commits since the
  last release. Any other tag (`3.1.1`, `v3.1`, `3.1-rc1`) runs the tests and fails
  `release-guard`, deploying nothing.

- **Roll back:** Actions › CI › _Run workflow_, choose the older tag under _Use workflow from_.
  It runs the same checks and approval. Its existing GitHub Release is left alone. The sheet and
  the published data aren't touched. Note that a tag runs the workflow as it was at that tag.

- **Release tags are fixed.** A tag ruleset lets only admins and maintainers create tags matching
  `[0-9]*.[0-9]*`, and lets no one move or delete them.

## Setting up an environment

Production's steps are the same as staging's were; the checklist below records the order. Do it
with a project owner's gcloud account (`CLOUDSDK_ACTIVE_CONFIG_NAME=openmrs`).

1. **Add Firebase to the project.** At <https://console.firebase.google.com>, choose _Create a
   project_, then pick the existing Google Cloud project. Skip Google Analytics (the site uses the
   OpenMRS measurement ID instead). Open _Hosting_ and click _Get started_ to create the default
   site, which is named after the project. Skip the CLI steps; CI does the deploys.
2. **Create the sheet** in the OpenMRS Google Drive ("OpenMRS Atlas", or "OpenMRS Atlas
   (staging)") and copy its id from the URL.
3. **Run the setup script:**

   ```sh
   CLOUDSDK_ACTIVE_CONFIG_NAME=openmrs SHEET_ID=<sheet id> bash infra/setup.sh <environment>
   ```

   It ends by printing the GitHub environment variables and the Apps Script properties. In
   production it creates the reminder job paused. Now that the service account exists, share
   the sheet with `atlas-service@<project>.iam.gserviceaccount.com` as an Editor.

4. **Set the GitHub environment variables** it printed, plus those in the table above:
   `gh variable set <NAME> --env <environment> --body <value>`.
5. **Prepare the sheet** as the service account. This replaces your Application Default
   Credentials, so sign in again as yourself afterwards:

   ```sh
   gcloud auth application-default login \
     --impersonate-service-account=atlas-service@<project>.iam.gserviceaccount.com
   npm run setup:sheet -- <sheet id>
   ```

   Then load the data with [`migration/README.md`](../migration/README.md), using
   `--sheet <sheet id> --bucket <bucket>`, dry run first.

6. **Install the Apps Script** on the sheet as in [`apps-script/README.md`](../apps-script/README.md),
   with the `SERVICE_URL` printed in step 3 and the secret from
   `gcloud secrets versions access latest --secret=atlas-publish-secret --project=<project>`.
7. **Keycloak.** In the environment's realm, create the `atlas` and `atlas-service` clients as in
   [`service/README.md`](../service/README.md#keycloak), with the environment's site as the
   redirect and origin, and the `atlas-administrators` group.
8. **Secrets.** `setup.sh` generated `atlas-link-signing-key` and created the other two empty. Add
   their values without putting them on the command line:

   ```sh
   gcloud secrets versions add atlas-keycloak-service-secret --project=<project> --data-file=-
   gcloud secrets versions add atlas-mandrill-api-key --project=<project> --data-file=-
   ```

   (Paste the value, then press Ctrl-D.) The Mandrill key should be Atlas's own, with only
   Messages › Send.

9. **Deploy**, then check:

   ```sh
   curl https://<service url>/health
   gcloud scheduler jobs run atlas-nightly-publish --location=us-central1 --project=<project>
   curl -sI https://storage.googleapis.com/<bucket>/atlas.json
   ```

10. **Add the custom domain.** In Firebase Hosting choose _Add custom domain_ and use Quick setup.
    In Cloudflare, add the records it shows, with the proxy off (DNS only). The certificate can
    take up to a day.

### Production checklist

Done together with the maintainer, in this order.

- [ ] Firebase added to `openmrs-atlas`, Hosting site `openmrs-atlas` created (step 1)
- [ ] Production sheet created (step 2)
- [ ] `bash infra/setup.sh production` run (step 3); reminder job paused; sheet shared with
      `atlas-service@openmrs-atlas.iam.gserviceaccount.com`
- [ ] `production` environment variables set (step 4), including `GA_ID`,
      `EMAIL_ALLOWLIST=burke@openmrs.org` and `NOTICE_EMAIL=infrastructure@openmrs.org`
- [ ] Sheet prepared; a first migration loaded to rehearse (step 5)
- [ ] Apps Script installed (step 6)
- [ ] Keycloak on `id.openmrs.org`: `atlas` client for `https://atlas.openmrs.org` (and
      `https://openmrs-atlas.web.app` until the DNS switch), `atlas-service` client,
      `atlas-administrators` group with the admins (step 7)
- [ ] Secret values added (step 8)
- [ ] `npm run report:accounts -w service -- <sheet id>` with production's issuer and service
      secret (see the script's header), to check owners and editors resolve to accounts
- [ ] First release: tag `3.0` on `main`, approve, check the site at
      `https://openmrs-atlas.web.app` and the service (step 9); rewrite the generated release notes
- [ ] Final migration from 2.0 into the production sheet, right before the switch
- [ ] Custom domain `atlas.openmrs.org` added in Firebase and DNS switched in Cloudflare (step 10)
- [ ] Reminder job resumed:
      `gcloud scheduler jobs resume atlas-daily-reminders --location=us-central1 --project=openmrs-atlas`
- [ ] After reviewing the first day's reminders in the `reminders` tab, `EMAIL_ALLOWLIST` removed
      from the `production` environment and production redeployed (_Run workflow_ on the tag)

## If the setup script fails

- **Public access to the bucket, or `--allow-unauthenticated`, is refused.** The organization
  enforces _Domain restricted sharing_ (`iam.allowedPolicyMemberDomains`) or _Public access
  prevention_ (`storage.publicAccessPrevention`). An organization policy admin has to override
  these for this project. Both are needed: the map data is public, and the Apps Script calls the
  service without a Google token.
- **The bucket name is taken.** Bucket names are global. Change `BUCKET` in the settings file,
  and the redirects in `firebase.json` and the names in `firebase.test.ts` to match.
