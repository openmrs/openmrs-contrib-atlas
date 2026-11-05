# Design

## Context

One workflow, `.github/workflows/ci.yml`, runs `check` and `e2e` on pushes and pull requests to `main`, then a `deploy-staging` job that:

- builds the service image into the staging project's Artifact Registry and deploys it to Cloud Run `atlas-service-stg`, with the settings and secret references listed in the job;
- builds the web app with `VITE_*` settings (data URL, Keycloak issuer and client) and deploys Firebase Hosting target `staging`.

Its settings are repository variables (`GCP_PROJECT`, `GCP_REGION`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`, `STAGING_DATA_URL`, `STAGING_EMAIL_ALLOWLIST`, `STAGING_NOTICE_EMAIL`), plus values written into the job (`SITE_URL`, the service name, `EMAIL_FROM`). Google Cloud trusts GitHub through Workload Identity Federation, with the provider condition `assertion.repository=='openmrs/openmrs-contrib-atlas' && assertion.ref=='refs/heads/main'`.

`firebase.json` has one hosting target whose `/api/**` rewrite names `atlas-service-stg` and whose `/rss` and `/data/*` redirects name the `openmrs-atlas-stg` bucket. `infra/staging/setup.sh` already reads most settings from environment variables, but its defaults and the service name are staging's. The production project `openmrs-atlas` exists with nothing in it; the bucket name `openmrs-atlas` is free.

## Goals / Non-Goals

**Goals:**
- One deploy definition used by both environments, so they can't drift apart.
- Staging deploys exactly as today, from the first commit of this change on.
- Safety settings that fail safe: a missing or misnamed setting must never make staging email real people, turn on analytics there, or point production at staging.
- Everything the maintainer has to do in a console is written down as a checklist.

**Non-Goals:**
- Creating any production resource. The setup script is written and reviewed here, and run against production later with the maintainer.
- Changing staging's Google Cloud setup. Its deploy rule stays as it is.

## Decisions

### One reusable deploy workflow, called once per environment
A new `.github/workflows/deploy.yml` (`on: workflow_call`, input `environment`) holds the deploy steps now in `deploy-staging`. `ci.yml` calls it from two jobs:

| Job | Runs when | Calls with |
|---|---|---|
| `deploy-staging` | push to `main`, or run by hand on `main`, after `check` and `e2e` pass | `environment: staging` |
| `deploy-production` | push of a tag, or run by hand on a tag, after `check`, `e2e` and `release-guard` pass | `environment: production` |

`ci.yml` gains `push: tags: ['*.*']` and `workflow_dispatch`, so the tests run again on the tagged commit within the same run. Rolling back is "Run workflow" with the older tag picked as the ref; no separate rollback workflow is needed.

Alternatives: two copies of the deploy job (they would drift); a separate release workflow triggered by tags (it would have to repeat or wait on the test jobs; keeping one workflow means a release's tests and its deploy are one run).

### Settings live in GitHub Environments, and repository variables go away
Each environment holds the same variable names:

| Variable | staging | production |
|---|---|---|
| `GCP_PROJECT` | `atlas-stg-513316` | `openmrs-atlas` |
| `GCP_REGION` | `us-central1` | `us-central1` |
| `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA` | printed by the setup script | printed by the setup script |
| `SERVICE` | `atlas-service-stg` | `atlas-service` |
| `HOSTING_TARGET` | `staging` | `production` |
| `SITE_URL` | `https://atlas-stg.openmrs.org` | `https://atlas.openmrs.org` |
| `DATA_URL` | `https://storage.googleapis.com/openmrs-atlas-stg` | `https://storage.googleapis.com/openmrs-atlas` |
| `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID` | `id-stg` realm, `atlas` | `id.openmrs.org` realm, `atlas` |
| `EMAIL_ALLOWLIST` | `burke@openmrs.org` | `burke@openmrs.org` at first, removed after review |
| `NOTICE_EMAIL` | optional | `infrastructure@openmrs.org` |
| `GA_ID` | not set | the OpenMRS measurement ID |

A job that names an environment also sees repository variables, and an environment variable only overrides one of the same name. A production setting left out by mistake would silently fall back to a staging value. So once staging deploys from its environment, every repository variable is deleted, and the deploy workflow's first step fails the run if any required variable is empty.

Secret names in Secret Manager stay the same in both projects (`atlas-publish-secret`, `atlas-keycloak-service-secret`, `atlas-mandrill-api-key`, `atlas-link-signing-key`). They are separated by project, not by name.

### Safety rules written in the workflow, not only in settings
- `EMAIL_ALLOWLIST` is passed as `vars.EMAIL_ALLOWLIST` only when `inputs.environment == 'production'`. Any other environment gets `vars.EMAIL_ALLOWLIST || 'none'`, so staging, or a misnamed environment, emails no one without an allowlist.
- `VITE_GA_ID` is passed only when `inputs.environment == 'production'`.
- The required-settings check above means production can never borrow a staging value.

Alternative considered: change the service so an empty allowlist means "no one" everywhere and add an explicit "everyone" value. That needs a service change for something the workflow can guarantee. The service rule is unchanged.

### A release guard job before approval
`release-guard` runs on tag refs only, before `deploy-production`, and fails unless:
- the tag matches `^[0-9]+\.[0-9]+$`, and
- the tagged commit is on `main` (`git merge-base --is-ancestor "$GITHUB_SHA" origin/main`, with full history checked out).

It runs before the environment's approval, so a bad tag fails at once and never asks for approval. The `production` environment also limits deployments to tags matching `[0-9]*.[0-9]*`. GitHub's patterns can't express "digits only", so the guard is the real check and the environment rule is a second fence.

### Production approval
The `production` environment requires a reviewer (Burke, plus any other maintainers added later), with self-review allowed, because there is one maintainer today. The run waits at `deploy-production` until approved, and lapses after GitHub's 30-day limit if it isn't.

### Production builds its own image from the tagged commit
Production builds the service image into its own Artifact Registry, from the tagged commit, after that run's tests pass. The alternative was copying the exact image staging runs, which would mean letting the production deploy account read the staging project's registry, or the reverse, and tying the two projects' permissions together. The build uses the same Dockerfile and `package-lock.json`, so the difference is negligible. This differs from what was suggested in conversation earlier: separate projects make promotion cost more than it buys.

### Each project trusts only its own environment
Each project has its own Workload Identity pool and deploy service account, created by the setup script.
- Staging keeps `assertion.repository=='openmrs/openmrs-contrib-atlas' && assertion.ref=='refs/heads/main'`. Its token still says `refs/heads/main` when the job uses the `staging` environment, so nothing in staging changes.
- Production uses `assertion.repository=='openmrs/openmrs-contrib-atlas' && assertion.environment=='production' && assertion.ref_type=='tag'`. GitHub only issues `environment: production` tokens to jobs that passed the environment's tag rule and approval.

The setup script reads the condition from the environment's settings file, and updates it on every run.

### One setup script with a settings file per environment
`infra/staging/setup.sh` becomes `infra/setup.sh <staging|production>`, which sources `infra/<env>.env`:

```sh
# infra/production.env
PROJECT=openmrs-atlas
REGION=us-central1
BUCKET=openmrs-atlas
SERVICE=atlas-service
SITE_ORIGIN=https://atlas.openmrs.org
WIF_CONDITION="assertion.repository=='openmrs/openmrs-contrib-atlas' && assertion.environment=='production' && assertion.ref_type=='tag'"
```

`SHEET_ID` is still passed on the command line. Two additions:
- It creates `atlas-link-signing-key` with a random value if missing, and creates the Keycloak and Mandrill secrets empty (no version), granting the runtime account access to all four. The maintainer adds those two values by hand.
- It prints the GitHub environment variables for that environment, not repository variables.

Run against staging, it must produce no changes beyond the new secret grants it already has. `infra/staging/README.md` becomes `infra/README.md`, covering both, with production's console steps as a checklist.

### Two Firebase hosting targets, checked against each other
Firebase redirects and rewrites can't read variables, so `firebase.json` lists a `production` target next to `staging`. The two differ only in the Cloud Run service name and the bucket name. A test in the `check` job fails if anything else differs (headers, redirect paths, clean URLs), so a change to one can't miss the other. `.firebaserc` maps `production` to the `openmrs-atlas` site.

### Release records and fixed tags
- After a successful production deploy, the job runs `gh release create "$TAG" --verify-tag --generate-notes`, unless a release for the tag already exists (a rollback). This needs `contents: write`, granted to that job only. The first release, `3.0`, would list every commit since `2.2.1`, so its notes get rewritten by hand.
- A repository ruleset on tags matching `[0-9]*.[0-9]*` restricts creation, update and deletion, with repository admins and maintainers allowed to create. That also protects the existing `2.x` tags.

## Risks / Trade-offs

- [A repository variable left behind is inherited by production] → Delete all repository variables once staging deploys from its environment. The required-settings check catches anything left empty.
- [A tag's own workflow runs, so a rollback to a tag runs that tag's deploy steps] → Expected and harmless: there are no release tags before this change. Note it in `infra/README.md`.
- [The production deploy runs before its secrets have values] → Cloud Run refuses to start a revision with a missing secret version and keeps the old one. No production tag is pushed until the walkthrough is done.
- [Self-approval is no real second check today] → Its purpose is to stop a tag pushed by mistake. Other maintainers can be added as reviewers later.
- [GitHub's 30-day approval limit] → A lapsed run is re-run by hand on the tag.
- [Firebase duplication] → The consistency test.

## Migration Plan

1. Create the GitHub `staging` environment with the variables above (copying today's values, with `STAGING_DATA_URL`, `STAGING_EMAIL_ALLOWLIST` and `STAGING_NOTICE_EMAIL` renamed). Create `production` with its reviewer and tag rule and no variables yet. The repository variables stay for now, so the current workflow keeps working.
2. Push the change to `main`. Staging deploys through the new workflow, from its environment. Check the deployed service settings match the old ones and the site works.
3. Delete the repository variables, and re-run the staging deploy to prove it no longer needs them.
4. Add the tag ruleset.
5. Later, with the maintainer: run `infra/setup.sh production`, then Firebase and the custom domain, Keycloak, secrets, the production sheet and migration, the `production` environment variables, and the first tag.

Rollback: revert the commit and recreate the repository variables. Staging's Google Cloud setup is never changed, so it keeps accepting deploys either way.

## Open Questions

- The OpenMRS Google Analytics measurement ID for production. Atlas 2.0's code has none to copy; it can be set in the `production` environment any time before the first tag.
- The production Keycloak realm URL, expected to be `https://id.openmrs.org/realms/openmrs`; confirmed during the walkthrough.
