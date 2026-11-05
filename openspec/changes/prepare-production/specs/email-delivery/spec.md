# Spec Delta

## MODIFIED Requirements

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
