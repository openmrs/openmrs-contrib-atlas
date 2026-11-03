# Tasks

## 1. Before building

- [ ] 1.1 Add a `report:contacts` script that prints only counts: active markers, those with a valid contact email, and how many are past 12, 18 and 24 months. Run it against staging and record the numbers in design.md
- [ ] 1.2 (manual) Verify the sending domain in Mandrill and add its SPF and DKIM records in Cloudflare
- [ ] 1.3 (manual) Create a Mandrill API key limited to Messages > Send, and store it with a new 32-byte link-signing key in Secret Manager, readable by `atlas-service`

## 2. Sheet

- [ ] 2.1 Add `reminders` and `unsubscribed` to `TABS` and `COLUMNS`, with `marker_id`, `confirmed_at` and `sent_at` as text columns
- [ ] 2.2 Make `setup:sheet` add both tabs, protected like `private`, and run it on staging
- [ ] 2.3 Confirm both tabs are never read by the snapshot builder; extend the snapshot test that checks no private tab leaks

## 3. Email

- [ ] 3.1 Add a `mailer` module: Mandrill `messages/send` via `fetch`, tracking off, tags, result mapped to sent, rejected (with reason) or failed
- [ ] 3.2 Apply `EMAIL_ALLOWLIST` inside the mailer, returning `withheld` and logging kind and marker id without the address
- [ ] 3.3 With no `MANDRILL_API_KEY`, return `off` and log once at start-up
- [ ] 3.4 Unit tests for each result, the allowlist and the off state, against a stubbed `fetch`

## 4. Reminder links

- [ ] 4.1 Add token signing and checking in `shared` (HMAC-SHA256, base64url, purpose, marker id, `confirmed_at`, email hash for unsubscribe, 30-day expiry)
- [ ] 4.2 Add `POST /api/reminder/view`, `/confirm` and `/unsubscribe`, outside the sign-in middleware: confirm goes through the queue, restarts the clock, logs user `reminder-link` and publishes; unsubscribe appends to `unsubscribed`
- [ ] 4.3 Answers for used, expired, forged and no-longer-active links, each telling the page what to say
- [ ] 4.4 Tests: confirm works once, a second press is refused with the date, a link dies after a map confirm, tampering is refused, an expired link is refused, unsubscribe checks the hash

## 5. Reminder job

- [ ] 5.1 Write the due-reminder selection as a pure function: latest stage passed, calendar months in UTC, not already recorded, oldest first, daily limit counting only today's `sent` rows
- [ ] 5.2 Add `POST /reminders`, protected like `/publish` and also open to admins, running the selection inside the queue and recording one `reminders` row per outcome
- [ ] 5.3 Write the reminder email: text and HTML, marker details, last confirmed date, the fading note, and the four links
- [ ] 5.4 Tests: backlog of 300 sends 50 oldest first, a rerun sends nothing, 5-year-old marker gets only the 24-month reminder, closed and unsubscribed markers are skipped, a Mandrill failure records nothing
- [ ] 5.5 (manual) Create the daily Cloud Scheduler job at 14:00 UTC in `infra/staging/setup.sh` and run it

## 6. Notices

- [ ] 6.1 After a successful add, send the notice outside the queue when `NOTICE_EMAIL` is set; log failures
- [ ] 6.2 Tests: notice sent on add only, none without an address, a failed send leaves the add successful

## 7. Feed

- [ ] 7.1 Build `rss.xml` from the last 500 `changes` rows and the snapshot: kept actions, private-only edits dropped, newest 50, escaped XML, stable `guid`
- [ ] 7.2 Write it in every publish with `application/rss+xml` and the same cache headers as the other files
- [ ] 7.3 Add the `/rss` redirect to `firebase.json`
- [ ] 7.4 Tests: titles per action, no user or fields in the output, deleted marker's items gone, the feed validates as RSS 2.0

## 8. Web

- [ ] 8.1 Add a `reminder.html` Vite entry with no map: reads the token from the fragment, shows the marker, and one "Still current" or "Unsubscribe" button
- [ ] 8.2 Messages for done, already confirmed, expired (with a sign-in link to the marker) and invalid links; works on a phone and by keyboard
- [ ] 8.3 Playwright tests for the page against a stubbed API, including that loading the page alone sends no confirm

## 9. Staging

- [ ] 9.1 (manual) Set `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_ALLOWLIST=burke@openmrs.org`, `NOTICE_EMAIL`, `SITE_URL` and the two secrets on `atlas-service-stg`
- [ ] 9.2 Document the variables and routes in `service/README.md` and the setup in `infra/staging/README.md`
- [ ] 9.3 (manual) Set a test marker's contact email to an allowlisted address and its `confirmed_at` to 13 months ago; run the job; confirm from the email; unsubscribe from a second reminder; add a marker and check the notice; subscribe to `/rss` in a feed reader
- [ ] 9.4 Check the `reminders` tab after a staging run: real contacts show `withheld`, and Cloud Run logs hold no addresses or tokens

## 10. Before archiving

- [ ] 10.1 All checks pass, `openspec validate --strict` passes, and CI has deployed to staging
