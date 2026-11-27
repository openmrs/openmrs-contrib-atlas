## MODIFIED Requirements

### Requirement: Production deploys only releases
Production SHALL be deployed only from a release tag: a tag named `<major>.<minor>` with no other characters (for example `3.0` or `3.12`). A release SHALL deploy only when the tagged commit is on `main` and its tests pass on that run; no further approval is asked for. Deploying pushes the commit's production image as `production`, `latest` and the release number. Pushes to `main` SHALL never deploy production.

#### Scenario: Release
- **WHEN** a maintainer tags a commit on `main` as `3.1` and its tests pass
- **THEN** `openmrsinfra/atlas:production`, `:latest` and `:3.1` are that commit's production image, without anyone approving the deploy

#### Scenario: Not a release tag
- **WHEN** a tag such as `3.1.1`, `v3.1` or `3.1-rc1` is pushed
- **THEN** nothing is deployed to production

#### Scenario: Tag off main
- **WHEN** a release tag points at a commit that is not on `main`
- **THEN** the deploy stops before pushing any image and says why

#### Scenario: Not approved
- **WHEN** a release's tests pass and nobody approves anything in GitHub Actions
- **THEN** it is deployed all the same: tagging the release is the decision

#### Scenario: Tests fail on a release
- **WHEN** a release tag's tests fail
- **THEN** the `production` and `latest` images are unchanged

### Requirement: Rollback by redeploying a release
A maintainer SHALL be able to redeploy any earlier release tag to production by hand, with the same checks as a new release.

#### Scenario: Roll back
- **WHEN** release `3.2` misbehaves and a maintainer redeploys `3.1`
- **THEN** `production` and `latest` are `3.1`'s image again, and the sheet and published data are untouched

### Requirement: Environments stay apart
Each environment SHALL have its own image tag, settings and secrets. Only a release tag that passes the release checks SHALL push `production` or `latest`; any other run SHALL push at most `staging`. Images SHALL contain no secrets: the service's secrets and Google key SHALL come from the host's settings for that environment. The only credential stored in GitHub SHALL be the Docker Hub token.

#### Scenario: Staging deploy credentials
- **WHEN** the staging deploy runs
- **THEN** it pushes only `staging`, and the image holds no secret that would let it change production

#### Scenario: A branch tries to deploy production
- **WHEN** a workflow on any branch, including `main`, asks to push `production` or `latest` without a release tag
- **THEN** the workflow refuses and nothing is pushed
