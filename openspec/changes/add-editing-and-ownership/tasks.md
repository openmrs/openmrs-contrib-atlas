# Tasks

## 1. Keycloak and configuration

- [x] 1.1 (manual) On `id-stg.openmrs.org`, realm `openmrs`: create a public `atlas` client with PKCE (S256) and the staging site's root as redirect URI and web origin; put `preferred_username` and a `groups` claim with plain group names in the access token; create the `atlas-administrators` group
- [x] 1.2 (manual) Provide two test accounts on `id-stg`, and add one to `atlas-administrators` for the admin checks
- [x] 1.3 Sign in as a test account and confirm that a real token has the expected issuer, `azp`, `preferred_username` and `groups`, and that the exchange works from the staging origin
- [x] 1.4 (manual) Set `KEYCLOAK_ISSUER` and `KEYCLOAK_CLIENT_ID` on the Cloud Run service and matching `VITE_` repository variables
- [x] 1.5 Document the Keycloak setup and the move to production Keycloak in `service/README.md`

## 2. Shared rules and sheet

- [x] 2.1 Add the `pending` tab to `TABS` and `COLUMNS` and `deleted` to `MARKER_STATUSES`; add `contact_name`/`contact_email` handling and the field length limits to shared validation, with tests
- [x] 2.2 Add shared permission rules (role of a person on a marker; what each role may do), with tests covering every row of the role table
- [x] 2.3 Prefix formula-like text cells in `toCsv`, with tests including negative coordinates
- [x] 2.4 (manual) Run `setup:sheet` against the staging sheet to add the `pending` tab
- [x] 2.5 Log direct `private` tab edits in Apps Script without requesting a publish, with tests; (manual) redeploy the script to the staging sheet

## 3. Service

- [x] 3.1 Add `jose` and `sharp`; confirm the service image builds and processes an image
- [x] 3.2 Verify Keycloak tokens (signature, issuer, expiry, `azp`) and derive username and admin; test with locally generated keys, including each rejection case
- [x] 3.3 Add the write queue and route `/publish` through it; test ordering and shared publishes
- [x] 3.4 Extend the sheet store: read `private` and `pending`, append rows, update chosen cells by id with RAW input, verify the id after writing, append to `changes`
- [x] 3.5 Add `GET /api/me` and `GET /api/markers/:id`, returning contact details and owner/editors only to those entitled; set `no-store`
- [x] 3.6 Add `POST /api/markers` and `PATCH /api/markers/:id`, with validation, field-level permissions, version check, logging and publish
- [x] 3.7 Add a shared helper for the clock rule, and confirm and delete routes; test every action that does and doesn't restart the clock
- [x] 3.8 Add editor management and direct owner and status setting for admins, with old and new values logged and a publish when the clock restarts
- [x] 3.9 Add transfer offer, cancel, accept and decline, with expiry, replacement, cancellation when an admin changes the owner, and a publish on offer and accept
- [x] 3.10 Add logo upload: 2 MB limit, content-based format check, re-encode to fit 300 × 300, random name
- [x] 3.11 Test that no private value reaches a person without rights, on every route and error response
- [x] 3.12 Run the write paths against the real test sheet in `sheets.sheet.test.ts`

## 4. Web: sign-in

- [x] 4.1 Add `oidc-client-ts` behind a lazy auth module; complete the code exchange in `main.tsx` and restore the saved URL
- [x] 4.2 Add sign-in and sign-out controls, showing the OpenMRS ID and handling unavailable or cancelled sign-in; hide them if Keycloak is not configured
- [x] 4.3 Add an API client that attaches the token and handles 401 by keeping the draft and asking for sign-in
- [x] 4.4 Confirm the first-load bundle hasn't grown materially and that the 3 second budget still holds on Fast 4G

## 5. Web: adding and editing

- [x] 5.1 Build the marker form with pick lists, field errors, drafts, and Escape asking before discarding; lazy-loaded and usable at 360 pixels and by keyboard
- [x] 5.2 Add the "Add a site" flow: place search through Nominatim with attribution, clicking the map, and an adjustable location
- [x] 5.3 Add edit, "Still current" and delete controls to `MarkerDetails` according to role, with delete confirmation
- [x] 5.4 Add logo upload with preview and errors
- [x] 5.5 Apply saved changes to the in-memory snapshot and show the notice about when others will see them
- [x] 5.6 Handle a 409 conflict by keeping typed values and offering to reload the marker

## 6. Web: ownership

- [x] 6.1 Add the My markers panel at `?panel=mine`, with roles, status, last confirmed, reasons for invalid rows, and a sign that an offer is waiting
- [x] 6.2 Add accept and decline for offers
- [x] 6.3 Add editor management and transfer offer and cancel for owners, with the unchecked-ID warning
- [x] 6.4 Add the admin-only owner, editors and status fields, and naming an owner when adding

## 7. Hosting and deployment

- [x] 7.1 Add the `/api/**` rewrite to `firebase.json` and `VITE_KEYCLOAK_*` to the CI build; set `--max-instances=1` in the Cloud Run deploy
- [x] 7.2 Add Playwright tests for adding, editing, conflict, delete, editors and transfer, against a stubbed API and token
- [x] 7.3 Deploy to staging after all checks pass
- [ ] 7.4 (manual) Assign test markers to the two test accounts, then walk through staging on a laptop and a phone: sign in, add, edit, confirm, delete, add an editor, transfer, accept, and the admin actions; check that a direct sheet edit leaves `confirmed_at` alone
- [ ] 7.5 Confirm that a downloaded `atlas.json`, `markers.geojson` and `markers.csv` contain no contact details, owners, editors or offers after that walkthrough

## 8. Staging feedback

- [x] 8.1 Publish `closed` markers with a public `status` field, as the last CSV column, with tests
- [x] 8.2 Add the `close` permission, close and reopen routes, and refuse confirming a closed site; test permissions, statuses, the clock, logging and publishing
- [x] 8.3 Draw closed sites as grey pins beneath others; leave them out of the stats and legend values; add a "Closed" legend entry, details row, search label, and the "Show closed sites" filter with its URL parameter, with tests
- [x] 8.4 Move Close or Reopen and Delete into a keyboard-operable actions menu, shown only to owners and admins; hide "Still current" on closed sites
- [x] 8.5 Report ended sessions from the API client, check on returning to the tab and at the refresh token's expiry, and keep sessions through network failures, with tests
- [x] 8.6 Keep an open form through an ended session; offer sign-in when a form can't load, with no empty form and no pin placement
- [x] 8.7 Rework the top bar to fit one line at 360 pixels: filter control in search, download icon, account control; add the sign-in panel; move "Add a site" to My markers
- [x] 8.8 Drop "(required)" from the latitude and longitude labels
- [x] 8.9 Update the README and `service/README.md`, run every check, deploy to staging

## 9. Before archiving

- [x] 9.1 Update the README and `service/README.md`; run `openspec validate add-editing-and-ownership --strict`
