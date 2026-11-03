# Proposal

## Why

Phase 1 put every marker back on the map, but only people with access to the sheet can change anything. Most markers are out of date, and 2.0's sign-in no longer works for most of the community, so implementers have no way to add or refresh their own markers, which is the main goal of Atlas 3.0. This change gives them sign-in, editing and ownership. It is the first of two Phase 2 changes, and it comes first because reminders and RSS depend on it.

## What Changes

- Sign in and out with OpenMRS Keycloak (C1, A5). Visitors who don't sign in see the same map as today, and it still loads within the 3 second budget.
- Any signed-in person can add a marker by searching for a place or clicking the map, then filling in a short form (C2, C3), and becomes its owner (O1).
- Owners, editors and admins can edit a marker and mark it "still current" from the map (C4, in-app part only). Logos can be uploaded as PNG, JPEG or WebP.
- A "My markers" list shows what a person owns or edits, and any transfers waiting for them (C6).
- Owners can add and remove editors by OpenMRS ID (O2), transfer ownership to someone who must accept (O3), and delete a marker (O4). Deleting sets a new status, `deleted`.
- Owners and admins can close a site whose implementation has ended, and reopen it. A closed site stays on the map as a grey pin, is left out of the headline stats, and can be hidden with a filter.
- The top bar fits one line on a phone: search holds the filter control, Download becomes an icon, and "Add a site" moves into My markers.
- When a session ends, the page says so straight away instead of still showing the person as signed in. Session length stays as Keycloak sets it.
- Activity on the website restarts a marker's freshness clock: saving the form, the "Still current" button, changing editors, transfers, reopening a site, and setting the status to `active`. Direct edits in the sheet do not; admins can edit `confirmed_at` there themselves.
- Admins can do all of this on any marker, set `owner` and `editors` directly, set `status`, and add markers on behalf of others (A1).
- Every change made in the Atlas is logged with who, when and what (O6), and so are direct edits to the `private` tab.
- A saved change is published straight away.
- The sheet gains a private `pending` tab for transfers awaiting acceptance.
- The public CSV now neutralises spreadsheet formulas, because anyone with an account can now supply marker text.
- Staging signs in against the OpenMRS staging Keycloak at `id-stg.openmrs.org`. Moving to production Keycloak changes configuration only.

Out of scope for this change:

- Reminder emails, emailed "still current" links, new-entry notices (A6) and the RSS feed: the second Phase 2 change.
- Any email at all. A person learns of a transfer from My markers, or from the owner who started it.
- Contact relay form and `contactable` opt-in (C7): Phase 3. Contact name and email are collected and stored privately, but nothing uses them yet.
- Claiming an orphaned marker (C9). Until it is built, admins set the owner of any of the 85 orphans directly.
- Group ownership (O5), bulk-load tooling beyond the sheet (A2), child sites (C8).
- Checking that an OpenMRS ID exists when it is entered: Keycloak's user lookup needs admin credentials that this service should not hold.
- Rate limits on adding markers. Blocking spam accounts stays in Keycloak.
- Longer sessions: offline tokens or a change to Keycloak's session settings, which other OpenMRS services share.
- Production deployment, and the DNS move to Terraform, which is deferred.

## Capabilities

### New Capabilities

- `user-sign-in`: signing in and out with Keycloak, and how the service establishes who a person is and whether they are an admin.
- `marker-editing`: adding, changing, confirming and deleting markers in the Atlas, including logo upload and handling of conflicting edits.
- `marker-ownership`: owner and editor roles, what each may do, editor management, ownership transfer and the My markers list.

### Modified Capabilities

- `marker-data`: adds the `pending` tab and the `deleted` status, keeps the tab private, adds length limits, extends change logging to Atlas edits and the `private` tab, and states that direct sheet edits leave `confirmed_at` alone.
- `snapshot-publishing`: leaves `deleted` markers out, publishes `closed` ones with a public `status` field, and adds publishing after Atlas edits and formula-safe CSV cells.
- `map-view`: draws closed sites, leaves them out of the stats, adds a filter to hide them, and fits the top bar on one line on a phone.

## Impact

- **Service:** new `/api` routes on the Cloud Run service, Keycloak token checks, Sheets writes, and logo processing. New dependencies: `jose` (token verification) and `sharp` (already used by `migration`). Runs as a single instance so writes are serialised.
- **Web:** sign-in, add and edit forms, My markers, a reworked top bar, closed sites on the map. New dependency: `oidc-client-ts`, loaded only when needed so the map's first load stays within budget. Place search uses OpenStreetMap's public Nominatim service.
- **Apps Script:** logs edits to the `private` tab. Needs redeploying to the sheet.
- **Hosting:** Firebase Hosting forwards `/api/**` to the Cloud Run service.
- **Data:** `setup:sheet` adds the `pending` tab to the staging sheet. Existing rows are unchanged. `status` accepts `deleted`.
- **Systems (manual):** an `atlas` client, token mappers, an `atlas-administrators` group and two test accounts on `id-stg.openmrs.org`, plus new repository variables and service environment variables.
- **Public files:** `atlas.json`, `markers.geojson` and `markers.csv` gain a `status` field, as the last CSV column. Existing columns don't move.
- **Unaffected:** Atlas 2.0 on `master`.
