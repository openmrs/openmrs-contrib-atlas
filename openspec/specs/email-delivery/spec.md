# email-delivery Specification

## Purpose
Rules shared by every email the Atlas sends, so staging never mails real implementers and production mail is trustworthy.

## Requirements

### Requirement: One sender
All Atlas email SHALL be sent through Mandrill from one no-reply address on a domain verified with SPF and DKIM, `atlas-noreply@openmrs.org` in production. Every email SHALL say that replies are not read and say where to get help instead.

#### Scenario: Where to get help
- **WHEN** a person reads any Atlas email
- **THEN** it says not to reply, and links to OpenMRS Talk (https://talk.openmrs.org/) and OpenMRS on Slack (https://openmrs.slack.com/) for help with the Atlas

### Requirement: Staging delivers only to an allowlist
When an allowlist is configured, email SHALL be delivered only to addresses on it. Email to any other address SHALL NOT be sent, and SHALL be logged with its kind and marker, but without the address or the body. This applies in every environment. Staging with no allowlist configured SHALL deliver to no one. Production with no allowlist configured SHALL deliver to everyone, so production can start with an allowlist and have it removed once its first reminders have been reviewed.

#### Scenario: Reminder on staging
- **WHEN** a staging reminder is due for a person whose email is not on the allowlist
- **THEN** nothing is sent, the log shows a reminder was withheld for that marker, and the `reminders` tab records it as withheld

#### Scenario: Allowlisted address
- **WHEN** a staging reminder is due for a person whose OpenMRS ID email is `burke@openmrs.org`, which is on the allowlist
- **THEN** it is delivered

#### Scenario: Staging without an allowlist
- **WHEN** staging is deployed with no allowlist set
- **THEN** no email is delivered to anyone

#### Scenario: Production during its first days
- **WHEN** production is deployed with an allowlist of `burke@openmrs.org`
- **THEN** reminders to everyone else are withheld and recorded, exactly as on staging

#### Scenario: Production after review
- **WHEN** production's allowlist is removed
- **THEN** reminders and notices are delivered to their real recipients

### Requirement: Email is never sent without configuration
With no Mandrill key configured, the service SHALL send no email and SHALL log that email is off. Everything else SHALL work as before.

#### Scenario: Local development
- **WHEN** the service runs with no Mandrill key
- **THEN** reminders and notices are logged as not sent, and editing works

### Requirement: Failed sends are retried by the next run
A reminder that Mandrill rejects or fails to accept SHALL NOT be recorded as sent, so the next daily run tries again. An address Mandrill reports as rejected SHALL be recorded as skipped.

#### Scenario: Mandrill unreachable
- **WHEN** Mandrill is unreachable during the daily run
- **THEN** no reminder is recorded as sent and the next run sends them
