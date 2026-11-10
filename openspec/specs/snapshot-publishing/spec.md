# snapshot-publishing Specification

## Purpose
Turns the Atlas sheet into the public snapshot files the map and downloads read, keeping visitors off the sheet and stopping a bad edit from wiping the public map.

## Requirements

### Requirement: Download formats
Each publish SHALL also produce `markers.geojson` (a FeatureCollection of the same markers), `markers.csv` (one row per marker, public fields only) and `rss.xml` (the change feed), generated from the same data as `atlas.json`.

#### Scenario: Formats agree
- **WHEN** a publish completes
- **THEN** `atlas.json`, `markers.geojson` and `markers.csv` contain the same set of marker ids, and every marker in `rss.xml` is among them

### Requirement: Publish on sheet edits
A direct edit to the `markers` or lookup tabs SHALL cause a publish within 5 minutes. Several edits made close together SHALL result in at most one publish per minute.

#### Scenario: Admin edits a marker
- **WHEN** an admin changes a marker's name in the sheet
- **THEN** the new name appears in `atlas.json` within 5 minutes

#### Scenario: Burst of edits
- **WHEN** an admin makes 40 edits within two minutes
- **THEN** no more than 3 publishes run as a result

### Requirement: Nightly publish
The system SHALL run a full validation and publish once every night, regardless of edits, so that missed triggers and derived values (such as freshness) are corrected within 24 hours.

#### Scenario: Missed trigger
- **WHEN** an edit's trigger fails to fire
- **THEN** the edit is published by the next nightly run

### Requirement: Publish safety check
A publish SHALL be refused, keeping the previous snapshot in place, when it would publish fewer than 80% of the markers in the current snapshot, unless an admin explicitly forces it. A refused publish SHALL be recorded in `problems`.

#### Scenario: Rows accidentally deleted
- **WHEN** someone deletes 200 of 450 marker rows and a publish runs
- **THEN** the publish is refused, the public map still shows 450 markers, and `problems` explains why

#### Scenario: Intentional large cleanup
- **WHEN** an admin hides 150 stale markers and forces the publish
- **THEN** the new snapshot is published without those markers

### Requirement: Publish endpoint is protected
Only the sheet trigger, the nightly scheduler and admins SHALL be able to start a publish.

#### Scenario: Anonymous publish request
- **WHEN** a request to start a publish arrives without valid credentials
- **THEN** it is rejected and no publish runs

### Requirement: Snapshot freshness for visitors
Published files SHALL be served with caching of no more than 5 minutes, so visitors see a publish within 10 minutes of it completing.

#### Scenario: Visitor after a publish
- **WHEN** a publish completes and a visitor loads the map 10 minutes later
- **THEN** the visitor sees the published data

### Requirement: Published snapshot contents
A publish SHALL produce `atlas.json` containing the generation time, the `types`, `distributions` and `versions` lists, and every valid marker whose `status` is `active` or `closed`, with only public marker fields, including `status`, plus a derived `country` (ISO 3166-1 alpha-2). Distributions SHALL have `name` and, when set, `url`. `distribution` and `openmrs_version` SHALL be published as the list entry they match ignoring case, else as in the sheet.

#### Scenario: Hidden markers excluded
- **WHEN** a marker's `status` is `hidden`
- **THEN** it does not appear in any published file

#### Scenario: Closed markers included
- **WHEN** a marker's `status` is `closed`
- **THEN** it appears in every published file with `status` `closed`

#### Scenario: Deleted markers excluded
- **WHEN** a marker's `status` is `deleted`
- **THEN** it does not appear in any published file

#### Scenario: Invalid rows excluded
- **WHEN** a marker row fails validation
- **THEN** it is left out of the snapshot and listed in `problems`
- **AND** all valid rows are still published

#### Scenario: Other value published
- **WHEN** a marker's `distribution` in the sheet is "AMPATH", which is not on the list
- **THEN** it is published, with `distribution` "AMPATH", and is not listed in `problems`

#### Scenario: List spelling published
- **WHEN** a marker's `distribution` in the sheet is "bahmni" and the list has "Bahmni"
- **THEN** it is published with `distribution` "Bahmni"

#### Scenario: Country derived from coordinates
- **WHEN** a marker is at latitude -1.29, longitude 36.82
- **THEN** its published `country` is `KE`

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
