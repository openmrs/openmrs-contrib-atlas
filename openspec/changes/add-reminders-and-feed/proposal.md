# Proposal

## Why

Implementers can now add and refresh their own markers, but most markers have not been touched in years and nobody is prompting their owners to look at them. The Atlas also can't check that an OpenMRS ID exists when someone adds an editor or offers a transfer, so a typo silently gives access to nobody. Atlas 2.0 also had an RSS feed at `/rss` that people subscribe to, and admins have no way to notice new entries other than watching the sheet. This is the second and last Phase 2 change, and the last piece of Phase 2 needed before cutover.

## What Changes

- Reminder emails go to a marker's owner and editors, at the email on their OpenMRS ID, when it was last confirmed 12, 18 and 24 months ago (C5). Each reminder is sent once per confirmation, and a marker more than 24 months out gets only one, never a backlog. A person with several due markers gets one email listing them all.
- Each reminder has a "Still current" link that works without signing in (C4, emailed part). The link opens a page with a button; nothing changes until the button is pressed, so mail scanners that open links can't confirm a marker by accident. A link works once and for 30 days, and stops working as soon as the marker is confirmed by any means.
- Reminders also link to update the marker and to say the site has closed. Those open the marker in the Atlas and need sign-in as usual.
- Every reminder has an unsubscribe link that stops all reminders to that OpenMRS ID, without signing in. My markers shows where reminders go and turns them back on.
- A daily job sends due reminders, at most 50 emails a day, so the first weeks after launch don't send hundreds at once.
- When a marker is added in the Atlas, a notice goes to one optional address (A6). With no address set, no notice is sent.
- `/rss` returns an RSS 2.0 feed (X3) of the latest additions, updates, closures and confirmations, built from public fields only and refreshed with every publish.
- The service gets read-only access to OpenMRS accounts through its own Keycloak client, `atlas-service`. Adding an editor, offering a transfer and an admin setting an owner now check that the OpenMRS ID exists, with a search by username or name. Searches return only usernames and names, need 3 characters, and are rate-limited. Only signed-in requests and the reminder job can cause a lookup; emailed links never do.
- Mandrill sends all email. Staging delivers only to an allowlist and drops the rest, logging what it would have sent.
- The sheet gains two private tabs: `reminders`, which records what was sent, and `unsubscribed`.

Out of scope for this change:

- Contact relay form and `contactable` opt-in (C7): Phase 3.
- Sending reminders to a marker's contact email. People may use a different address for Atlas contact than for their OpenMRS ID; contact details wait for the relay form.
- Any write access to Keycloak, or showing anyone's email to another person.
- Email when a transfer is offered or accepted.
- Reminders after 24 months. Those markers stay visible and faded, and admins close the dead ones (decided in the design spec).
- Bounce and complaint handling beyond Mandrill's own rejection list.
- Production Mandrill setup and the cutover itself.
- An Atom feed, or feeds filtered by country or type.

## Capabilities

### New Capabilities

- `reminder-emails`: when reminders are sent and to whom, what they contain, the emailed "still current" link, unsubscribing, and the daily limit.
- `entry-notices`: the notice email sent when a marker is added.
- `change-feed`: the public RSS feed at `/rss`.
- `account-lookup`: read-only access to OpenMRS accounts: checking an ID, searching by username or name, and fetching emails for reminders, with limits on what triggers a lookup and what is exposed.
- `email-delivery`: rules shared by all Atlas email: the sender, the staging allowlist, and what happens when sending fails.

### Modified Capabilities

- `marker-data`: adds the private `reminders` and `unsubscribed` tabs, which hold usernames, never emails.
- `marker-ownership`: OpenMRS IDs are checked when adding editors, offering transfers and setting owners, with a search; My markers gains the reminder setting. This reverses the previous change's decision not to check IDs.
- `marker-editing`: the emailed "still current" link restarts the freshness clock like the button.
- `snapshot-publishing`: each publish also writes the RSS feed.

## Impact

- **Service:** a Keycloak admin API client for user lookup (client credentials, `view-users` only), account search and check routes, a daily `/reminders` job, a public `/api/reminder/*` route for emailed links (no sign-in, signed tokens), Mandrill calls, and RSS generation in the publish. No new dependencies: Mandrill is called with `fetch`, the links are signed with Node's `crypto`, and the feed is built from a template string.
- **Web:** a small page for emailed links ("Still current" and "Unsubscribe", each with one button), an account picker in the editor and transfer forms, and the reminder setting in My markers.
- **Hosting:** `/rss` redirects to the published feed, like the data files.
- **Data:** `setup:sheet` adds the `reminders` and `unsubscribed` tabs. Existing rows are unchanged.
- **Systems (manual):** an `atlas-service` confidential client on `id-stg.openmrs.org` with a service account holding only `view-users`, and later the same on `id.openmrs.org`; a verified Mandrill sending domain with SPF and DKIM records, a Mandrill API key with only Messages > Send, three new secrets (the Keycloak client secret, the Mandrill key and a link-signing key), a Cloud Scheduler job, and the notice address.
- **Public files:** a new `rss.xml` next to `atlas.json`. Existing files don't change.
- **Unaffected:** Atlas 2.0 on `master`.
