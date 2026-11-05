# Proposal

## Why

Atlas 3.0 can only deploy to staging. The staging project, bucket, service name and site address
are written into CI, `firebase.json` and the setup script, so there is no way to put it on
atlas.openmrs.org. The production Google Cloud project (`openmrs-atlas`) now exists, and the
repository's default branch is `main`, so this is the point to make the repository deploy to
both environments, before any production resources are built.

## What Changes

- Every push to `main` that passes the tests keeps deploying staging, exactly as today.
- A tag of the form `x.y` (for example `3.0`) deploys production, once the tests pass on the
  tagged commit, the commit is on `main`, and a maintainer approves the deploy in GitHub.
- An earlier tag can be redeployed by hand to roll production back.
- Each production deploy creates a GitHub Release for its tag, with notes generated from the
  commits since the last release.
- Release tags can only be created by maintainers and can't be moved or deleted.
- Settings move out of the workflow into GitHub Environments, `staging` and `production`, each
  holding its own Google Cloud project, bucket, Keycloak, email and analytics settings.
- Each Google Cloud project accepts deploys only from its own environment: staging from `main`,
  production only from the `production` environment on a release tag.
- `firebase.json` gets a hosting target per environment, each with its own service rewrite and
  `/rss` and download redirects to its own bucket.
- `infra/staging/setup.sh` becomes one script for both environments, `infra/setup.sh`, with a
  settings file for each. It also creates the link-signing secret it can generate itself.
- Production email follows the same rule as staging when an allowlist is set, so production can
  start by emailing only an allowlist. Unlike staging, production with no allowlist emails
  everyone.
- Production builds with Google Analytics on; staging stays without it.

Out of scope, done later and walked through with the maintainer step by step:

- Creating the production resources (running the setup script against `openmrs-atlas`), and
  Firebase Hosting and the `atlas.openmrs.org` custom domain.
- The production Keycloak clients and `atlas-administrators` group on `id.openmrs.org`.
- The production Mandrill key and other secret values.
- The production sheet, the final 2.0 migration, `report:accounts` against production, and the DNS
  switch.
- Tagging `3.0` and the cutover itself.

Also out of scope: Terraform for the infrastructure, a separate pre-production environment, and
maintenance (`x.y.z`) releases.

## Capabilities

### New Capabilities

- `deployment`: how changes reach staging and production: what triggers each, the checks a
  production release must pass, approval, rollback, release records, and keeping each
  environment's credentials apart.

### Modified Capabilities

- `email-delivery`: the allowlist requirement covers production as well as staging. Staging with
  no allowlist delivers to no one; production with no allowlist delivers to everyone.

No requirement ID in the Atlas 3.0 design spec covers deployment; this change serves the
cutover, which Phase 2 made the next step.

## Impact

- `.github/workflows/ci.yml`: the deploy job runs per environment; production runs on tags and
  by hand. New `contents: write` permission for the release step, on the production job only.
- `firebase.json`, `.firebaserc`: a `production` hosting target in `openmrs-atlas`.
- `infra/staging/` moves to `infra/`, with `staging.env` and `production.env`.
- Docs: `README.md`, `infra/README.md`, `service/README.md`, `migration/README.md`.
- GitHub settings (no code): `staging` and `production` environments, with the existing
  repository variables moved into `staging`; a tag ruleset for release tags.
- Google Cloud: the staging deploy rule is unchanged; production's is created by the setup script.
- No change to the web app, the service code or the sheet.
