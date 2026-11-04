# entry-notices Specification

## Purpose
Tells the Atlas admins when someone adds a marker, so spam and mistakes are caught quickly.

## Requirements

### Requirement: Notice when a marker is added
When a marker is added in the Atlas, one email SHALL be sent to the configured notice address. It SHALL name the marker, its type and country, the OpenMRS ID of the person who added it, and link to it on the map and to the sheet. With no notice address configured, no notice SHALL be sent.

#### Scenario: Marker added
- **WHEN** a person adds a marker named "Eldoret Clinic" and a notice address is set
- **THEN** that address gets one email naming "Eldoret Clinic", who added it, and links to the marker and the sheet

#### Scenario: No notice address
- **WHEN** a marker is added and no notice address is set
- **THEN** no email is sent and the marker is added as usual

#### Scenario: Other changes
- **WHEN** a marker is edited, confirmed, closed or deleted
- **THEN** no notice is sent

### Requirement: A failed notice never blocks an edit
Adding a marker SHALL succeed even when the notice cannot be sent. The failure SHALL be logged.

#### Scenario: Mandrill down
- **WHEN** a person adds a marker while Mandrill is unreachable
- **THEN** the marker is saved and published, and the failed notice is logged
