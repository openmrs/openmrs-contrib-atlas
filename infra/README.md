# Environments

Each environment runs as one Docker container on an OpenMRS server on Jetstream 2, from an image
on Docker Hub. Staging runs on `gode`, with the staging versions of the other OpenMRS apps, and
production on `goba`:

| Environment | Site                                                   | Host   | Image                                           | Built from                            |
| ----------- | ------------------------------------------------------ | ------ | ----------------------------------------------- | ------------------------------------- |
| staging     | [atlas-stg.openmrs.org](https://atlas-stg.openmrs.org) | `gode` | `openmrsinfra/atlas:staging`                    | every push to `main` that passes CI   |
| production  | [atlas.openmrs.org](https://atlas.openmrs.org)         | `goba` | `openmrsinfra/atlas:production` (and `:latest`) | release tags (`4.0`, `4.1`), approved |

The compose stacks that run them are in
[openmrs-contrib-ansible-docker-compose](https://github.com/openmrs/openmrs-contrib-ansible-docker-compose),
under `files/atlas-stg/` and `files/atlas/`, and are deployed with the Ansible in
[openmrs-contrib-itsmresources](https://github.com/openmrs/openmrs-contrib-itsmresources). The
host picks up a new image when its tag changes (`deploy-compose-if-newer`). The host's reverse
proxy terminates TLS and forwards to the container.

The container needs nothing else from Google Cloud except the Sheets API. The sheet is still the
source of truth, Keycloak (`id-stg.openmrs.org` / `id.openmrs.org`, realm `openmrs`) still signs
people in, and Mandrill still sends the email.

## The image

`service/Dockerfile` builds one image: the service, plus the map site built for one environment.
The site's settings are fixed when it is built, so staging and production are separate builds.

| Tag                    | Pushed by                                              |
| ---------------------- | ------------------------------------------------------ |
| `staging`              | every push to `main` that passes CI                    |
| `staging-<sha>`        | the same, one per commit, to pin or compare            |
| `production`, `latest` | an approved release                                    |
| `<release>` (`4.0`)    | the same, one per release, to pin or roll back by hand |

In the container:

- **Port 8080**, plain HTTP. Put the host's TLS proxy in front. It must allow request bodies of at
  least 3 MB, for logo uploads (2 MB at most).
- **`/atlas_data`**, the data folder: published files, `history/`, `cards/` and `logos/`. Mount a
  named volume here and back it up (see below). A new volume takes the folder's owner, `node`.
- **`/health`** answers `{"ok":true,"environment":…,"commit":…}`. The image has a Docker
  `HEALTHCHECK` that calls it.
- **One container per environment, always.** Sheet writes and publishes are queued in memory, so
  two containers would overwrite each other.
- The service runs its own daily jobs: the nightly publish at 03:00 UTC and the reminders at
  14:00 UTC (service/README.md, "Daily jobs").
- Logs are one JSON object per line on standard output: `docker logs`.

### Settings

Set these in the stack's `.env`. The full list, with defaults, is in
[`service/README.md`](../service/README.md#configuration).

| Variable                         | staging                                     | production                              |
| -------------------------------- | ------------------------------------------- | --------------------------------------- |
| `SHEET_ID`                       | the staging sheet's id                      | the production sheet's id               |
| `SITE_URL`                       | `https://atlas-stg.openmrs.org`             | `https://atlas.openmrs.org`             |
| `KEYCLOAK_ISSUER`                | `https://id-stg.openmrs.org/realms/openmrs` | `https://id.openmrs.org/realms/openmrs` |
| `KEYCLOAK_CLIENT_ID`             | `atlas`                                     | `atlas`                                 |
| `KEYCLOAK_SERVICE_CLIENT_ID`     | `atlas-service`                             | `atlas-service`                         |
| `EMAIL_ALLOWLIST`                | addresses staging may email                 | unset (everyone)                        |
| `NOTICE_EMAIL`                   | optional                                    | `infrastructure@openmrs.org`            |
| Secrets                          |                                             |                                         |
| `GOOGLE_SERVICE_ACCOUNT_KEY`     | the Sheets service account's JSON key       | the same, for production's account      |
| `PUBLISH_SECRET`                 | shared with the sheet's Apps Script         | its own value                           |
| `KEYCLOAK_SERVICE_CLIENT_SECRET` | the `atlas-service` client's secret         | its own value                           |
| `MANDRILL_API_KEY`               | Atlas's Mandrill key (Messages › Send only) | the same key, or its own                |
| `LINK_SIGNING_KEY`               | `openssl rand -base64 32`                   | its own value                           |

The staging image emails only its allowlist, emails no one when it is unset, and refuses to start
when it is `*`, whatever the host's settings say. Only the production image includes Google
Analytics.

`GOOGLE_SERVICE_ACCOUNT_KEY` is the JSON key of the service account the sheet is shared with as
an Editor, either as is on one line or base64-encoded (`base64 -i key.json`). Treat it like any
other secret; if it leaks, delete the key in Google Cloud and create another.

### Example compose service

A starting point for `files/atlas-stg/docker-compose.yml`. Production is the same with `:production`
and its own names.

```yaml
services:
  atlas:
    image: openmrsinfra/atlas:staging
    restart: always
    env_file: .env
    ports:
      - "8548:8080"
    volumes:
      - atlas-data:/atlas_data

  backup:
    image: openmrsinfra/cron-backup:latest
    depends_on:
      - atlas
    volumes:
      - atlas-data:/atlas_data
      - ${BACKUP_DIR-/opt/backups}:/backup
    environment:
      - DIRS=/atlas_data:atlas-stg-data
      - SCHEDULE=0 0 * * *
    restart: always
    healthcheck:
      test: "exit 0"

volumes:
  atlas-data:
```

### Building it yourself

```sh
docker build -f service/Dockerfile -t atlas:staging \
  --build-arg ATLAS_ENVIRONMENT=staging --build-arg ATLAS_COMMIT="$(git rev-parse HEAD)" \
  --build-arg VITE_SITE_URL=https://atlas-stg.openmrs.org \
  --build-arg VITE_KEYCLOAK_ISSUER=https://id-stg.openmrs.org/realms/openmrs \
  --build-arg VITE_KEYCLOAK_CLIENT_ID=atlas .
docker run --rm -p 8080:8080 -v atlas-data:/atlas_data --env-file .env.staging atlas:staging
```

## Security headers

The service sends the headers itself ([`service/src/site.ts`](../service/src/site.ts),
specs/deployment):

- **The site's two pages** (`/` and `/reminder`) get an enforced Content-Security-Policy. It allows
  only what the site uses: itself, OpenFreeMap, Nominatim, the environment's Keycloak (from
  `KEYCLOAK_ISSUER`) and Google Analytics.
- **Everything** gets `X-Content-Type-Options: nosniff` and a `Permissions-Policy` that turns off
  unused device features.
- **`Referrer-Policy`** is `strict-origin-when-cross-origin` on the map page and `no-referrer` on the
  reminder page.
- **Not on `/marker/*`:** the policy isn't applied to the permalink pages, whose redirect is an
  inline script.

**When the site starts using a new origin**, add it to the right directive in
`contentSecurityPolicy`: for example, a new API to `connect-src`, or new images to `img-src`. The
e2e tests run under the same policy and fail on any violation, naming the directive that blocked
it.

## Backups and restoring a file

The host backs up the `/atlas_data` volume every night with `openmrsinfra/cron-backup`. The
nightly logo sweep deletes only logos that no marker has used for more than a day, so every logo
it deletes is in at least one backup. To restore a file, unpack it from the most recent backup
that has it (`cron-backup` writes them to the host's `BACKUP_DIR`), then copy it back under the
same name:

```sh
docker cp <restored>/logos/<name>.webp <container>:/atlas_data/logos/<name>.webp
```

The marker shows it again as soon as its `logo_url` points to it. Snapshots and social cards can be
restored the same way, though the next publish rewrites them anyway. To roll back a bad publish,
see [`service/README.md`](../service/README.md#rolling-back-a-bad-publish).

## GitHub environments

The settings the image is built with live in the GitHub Environments `staging` and `production`
(Settings › Environments). There are deliberately no repository variables: a job that uses an
environment also sees repository variables, so a setting missing from production would silently
take the staging value. Each deploy starts by failing if a required variable is empty.

| Variable             | staging                                     | production                              |
| -------------------- | ------------------------------------------- | --------------------------------------- |
| `SITE_URL`           | `https://atlas-stg.openmrs.org`             | `https://atlas.openmrs.org`             |
| `KEYCLOAK_ISSUER`    | `https://id-stg.openmrs.org/realms/openmrs` | `https://id.openmrs.org/realms/openmrs` |
| `KEYCLOAK_CLIENT_ID` | `atlas`                                     | `atlas`                                 |
| `GA_ID`              | not used                                    | `G-9XFSTG4KZ0` (required)               |

Pushing to Docker Hub uses the `DOCKER_HUB_USERNAME` and `DOCKER_HUB_TOKEN` secrets. The workflow
chooses the tags from the environment, never from a setting: only the `production` job, which
runs only for a release tag after `release-guard` passes and a maintainer approves, can push
`production`, `latest` or a release number.

The `staging` environment accepts deploys only from `main`. The `production` environment accepts
only tags matching `[0-9]*.[0-9]*`, and waits for a required reviewer's approval.

## Releasing and rolling back

- **Release:** tag a commit on `main` as `<major>.<minor>` and push the tag:

  ```sh
  git tag -a 4.1 -m "Atlas 4.1" && git push origin 4.1
  ```

  CI runs the tests on the tagged commit, `release-guard` checks the tag is a release on `main`,
  and `deploy-production` then waits for approval (Actions › the run › _Review deployments_).
  It then pushes the production image, and the host picks it up. A GitHub Release is created with
  notes generated from the commits since the last release. Any other tag (`4.1.1`, `v4.1`,
  `4.1-rc1`) runs the tests and fails `release-guard`, pushing nothing.

- **Roll back:** Actions › CI › _Run workflow_, choose the older tag under _Use workflow from_.
  It runs the same checks and approval, and pushes that release's image as `production` and
  `latest` again. Its existing GitHub Release is left alone. The sheet and the published data
  aren't touched. Note that a tag runs the workflow as it was at that tag. In a hurry, the host's
  compose file can also be pointed at a release's own tag, such as `openmrsinfra/atlas:4.0`.

- **Release tags are fixed.** A tag ruleset lets only admins and maintainers create tags matching
  `[0-9]*.[0-9]*`, and lets no one move or delete them.

## Setting up an environment

1. **A service account for the sheet.** In a Google Cloud project, create a service account (for
   example `atlas-stg-sheets-access@atlas-stg-513316`), enable the Sheets API, and create a JSON key
   for it. Share the
   sheet with the account as an Editor. If the organization blocks key creation
   (`iam.disableServiceAccountKeyCreation`), an organization policy admin has to allow it for that
   project.
2. **Keycloak.** In the environment's realm, create the `atlas` and `atlas-service` clients as in
   [`service/README.md`](../service/README.md#keycloak), with the environment's site as the
   redirect and origin, and the `atlas-administrators` group.
3. **The stack on its host** (`gode` for staging, `goba` for production): the compose service
   above, with the settings in its `.env`.
4. **The Apps Script** on the sheet, as in [`apps-script/README.md`](../apps-script/README.md),
   with `SERVICE_URL` set to the site and the stack's `PUBLISH_SECRET`.
5. **DNS** for the site, pointing at its host, and a certificate on the host's proxy.
6. **Check:** `curl https://<site>/health`, publish from the sheet (Atlas › Publish), then
   `curl -sI https://<site>/data/atlas.json`.

## Moving an environment off Google Cloud

Until 4.0, each environment ran on Google Cloud: Cloud Run for the service, Firebase Hosting for
the site, a Cloud Storage bucket for the files, and Cloud Scheduler for the daily jobs. The sheet
is shared, so moving an environment means moving its files and its addresses. In order:

1. **The image.** Staging: pushed by CI. Production: merge, tag `4.0` and approve it. Cloud Run
   keeps running the old release throughout.
2. **The service account key**, for an account the sheet is shared with as an Editor (step 1
   above).
3. **The stack** on its host, with its settings. Copy the secrets from the project's Secret
   Manager: `atlas-publish-secret`, `atlas-keycloak-service-secret`, `atlas-mandrill-api-key`
   and `atlas-link-signing-key`. Reading them into the `.env` without printing them:

   ```sh
   gcloud secrets versions access latest --secret=<name> --project=<project>
   ```

4. **The logos.** Copy them from the bucket into the volume (the history is optional):

   ```sh
   gcloud storage rsync -r gs://<bucket>/logos <volume>/logos
   ```

5. **Pause Cloud Scheduler**, so Cloud Run's nightly sweep doesn't see the moved logos as unused:

   ```sh
   gcloud scheduler jobs pause atlas-nightly-publish --location=us-central1 --project=<project>
   gcloud scheduler jobs pause atlas-daily-reminders --location=us-central1 --project=<project>
   ```

6. **The logo addresses.** Preview, then apply (service/README.md, "Moving logo addresses"):

   ```sh
   npm run move:logos -w service -- <sheet id> \
     --from https://storage.googleapis.com/<bucket>/logos/ --to https://<site>/data/logos/
   ```

7. **The Apps Script's `SERVICE_URL`**: the site, instead of the Cloud Run address.
8. **DNS**: point the site at its host. For production, lower the record's TTL a day ahead and
   switch at a quiet hour, since both Cloud Run and `goba` can take edits until it propagates.
9. **Publish** from the sheet, and check the site. For production, once DNS has settled, run
   steps 4 and 6 again to catch logos uploaded to Cloud Run in the meantime.

| Environment | Project            | Bucket                   |
| ----------- | ------------------ | ------------------------ |
| staging     | `atlas-stg-513316` | `gs://openmrs-atlas-stg` |
| production  | `openmrs-atlas`    | `gs://openmrs-atlas`     |

**Rolling back** an environment: point DNS back at Firebase Hosting, copy any new logos from the
volume to the bucket (`gcloud storage rsync -r <volume>/logos gs://<bucket>/logos`), run the
address script the other way, resume the two scheduler jobs, and set the Apps Script's
`SERVICE_URL` back to the Cloud Run address. Cloud Run, Firebase Hosting and the buckets stay in
place until a later change removes them.
