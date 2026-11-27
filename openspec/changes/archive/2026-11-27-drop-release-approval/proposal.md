# Proposal

## Why

Each production release waits in GitHub Actions for a maintainer to approve the deploy, under _Review deployments_, after the same maintainer has already tagged it. With releases now tested on staging first, and a release tag being a deliberate step that only admins and maintainers can take, the approval adds a click without adding a check. The maintainer asked to remove it.

## What Changes

- **A release tag deploys production once its checks pass.** No one has to approve the deploy any more. `release-guard` still checks that the tag is a `<major>.<minor>` release on `main`, and the tests still run on the tagged commit.
- **The `production` GitHub environment loses its required reviewer.** It keeps its deployment rule allowing only tags matching `[0-9]*.[0-9]*`, and its variables.
- **Rolling back** runs the same checks as a new release, without approval.
- **Docs** stop describing an approval step: the root README, `infra/README.md`, and the comments in `ci.yml` and `deploy.yml`.

### Out of scope

- Who may create release tags. The tag ruleset still allows only admins and maintainers, and nobody may move or delete a release tag.
- Staging, which never needed approval.
- Fixing the automatic image updates on the hosts. `goba` is still updated by hand after a release.
- The ITSM wiki's Service-Atlas page, which the maintainer keeps up to date.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deployment`:
  - "Production deploys only releases" drops the approval. Its "Not approved" scenario now says a release deploys without one, and a new scenario covers failing tests;
  - "Rollback by redeploying a release" runs the same checks, without approval;
  - "Environments stay apart" speaks of a release that passes `release-guard`, rather than an approved one.

## Impact

- **GitHub settings:** the `production` environment's protection rules lose the required reviewer. The deployment branch and tag policy stays.
- **Workflows:** comments only, in `ci.yml` and `deploy.yml`. The jobs already deploy as soon as the environment lets them.
- **Docs:** `README.md` and `infra/README.md`.
- **Risk:** anyone who can create a release tag can now release without a second step. Tag creation is limited to admins and maintainers by the ruleset, and staging shows every commit first.
