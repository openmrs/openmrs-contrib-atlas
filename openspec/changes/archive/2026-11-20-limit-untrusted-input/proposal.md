# Proposal

## Why

Anyone with a free OpenMRS ID can sign in and write to the Atlas, and the service trusts some of
what they send more than it should:

- **Logo addresses.** The form only sets a marker's logo from an upload. The API, though, takes any
  http(s) address for `logo_url`, and every visitor's browser then loads it. That lets anyone track
  who views a marker, or serve a page mixed content over `http:`.
- **No limits on adds or uploads.** Claims (10 pending) and account searches (30 a minute) have
  limits; adding markers and uploading logos do not. Each add publishes and emails the admins.
  Each upload is a public file in the bucket that is never removed, even if no marker uses it.
- **Token type.** The sign-in check accepts any token Keycloak issued to the Atlas client,
  including an ID token, where only access tokens are meant.

These are cheap to close before the announcement brings more people in. They extend the
protections in the design spec's add-a-site (C2, C3) and sign-in (C1) requirements.

## What Changes

- **Logo addresses come from uploads.** Through the API, `logo_url` may only be blank or an address
  in the bucket's `logos/` folder, which is where uploads and migrated logos live. Anything else is
  refused with a reason on the logo field. Admins can still put any address in the sheet.
- **Daily limits for people who aren't admins:** 5 markers added and 20 logos uploaded per person
  per day (UTC). Past a limit, the request is refused with 429 and "try again tomorrow". Counts are
  kept in the service's memory, like the search limit, so a restart resets them. Admins have no
  limit.
- **Unused logos are swept nightly.** The nightly publish deletes files in `logos/` that no marker
  row in the sheet uses (any status) and that are more than a day old. A logo uploaded for a form
  not yet saved is never at risk.
- **Only access tokens are accepted.** The service also requires the token's type to be `Bearer`,
  so an ID token for the Atlas client is refused like any other invalid token.

Out of scope:

- Limits on edits, confirmations, transfers or editors. They don't publish new markers or files.
- Limits that survive a restart, or per-address (IP) limits.
- Checking that a logo address is a real file in the bucket. Its folder is enough.
- Email reliability (`reliable-writes`), security headers (`add-security-headers`) and the
  refactor (`tidy-service`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `marker-editing`: logo addresses are limited to the bucket's `logos/` folder, adds and uploads
  have daily limits, and unused logos are swept.
- `user-sign-in`: the service accepts only access tokens.

## Impact

- `service/src/edits.ts`: a logo address check on add and edit, with the bucket's logo prefix
  passed in.
- `service/src/api.ts`: daily counters for adds and uploads, as for searches.
- `service/src/storage.ts` and `service/src/logos.ts`: the logo store's public prefix, and listing
  and removing logos for the sweep.
- `service/src/app.ts`: the sweep in the nightly publish.
- `service/src/keycloak.ts`: the `typ` check.
- Tests for each. No sheet, configuration or deploy changes.
