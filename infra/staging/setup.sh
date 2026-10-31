#!/usr/bin/env bash
# Sets up the Atlas staging environment in Google Cloud. See infra/staging/README.md.
#
#   CLOUDSDK_ACTIVE_CONFIG_NAME=openmrs SHEET_ID=<staging sheet id> bash infra/staging/setup.sh
#
# Safe to run again: each step skips what already exists. Run it as a project owner.
set -euo pipefail

PROJECT="${PROJECT:-atlas-stg-513316}"
REGION="${REGION:-us-central1}"
BUCKET="${BUCKET:-openmrs-atlas-stg}" # firebase.json redirects to this name
GITHUB_REPO="${GITHUB_REPO:-openmrs/openmrs-contrib-atlas}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-atlas-3.0}"
SITE_ORIGIN="${SITE_ORIGIN:-https://atlas-stg.openmrs.org}"
SERVICE="atlas-service-stg"
SECRET="atlas-publish-secret"
SCHEDULE="${SCHEDULE:-0 3 * * *}" # nightly, 03:00 UTC
: "${SHEET_ID:?Set SHEET_ID to the staging sheet id (see README step 2)}"

RUNTIME_SA="atlas-service@${PROJECT}.iam.gserviceaccount.com"
SCHEDULER_SA="atlas-scheduler@${PROJECT}.iam.gserviceaccount.com"
DEPLOY_SA="atlas-deploy@${PROJECT}.iam.gserviceaccount.com"
ME="$(gcloud config get-value account 2>/dev/null)"

gcloud config set project "$PROJECT" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
echo "Project $PROJECT ($PROJECT_NUMBER), region $REGION, as $ME"

step() { printf '\n== %s\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }

step "APIs"
gcloud services enable \
  run.googleapis.com artifactregistry.googleapis.com cloudscheduler.googleapis.com \
  secretmanager.googleapis.com sheets.googleapis.com storage.googleapis.com \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  firebase.googleapis.com firebasehosting.googleapis.com

step "Service accounts"
for sa in atlas-service:"Atlas publish service" atlas-scheduler:"Atlas nightly publish" \
  atlas-deploy:"Atlas CI deploys"; do
  name="${sa%%:*}"
  exists gcloud iam service-accounts describe "${name}@${PROJECT}.iam.gserviceaccount.com" ||
    gcloud iam service-accounts create "$name" --display-name="${sa#*:}"
done

step "Artifact Registry"
exists gcloud artifacts repositories describe atlas --location="$REGION" ||
  gcloud artifacts repositories create atlas --repository-format=docker --location="$REGION" \
    --description="Atlas service images"
gcloud artifacts repositories add-iam-policy-binding atlas --location="$REGION" \
  --member="serviceAccount:${DEPLOY_SA}" --role=roles/artifactregistry.writer >/dev/null

step "Bucket gs://${BUCKET}"
exists gcloud storage buckets describe "gs://${BUCKET}" ||
  gcloud storage buckets create "gs://${BUCKET}" --location="$REGION" \
    --uniform-bucket-level-access
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cat >"$tmp/cors.json" <<EOF
[{"origin": ["${SITE_ORIGIN}", "https://${PROJECT}.web.app", "https://${PROJECT}.firebaseapp.com",
  "http://localhost:5173"], "method": ["GET", "HEAD"], "responseHeader": ["Content-Type"],
  "maxAgeSeconds": 3600}]
EOF
cat >"$tmp/lifecycle.json" <<EOF
{"rule": [{"action": {"type": "Delete"}, "condition": {"age": 90, "matchesPrefix": ["history/"]}}]}
EOF
gcloud storage buckets update "gs://${BUCKET}" --cors-file="$tmp/cors.json" \
  --lifecycle-file="$tmp/lifecycle.json"
# Public read. Fails if an organization policy blocks public access; see README.
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member=allUsers --role=roles/storage.objectViewer >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${RUNTIME_SA}" --role=roles/storage.objectAdmin >/dev/null

step "Publish secret"
if ! exists gcloud secrets describe "$SECRET"; then
  openssl rand -base64 32 | tr -d '\n' |
    gcloud secrets create "$SECRET" --replication-policy=automatic --data-file=-
fi
gcloud secrets add-iam-policy-binding "$SECRET" \
  --member="serviceAccount:${RUNTIME_SA}" --role=roles/secretmanager.secretAccessor >/dev/null

step "Cloud Run service ${SERVICE}"
if ! exists gcloud run services describe "$SERVICE" --region="$REGION"; then
  # A placeholder image; the first CI deploy replaces it and keeps this configuration.
  # Unauthenticated invocation is allowed because the service checks its own credentials
  # (the shared secret or the scheduler's OIDC token).
  gcloud run deploy "$SERVICE" --region="$REGION" \
    --image=us-docker.pkg.dev/cloudrun/container/hello \
    --service-account="$RUNTIME_SA" --allow-unauthenticated \
    --min-instances=0 --max-instances=2 \
    --set-secrets="PUBLISH_SECRET=${SECRET}:latest" \
    --set-env-vars="SHEET_ID=${SHEET_ID},BUCKET=${BUCKET},SCHEDULER_SA_EMAIL=${SCHEDULER_SA}"
fi
# A new service can take a moment to report its URL.
SERVICE_URL=""
for _ in 1 2 3 4 5 6; do
  SERVICE_URL="$(gcloud run services describe "$SERVICE" --region="$REGION" \
    --format='value(status.url)')"
  [[ -n "$SERVICE_URL" ]] && break
  sleep 10
done
[[ -n "$SERVICE_URL" ]] || { echo "Cloud Run did not report a URL for ${SERVICE}." >&2; exit 1; }
gcloud run services update "$SERVICE" --region="$REGION" \
  --update-env-vars="SHEET_ID=${SHEET_ID},SERVICE_URL=${SERVICE_URL}" >/dev/null

step "Nightly publish job"
job_flags=(--location="$REGION" --schedule="$SCHEDULE" --time-zone=UTC
  --uri="${SERVICE_URL}/publish" --http-method=POST
  --oidc-service-account-email="$SCHEDULER_SA" --oidc-token-audience="$SERVICE_URL")
if exists gcloud scheduler jobs describe atlas-nightly-publish --location="$REGION"; then
  gcloud scheduler jobs update http atlas-nightly-publish "${job_flags[@]}" >/dev/null
else
  gcloud scheduler jobs create http atlas-nightly-publish "${job_flags[@]}"
fi

step "Workload Identity Federation for ${GITHUB_REPO}@${DEPLOY_BRANCH}"
exists gcloud iam workload-identity-pools describe github --location=global ||
  gcloud iam workload-identity-pools create github --location=global \
    --display-name="GitHub Actions"
exists gcloud iam workload-identity-pools providers describe github --location=global \
  --workload-identity-pool=github ||
  gcloud iam workload-identity-pools providers create-oidc github --location=global \
    --workload-identity-pool=github --display-name="GitHub Actions" \
    --issuer-uri=https://token.actions.githubusercontent.com \
    --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref \
    --attribute-condition="assertion.repository=='${GITHUB_REPO}' && assertion.ref=='refs/heads/${DEPLOY_BRANCH}'"
POOL="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/${POOL}/attribute.repository/${GITHUB_REPO}" >/dev/null

step "Deploy permissions"
for role in roles/run.developer roles/firebasehosting.admin \
  roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --condition=None \
    --member="serviceAccount:${DEPLOY_SA}" --role="$role" >/dev/null
done
# CI deploys Cloud Run revisions that run as the runtime service account.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${DEPLOY_SA}" --role=roles/iam.serviceAccountUser >/dev/null
# You, for `npm run setup:sheet` and `npm run migrate` as the runtime service account.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="user:${ME}" --role=roles/iam.serviceAccountTokenCreator >/dev/null

cat <<EOF

Done. GitHub repository variables (Settings > Secrets and variables > Actions > Variables):

  GCP_PROJECT       ${PROJECT}
  GCP_REGION        ${REGION}
  GCP_WIF_PROVIDER  ${POOL}/providers/github
  GCP_DEPLOY_SA     ${DEPLOY_SA}
  STAGING_DATA_URL  https://storage.googleapis.com/${BUCKET}

Apps Script properties for the staging sheet:

  SERVICE_URL       ${SERVICE_URL}
  PUBLISH_SECRET    gcloud secrets versions access latest --secret=${SECRET}
EOF
