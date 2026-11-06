#!/usr/bin/env bash
# Sets up one Atlas environment in Google Cloud. See infra/README.md.
#
#   CLOUDSDK_ACTIVE_CONFIG_NAME=openmrs SHEET_ID=<sheet id> bash infra/setup.sh staging
#   CLOUDSDK_ACTIVE_CONFIG_NAME=openmrs SHEET_ID=<sheet id> bash infra/setup.sh production
#
# Reads infra/<environment>.env for the project, bucket, service and deploy rule. Safe to run
# again: each step skips what already exists. Run it as a project owner.
set -euo pipefail

ENVIRONMENT="${1:-}"
case "$ENVIRONMENT" in
  staging | production) ;;
  *)
    echo "Usage: SHEET_ID=<sheet id> bash infra/setup.sh staging|production" >&2
    exit 2
    ;;
esac
# shellcheck source=/dev/null
source "$(dirname "$0")/${ENVIRONMENT}.env"
: "${PROJECT:?}" "${REGION:?}" "${BUCKET:?}" "${SERVICE:?}" "${SITE_ORIGIN:?}"
: "${HOSTING_TARGET:?}" "${KEYCLOAK_ISSUER:?}" "${WIF_CONDITION:?}"
GITHUB_REPO="openmrs/openmrs-contrib-atlas"
export CLOUDSDK_CORE_DISABLE_PROMPTS=1 # never wait on a question the hidden checks can't show
SECRET="atlas-publish-secret"
SCHEDULE="${SCHEDULE:-0 3 * * *}" # nightly, 03:00 UTC
REMINDER_SCHEDULE="${REMINDER_SCHEDULE:-0 14 * * *}" # daily, 14:00 UTC
: "${SHEET_ID:?Set SHEET_ID to the ${ENVIRONMENT} sheet id (see infra/README.md)}"

RUNTIME_SA="atlas-service@${PROJECT}.iam.gserviceaccount.com"
SCHEDULER_SA="atlas-scheduler@${PROJECT}.iam.gserviceaccount.com"
DEPLOY_SA="atlas-deploy@${PROJECT}.iam.gserviceaccount.com"
ME="$(gcloud config get-value account 2>/dev/null)"

gcloud config set project "$PROJECT" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
echo "Setting up ${ENVIRONMENT}: project $PROJECT ($PROJECT_NUMBER), region $REGION, as $ME"

step() { printf '\n== %s\n' "$*"; }
# Hides the output of an existence check. Its input is closed too, so a gcloud question can't
# wait unseen; prompts are also off for the whole script (CLOUDSDK_CORE_DISABLE_PROMPTS, set above).
exists() { "$@" </dev/null >/dev/null 2>&1; }

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

step "Service secrets"
# The link-signing key can be generated here. The Keycloak client secret and the Mandrill key
# are created empty; add their values by hand (infra/README.md). Until they have values, Cloud
# Run refuses new revisions and keeps the running one.
if ! exists gcloud secrets describe atlas-link-signing-key; then
  openssl rand -base64 32 | tr -d '\n' |
    gcloud secrets create atlas-link-signing-key --replication-policy=automatic --data-file=-
fi
for s in atlas-keycloak-service-secret atlas-mandrill-api-key; do
  exists gcloud secrets describe "$s" ||
    gcloud secrets create "$s" --replication-policy=automatic
done
for s in atlas-keycloak-service-secret atlas-mandrill-api-key atlas-link-signing-key; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:${RUNTIME_SA}" --role=roles/secretmanager.secretAccessor >/dev/null
done

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

step "Daily reminder job"
# Sends due reminder emails (specs/reminder-emails). The service delivers only to the
# environment's EMAIL_ALLOWLIST when one is set; on staging, to no one without it.
reminder_flags=(--location="$REGION" --schedule="$REMINDER_SCHEDULE" --time-zone=UTC
  --uri="${SERVICE_URL}/reminders" --http-method=POST --attempt-deadline=600s
  --oidc-service-account-email="$SCHEDULER_SA" --oidc-token-audience="$SERVICE_URL")
if exists gcloud scheduler jobs describe atlas-daily-reminders --location="$REGION"; then
  gcloud scheduler jobs update http atlas-daily-reminders "${reminder_flags[@]}" >/dev/null
else
  gcloud scheduler jobs create http atlas-daily-reminders "${reminder_flags[@]}"
  if [[ "${PAUSE_NEW_REMINDER_JOB:-no}" == yes ]]; then
    gcloud scheduler jobs pause atlas-daily-reminders --location="$REGION"
    echo "The reminder job is paused until the cutover."
  fi
fi

step "Workload Identity Federation for ${GITHUB_REPO} (${ENVIRONMENT})"
exists gcloud iam workload-identity-pools describe github --location=global ||
  gcloud iam workload-identity-pools create github --location=global \
    --display-name="GitHub Actions"
# Who may deploy (WIF_CONDITION in the settings file). Updated on every run, so a changed rule
# only needs this script run again.
wif_condition="$WIF_CONDITION"
if exists gcloud iam workload-identity-pools providers describe github --location=global \
  --workload-identity-pool=github; then
  gcloud iam workload-identity-pools providers update-oidc github --location=global \
    --workload-identity-pool=github --attribute-condition="$wif_condition" >/dev/null
else
  gcloud iam workload-identity-pools providers create-oidc github --location=global \
    --workload-identity-pool=github --display-name="GitHub Actions" \
    --issuer-uri=https://token.actions.githubusercontent.com \
    --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref \
    --attribute-condition="$wif_condition"
fi
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

Done. Variables for the GitHub environment "${ENVIRONMENT}" (Settings > Environments >
${ENVIRONMENT}, or gh variable set <NAME> --env ${ENVIRONMENT} --body <value>):

  GCP_PROJECT         ${PROJECT}
  GCP_REGION          ${REGION}
  GCP_WIF_PROVIDER    ${POOL}/providers/github
  GCP_DEPLOY_SA       ${DEPLOY_SA}
  SERVICE             ${SERVICE}
  HOSTING_TARGET      ${HOSTING_TARGET}
  SITE_URL            ${SITE_ORIGIN}
  DATA_URL            https://storage.googleapis.com/${BUCKET}
  KEYCLOAK_ISSUER     ${KEYCLOAK_ISSUER}
  KEYCLOAK_CLIENT_ID  atlas
  EMAIL_ALLOWLIST     addresses this environment may email (see infra/README.md)
  NOTICE_EMAIL        where new-marker notices go (optional)
EOF
if [[ "$ENVIRONMENT" == production ]]; then
  echo "  GA_ID               the Google Analytics measurement ID"
fi
cat <<EOF

Apps Script properties for the ${ENVIRONMENT} sheet:

  SERVICE_URL       ${SERVICE_URL}
  PUBLISH_SECRET    gcloud secrets versions access latest --secret=${SECRET}
EOF
