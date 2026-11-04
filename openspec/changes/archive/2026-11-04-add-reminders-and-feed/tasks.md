# Tasks

## 1. Before building

- [x] 1.1 Add a `report:accounts` script that prints only counts and usernames, never emails: active markers by reminder stage, markers with no owner or editors, and owners or editors that don't exist, are disabled or have no email. Run it against staging and record the counts in design.md
- [x] 1.2 (manual) On `id-stg.openmrs.org`, create the confidential client `atlas-service` with only service accounts enabled, and give its service account only `realm-management` `view-users`
- [x] 1.3 (manual) Store the client secret as `atlas-keycloak-service-secret` in Secret Manager in `atlas-stg-513316`, readable by `atlas-service@`
- [x] 1.4 (manual) Sending domain: `openmrs.org` is already verified in Mandrill, with SPF and DKIM, for OpenMRS community email
- [x] 1.5 (manual) Store the Mandrill API key (Messages > Send) as `atlas-mandrill-api-key` and a generated 32-byte key as `atlas-link-signing-key` in Secret Manager, both readable by `atlas-service@`

## 2. Accounts

- [x] 2.1 Add a `KeycloakAccounts` module: client-credentials token cached until near expiry, `check(username)`, `search(text)` and `lookup(username)`, treating disabled accounts as not found; no other Keycloak calls
- [x] 2.2 Add `GET /api/accounts?q=` and `GET /api/accounts/:username` behind sign-in, returning only `username` and `name`; 3-character minimum, 10 results, 30 a minute per person
- [x] 2.3 Check IDs in `addEditor`, `offer`, and admin owner and editor changes; "not found" and "try again" errors with nothing written
- [x] 2.4 Return the person's own email from their token in `/api/me`
- [x] 2.5 With no service client configured, accept IDs unchecked and answer search with 503
- [x] 2.6 Tests: each route without a token is refused and never calls Keycloak; emailed-link routes and `/publish` never call it; no response holds another person's email; rate limit; Keycloak down

## 3. Sheet

- [x] 3.1 Add `reminders` and `unsubscribed` to `TABS` and `COLUMNS`, with `marker_id`, `confirmed_at`, `username` and `sent_at` as text columns
- [x] 3.2 Make `setup:sheet` add both tabs (private like the rest of the sheet, which only admins and the service can open), and run it on staging
- [x] 3.3 Confirm both tabs are never read by the snapshot builder; extend the snapshot test that checks no private tab leaks

## 4. Email

- [x] 4.1 Add a `mailer` module: Mandrill `messages/send` via `fetch`, tracking off, tags, result mapped to sent, rejected (with reason) or failed
- [x] 4.2 Apply `EMAIL_ALLOWLIST` inside the mailer, returning `withheld` and logging kind and marker ids without the address
- [x] 4.3 With no `MANDRILL_API_KEY`, return `off` and log once at start-up
- [x] 4.4 Unit tests for each result, the allowlist and the off state, against a stubbed `fetch`

## 5. Reminder links

- [x] 5.1 Add token signing and checking in `service` (it uses Node crypto, and `shared` is bundled into the web app) (HMAC-SHA256, base64url; confirm: marker id, `confirmed_at`, username, 30 days; unsubscribe: username, 1 year)
- [x] 5.2 Add `POST /api/reminder/view`, `/confirm` and `/unsubscribe`, outside the sign-in middleware and without the Keycloak client: confirm goes through the queue, restarts the clock, logs `reminder-link:<username>` and publishes; unsubscribe appends the username to `unsubscribed`
- [x] 5.3 Answers for used, expired, forged and no-longer-active links, each telling the page what to say
- [x] 5.4 Tests: confirm works once, a second press is refused with the date, a link dies after a map confirm or another recipient's confirm, tampering is refused, an expired link is refused

## 6. Reminder job

- [x] 6.1 Write the due-reminder selection as a pure function: latest stage passed, calendar months in UTC, per marker and person not already recorded, grouped by person, oldest first, daily limit counting only today's `sent` emails
- [x] 6.2 Add `POST /reminders`, protected like `/publish` and also open to signed-in admins, running the selection inside the queue, looking each person up once, and recording one `reminders` row per marker and person
- [x] 6.3 Write the reminder email: text and HTML, why it was sent, not to reply and where to get help, each marker's details, last confirmed date and three links, the fading note, and the unsubscribe link
- [x] 6.4 Tests: 300 people sends 50 with the oldest markers, a rerun sends nothing, a 5-year-old marker gets only the 24-month reminder, three markers make one email, orphan, unsubscribed, disabled and no-email cases are recorded, a Mandrill or Keycloak failure records nothing
- [x] 6.5 (manual) Create the daily Cloud Scheduler job at 14:00 UTC in `infra/staging/setup.sh` and run it

## 7. Notices

- [x] 7.1 After a successful add, with the same no-reply wording, send the notice outside the queue when `NOTICE_EMAIL` is set; log failures
- [x] 7.2 Tests: notice sent on add only, none without an address, a failed send leaves the add successful

## 8. Feed

- [x] 8.1 Build `rss.xml` from the last 500 `changes` rows and the snapshot: kept actions, private-only edits dropped, newest 50, escaped XML, stable `guid`
- [x] 8.2 Write it in every publish with `application/rss+xml` and the same cache headers as the other files
- [x] 8.3 Add the `/rss` redirect to `firebase.json`
- [x] 8.4 Tests: titles per action, no user or fields in the output, deleted marker's items gone, the feed validates as RSS 2.0

## 9. Web

- [x] 9.1 Account picker in the add-editor, transfer and admin owner fields: search as you type after 3 characters, show username and name, and show "not found" and "try again" errors
- [x] 9.2 My markers: show the email reminders go to, with a link to change it on the OpenMRS ID site, and a reminders on/off switch
- [x] 9.3 Add a `reminder.html` Vite entry with no map: reads the token from the fragment, shows the marker, and one "Still current" or "Unsubscribe" button
- [x] 9.4 Messages for done, already confirmed, expired (with a sign-in link to the marker) and invalid links; works on a phone and by keyboard
- [x] 9.5 Playwright tests for the picker, the reminder setting and the reminder page against a stubbed API, including that loading the reminder page alone sends no confirm

## 10. Staging

- [x] 10.1 (manual) CI now sets the service settings and secrets on `atlas-service-stg`; set the repository variable `STAGING_EMAIL_ALLOWLIST=burke@openmrs.org` (staging emails no one without it) and, optionally, `STAGING_NOTICE_EMAIL`, then re-run the latest deploy
- [x] 10.2 Document the variables and routes in `service/README.md`, and the Keycloak client and other setup in `infra/staging/README.md`
- [x] 10.3 (manual) Walk through staging: add an editor by name search; try an unknown ID; make a test marker owned by an allowlisted account 13 months old; run the job; confirm from the email; unsubscribe from a second reminder and turn reminders back on in My markers; add a marker and check the notice; subscribe to `/rss` in a feed reader
- [x] 10.4 Check the `reminders` tab after a staging run: real people show `withheld`, and Cloud Run logs and the sheet hold no addresses or tokens (2026-11-04: on staging real people show `no account`, as id-stg doesn't hold their accounts; one `sent` to the test account; 282 log entries and 405 rows checked, no addresses or tokens)

## 11. Before archiving

- [x] 11.1 All checks pass, `openspec validate --strict` passes, and CI has deployed to staging
