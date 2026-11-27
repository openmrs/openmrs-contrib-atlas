# Tasks

## 1. GitHub

- [x] 1.1 Remove the required reviewer from the `production` environment's protection rules, keeping its deployment rule (tags `[0-9]*.[0-9]*`) and its variables. Check with the API that it lists no reviewers and still lists the tag policy.

## 2. Workflows and docs

- [x] 2.1 In `.github/workflows/ci.yml` and `deploy.yml`, reword the comments that mention an approval: production deploys once `release-guard` and the tests pass.
- [x] 2.2 In `README.md` and `infra/README.md`, remove the approval step from the hosts table, the image tags table, "GitHub environments" and "Releasing and rolling back". Releasing is now: tag, push, wait for CI, update `goba`. Leave the history in "Moving an environment off Google Cloud" alone.
- [x] 2.3 Run the format check and `openspec validate --strict`.

## 3. Release

- [ ] 3.1 Tag `4.1` on `main`. Check that `deploy-production` runs without waiting for approval and pushes `openmrsinfra/atlas:production`, `latest` and `4.1`.

## Workflow follow-up

- Archive this change with its specs synced before tagging `4.1`, so the release includes it. Task 3.1 is then checked off in the archive.
