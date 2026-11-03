# Spec Delta

## Purpose

Rules shared by every email the Atlas sends, so staging never mails real implementers and production mail is trustworthy.

## ADDED Requirements

### Requirement: One sender
All Atlas email SHALL be sent through Mandrill from one configured address on a domain verified with SPF and DKIM, with a reply-to address that reaches the Atlas admins.

#### Scenario: Reply to a reminder
- **WHEN** a person replies to a reminder
- **THEN** the reply goes to the configured admin address, not to an unattended mailbox

### Requirement: Staging delivers only to an allowlist
When an allowlist is configured, email SHALL be delivered only to addresses on it. Email to any other address SHALL NOT be sent, and SHALL be logged with its kind and marker, but without the address or the body.

#### Scenario: Reminder on staging
- **WHEN** a staging reminder is due for a marker whose contact email is not on the allowlist
- **THEN** nothing is sent, the log shows a reminder was withheld for that marker, and the `reminders` tab records it as withheld

#### Scenario: Allowlisted address
- **WHEN** a staging reminder is due for a marker whose contact email is `burke@openmrs.org`, which is on the allowlist
- **THEN** it is delivered

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
