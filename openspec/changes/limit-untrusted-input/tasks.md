# Tasks

## 1. Logo addresses

- [x] 1.1 Add `publicPrefix` to `LogoStore` (`gcsLogoStore` and the test fake), and pass `<prefix>logos/` to `MarkerEditor`
- [x] 1.2 In `add` and `change`, refuse a changed, non-blank `logo_url` outside that prefix with a 422 reason on `logo_url`
- [x] 1.3 Tests: an uploaded address saves; a foreign address is refused and nothing is written; an unchanged foreign address already in the sheet doesn't block another edit

## 2. Daily limits

- [x] 2.1 Add `service/src/limits.ts` with a UTC-day `DailyLimit`, and use it in `api.ts` for adds (5) and uploads (20), with admins exempt. Count an add only once it succeeds
- [x] 2.2 Tests: a sixth add and a 21st upload in a day get 429 and write nothing; the next UTC day allows them again; admins are never limited; a rejected add doesn't count

## 3. Logo sweep

- [x] 3.1 Add listing (name and creation time) and removal to the logo store and its fake
- [x] 3.2 In `publish`, an optional `logos` sweep after a successful publish: keep files used by any `markers` row or under a day old, delete the rest, and log the count. Failures are logged and never fail the publish. Pass it only from the scheduler's run in `app.ts`
- [x] 3.3 Tests: an abandoned upload over a day old is deleted; one under a day old, one used by an active marker and one used by a deleted marker are kept; edit publishes never sweep; a failing sweep still publishes

## 4. Access tokens only

- [x] 4.1 In `keycloakVerifier`, require `typ` to be `Bearer`
- [x] 4.2 Test: an ID token for the Atlas client is refused with 401

## 5. Check and ship

- [x] 5.1 Update `service/README.md`: the limits, the logo rule and the sweep
- [x] 5.2 Run `npm run format:check`, `typecheck`, `lint`, `test`, the e2e tests and `openspec validate --strict`
- [x] 5.3 (manual) On staging: upload and save a logo, check that sign-in still works, and check the sweep in the nightly publish's log
