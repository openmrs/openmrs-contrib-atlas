# Design

## Context

The service already does every write through one in-memory queue on a single Cloud Run instance, logs Atlas edits to the private `changes` tab, and publishes after each write and nightly from Cloud Scheduler. It verifies Keycloak sign-in tokens against the realm's public keys and holds no Keycloak credentials. Owners and editors are stored by OpenMRS ID in the `private` tab, unchecked. The web app is a static Vite build on Firebase Hosting, with `/api/**` forwarded to the service and the data files redirected to the bucket.

Atlas 2.0 sent no reminders. Its `/rss` feed listed new and updated markers from an in-memory list that was lost on every restart.

## Goals / Non-Goals

**Goals:**
- Get stale markers confirmed or closed with as little effort from implementers and admins as possible.
- Reach people at the address they expect: the email on their OpenMRS ID.
- Stop typos in OpenMRS IDs from silently granting access to nobody.
- Never mail real implementers from staging.
- Keep `/rss` working for existing subscribers.
- No new runtime dependencies and no database.

**Non-Goals:**
- Any write to Keycloak.
- Transfer emails, the contact relay form (Phase 3).
- A preference centre, or per-marker unsubscribe.

## Decisions

### A read-only Keycloak client used only by the service
A confidential client `atlas-service` with client authentication on, only "Service accounts roles" enabled (no standard or direct-access flow, no redirect URIs), and its service account given just the `realm-management` role `view-users`. That composite brings `query-users` and `query-groups`; nothing that can change data. The service gets a token with the client-credentials grant, caches it until shortly before it expires, and calls:

| Need | Call |
|---|---|
| Check an ID | `GET /admin/realms/openmrs/users?username=<id>&exact=true&briefRepresentation=true` |
| Search | `GET /admin/realms/openmrs/users?search=<text>&max=10&briefRepresentation=true` |
| Email for a reminder | the exact-username call above, which includes `email` and `enabled` |

`view-users` lets the client read any account's profile, including email; Keycloak can't narrow which fields it sees. So the boundary is the service: what triggers a lookup and what leaves it.

- **Triggers.** The Keycloak client is passed only to the signed-in API (behind the existing token check) and to the reminder job (behind the scheduler or admin check). The emailed-link routes and `/publish` are built without it, so they can't call it. A test drives every route without a token and asserts the client was never called.
- **What leaves.** Search and check return `{ username, name }` only. The one email ever returned is a person's own, read from their own sign-in token, not from the admin API. Emails are never written to the sheet or logs; `reminders` and `unsubscribed` hold usernames.
- **Abuse.** Search needs 3 characters, returns at most 10 enabled accounts, and is limited to 30 a minute per person in memory (one instance makes that enough).
- **Leak response.** If the secret leaks, the exposure is read access to the account directory. Regenerating the client secret in Keycloak and updating Secret Manager ends it.

The current user's email for My markers comes from the `email` claim in their access token, which the `email` scope adds by default. Nothing new is needed on the public `atlas` client.

Disabled accounts are treated as not found for checks and search, and skipped for reminders.

### Reminders go to owners and editors, one email per person
For each due marker the job collects the owner and editors, drops anyone in `unsubscribed`, and looks up each remaining username once per run. Due markers are then grouped by person, so someone with five stale markers gets one email with five entries. Markers with no owner and no editors are recorded as skipped (`no owner`). The 85 orphans keep waiting for admins to assign owners.

The contact email is not used. People may give the Atlas a different address for contact than their OpenMRS ID uses, and the relay form in Phase 3 is where it belongs.

### Links are signed, and bound to `confirmed_at`
A link token is `base64url(payload).base64url(HMAC-SHA256(payload))`, keyed by a new `LINK_SIGNING_KEY` secret. A confirm token holds the purpose, the marker id, the marker's `confirmed_at` when sent, the recipient's username (for the log) and an expiry 30 days out. The service accepts it only when the signature matches, it hasn't expired, the marker is `active`, and its `confirmed_at` still equals the one in the token. Confirming changes `confirmed_at`, so a used link stops working, and so do the links sent to the marker's other people and any link for a marker confirmed another way. Single use needs no stored state.

An unsubscribe token holds the purpose and the username, with the same expiry rule except it lasts a year, since people unsubscribe from old mail. Neither token holds an email address. Neither route touches Keycloak: confirm needs only the sheet, and unsubscribe writes the username from the token.

### Tokens travel in the URL fragment, and only a button press acts
Links point to `https://<site>/reminder#<token>`. Browsers never send the fragment to a server, so tokens stay out of Firebase and Cloud Run request logs. `/reminder` is a second, small Vite page (no map) that reads the fragment, POSTs it to `/api/reminder/view` to show the marker, and POSTs to `/api/reminder/confirm` or `/api/reminder/unsubscribe` only when the person presses the button. Mail scanners that fetch links press no button, so they change nothing.

"Update details" and "This site has closed" are plain `/?marker=<id>` links; the map opens on the marker and the usual sign-in applies.

### A daily job, idempotent through the `reminders` tab
Cloud Scheduler calls `POST /reminders` daily at 14:00 UTC, early afternoon in Africa and evening in South Asia, with the same OIDC check as `/publish`; signed-in admins can call it too. The job runs inside the write queue:

1. Read `markers`, `private`, `reminders` and `unsubscribed`.
2. For each `active` marker, find the latest stage (12, 18 or 24 calendar months, UTC) that `confirmed_at` has passed. It is due for a person unless `reminders` already has a row for that marker, stage, `confirmed_at` and username.
3. Look up the people, group due markers by person, and order people by their oldest due marker.
4. Send until today's emails reach 50. Record one row per marker and person: `sent`, `withheld` (staging allowlist) or a skip reason (`no owner`, `unsubscribed`, `no account`, `disabled`, `no email`, `rejected: <reason>`).

A Mandrill or Keycloak failure records nothing for the people affected, so the next run tries again. Skipped and withheld rows don't count towards the 50.

### Mandrill via `fetch`
One function posts to `https://mandrillapp.com/api/1.0/messages/send` with the key from Secret Manager. Each message has a plain-text body and a simple HTML body with no images, `track_clicks` and `track_opens` off (click tracking would rewrite the links through Mandrill and expose tokens), and a tag (`reminder` or `notice`). A `sent` or `queued` status counts as sent; `rejected` or `invalid` is recorded with Mandrill's reason.

Configuration, all optional so local runs and tests need none:

| Variable | Use |
|---|---|
| `KEYCLOAK_SERVICE_CLIENT_ID` | `atlas-service`. With no ID or secret, checks and search are off and IDs are accepted unchecked, as today. |
| `KEYCLOAK_SERVICE_CLIENT_SECRET` | Secret `atlas-keycloak-service-secret`; surrounding whitespace is trimmed. |
| `MANDRILL_API_KEY` | Secret. No key: email is off and logged as such. |
| `EMAIL_FROM` | `OpenMRS Atlas <atlas-noreply@openmrs.org>` |
| `EMAIL_ALLOWLIST` | Comma-separated. Set on staging (`burke@openmrs.org`), unset in production. |
| `NOTICE_EMAIL` | One address for new-entry notices. Unset: no notices. |
| `LINK_SIGNING_KEY` | Secret, 32 random bytes. |
| `SITE_URL` | Base for links in email and the feed. |

### Notices are sent after the write, outside the queue
After an add succeeds and publishes, the service sends the notice without holding the queue, and logs a failure instead of returning it. The person who added the marker never waits on Mandrill.

### The feed comes from the change log
Each publish reads the last 500 rows of `changes` and keeps `add`, `edit`, `confirm`, `close` and `reopen` for markers in the snapshot, dropping edits whose fields are all private (owner, editors, contact). It maps them to "X joins the Atlas", "X entry updated", "X confirmed as still current", "X has closed" and "X has reopened", takes the newest 50, and writes `rss.xml` to the bucket with `application/rss+xml`. Names and links come from the snapshot, so a deleted or hidden marker's items vanish at the next publish. The `user` and `fields` columns are never written to the feed.

Direct edits to the `markers` tab aren't in `changes`, so they don't appear in the feed. Those are admin corrections, not news.

Alternative considered: derive events from `created_at` and `updated_at`. That can't tell a confirmation from an edit and loses every event but the latest per marker.

`/rss` is a 302 redirect to the bucket's `rss.xml`, like `/data/*`. Feed readers follow redirects.

## Risks / Trade-offs

- **A leaked client secret exposes the account directory** → read-only role, secret only in Secret Manager and the service, no browser path to it, and rotation in one step.
- **Signed-in people could probe for accounts** → names and usernames only, 3 characters, 10 results, 30 searches a minute. Usernames and names are already visible on OpenMRS Talk.
- **Old accounts with stale or missing emails** → recorded per person in `reminders`, so admins can see who isn't reachable. Task 1.1 counts them before launch.
- **Keycloak outage** → adding editors and transfers fail with "try again"; the reminder job leaves affected people for the next run. Viewing and other edits are unaffected.
- **The first production weeks send a backlog** → 50 emails a day, oldest markers first.
- **Deliverability of a new sending domain** → SPF and DKIM before any send, plain content, no tracking, and the daily limit.
- **Someone forwards a reminder** → the recipient can confirm those markers once. That is the intended trade for one-click confirmation without sign-in, and the design spec accepted it.
- **Existing unchecked IDs** → editors and owners already in the sheet aren't re-checked; task 1.1 reports any that don't exist so admins can fix them.

## Staging counts (task 1.1)

`npm run report:accounts` against the staging sheet on 3 November 2026:

| | |
|---|---|
| Active markers | 452 |
| Confirmed within 12 months | 87, including all 85 orphans |
| Past 12 / 18 / 24 months | 1 / 7 / 357 |
| Owners and editors of active markers | 178 |
| People due on the first run | 177, about 4 days at 50 a day |

Staging Keycloak (`id-stg`) holds test accounts, not the production directory, so 177 of the 178 OpenMRS IDs were "not found" there. Disabled and no-email counts are only meaningful against `id.openmrs.org`; run the report there before cutover.

## Migration Plan

1. (manual) Create `atlas-service` on `id-stg.openmrs.org` and store its secret.
2. `setup:sheet` adds the two tabs to staging.
3. (manual) Verify the sending domain, create the Mandrill key and the signing key, set the variables, create the scheduler job.
4. Deploy. Run the job by hand as an admin with only the allowlist set, and check `reminders`.
5. Production follows at cutover: the same client on `id.openmrs.org`, `npm run report:accounts` against it to fix unknown or emailless owners first, and the allowlist unset only after reviewing the first day's `reminders` rows.

Rollback: pause the scheduler job or unset `MANDRILL_API_KEY` to stop email; unset the Keycloak client variables to return to unchecked IDs.

## Open Questions

None.

Settled: production notices go to `infrastructure@openmrs.org`; email comes from `atlas-noreply@openmrs.org` with no reply-to, and points people to OpenMRS Talk or OpenMRS on Slack for help (fixed text in `service/src/help.ts`, not a setting); the daily send runs at 14:00 UTC.
