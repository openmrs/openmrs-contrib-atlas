# Staging environment (atlas-stg.openmrs.org)

Staging runs in the Google Cloud project `atlas-stg-513316`. [`setup.sh`](setup.sh) creates
everything except the parts that need a browser (Firebase, the sheet, DNS). It is safe to run
again, and it records the setup until it moves to Terraform.

| Resource                       | Name                                                    |
| ------------------------------ | ------------------------------------------------------- |
| Public bucket                  | `gs://openmrs-atlas-stg` (CORS, 90-day `history/` rule) |
| Publish service (Cloud Run)    | `atlas-service-stg`, runs as `atlas-service@…`          |
| Shared secret (Secret Manager) | `atlas-publish-secret`                                  |
| Nightly publish                | Cloud Scheduler job `atlas-nightly-publish`, 03:00 UTC  |
| Service images                 | Artifact Registry repository `atlas`                    |
| CI deploys                     | `atlas-deploy@…` through Workload Identity Federation   |
| Map site                       | Firebase Hosting, default site `atlas-stg-513316`       |

The service accounts are `atlas-service` (reads and writes the sheet, writes the bucket),
`atlas-scheduler` (signs the nightly request) and `atlas-deploy` (GitHub Actions, only from the
`atlas-3.0` branch of `openmrs/openmrs-contrib-atlas`).

## Setting it up

1. **Add Firebase to the project.** At <https://console.firebase.google.com>, choose _Create a
   project_, then pick the existing Google Cloud project `atlas-stg-513316`. Skip Google
   Analytics. Then open _Hosting_ and click _Get started_ to create the default site. Skip the
   CLI steps; CI does the deploys.
2. **Create the staging sheet** in your OpenMRS Google Drive. Name it "OpenMRS Atlas (staging)",
   share it as an Editor with `atlas-service@atlas-stg-513316.iam.gserviceaccount.com`, and copy
   its id from the URL.
3. **Run the setup script:**

   ```sh
   CLOUDSDK_ACTIVE_CONFIG_NAME=openmrs SHEET_ID=<sheet id> bash infra/staging/setup.sh
   ```

   It ends by printing the GitHub variables and the Apps Script properties.

4. **Set the GitHub repository variables** it printed, under Settings › Secrets and variables ›
   Actions › Variables, or with `gh variable set <NAME> --body <value>`. Once `GCP_PROJECT`
   exists, the `deploy-staging` job runs on every push to `atlas-3.0` that passes the tests.
5. **Prepare the sheet** as the service account. This replaces your Application Default
   Credentials, so sign in again as `atlas-dev` afterwards for `npm run test:sheet`:

   ```sh
   gcloud auth application-default login \
     --impersonate-service-account=atlas-service@atlas-stg-513316.iam.gserviceaccount.com
   npm run setup:sheet -- <sheet id>
   ```

   To load the production data, follow [`migration/README.md`](../../migration/README.md) with
   `--sheet <sheet id> --bucket openmrs-atlas-stg`, dry run first.

6. **Install the Apps Script** on the sheet as in [`apps-script/README.md`](../../apps-script/README.md),
   using the `SERVICE_URL` printed in step 3 and the secret from
   `gcloud secrets versions access latest --secret=atlas-publish-secret`.
7. **Deploy.** Push to `atlas-3.0`, or re-run the latest CI run. Then check:

   ```sh
   curl https://<service url>/health
   gcloud scheduler jobs run atlas-nightly-publish --location=us-central1
   curl -sI https://storage.googleapis.com/openmrs-atlas-stg/atlas.json
   ```

8. **Add the custom domain.** In Firebase Hosting choose _Add custom domain_, enter
   `atlas-stg.openmrs.org` and use Quick setup. In Cloudflare, add the records it shows (for staging, a `CNAME` and a
   `TXT`), with the proxy off (DNS only). The certificate can take up to a day.

## If the setup script fails

- **Public access to the bucket, or `--allow-unauthenticated`, is refused.** The organization
  enforces _Domain restricted sharing_ (`iam.allowedPolicyMemberDomains`) or _Public access
  prevention_ (`storage.publicAccessPrevention`). An organization policy admin has to override
  these for this project. Both are needed: the map data is public, and the Apps Script calls the
  service without a Google token.
- **The bucket name is taken.** Bucket names are global. Set `BUCKET=<other name>`, and change
  the redirects in `firebase.json` to match.
