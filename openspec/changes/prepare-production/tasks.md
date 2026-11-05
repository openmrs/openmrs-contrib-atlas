# Tasks

## 1. GitHub environments

- [ ] 1.1 Create the `staging` environment with the variables in design.md, copying today's repository variable values (`STAGING_DATA_URL` → `DATA_URL`, `STAGING_EMAIL_ALLOWLIST` → `EMAIL_ALLOWLIST`, `STAGING_NOTICE_EMAIL` → `NOTICE_EMAIL`) and adding `SERVICE`, `HOSTING_TARGET` and `SITE_URL`. Leave the repository variables in place for now
- [ ] 1.2 Create the `production` environment with Burke as required reviewer (self-review allowed), deployments limited to tags matching `[0-9]*.[0-9]*`, and no variables yet

## 2. Deploy workflow

- [ ] 2.1 Add `.github/workflows/deploy.yml` (`workflow_call`, input `environment`): a first step that fails if any required variable is empty, then the current deploy steps, reading the service name, site URL, data URL, hosting target and Keycloak settings from the environment
- [ ] 2.2 Write the safety rules into it: `EMAIL_ALLOWLIST` passed as set only for `production`, otherwise defaulting to `none`; `VITE_GA_ID` passed only for `production`
- [ ] 2.3 In `ci.yml`: add tag pushes (`*.*`) and `workflow_dispatch`; replace `deploy-staging`'s steps with a call to `deploy.yml` for `staging` (on `main` only); concurrency per environment
- [ ] 2.4 Add the `release-guard` job (tag refs only: `^[0-9]+\.[0-9]+$` and the commit on `main`, with full history) and `deploy-production`, which needs `check`, `e2e` and `release-guard` and calls `deploy.yml` for `production`
- [ ] 2.5 After a successful production deploy, create the GitHub Release for the tag with generated notes unless one exists; `contents: write` on that job only

## 3. Firebase

- [ ] 3.1 Add the `production` hosting target to `firebase.json` (service `atlas-service`, bucket `openmrs-atlas`) and to `.firebaserc` (site `openmrs-atlas`)
- [ ] 3.2 Add a test, run by `check`, that fails if the two targets differ in anything but the service name and bucket

## 4. Setup script

- [ ] 4.1 Move `infra/staging/setup.sh` to `infra/setup.sh <staging|production>`, reading `infra/staging.env` or `infra/production.env` (project, region, bucket, service, site origin, deploy condition); `SHEET_ID` still on the command line
- [ ] 4.2 Create `atlas-link-signing-key` with a random value if missing, and the Keycloak and Mandrill secrets with no value; grant the runtime account access to all four
- [ ] 4.3 Print the GitHub environment variables for that environment
- [ ] 4.4 (manual) Run `bash infra/setup.sh staging` and confirm it changes nothing in staging beyond what it already had

## 5. Docs

- [ ] 5.1 Replace `infra/staging/README.md` with `infra/README.md` for both environments: the resources, the settings files, the GitHub environments, how to release and roll back, and production's console steps as a checklist (Firebase and the custom domain, Keycloak clients and group, secrets, sheet and migration, environment variables, first tag, allowlist review)
- [ ] 5.2 Update `README.md`, `service/README.md`, `migration/README.md` and `openspec/config.yaml` for two environments

## 6. Switch staging over

- [ ] 6.1 All checks pass and `openspec validate --strict` passes
- [ ] 6.2 Push to `main`; confirm staging deployed through `deploy.yml` from the `staging` environment, with the same service settings as before and a working site
- [ ] 6.3 Delete the repository variables and re-run the staging deploy to confirm it no longer needs them
- [ ] 6.4 Confirm a non-release tag (for example `0.0-test`, deleted afterwards) runs the tests and deploys nothing
- [ ] 6.5 Add the tag ruleset for `[0-9]*.[0-9]*`: restrict creation to admins and maintainers, block updates and deletion

## Workflow follow-up

- Archive this change once section 6 is done.
- The production walkthrough (setup script against `openmrs-atlas`, Firebase, Keycloak, secrets, sheet and migration, first tag) follows the checklist in `infra/README.md`, done together with Burke.
