# Design

## Context

The Cloud Run service has one write path today, `POST /publish`, and it only rewrites the `problems` tab. `SheetStore` reads the public tabs; it never reads `private`. Writes made through the Sheets API don't fire the Apps Script `onEdit` trigger, so the service must do its own `updated_at` and `changes` bookkeeping. `shared/validate.ts` already holds the marker rules, and `parsePrivateRows` already exists.

The web app has no router. All state lives in `App.tsx` and the query string, and `App` rewrites the query string on mount. The first load is tuned to 3 seconds on Fast 4G, so anything added to the first bundle has a cost.

Admins edit the same sheet directly at any time, so the service does not have exclusive control of row order.

## Goals / Non-Goals

**Goals:**
- Implementers can add, edit, confirm and hand over their markers without an admin.
- Every authorisation decision is made in the service. The web app only hides controls.
- Private fields leave the service only for people entitled to them.
- Moving from staging Keycloak to production Keycloak changes configuration only.

**Non-Goals:**
- Everything listed as out of scope in the proposal.
- Removing the sheet's direct-edit path, or locking admins out during a write.

## Decisions

### Same-origin API through Firebase Hosting
Firebase forwards `/api/**` to the Cloud Run service, so the browser calls `/api/...` on its own origin. There is no CORS to configure or maintain. Service responses set `Cache-Control: no-store` so the CDN never caches private data. `POST /publish` stays on the service's own URL. The alternative, calling the `run.app` URL with CORS, adds a dependency and a per-environment origin list.

### Token verification with `jose`, checking `azp`
The service verifies signature (cached JWKS), issuer and expiry, and requires `azp` to equal the Atlas client id. Keycloak access tokens have `aud: account` by default, so `azp` is what identifies the client without an extra audience mapper. Username is `preferred_username`, lowercased. Admin comes from a `groups` claim produced by a group-membership mapper on the client. `/api` returns 503 if `KEYCLOAK_ISSUER` or `KEYCLOAK_CLIENT_ID` is unset, so deploys before setup don't break `/publish`.

### Browser sign-in with `oidc-client-ts`, loaded lazily
Authorization Code with PKCE on a public client, with no secret. A small module checks `sessionStorage` for a session and only imports the library when one exists, when returning from Keycloak, or when someone chooses Sign in. Forms and My markers are lazy chunks too, so first load is unaffected. Hand-writing PKCE and refresh is not worth the saving, and `keycloak-js` would tie the client to one provider.

`redirect_uri` is the site root. `main.tsx` completes the code exchange before rendering `App`, then restores the URL saved in OIDC `state`, so URL handling stays in one place and no catch-all Firebase rewrite is needed. Form drafts go in `sessionStorage` so a re-sign-in redirect keeps them.

### A single instance with an in-process queue
Cloud Run runs with `max-instances=1`, and one async queue in the service covers all writes and publishes, including `/publish`. This is the simplest way to serialise, and traffic is a few edits a week. The alternatives, a lock in Cloud Storage or a task queue, add failure modes for no benefit at this volume. A request waiting behind a publish waits a few seconds.

The publish runs inside the request because Cloud Run throttles CPU after a response. If several requests queue up, one publish covers them all.

### `updated_at` as the version check
`GET /api/markers/:id` returns `updated_at`, and a save sends it back. A mismatch returns 409. This catches sheet edits too, because `onEdit` stamps `updated_at`. No new column or lock is needed.

### Locating rows just before writing
Rows are found by `id` from a fresh read inside the queue, and written with `valueInputOption: RAW` so user text can't become a formula. Only changed cells are written, so columns admins have added and other cells are left alone.

A human inserting or sorting rows in the moment between read and write could still misdirect a write. Sheets has no compare-and-set, so the service re-reads the `id` cell after the write and logs an error on a mismatch, and the sheet's version history is the recovery. This is accepted given how rarely it could happen.

### Delete means `deleted`
Deleting sets the new status `deleted` and keeps the row. `closed` keeps its own meaning, that the implementation has ended, so admins can tell the two apart in the sheet. Neither is published. The row and its `changes` history stay meaningful, and a mistaken or malicious delete is undone by changing one cell. A hard delete would need row-shifting writes on a sheet humans also edit.

### Website activity restarts the clock
As in 2.0, using the site counts as evidence that a marker is alive, so `confirmed_at` is set by saving the form (even unchanged), "Still current", changing editors, offering or accepting a transfer, an admin setting the owner, and setting `status` to `active`. The second Phase 2 change adds the emailed link as one more route.

Deleting, closing, hiding, and a declined, cancelled or expired offer don't restart it, because none of them shows the marker is in use. Direct sheet edits don't either: `onEdit` stamps only `updated_at`, and admins can set `confirmed_at` by hand. The value is always the service's clock.

These actions change a public field, so each one publishes. A shared helper in the service applies the rule, so it stays in one place.

### The previous owner stays on as an editor
Accepting a transfer makes the previous owner an editor, and the new owner can remove them. This avoids locking out someone mid-handover, and needs no extra option on the form.

### Offers live in `pending`, checked lazily
One row per offer, and at most one per marker. A new offer replaces the old one. Expiry is checked when an offer is read or accepted, and expired rows are deleted during later writes, so no scheduled job is needed. The design doc's `pending` tab also anticipated claims. C9 can add a `kind` column later, because columns are found by header.

### My markers as a panel, not a page
It uses the same panel pattern as Filters and Download, with the state `?panel=mine` in the URL. This needs no router and keeps the map in view, so choosing an entry can reveal the marker. Hidden, closed and invalid markers have no map position in the snapshot, so they open directly in the edit form.

`GET /api/me` returns username, admin flag, role per marker id and pending offers, so the details panel can decide on edit controls with no per-marker call. Only the entries a person holds are returned, and never another person's owner or editors.

### Logos processed by `sharp` in the service
The format is detected from file contents, and the image is re-encoded to WebP fitting 300 × 300, matching the `logos/<id>.webp` files from the migration. Re-encoding also strips metadata and any payload hidden in the file. Uploads get a fresh random name, so a cached old logo can't linger under the same URL. Replaced files are left in the bucket, as a few orphaned small images cost nothing. `sharp` installs through prebuilt optional packages, so the Dockerfile's `--ignore-scripts` needs no change, which task 3.1 verifies by building the image. Client-side resizing alone can't be trusted.

### Place search through Nominatim
Called directly from the browser only when someone submits a search in the add form, which fits its public usage policy of low, user-initiated traffic. Results show OpenStreetMap attribution. No account or dependency is needed. If it is unavailable, clicking the map still works.

### Staging uses `id-stg.openmrs.org`
The issuer is `https://id-stg.openmrs.org/realms/openmrs`, which already serves OIDC discovery with S256 PKCE. Using the real staging Keycloak means real upgrades and real token shapes are tested. Local development and CI don't depend on it: service tests use locally generated keys, and browser tests use a stubbed API and token.

## Risks / Trade-offs

- **Anyone with admin rights on `id-stg` can make themselves an Atlas admin on staging** → Staging's sheet holds real contact details from the migration, so keep that admin list short, and never point production at `id-stg`.
- **`id-stg` has only a handful of accounts** → Migrated owners can't sign in unless they have an account there, so an admin assigns test markers to two test accounts. Real account behaviour needs a recheck against production Keycloak before cutover.
- **Token contents depend on client setup** → A missing mapper would make every person look like a non-admin or be rejected. Task 1.3 checks a real token before the service is built on it.
- **The generous clock can overstate freshness** → Adding an editor to a dormant marker makes it look confirmed. Accepted, since it still shows someone is actively looking after the marker.
- **Unchecked IDs** → A mistyped editor ID grants nothing to anyone until that username exists, and transfers need acceptance. The form warns about this.
- **A requester can wait several seconds behind a publish** → Acceptable at this volume, and the form shows progress.
- **Anyone with an account can add a marker, with no moderation** → New-entry notices in the next change are the intended control, so this change alone shouldn't reach production.
- **Sheets API quota** → About 60 writes a minute per user. One edit makes only a few calls, so this is far above expected traffic.
