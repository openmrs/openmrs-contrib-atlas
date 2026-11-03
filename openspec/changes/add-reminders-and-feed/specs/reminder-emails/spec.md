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
A reminder SHALL be sent to the marker's contact email, and to no one else. A marker with no valid contact email, or whose contact email has unsubscribed, SHALL get no reminder, and that SHALL be recorded so admins can see it.

#### Scenario: No contact email
- **WHEN** a due marker has a blank contact email
- **THEN** no email is sent and the `reminders` tab records it as skipped for that reason

#### Scenario: Unsubscribed address
- **WHEN** a due marker's contact email has unsubscribed
- **THEN** no email is sent and it is recorded as skipped

### Requirement: Reminder content
A reminder SHALL name the marker, say when it was last confirmed, show its public details, and say that the marker fades on the map until it is confirmed. It SHALL contain links to confirm it is still current, to update it, to say the site has closed, and to unsubscribe. It SHALL be plain enough to read as text without images.

#### Scenario: Reminder links
- **WHEN** a reminder is sent for a marker
- **THEN** it has "Still current", "Update details", "This site has closed" and "Unsubscribe" links

### Requirement: Emailed "still current" link
The "Still current" link SHALL work without signing in. Opening it SHALL show the marker and a button, and SHALL change nothing until the button is pressed. Pressing it SHALL set `confirmed_at` to the current time, log the change as made through a reminder link, and publish. A link SHALL work once, SHALL expire 30 days after it was sent, and SHALL stop working once the marker is confirmed by any means or is no longer `active`.

#### Scenario: Confirm from email
- **WHEN** a person opens the link from a reminder sent 3 days ago and presses "Still current"
- **THEN** the marker's `confirmed_at` is the current time, and the page says it is confirmed

#### Scenario: Link opened by a mail scanner
- **WHEN** a mail security scanner fetches the link but nobody presses the button
- **THEN** the marker is unchanged

#### Scenario: Link used twice
- **WHEN** a person presses "Still current" on a link that was already used
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
The unsubscribe link SHALL work without signing in and SHALL stop all reminders to that address, for every marker, after the person presses a button. The page SHALL say how to start receiving reminders again: by asking an admin.

#### Scenario: Unsubscribe
- **WHEN** a person follows the unsubscribe link and presses "Unsubscribe"
- **THEN** their address is added to `unsubscribed` and they get no further reminders

### Requirement: Daily sending
Due reminders SHALL be sent by a daily job, oldest `confirmed_at` first, at most 50 a day. Markers not reached SHALL be sent on later days. Running the job twice in one day SHALL NOT send any reminder twice.

#### Scenario: Large backlog
- **WHEN** 300 markers are due on the first day
- **THEN** the 50 with the oldest `confirmed_at` get a reminder that day and the rest follow on later days

#### Scenario: Job retried
- **WHEN** the daily job runs again an hour after it finished
- **THEN** no reminder is sent a second time

### Requirement: The daily job is protected
Only the scheduler and admins SHALL be able to start the reminder job.

#### Scenario: Anonymous request
- **WHEN** an unauthenticated request starts the reminder job
- **THEN** it is refused with 401 and nothing is sent
