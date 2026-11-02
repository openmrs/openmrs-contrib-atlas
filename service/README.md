# Atlas publish service

A small HTTP service on Cloud Run. It reads the Atlas sheet, validates it, publishes the public
snapshot files to Cloud Storage, and makes every change people save on the site.

## Endpoints

| Method and path            | Who may call                                      | What it does                                                                                                                       |
| -------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`              | anyone                                            | `{"ok":true}`                                                                                                                      |
| `POST /publish`            | the sheet's Apps Script, or Cloud Scheduler       | Validates the sheet, rewrites `problems`, and publishes unless the safety check refuses. `200` when published, `409` when refused. |
| `POST /publish?force=true` | the sheet's Apps Script ("Atlas › Force publish") | The same, but skips the safety check.                                                                                              |

Callers authenticate with `Authorization: Bearer <token>`:

- **Apps Script** sends the shared `PUBLISH_SECRET`.
- **Cloud Scheduler** sends a Google OIDC token for `SCHEDULER_SA_EMAIL`, with `SERVICE_URL` as
  its audience.

Anything else gets `401`.

### Editing endpoints

All of these are under `/api`, need a Keycloak access token as `Authorization: Bearer <token>`,
and are never cached. Firebase Hosting forwards `/api/**` from the site to this service.

| Method and path                          | Who may call          | What it does                                      |
| ---------------------------------------- | --------------------- | ------------------------------------------------- |
| `GET /api/me`                            | anyone signed in      | Their markers and the offers waiting for them.    |
| `GET /api/markers/:id`                   | editor, owner, admin  | The form's values. Private fields not to editors. |
| `POST /api/markers`                      | anyone signed in      | Adds a marker; they become its owner.             |
| `PATCH /api/markers/:id`                 | editor, owner, admin  | Saves the form. `409` if the marker has changed.  |
| `POST /api/markers/:id/confirm`          | editor, owner, admin  | "Still current".                                  |
| `DELETE /api/markers/:id`                | owner, admin          | Sets `status` to `deleted`; the row stays.        |
| `POST /api/markers/:id/editors`          | owner, admin          | Adds an editor by OpenMRS ID.                     |
| `DELETE /api/markers/:id/editors/:name`  | owner, admin          | Removes an editor.                                |
| `POST /api/markers/:id/transfer`         | owner, admin          | Offers ownership.                                 |
| `DELETE /api/markers/:id/transfer`       | owner, admin          | Cancels the offer.                                |
| `POST /api/markers/:id/transfer/accept`  | the offer's recipient | Accepts; the old owner becomes an editor.         |
| `POST /api/markers/:id/transfer/decline` | the offer's recipient | Declines.                                         |
| `POST /api/logos`                        | anyone signed in      | Stores a logo, returns its URL.                   |

Saved changes publish straight away unless nothing public changed. All sheet writes and publishes
run one at a time through a queue in memory, so the service must run as **one instance**
(`--max-instances=1`, set by the CI deploy).

### Files written to the bucket

| File                        | Cache-Control             |
| --------------------------- | ------------------------- |
| `atlas.json`                | `public, max-age=300`     |
| `markers.geojson`           | `public, max-age=300`     |
| `markers.csv`               | `public, max-age=300`     |
| `history/atlas-<time>.json` | `no-store` (kept 90 days) |

All of them are stored gzipped. Clients that don't accept gzip are served the plain file.

A publish is refused if it would publish fewer than 80% of the markers in the current
`atlas.json`. The reason is then written to the first row of `problems`, and the public files are
left alone.

## Configuration

| Variable             | Purpose                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `SHEET_ID`           | The Atlas sheet. The service account needs edit access to it.     |
| `BUCKET`             | The public bucket.                                                |
| `PUBLISH_SECRET`     | Shared secret for the Apps Script (from Secret Manager).          |
| `SCHEDULER_SA_EMAIL` | Service account the nightly Cloud Scheduler job signs in as.      |
| `SERVICE_URL`        | This service's URL, the audience of the scheduler's OIDC token.   |
| `STORAGE_ENDPOINT`   | Local development only: fake-gcs-server, `http://localhost:4443`. |
| `PORT`               | Default 8080.                                                     |
| `KEYCLOAK_ISSUER`    | Keycloak realm URL. Without it and the next one, `/api` is `503`. |
| `KEYCLOAK_CLIENT_ID` | The Atlas client in that realm: `atlas`.                          |

## Keycloak

Staging uses `https://id-stg.openmrs.org/realms/openmrs`. The issuer and client id are the
repository variables `KEYCLOAK_ISSUER` and `KEYCLOAK_CLIENT_ID`; the CI deploy gives them to both
this service and the site's build, so moving to production Keycloak changes only those. The client needs:

- **Client authentication** and **Authorization** off: it is a public client, as a browser can't
  keep a secret. **Standard flow** on, and **Require PKCE** with **S256**.
- The site's root as **Root URL**, **Home URL**, **Valid redirect URIs** and **Valid post logout
  redirect URIs**, and its origin (no trailing slash) as **Web origins**.
- A **Group Membership** mapper on its dedicated scope: token claim name `groups`, **Full group
  path** off, **Add to access token** on. `preferred_username` comes with the `profile` scope.

Members of the group `atlas-administrators` are Atlas admins. Anyone who can change that group can
make themselves an admin and see contact details, so keep Keycloak's own admin list short.

## Running locally

```sh
docker compose up -d                      # fake-gcs-server, bucket atlas-local
SHEET_ID=<your test sheet> BUCKET=atlas-local STORAGE_ENDPOINT=http://localhost:4443 \
  PUBLISH_SECRET=local node service/src/server.ts
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
