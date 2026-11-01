# Atlas publish service

A small HTTP service on Cloud Run. It reads the Atlas sheet, validates it, and publishes the
public snapshot files to Cloud Storage. Phase 2 adds the edit endpoints here.

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
