## ADDED Requirements

### Requirement: Suggestions in OpenMRS ID fields
An OpenMRS ID field SHALL suggest matching accounts once the person has typed at least 3 characters into it. An account whose username matches the typed text exactly, ignoring case, SHALL be suggested, and listed first. A field that opens already filled SHALL NOT show suggestions until the person changes it.

#### Scenario: Typing an exact OpenMRS ID
- **WHEN** a person types `burke` and the accounts `burke` (Burke Mamlin) and `mercedesburke` (Mercedes Burke) both match
- **THEN** both are suggested, with `burke` first

#### Scenario: Owner field already filled
- **WHEN** an admin opens the form for a marker whose owner is `burke`
- **THEN** the Owner field shows `burke` with no suggestions until the admin edits it
