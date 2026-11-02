# Spec Delta

## MODIFIED Requirements

### Requirement: Snapshot contents
A publish SHALL produce `atlas.json` containing the generation time, the `types`, `distributions` and `versions` lists, and every valid marker whose `status` is `active`, with only public marker fields plus a derived `country` (ISO 3166-1 alpha-2).

#### Scenario: Hidden and closed markers excluded
- **WHEN** a marker's `status` is `hidden` or `closed`
- **THEN** it does not appear in any published file

#### Scenario: Deleted markers excluded
- **WHEN** a marker's `status` is `deleted`
- **THEN** it does not appear in any published file

#### Scenario: Invalid rows excluded
- **WHEN** a marker row fails validation
- **THEN** it is left out of the snapshot and listed in `problems`
- **AND** all valid rows are still published

#### Scenario: Country derived from coordinates
- **WHEN** a marker is at latitude -1.29, longitude 36.82
- **THEN** its published `country` is `KE`

## ADDED Requirements

### Requirement: Publish after Atlas edits
Each change to public marker data through the Atlas SHALL be published before the service reports it finished, unless a publish is refused or fails. Changes made close together SHALL share a publish rather than wait in turn.

#### Scenario: Marker saved
- **WHEN** an owner saves a change
- **THEN** a publish containing that change has completed by the time the save is confirmed

#### Scenario: Publish fails after a save
- **WHEN** a save is written to the sheet but the publish then fails
- **THEN** the person is told the change is saved and will appear later, the failure is logged, and the next publish includes the change

#### Scenario: Editor change
- **WHEN** an owner adds an editor, which restarts the marker's freshness clock
- **THEN** a publish containing the new `confirmed_at` runs

#### Scenario: No public change
- **WHEN** a recipient declines a transfer offer
- **THEN** no publish runs

### Requirement: Writes are serialised
Writes to the sheet by the service, and publishes, SHALL run one at a time, so that concurrent requests cannot overwrite one another or read a half-finished change.

#### Scenario: Two saves at once
- **WHEN** two people save different markers at the same moment
- **THEN** both changes are in the sheet and in the next published snapshot

### Requirement: Spreadsheet-safe CSV
In `markers.csv`, a text value beginning with `=`, `+`, `-`, `@`, a tab or a carriage return SHALL be prefixed with an apostrophe, so spreadsheet software does not run it as a formula. Numeric fields and other files SHALL be unaffected.

#### Scenario: Formula in a marker name
- **WHEN** a marker is named `=HYPERLINK("http://example.org")`
- **THEN** `markers.csv` holds `'=HYPERLINK("http://example.org")` for its name, and `atlas.json` holds the name unchanged

#### Scenario: Negative coordinate
- **WHEN** a marker has longitude -1.5
- **THEN** `markers.csv` holds `-1.5` with no apostrophe
