# Design

## Context

- **Logos.** `POST /api/logos` re-encodes an upload to WebP and saves it as
  `logos/<uuid>.webp` through `gcsLogoStore`, returning
  `https://storage.googleapis.com/<bucket>/logos/<uuid>.webp`. The migration put 2.0 logos at
  `logos/<marker id>.webp`. `validate.ts` checks only that `logo_url` is an http(s) URL. All 39
  production logos are in `storage.googleapis.com/openmrs-atlas/logos/`.
- **Limits.** `api.ts` keeps a per-person list of search times in a `Map` (30 a minute). The
  service runs with `--max-instances=1`, so memory is shared by every request.
- **Cards** are swept only by the nightly publish (`cards(nightly)` in `app.ts` passes
  `sweep: true`). The card refresh runs after a successful publish, and its failures are logged
  without failing the publish.
- **Tokens.** `keycloakVerifier` checks the signature, issuer, expiry and `azp`. Keycloak sets
  `typ` to `Bearer` on access tokens and `ID` on ID tokens.

## Goals / Non-Goals

**Goals:** refuse what the site itself never sends, and bound what one account can add to the
public bucket and the admins' inbox.

**Non-Goals:** abuse detection, persistent or per-IP limits, and moderation of content.

## Decisions

**1. Check the logo prefix in the service, on changed values only.**
`MarkerEditor` gets a `logoPrefix` (`<public bucket URL>/logos/`), from a new `publicPrefix` on
`LogoStore`. `add` and `change` refuse a non-blank `logo_url` that doesn't start with it, using
the usual `{ field: "logo_url", reason }` 422. As with the other limits, only values the request
changes are checked, so an admin's address already in the sheet survives other edits. The rule
stays out of `validate.ts`, so publishing never drops a marker for its logo.
_Alternative:_ a full-URL equality check against files that exist. Rejected: it needs a bucket
read on every save, for no real gain.

**2. One small daily counter, shared by adds and uploads.**
A `DailyLimit` helper in `service/src/limits.ts` (new) holds `Map<username, { day, count }>`, where
`day` is the UTC date: `allow(username, now)` resets on a new day and increments. There are two
instances, `adds` (5) and `uploads` (20). Admins skip them. Only successful adds count: the check
happens before the write, and the count only after the write succeeds, so a rejected form doesn't
use up the allowance. The search limit keeps its own sliding window.

**3. The sweep runs with the nightly publish, after it succeeds.**
`publish` gains an optional `logos: { store, now }`, passed only by the scheduler's run, like
`cards(true)`. After a successful publish:
1. It collects every `logo_url` in the `markers` values it already read, whatever the row's status.
2. It lists `logos/` with each file's creation time (`getFiles` metadata).
3. It removes each file that is not in that set and is more than 24 hours old.
4. It logs `{ event: "logos-swept", deleted }`. A failure logs `logos-sweep-failed` and never fails
   the publish.

Files are matched by turning each `logo_url` back into an object name with the store's
`publicPrefix`.

**4. `typ === "Bearer"`.**
One more line in `keycloakVerifier`. The site sends `user.access_token` from oidc-client-ts, which
is the access token, so nothing on the client changes.

## Risks / Trade-offs

- **[An admin bulk-adding for someone as a non-admin hits 5 a day]** → Bulk loads go through
  admins, who have no limit, or through the sheet.
- **[A restart resets the counts]** → That is accepted: deploys and restarts are rare, and the
  limits are a brake, not a quota.
- **[A logo set in the sheet to an address in `logos/` with different casing or query]** → It
  won't match any listed file, so it isn't "used", but it also doesn't point at a file the sweep
  would keep. Admins use addresses from uploads in practice.
- **[A sweep deletes a logo a marker in another environment uses]** → Each environment has its own
  bucket.

## Migration Plan

Ship with the next release, after staging checks: upload a logo, save it, and try a foreign
address through the API. The first production sweep deletes any unused uploads from testing.
Rollback is the previous release, but deleted files don't come back. Only unused files over a day
old are deleted, and that is the intent.
