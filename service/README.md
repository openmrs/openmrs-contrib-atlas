# Atlas publish service

A small HTTP service on Cloud Run. It reads the Atlas sheet, validates it, publishes the public
snapshot files to Cloud Storage, and makes every change people save on the site.

## Endpoints

| Method and path            | Who may call                                      | What it does                                                                                                                       |
| -------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`              | anyone                                            | `{"ok":true}`                                                                                                                      |
| `POST /publish`            | the sheet's Apps Script, or Cloud Scheduler       | Validates the sheet, rewrites `problems`, and publishes unless the safety check refuses. `200` when published, `409` when refused. |
| `POST /publish?force=true` | the sheet's Apps Script ("Atlas › Force publish") | The same, but skips the safety check.                                                                                              |
| `POST /reminders`          | Cloud Scheduler, or a signed-in admin             | Sends due reminder emails, at most 50 a day, and records each outcome in `reminders`.                                              |

Callers authenticate with `Authorization: Bearer <token>`:

- **Apps Script** sends the shared `PUBLISH_SECRET`.
- **Cloud Scheduler** sends a Google OIDC token for `SCHEDULER_SA_EMAIL`, with `SERVICE_URL` as
  its audience.
- **Admins** may start `/reminders` with their Keycloak access token.

Anything else gets `401`.

### Editing endpoints

All of these are under `/api`, need a Keycloak access token as `Authorization: Bearer <token>`,
and are never cached. Firebase Hosting forwards `/api/**` from the site to this service.

| Method and path                          | Who may call          | What it does                                      |
| ---------------------------------------- | --------------------- | ------------------------------------------------- |
| `GET /api/me`                            | anyone signed in      | Their markers, offers, email and reminder switch. |
| `PUT /api/me/reminders`                  | anyone signed in      | `{"on": true}` or `false`: their reminders.       |
| `GET /api/accounts?q=`                   | anyone signed in      | Up to 10 accounts: username and name only.        |
| `GET /api/accounts/:username`            | anyone signed in      | One account's username and name, or `404`.        |
| `GET /api/markers/:id`                   | editor, owner, admin  | The form's values. Private fields not to editors. |
| `POST /api/markers`                      | anyone signed in      | Adds a marker; they become its owner.             |
| `PATCH /api/markers/:id`                 | editor, owner, admin  | Saves the form. `409` if the marker has changed.  |
| `POST /api/markers/:id/confirm`          | editor, owner, admin  | "Still current".                                  |
| `POST /api/markers/:id/close`            | owner, admin          | Closes a site; it stays on the map.               |
| `POST /api/markers/:id/reopen`           | owner, admin          | Reopens a closed site; restarts the clock.        |
| `DELETE /api/markers/:id`                | owner, admin          | Sets `status` to `deleted`; the row stays.        |
| `POST /api/markers/:id/editors`          | owner, admin          | Adds an editor by OpenMRS ID.                     |
| `DELETE /api/markers/:id/editors/:name`  | owner, admin          | Removes an editor.                                |
| `POST /api/markers/:id/transfer`         | owner, admin          | Offers ownership.                                 |
| `DELETE /api/markers/:id/transfer`       | owner, admin          | Cancels the offer.                                |
| `POST /api/markers/:id/transfer/accept`  | the offer's recipient | Accepts; the old owner becomes an editor.         |
| `POST /api/markers/:id/transfer/decline` | the offer's recipient | Declines.                                         |
| `POST /api/logos`                        | anyone signed in      | Stores a logo, returns its URL.                   |

Account searches need 3 characters and are limited to 30 a minute per person. Adding an editor,
offering a transfer and an admin setting an owner check that the OpenMRS ID exists and is enabled.

### Emailed-link endpoints

These work **without** signing in, for the "Still current" and "Unsubscribe" links in reminder
emails. Each takes `{"token": "..."}`, a signed link token from the URL fragment of
`/reminder#<token>`. They are mounted ahead of the sign-in check and have no account access.

| Method and path                  | What it does                                                          |
| -------------------------------- | --------------------------------------------------------------------- |
| `POST /api/reminder/view`        | What the page shows. Changes nothing.                                 |
| `POST /api/reminder/confirm`     | "Still current": works once, for 30 days, while `confirmed_at` holds. |
| `POST /api/reminder/unsubscribe` | Adds the link's OpenMRS ID to `unsubscribed`.                         |

Saved changes publish straight away unless nothing public changed. All sheet writes and publishes
run one at a time through a queue in memory, so the service must run as **one instance**
(`--max-instances=1`, set by the CI deploy).

### Files written to the bucket

| File                        | Cache-Control             |
| --------------------------- | ------------------------- |
| `atlas.json`                | `public, max-age=300`     |
| `markers.geojson`           | `public, max-age=300`     |
| `markers.csv`               | `public, max-age=300`     |
| `rss.xml`                   | `public, max-age=300`     |
| `history/atlas-<time>.json` | `no-store` (kept 90 days) |

All of them are stored gzipped. Clients that don't accept gzip are served the plain file.

A publish is refused if it would publish fewer than 80% of the markers in the current
`atlas.json`. The reason is then written to the first row of `problems`, and the public files are
left alone.

## Configuration

| Variable                         | Purpose                                                             |
| -------------------------------- | ------------------------------------------------------------------- |
| `SHEET_ID`                       | The Atlas sheet. The service account needs edit access to it.       |
| `BUCKET`                         | The public bucket.                                                  |
| `PUBLISH_SECRET`                 | Shared secret for the Apps Script (from Secret Manager).            |
| `SCHEDULER_SA_EMAIL`             | Service account the nightly Cloud Scheduler job signs in as.        |
| `SERVICE_URL`                    | This service's URL, the audience of the scheduler's OIDC token.     |
| `STORAGE_ENDPOINT`               | Local development only: fake-gcs-server, `http://localhost:4443`.   |
| `PORT`                           | Default 8080.                                                       |
| `KEYCLOAK_ISSUER`                | Keycloak realm URL. Without it and the next one, `/api` is `503`.   |
| `KEYCLOAK_CLIENT_ID`             | The Atlas client in that realm: `atlas`.                            |
| `SITE_URL`                       | The public site, for links in the feed and email. Required.         |
| `KEYCLOAK_SERVICE_CLIENT_ID`     | `atlas-service`. Without it and its secret, IDs go unchecked.       |
| `KEYCLOAK_SERVICE_CLIENT_SECRET` | Secret `atlas-keycloak-service-secret`.                             |
| `MANDRILL_API_KEY`               | Secret `atlas-mandrill-api-key`. Without it, no email is sent.      |
| `LINK_SIGNING_KEY`               | Secret `atlas-link-signing-key`. Without it, no reminders.          |
| `EMAIL_FROM`                     | Default `OpenMRS Atlas <atlas-noreply@openmrs.org>`.                |
| `EMAIL_ALLOWLIST`                | Comma-separated. Set: only these get email. Unset or `*`: everyone. |
| `NOTICE_EMAIL`                   | Gets a notice for each marker added. Unset: no notices.             |

## Keycloak

Staging uses `https://id-stg.openmrs.org/realms/openmrs` and production
`https://id.openmrs.org/realms/openmrs`. The issuer and client id are the variables
`KEYCLOAK_ISSUER` and `KEYCLOAK_CLIENT_ID` in each GitHub environment (see
[`infra/README.md`](../infra/README.md)); the deploy gives them to both this service and the site's
build. The client needs:

- **Client authentication** and **Authorization** off: it is a public client, as a browser can't
  keep a secret. **Standard flow** on, and **Require PKCE** with **S256**.
- The site's root as **Root URL**, **Home URL**, **Valid redirect URIs** and **Valid post logout
  redirect URIs**, and its origin (no trailing slash) as **Web origins**.
- A **Group Membership** mapper on its dedicated scope: token claim name `groups`, **Full group
  path** off, **Add to access token** on. `preferred_username` comes with the `profile` scope.

### The `atlas-service` client

The service reads accounts through a second, confidential client, `atlas-service`, to check
OpenMRS IDs, search by name and find the email for reminders. It needs:

- **Client authentication** on, and only **Service accounts roles** enabled: no standard flow,
  no direct access grants, no redirect URIs.
- On its **Service account roles** tab, only the `realm-management` role `view-users`.

Its secret is `atlas-keycloak-service-secret` in Secret Manager, read only by `atlas-service@`. It
is never sent to the browser. If it leaks, regenerate it in Keycloak and add a new secret version.

Members of the group `atlas-administrators` are Atlas admins. Anyone who can change that group can
make themselves an admin and see contact details, so keep Keycloak's own admin list short.

## Running locally

```sh
docker compose up -d                      # fake-gcs-server, bucket atlas-local
SHEET_ID=<your test sheet> BUCKET=atlas-local STORAGE_ENDPOINT=http://localhost:4443 \
  SITE_URL=http://localhost:5173 PUBLISH_SECRET=local node service/src/server.ts
curl -X POST -H "Authorization: Bearer local" http://localhost:8080/publish
```

Node 24 runs the TypeScript sources directly, so there's no build step. The container image does
the same:

```sh
docker build -f service/Dockerfile -t atlas-service .
```

## Rolling back a bad publish

Every publish also writes `history/atlas-<time>.json`. To put an earlier snapshot back:

```sh
gcloud storage ls gs://<bucket>/history/ | tail -5
gcloud storage cp gs://<bucket>/history/atlas-<time>.json gs://<bucket>/atlas.json \
  --cache-control="public, max-age=300" --content-type=application/json
```

`markers.csv` and `markers.geojson` catch up at the next publish. Fix the sheet first, or the
next publish (at the latest, the nightly one) will publish the bad data again.
