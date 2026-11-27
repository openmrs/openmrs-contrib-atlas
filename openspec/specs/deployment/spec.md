# deployment Specification

## Purpose

How changes reach staging (atlas-stg.openmrs.org) and production (atlas.openmrs.org), so staging always shows the latest `main` and production only ever runs a tested, approved release.

## Requirements

### Requirement: Staging follows main
Every push to `main` whose tests pass SHALL build the Atlas image from that commit and push it to Docker Hub as `openmrsinfra/atlas:staging`, which staging runs. Pushes to other branches and pull requests SHALL be tested but SHALL NOT push any image.

#### Scenario: Push to main
- **WHEN** a commit is pushed to `main` and its tests pass
- **THEN** `openmrsinfra/atlas:staging` is that commit's image, with its service and map site

#### Scenario: Failing tests
- **WHEN** a commit is pushed to `main` and a test fails
- **THEN** no image is pushed and `staging` stays the previous commit's image

#### Scenario: Pull request
- **WHEN** a pull request is opened against `main`
- **THEN** its tests run and no image is pushed

### Requirement: Production deploys only releases
Production SHALL be deployed only from a release tag: a tag named `<major>.<minor>` with no other characters (for example `3.0` or `3.12`). A release SHALL deploy only when the tagged commit is on `main`, its tests pass on that run, and a maintainer approves the deploy. Deploying pushes the commit's production image as `production`, `latest` and the release number. Pushes to `main` SHALL never deploy production.

#### Scenario: Release
- **WHEN** a maintainer tags a commit on `main` as `3.1`, its tests pass and a maintainer approves the deploy
- **THEN** `openmrsinfra/atlas:production`, `:latest` and `:3.1` are that commit's production image

#### Scenario: Not a release tag
- **WHEN** a tag such as `3.1.1`, `v3.1` or `3.1-rc1` is pushed
- **THEN** nothing is deployed to production

#### Scenario: Tag off main
- **WHEN** a release tag points at a commit that is not on `main`
- **THEN** the deploy stops before pushing any image and says why

#### Scenario: Not approved
- **WHEN** a release's tests pass but no maintainer approves the deploy
- **THEN** the `production` and `latest` images are unchanged

### Requirement: Rollback by redeploying a release
A maintainer SHALL be able to redeploy any earlier release tag to production by hand, with the same checks and approval as a new release.

#### Scenario: Roll back
- **WHEN** release `3.2` misbehaves and a maintainer redeploys `3.1`
- **THEN** `production` and `latest` are `3.1`'s image again, and the sheet and published data are untouched

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
Each environment SHALL have its own image tag, settings and secrets. Only an approved production release SHALL push `production` or `latest`; any other run SHALL push at most `staging`. Images SHALL contain no secrets: the service's secrets and Google key SHALL come from the host's settings for that environment. The only credential stored in GitHub SHALL be the Docker Hub token.

#### Scenario: Staging deploy credentials
- **WHEN** the staging deploy runs
- **THEN** it pushes only `staging`, and the image holds no secret that would let it change production

#### Scenario: A branch tries to deploy production
- **WHEN** a workflow on any branch, including `main`, asks to push `production` or `latest` without an approved release
- **THEN** the workflow refuses and nothing is pushed

### Requirement: Staging never loses its safety settings
An image built for any environment other than production SHALL deliver email only to its allowlist, and to no one when the allowlist is unset, SHALL refuse to start when the allowlist is `*`, and SHALL be built without analytics, whatever settings the host gives it.

#### Scenario: Production settings change
- **WHEN** production's email allowlist is removed and its analytics ID is set
- **THEN** staging still emails only its allowlist and sends nothing to Google Analytics

#### Scenario: Staging started without an allowlist
- **WHEN** the staging image is started with no `EMAIL_ALLOWLIST`
- **THEN** it sends no email to anyone

#### Scenario: Staging told to email everyone
- **WHEN** the staging image is started with `EMAIL_ALLOWLIST=*`
- **THEN** it does not start, and its log says why

### Requirement: The site is served with security headers
Both environments SHALL serve the map site with an enforced Content-Security-Policy allowing only the origins it uses (itself, OpenFreeMap, Nominatim, its Keycloak and Google Analytics), framing only by itself, and no plugins or form posts elsewhere. They SHALL also send `X-Content-Type-Options: nosniff`, a `Permissions-Policy` turning off unused device features, and a `Referrer-Policy`. The headers SHALL differ only in each environment's Keycloak host.

#### Scenario: Script from elsewhere
- **WHEN** a page tries to load a script from an origin the policy doesn't list
- **THEN** the browser refuses it

#### Scenario: Everything the site uses still works
- **WHEN** a visitor loads the map, searches for a place, signs in and downloads the data on staging
- **THEN** nothing is blocked by the policy

#### Scenario: Framed by another site
- **WHEN** another site puts the Atlas in a frame
- **THEN** the browser refuses to show it

### Requirement: Deleted files can be restored
Each environment SHALL keep every file it writes (published files, history, social cards and logos) in one data folder, mounted from a volume the host backs up daily, so a logo or snapshot deleted by mistake can be restored from a backup. The infra README SHALL say how to restore a file.

#### Scenario: Logo deleted by mistake
- **WHEN** an admin finds, a week later, that a marker's logo file was deleted
- **THEN** an infra supporter can restore it to the same name from a backup, by following the infra README, and the marker shows it again

### Requirement: One container serves the Atlas
Each environment SHALL run as one container that serves, on the site's own origin, the map site, the API, marker permalinks, the published files under `/data/`, the change feed at `/rss`, and logos and social cards under `/data/`. It SHALL listen on plain HTTP behind the host's TLS proxy and SHALL answer a health check at `/health`.

#### Scenario: Download links from 2.0 and 3.x
- **WHEN** someone fetches `/data/atlas.json`, `/data/markers.csv`, `/data/markers.geojson` or `/rss`
- **THEN** the container answers with the current file, without a redirect to another host

#### Scenario: Health check
- **WHEN** the host checks `/health` while the service is running
- **THEN** it answers 200

### Requirement: Scheduled jobs run in the service
The service SHALL start the nightly publish at 03:00 UTC and the reminder job at 14:00 UTC itself, as the scheduler caller, without an outside scheduler. A setting SHALL turn both off, for local development. The service SHALL run at most one copy of each job at a time.

#### Scenario: Nightly run
- **WHEN** the clock passes 03:00 UTC while the service is running
- **THEN** a scheduler publish runs, including the logo sweep and the card redraw

#### Scenario: Jobs turned off
- **WHEN** the service runs with scheduled jobs turned off
- **THEN** no publish or reminder job starts on its own
