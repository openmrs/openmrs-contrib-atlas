# Spec Delta

## Purpose

Prompts the people responsible for a marker to confirm it or update it, so the map stays current without admins chasing anyone.

## ADDED Requirements

### Requirement: When reminders are due
An `active` marker SHALL be due a reminder when its `confirmed_at` is at least 12, 18 or 24 months ago and no reminder for that stage has been sent since that `confirmed_at`. When more than one stage is due, only the latest SHALL be sent. No reminder SHALL be sent beyond 24 months, or for a marker that is `hidden`, `closed` or `deleted`.

#### Scenario: First reminder
- **WHEN** a marker was confirmed 12 months and 1 day ago and has had no reminder since
- **THEN** it is due its 12-month reminder

#### Scenario: Long-neglected marker
- **WHEN** a marker was confirmed 5 years ago and has never had a reminder
- **THEN** it is sent the 24-month reminder only, and no further reminders after that

#### Scenario: Confirmed after a reminder
- **WHEN** a marker is sent its 12-month reminder and then confirmed
- **THEN** its next reminder is due 12 months after the new `confirmed_at`

#### Scenario: Closed marker
- **WHEN** a closed marker was confirmed 18 months ago
- **THEN** no reminder is sent

### Requirement: Who receives reminders
A due marker's reminder SHALL go to its owner and each editor, at the email on their OpenMRS ID. It SHALL NOT go to the marker's contact email. A person who has unsubscribed, whose account is disabled, missing or has no email SHALL get no reminder, and that SHALL be recorded so admins can see it. A marker with no owner and no editors SHALL be recorded as skipped.

#### Scenario: Owner and editor
- **WHEN** a due marker has owner `jdoe` and editor `asmith`
- **THEN** each gets a reminder at the email on their OpenMRS ID

#### Scenario: Orphaned marker
- **WHEN** a due marker has no owner and no editors
- **THEN** no email is sent and the `reminders` tab records it as skipped, with no owner

#### Scenario: Unsubscribed person
- **WHEN** a due marker's owner has unsubscribed and its editor has not
- **THEN** only the editor gets a reminder, and the owner is recorded as skipped

#### Scenario: Account without an email
- **WHEN** a due marker's owner has no email on their OpenMRS ID
- **THEN** the owner is recorded as skipped, with no email

### Requirement: One email per person
Each person SHALL get at most one reminder email per daily run, listing every marker of theirs that is due. Each marker in it SHALL have its own links.

#### Scenario: Owner of several markers
- **WHEN** `jdoe` owns three markers that are due on the same day
- **THEN** `jdoe` gets one email listing all three

### Requirement: Reminder content
A reminder SHALL name each marker, say when it was last confirmed, show its public details, and say that a marker fades on the map until it is confirmed. Each marker SHALL have links to confirm it is still current, to update it and to say the site has closed. The email SHALL say why the person is getting it, and have a link to unsubscribe. It SHALL be plain enough to read as text without images.

#### Scenario: Reminder links
- **WHEN** a reminder is sent for a marker
- **THEN** that marker has "Still current", "Update details" and "This site has closed" links, and the email has an "Unsubscribe" link

### Requirement: Emailed "still current" link
The "Still current" link SHALL work without signing in. Opening it SHALL show the marker and a button, and SHALL change nothing until the button is pressed. Pressing it SHALL set `confirmed_at` to the current time, log the change as made through a reminder link sent to that person, and publish. A link SHALL work once, SHALL expire 30 days after it was sent, and SHALL stop working once the marker is confirmed by any means or is no longer `active`.

#### Scenario: Confirm from email
- **WHEN** a person opens the link from a reminder sent 3 days ago and presses "Still current"
- **THEN** the marker's `confirmed_at` is the current time, and the page says it is confirmed

#### Scenario: Link opened by a mail scanner
- **WHEN** a mail security scanner fetches the link but nobody presses the button
- **THEN** the marker is unchanged

#### Scenario: Link used twice
- **WHEN** a person presses "Still current" on a link that was already used, or after an editor of the same marker confirmed it
- **THEN** nothing changes and the page says the marker was already confirmed, with the date

#### Scenario: Expired link
- **WHEN** a person opens a link sent 31 days ago
- **THEN** nothing changes and the page offers to sign in and confirm from the map

#### Scenario: Forged link
- **WHEN** a request uses a link whose signature does not match, or names a different marker
- **THEN** it is refused and nothing changes

### Requirement: Links that need sign-in
The "Update details" and "This site has closed" links SHALL open the marker in the Atlas. Changing or closing it SHALL then need sign-in and the usual permissions.

#### Scenario: Update from email
- **WHEN** a person who is not signed in follows "Update details"
- **THEN** the Atlas opens on that marker and asks them to sign in before editing

### Requirement: Unsubscribe
The unsubscribe link SHALL work without signing in and SHALL stop all reminders to that OpenMRS ID, for every marker, after the person presses a button. The page SHALL say that reminders can be turned back on from My markers.

#### Scenario: Unsubscribe
- **WHEN** a person follows the unsubscribe link and presses "Unsubscribe"
- **THEN** their OpenMRS ID is added to `unsubscribed` and they get no further reminders

### Requirement: Daily sending
Due reminders SHALL be sent by a daily job, starting with the markers with the oldest `confirmed_at`, at most 50 emails a day. Markers not reached SHALL be sent on later days. Running the job twice in one day SHALL NOT send any reminder twice.

#### Scenario: Large backlog
- **WHEN** 300 people have markers due on the first day
- **THEN** 50 of them, those with the oldest markers, get a reminder that day and the rest follow on later days

#### Scenario: Job retried
- **WHEN** the daily job runs again an hour after it finished
- **THEN** no reminder is sent a second time

### Requirement: The daily job is protected
Only the scheduler and signed-in admins SHALL be able to start the reminder job.

#### Scenario: Anonymous request
- **WHEN** an unauthenticated request starts the reminder job
- **THEN** it is refused with 401, nothing is sent, and no account is looked up
