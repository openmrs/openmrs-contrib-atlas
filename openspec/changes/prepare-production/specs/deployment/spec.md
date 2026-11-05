# Spec Delta

## Purpose

How changes reach staging (atlas-stg.openmrs.org) and production (atlas.openmrs.org), so staging always shows the latest `main` and production only ever runs a tested, approved release.

## ADDED Requirements

### Requirement: Staging follows main
Every push to `main` whose tests pass SHALL be deployed to staging, both the service and the map site. Pushes to other branches and pull requests SHALL be tested but SHALL NOT deploy anywhere.

#### Scenario: Push to main
- **WHEN** a commit is pushed to `main` and its tests pass
- **THEN** staging runs that commit's service and map site

#### Scenario: Failing tests
- **WHEN** a commit is pushed to `main` and a test fails
- **THEN** nothing is deployed and staging keeps running the previous commit

#### Scenario: Pull request
- **WHEN** a pull request is opened against `main`
- **THEN** its tests run and nothing is deployed

### Requirement: Production deploys only releases
Production SHALL be deployed only from a release tag: a tag named `<major>.<minor>` with no other characters (for example `3.0` or `3.12`). A release SHALL deploy only when the tagged commit is on `main`, its tests pass on that run, and a maintainer approves the deploy. Pushes to `main` SHALL never deploy production.

#### Scenario: Release
- **WHEN** a maintainer tags a commit on `main` as `3.1`, its tests pass and a maintainer approves the deploy
- **THEN** production runs that commit's service and map site

#### Scenario: Not a release tag
- **WHEN** a tag such as `3.1.1`, `v3.1` or `3.1-rc1` is pushed
- **THEN** nothing is deployed to production

#### Scenario: Tag off main
- **WHEN** a release tag points at a commit that is not on `main`
- **THEN** the deploy stops before changing production and says why

#### Scenario: Not approved
- **WHEN** a release's tests pass but no maintainer approves the deploy
- **THEN** production is unchanged

### Requirement: Rollback by redeploying a release
A maintainer SHALL be able to redeploy any earlier release tag to production by hand, with the same checks and approval as a new release.

#### Scenario: Roll back
- **WHEN** release `3.2` misbehaves and a maintainer redeploys `3.1`
- **THEN** production runs `3.1` again, and the sheet and published data are untouched

### Requirement: Releases are recorded
Each release deployed to production SHALL have a GitHub Release for its tag, with notes listing the changes since the previous release. Redeploying a release that already has one SHALL NOT create another.

#### Scenario: First deploy of a release
- **WHEN** `3.1` is deployed to production for the first time
- **THEN** a GitHub Release named `3.1` lists the commits since `3.0`

### Requirement: Release tags are fixed
Only maintainers SHALL be able to create release tags, and nobody SHALL be able to move or delete one once it exists.

#### Scenario: Moving a tag
- **WHEN** someone tries to push `3.1` to a different commit, or delete it
- **THEN** GitHub refuses

### Requirement: Environments stay apart
Each environment SHALL have its own Google Cloud project, settings and secrets. A deploy SHALL only be able to change the environment it targets: the staging project SHALL accept deploys only from `main`, and the production project only from an approved production release. No long-lived credentials SHALL be stored in GitHub.

#### Scenario: Staging deploy credentials
- **WHEN** the staging deploy runs
- **THEN** it cannot change anything in the production project

#### Scenario: A branch tries to deploy production
- **WHEN** a workflow on any branch, including `main`, asks to deploy to the production project
- **THEN** Google Cloud refuses it

### Requirement: Staging never loses its safety settings
Staging SHALL keep delivering email only to its allowlist, and to no one when the allowlist is unset, and SHALL be built without analytics, whatever the production settings are.

#### Scenario: Production settings change
- **WHEN** production's email allowlist is removed and its analytics ID is set
- **THEN** staging still emails only its allowlist and sends nothing to Google Analytics
