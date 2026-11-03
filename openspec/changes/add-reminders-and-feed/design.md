# Design

## Context

The service already does every write through one in-memory queue on a single Cloud Run instance, logs Atlas edits to the private `changes` tab, and publishes after each write and nightly from Cloud Scheduler. Each marker's `private` row holds `contact_name` and `contact_email`, migrated from 2.0 or entered in the form. The web app is a static Vite build on Firebase Hosting, with `/api/**` forwarded to the service and the data files redirected to the bucket.

Atlas 2.0 sent no reminders. Its `/rss` feed listed new and updated markers from an in-memory list that was lost on every restart.

## Goals / Non-Goals

**Goals:**
- Get stale markers confirmed or closed with as little effort from implementers and admins as possible.
- Never mail real implementers from staging.
- Keep `/rss` working for existing subscribers.
- No new runtime dependencies and no database.

**Non-Goals:**
- Email to OpenMRS account addresses, transfer emails, the contact relay form (Phase 3).
- A preference centre, or per-marker unsubscribe.

## Decisions

### Reminders go to the contact email
The service can't look up an OpenMRS account's email without Keycloak admin credentials, which the previous change chose not to give it. The marker's `contact_email` is already there for most migrated markers and is asked for in the form. Markers without one are recorded as skipped, so admins can see the gap in the `reminders` tab and fill it in.

Alternative considered: record each person's email from their sign-in token in a new tab. That reaches only owners who have signed in to 3.0, and the stale markers that most need a reminder are exactly the ones whose owners haven't.

### Links are signed, and bound to `confirmed_at`
A link token is `base64url(payload).base64url(HMAC-SHA256(payload))`, keyed by a new `LINK_SIGNING_KEY` secret. The payload holds the purpose (`confirm` or `unsubscribe`), the marker id, the marker's `confirmed_at` when the reminder was sent, and an expiry 30 days out. The service accepts a confirm token only when the signature matches, it hasn't expired, the marker is `active`, and its `confirmed_at` still equals the one in the token. Confirming changes `confirmed_at`, so a used link stops working, and so does a link for a marker that was confirmed any other way. Single use needs no stored state.

An unsubscribe token carries a SHA-256 hash of the contact email, not the address. The service unsubscribes the marker's current contact email only if it still matches the hash. Addresses never appear in a URL.

### Tokens travel in the URL fragment, and only a button press acts
Links point to `https://<site>/reminder#<token>`. Browsers never send the fragment to a server, so tokens stay out of Firebase and Cloud Run request logs. `/reminder` is a second, small Vite page (no map) that reads the fragment, POSTs it to `/api/reminder/view` to show the marker, and POSTs to `/api/reminder/confirm` or `/api/reminder/unsubscribe` only when the person presses the button. Mail scanners that fetch links run no button, so they change nothing.

The "Update details" and "This site has closed" links are plain `/?marker=<id>` links; the map opens on the marker and the usual sign-in applies.

### A daily job, idempotent through the `reminders` tab
Cloud Scheduler calls `POST /reminders` daily at 14:00 UTC, early afternoon in Africa and evening in South Asia, with the same OIDC check as `/publish`; admins can call it too. The job runs inside the write queue:

1. Read `markers`, `private`, `reminders` and `unsubscribed`.
2. For each `active` marker, find the latest stage (12, 18 or 24 months) that `confirmed_at` has passed. It is due unless `reminders` already has a row for that marker, stage and `confirmed_at`.
3. Order by `confirmed_at`, oldest first. Stop sending when today's `sent` rows reach 50.
4. For each, either send and record `sent`, or record `withheld` (staging allowlist), or a skip reason (`no contact email`, `unsubscribed`, `rejected: <reason>`).

A Mandrill failure records nothing, so the next run tries again. Skipped and withheld rows don't count towards the 50.

Months are calendar months from `confirmed_at`, in UTC.

### Mandrill via `fetch`
One function posts to `https://mandrillapp.com/api/1.0/messages/send` with the key from Secret Manager. Each message has a plain-text body and a simple HTML body with no images, `track_clicks` and `track_opens` off (click tracking would rewrite the links through Mandrill and expose tokens), and a tag (`reminder` or `notice`). A `sent` or `queued` status counts as sent; `rejected` or `invalid` is recorded with Mandrill's reason.

Configuration, all optional so local runs and tests need none:

| Variable | Use |
|---|---|
| `MANDRILL_API_KEY` | Secret. No key: email is off and logged as such. |
| `EMAIL_FROM` | e.g. `OpenMRS Atlas <atlas@openmrs.org>` |
| `EMAIL_REPLY_TO` | Where replies go, e.g. the admins' address |
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

- **Contact emails may be missing or stale for many markers** → the first runs will show how many in the `reminders` tab. Task 1.1 counts them before launch, so admins can fill gaps first.
- **The first production weeks send a backlog** → 50 a day and oldest first. About 300 stale markers clear in under a week.
- **Deliverability of a new sending domain** → SPF and DKIM before any send, plain content, no tracking, and the daily limit.
- **Someone forwards a reminder** → the recipient can confirm the marker once. That is the intended trade for one-click confirmation without sign-in, and the design spec accepted it.
- **Sheet growth** → `reminders` gets at most three rows per marker per confirmation. Thousands of rows over years, well within limits.

## Migration Plan

1. `setup:sheet` adds the two tabs to staging.
2. (manual) Verify the sending domain, create the key and the signing key, set the variables, create the scheduler job.
3. Deploy. Run the job by hand as an admin with only the allowlist set, and check `reminders`.
4. Production follows at cutover, with the allowlist unset only after a review of the first day's `reminders` rows.

Rollback: pause the scheduler job, or unset `MANDRILL_API_KEY`. Nothing else depends on email.

## Open Questions

- The sender and reply-to addresses (assumed `atlas@openmrs.org`, replies to the Atlas admins).
- The production notice address.
- Whether 14:00 UTC suits the community, or another hour is better.
