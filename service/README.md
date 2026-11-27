# Atlas publish service

A small HTTP service, run as one Docker container per environment (see
[`infra/README.md`](../infra/README.md)). It reads the Atlas sheet, validates it, publishes the
public snapshot files to its data folder, makes every change people save on the site, and serves
the map site and the published files.

## Endpoints

| Method and path            | Who may call                                      | What it does                                                                                                                       |
| -------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`              | anyone                                            | `{"ok":true,"environment":…,"commit":…}`                                                                                           |
| `POST /publish`            | the sheet's Apps Script                           | Validates the sheet, rewrites `problems`, and publishes unless the safety check refuses. `200` when published, `409` when refused. |
| `POST /publish?force=true` | the sheet's Apps Script ("Atlas › Force publish") | The same, but skips the safety check.                                                                                              |
| `POST /reminders`          | a signed-in admin                                 | Sends due reminder emails, at most 50 a day, and records each outcome in `reminders`.                                              |
| `GET /marker/:id`          | anyone                                            | A page with link preview tags that hands over to `/?marker=<id>`. `404` for unpublished ids.                                       |
| `GET /marker/:id/card.png` | anyone                                            | `302` to the marker's current social card, or `404`.                                                                               |

Callers authenticate with `Authorization: Bearer <token>`:

- **Apps Script** sends the shared `PUBLISH_SECRET`.
- **Admins** may start `/reminders` with their Keycloak access token.

Anything else gets `401`.

### Daily jobs

The service starts its own daily jobs (specs/deployment), at 03:00 UTC the nightly publish and at
14:00 UTC the reminder job. The nightly publish is the only one that draws every card, sweeps
unused logos and deletes history more than 90 days old. Each run logs `job-scheduled` for its
next run; a run still going when the next is due is skipped (`job-skipped`), and a failure is
logged as `job-failed`. If the container is down at 03:00, that night's run is missed and the
next one catches up. `SCHEDULED_JOBS=off` turns both jobs off, for local development.

### The site and the published files

The service also serves what Firebase Hosting and the bucket used to:

| Path                                                         | What                                   | Cache-Control                                |
| ------------------------------------------------------------ | -------------------------------------- | -------------------------------------------- |
| `/`, `/reminder`                                             | The map and reminder pages (`WEB_DIR`) | `no-cache`, with the Content-Security-Policy |
| `/assets/*`                                                  | Vite's hashed bundles                  | `public, max-age=31536000, immutable`        |
| Other site files (icons, badges)                             |                                        | `public, max-age=3600`                       |
| `/data/atlas.json`, `markers.csv`, `markers.geojson`, `/rss` | Published files (`DATA_DIR`)           | `public, max-age=300`                        |
| `/data/logos/<name>`                                         | Logos                                  | `public, max-age=31536000`                   |
| `/data/cards/<name>`                                         | Social cards                           | as in the table below                        |

Nothing else in `DATA_DIR` is served: `history/` and any other path answer `404`. Addresses
ending in `.html` redirect to the clean address (`/reminder.html` to `/reminder`). Every response
gets `X-Content-Type-Options: nosniff` and a `Permissions-Policy`, and text is gzipped for
clients that accept it. The Content-Security-Policy (`src/site.ts`) allows only the site itself,
OpenFreeMap, Nominatim, `KEYCLOAK_ISSUER`'s host and Google Analytics.

### Editing endpoints

All of these are under `/api`, need a Keycloak access token as `Authorization: Bearer <token>`,
and are never cached.

| Method and path                               | Who may call          | What it does                                                                |
| --------------------------------------------- | --------------------- | --------------------------------------------------------------------------- |
| `GET /api/me`                                 | anyone signed in      | Their markers, offers, claims, email and reminder switch.                   |
| `PUT /api/me/reminders`                       | anyone signed in      | `{"on": true}` or `false`: their reminders.                                 |
| `POST /api/me/confirm-recent`                 | anyone signed in      | Confirms their markers confirmed under 12 months ago (sent once per visit). |
| `GET /api/accounts?q=`                        | anyone signed in      | Up to 10 accounts: username and name only.                                  |
| `GET /api/accounts/:username`                 | anyone signed in      | One account's username and name, or `404`.                                  |
| `GET /api/markers/:id`                        | editor, owner, admin  | The form's values. Private fields not to editors.                           |
| `POST /api/markers`                           | anyone signed in      | Adds a marker; they become its owner.                                       |
| `PATCH /api/markers/:id`                      | editor, owner, admin  | Saves the form. `409` if the marker has changed.                            |
| `POST /api/markers/:id/confirm`               | editor, owner, admin  | "Still current", and "Update" in My markers.                                |
| `POST /api/markers/:id/close`                 | owner, admin          | Closes a site; it stays on the map.                                         |
| `POST /api/markers/:id/reopen`                | owner, admin          | Reopens a closed site; restarts the clock.                                  |
| `DELETE /api/markers/:id`                     | owner, admin          | Sets `status` to `deleted`; the row stays.                                  |
| `POST /api/markers/:id/editors`               | owner, admin          | Adds an editor by OpenMRS ID.                                               |
| `DELETE /api/markers/:id/editors/:name`       | owner, admin          | Removes an editor.                                                          |
| `POST /api/markers/:id/transfer`              | owner, admin          | Offers ownership.                                                           |
| `DELETE /api/markers/:id/transfer`            | owner, admin          | Cancels the offer.                                                          |
| `POST /api/markers/:id/transfer/accept`       | the offer's recipient | Accepts; the old owner becomes an editor.                                   |
| `POST /api/markers/:id/transfer/decline`      | the offer's recipient | Declines.                                                                   |
| `POST /api/markers/:id/claims`                | anyone signed in      | `{"message"}`: claims a marker with no owner.                               |
| `DELETE /api/markers/:id/claims/:claim`       | the claimant          | Withdraws the claim.                                                        |
| `POST /api/markers/:id/claims/:claim/approve` | admin                 | Makes the claimant the owner; declines other claims.                        |
| `POST /api/markers/:id/claims/:claim/decline` | admin                 | `{"reason"}` (optional): declines the claim.                                |
| `POST /api/logos`                             | anyone signed in      | Stores a logo, returns its URL.                                             |

Account searches need 3 characters and are limited to 30 a minute per person. Adding an editor,
offering a transfer and an admin setting an owner check that the OpenMRS ID exists and is enabled.

Untrusted input (specs/marker-editing, specs/user-sign-in):

- **Daily limits.** People who aren't admins can add 5 markers and upload 20 logos a day (UTC).
  Past a limit they get 429 and "try again tomorrow". A use is counted when the request arrives,
  so requests sent at once can't get past the limit, and is given back if the request fails.
  Counts are kept in memory for the current UTC day only, so a restart resets them.
- **Logo addresses.** Through the API, `logo_url` must be blank or under `<SITE_URL>/data/logos/`,
  where uploads go. Admins can still type any address in the sheet. To move every address from
  one place to another (the old bucket, say), see "Moving logo addresses" below.
- **Logo sweep.** The nightly publish deletes files in `logos/` that no `markers` row uses, of
  any status, once they are more than a day old (log event `logos-swept`). It deletes nothing if
  that would be more than 20 files, or more than half the folder (when over 5 files), or if the
  tab has no `logo_url` column. Those look like a sheet mistake, such as a cleared column. Every
  publish then puts a "logo sweep held back" note in `problems` until the sheet is fixed, and the
  nightly run logs `logos-sweep-held-back`. If the files really are unused, delete them by hand.
  A deleted logo can be restored from the host's backups (infra README, "Restoring a file").
- **Access tokens only.** A token must have `typ: Bearer`, so a Keycloak ID token is refused.

Claims (specs/marker-claims) are rows in the sheet's private `claims` tab, kept with their
decision. `GET /api/me` lists the markers a person may claim (`claimable`), their own pending
`claims` and, for admins, every pending claim with its message (`review`). Each claim emails
`NOTICE_EMAIL`; each decision emails the claimant, whose address is looked up in Keycloak during
the admin's request and never stored or logged. An admin setting an owner in the form declines
that marker's pending claims. A new environment's sheet needs `npm run setup:sheet` to add the tab.

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
run one at a time through a queue in memory, so each environment must run **one container**.

### Files in the data folder

Every file the service writes is in `DATA_DIR` (`/atlas_data` in the image, a volume the host
backs up), under the names the Cloud Storage bucket used:

| File                        | Served at                                  |
| --------------------------- | ------------------------------------------ |
| `atlas.json`                | `/data/atlas.json`                         |
| `markers.geojson`           | `/data/markers.geojson`                    |
| `markers.csv`               | `/data/markers.csv`                        |
| `rss.xml`                   | `/rss`                                     |
| `history/atlas-<time>.json` | not served (the nightly run keeps 90 days) |
| `logos/<name>.webp`         | `/data/logos/<name>.webp`                  |
| `cards/…`                   | `/data/cards/…`                            |

Each file is written to a temporary file beside it and then renamed into place, so a visitor
gets the old file or the new one whole, never part of one.

Social cards (specs/social-cards) are written after a successful publish:

| File                    | Cache-Control                         |
| ----------------------- | ------------------------------------- |
| `cards/<id>-<hash>.png` | `public, max-age=31536000, immutable` |
| `cards/world.png`       | `public, max-age=3600`                |
| `cards/manifest.json`   | `public, max-age=300`                 |

A card's name changes whenever what it shows changes (name, country, sites, status or position),
so previews of a fresh share show the new card. The nightly publish draws every
missing or out-of-date card and deletes card files the manifest no longer names. Every other
publish draws at most 10. The world image is redrawn only when it would look different (the
manifest's `world` field holds a hash of what it shows) and by every nightly publish, and the
manifest is rewritten only when it changes. A failure drawing cards is logged (`cards-failed`, `card-failed`) and
never stops the publish. The `/marker` pages read `atlas.json` and the manifest, kept in memory for
a minute, and never the sheet. When a marker or its card is missing from what's in memory, they
read both again (at most every 5 seconds, shared by concurrent requests), so a marker shared the
moment it is added previews correctly: LinkedIn and Facebook keep the first answer for days. Pages
are cached for 5 minutes, and 404s for 1 minute.

### Website badges

The "On the OpenMRS Atlas" badges that the Share dialog offers are static files served by the
site, at `/badges/on-the-atlas-light.svg` and `/badges/on-the-atlas-dark.svg` (200 × 44). Other
websites link to them, so their addresses must never change. They are drawn by
`src/cards/badge.ts` with the card font, so the text is outlines and the files load nothing else.
After changing the design, the font or the logo, regenerate and commit them:

```sh
npm run badges -w service
```

A test fails if the committed files don't match the generator.

A publish is refused if it would publish fewer than 80% of the markers in the current
`atlas.json`. The reason is then written to the first row of `problems`, and the public files are
left alone.

### Moving logo addresses

`logo_url` cells hold full addresses. When logos move (from the Cloud Storage bucket to
`/data/logos/`, or back for a rollback), rewrite every address that starts with one prefix to
start with another. Run it from the repository root. It reads the sheet's key from
`GOOGLE_SERVICE_ACCOUNT_KEY` in the environment, not from `.env`, so load `.env` first. Without
the key it falls back to your own gcloud login, which usually can't open the sheet ("The caller
does not have permission"):

```sh
set -a && . ./.env && set +a      # GOOGLE_SERVICE_ACCOUNT_KEY and SHEET_ID
npm run move:logos -w service -- "$SHEET_ID" \
  --from https://storage.googleapis.com/openmrs-atlas-stg/logos/ \
  --to https://atlas-stg.openmrs.org/data/logos/     # a preview: writes nothing
# then the same again with --apply
```

It changes only matching `logo_url` cells, in one write. Like an admin's own sheet edit, it
doesn't restart anyone's freshness clock or add to the change feed. Running it twice is harmless.
Copy the logo files first, then publish afterwards.

## Types, distributions and versions

The `types`, `distributions` and `versions` tabs are the lists the form offers (specs/marker-data).
Admins edit them in the sheet. Each edit publishes within about a minute.

- **Types are a fixed list.** A marker whose `type` isn't on `types` is a problem and stays off
  the map until it's fixed.
- **Distributions and versions are a list plus "Other".** A marker's `distribution` or
  `openmrs_version` can be any text. A value that isn't on its list is an _Other_ value. It's
  shown by name in the marker's details, and it's grouped under one "Other" in the legend and the
  filters. In the form, "Other" gives a text field of up to 30 characters for a distribution and
  12 for a version. `Other` on its own means Other with no detail.
- **Case doesn't matter.** "bahmni", typed in the form or the sheet, is saved and published as
  "Bahmni".
- **Changing a list changes the grouping, not the markers.** Adding "iSantePlus" to
  `distributions` takes every marker that already says iSantePlus out of Other. Deleting or
  renaming an entry puts its markers into Other, with their value kept. A row named "Other" is
  ignored.
- `distributions` has only `name` and `url`. An old `is_standard` column is ignored.

## Configuration

| Variable                         | Purpose                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `SHEET_ID`                       | The Atlas sheet. The service account needs edit access to it.      |
| `GOOGLE_SERVICE_ACCOUNT_KEY`     | The service account's JSON key, as is or base64. Unset: local ADC. |
| `PUBLISH_SECRET`                 | Shared secret for the Apps Script.                                 |
| `DATA_DIR`                       | The data folder. Default `/atlas_data`.                            |
| `WEB_DIR`                        | The built map site. Default `web/dist` beside the service.         |
| `ATLAS_ENVIRONMENT`              | Built into the image: `staging` or `production`. See below.        |
| `ATLAS_COMMIT`                   | Built into the image: the commit, reported by `/health`.           |
| `SCHEDULED_JOBS`                 | `off` turns the daily jobs off. Default on.                        |
| `PORT`                           | Default 8080.                                                      |
| `KEYCLOAK_ISSUER`                | Keycloak realm URL. Without it and the next one, `/api` is `503`.  |
| `KEYCLOAK_CLIENT_ID`             | The Atlas client in that realm: `atlas`.                           |
| `SITE_URL`                       | The public site, for links in the feed and email. Required.        |
| `KEYCLOAK_SERVICE_CLIENT_ID`     | `atlas-service`. Without it and its secret, IDs go unchecked.      |
| `KEYCLOAK_SERVICE_CLIENT_SECRET` | The `atlas-service` client's secret.                               |
| `MANDRILL_API_KEY`               | Without it, no email is sent.                                      |
| `LINK_SIGNING_KEY`               | Signs emailed links. Without it, no reminders.                     |
| `EMAIL_FROM`                     | Default `OpenMRS Atlas <atlas-noreply@openmrs.org>`.               |
| `EMAIL_ALLOWLIST`                | Commas or spaces: only these get email. See below.                 |
| `NOTICE_EMAIL`                   | Gets a notice for each marker added or claimed. Unset: no notices. |

`EMAIL_ALLOWLIST` depends on `ATLAS_ENVIRONMENT` (specs/deployment). In the production image,
unset or `*` means everyone. In any other image, including one run with no environment, unset
means no one, and `*` stops the service at start-up with the reason in its log. Only the
production image is built with Google Analytics.

## Keycloak

Staging uses `https://id-stg.openmrs.org/realms/openmrs` and production
`https://id.openmrs.org/realms/openmrs`. The issuer and client id are the variables
`KEYCLOAK_ISSUER` and `KEYCLOAK_CLIENT_ID` in each GitHub environment (see
[`infra/README.md`](../infra/README.md)), which the deploy builds into the site. The service gets
the same two values from the host's settings. The client needs:

- **Client authentication** and **Authorization** off: it is a public client, as a browser can't
  keep a secret. **Standard flow** on, and **Require PKCE** with **S256**.
- The site's root as **Root URL**, **Home URL**, **Valid redirect URIs** and **Valid post logout
  redirect URIs**, and its origin (no trailing slash) as **Web origins**.
- A **Group Membership** mapper on its dedicated scope: token claim name `groups`, **Full group
  path** off, **Add to access token** on. `preferred_username` comes with the `profile` scope.
- `offline_access` as an **Optional** client scope (Keycloak's default), for "Keep me signed in
  on this device", and the realm's `basic` scope as a **Default** client scope, whose `auth time`
  mapper puts `auth_time` in access tokens.

### Staying signed in

These rules come from specs/user-sign-in.

- **Kept across tabs and visits.** The site keeps the sign-in in the browser's `localStorage`,
  and renews it quietly while Keycloak's normal session lasts. In both realms that is 30 minutes
  idle and 10 hours at most.
- **"Keep me signed in on this device".** Ticking it asks for `offline_access`, so the sign-in
  lasts as long as Keycloak's **offline** session: until it has gone unused for the realm's
  _Offline Session Idle_, which is 30 days in both realms, with no maximum. The sign-in panel's
  hint says "30 days", so update it in `web/src/components/SignInPanel.tsx` if the realm setting
  changes.
- **Signing out** revokes the refresh token, which ends a kept sign-in's offline session, then
  ends Keycloak's session. People can also revoke "offline access" for the Atlas on their
  Keycloak account page.
- **Weighty actions need a sign-in within the last 10 minutes,** however long the session has
  run: offering a marker to a new owner, and anything only admin rights allow (another person's
  marker, setting an owner, editors or status, reviewing claims, `POST /reminders`). Without one,
  the service answers 401 with `{"code": "sign-in-again"}`. The site keeps what was typed and
  sends the person to Keycloak with `max_age=0` to enter their password. The time comes from the
  token's `auth_time`. A token without it never counts as recent, and the service logs
  `auth-time-missing` once.

### The `atlas-service` client

The service reads accounts through a second, confidential client, `atlas-service`, to check
OpenMRS IDs, search by name and find the email for reminders. It needs:

- **Client authentication** on, and only **Service accounts roles** enabled: no standard flow,
  no direct access grants, no redirect URIs.
- On its **Service account roles** tab, only the `realm-management` role `view-users`.

Its secret is `KEYCLOAK_SERVICE_CLIENT_SECRET` in the host's settings for the environment. It is
never sent to the browser. If it leaks, regenerate it in Keycloak and update the setting.

Members of the group `atlas-administrators` are Atlas admins. Anyone who can change that group can
make themselves an admin and see contact details, so keep Keycloak's own admin list short.

## Running locally

```sh
SHEET_ID=<your test sheet> DATA_DIR=.data SITE_URL=http://localhost:5173 PUBLISH_SECRET=local \
  SCHEDULED_JOBS=off node service/src/server.ts
curl -X POST -H "Authorization: Bearer local" http://localhost:8080/publish
```

This reaches the sheet with Application Default Credentials, set up as in the root README's
"Test sheet" section, or with `GOOGLE_SERVICE_ACCOUNT_KEY`. Published files land in `.data/`
(git-ignored). With the service running, `npm run dev -w web`
forwards `/api`, `/data`, `/rss` and `/marker` to it. Node 24 runs the TypeScript sources
directly, so there's no build step for the service. The container image adds the built map site;
see [`infra/README.md`](../infra/README.md) for building and running it.

## Timing logs

Every request under `/api` logs one `timing` line, and every publish logs one `publish-timing`
line. They show where the time went:

```json
{"event":"timing","route":"POST /api/markers/:id/editors","status":200,"total_ms":1840,
 "steps":{"auth.verify":{"ms":12,"n":1},"sheet.readEdits":{"ms":310,"n":1},
          "accounts.check":{"ms":220,"n":1},"sheet.updateCells":{"ms":280,"n":1}, "...": {},
          "publish":{"ms":930,"n":1}}}
{"event":"publish-timing","caller":"edit","result":"published","total_ms":925,"steps":{"...": {}}}
```

- `route` is the route pattern, never the path, so a username in the path isn't logged. The lines
  hold only step names, times and counts: no emails, usernames or sheet data.
- Each step's `ms` is the total for its `n` calls. Steps that run together (the snapshot uploads,
  or the change-log entry and the row check) add up to more than `total_ms`.
- Step names: `sheet.*` (Sheets calls), `files.*` (snapshot files), `cards.*` and `logos.*`
  (the data folder's cards and logos), `accounts.*` (Keycloak lookups), `auth.verify` (checking the
  sign-in token), `draw.png` (drawing a card) and `publish` (the whole publish after an edit,
  detailed in its own `publish-timing` line).

The service logs one JSON object per line to standard output. To find slow requests on the host:

```sh
docker logs <container> 2>&1 | grep '"event":"timing"' | jq -c 'select(.total_ms > 2000)'
```

## Rolling back a bad publish

Every publish also writes `history/atlas-<time>.json`. To put an earlier snapshot back:

```sh
docker exec <container> ls /atlas_data/history | tail -5
docker exec <container> cp /atlas_data/history/atlas-<time>.json /atlas_data/atlas.json
```

`markers.csv` and `markers.geojson` catch up at the next publish. Fix the sheet first, or the
next publish (at the latest, the nightly one) will publish the bad data again.
