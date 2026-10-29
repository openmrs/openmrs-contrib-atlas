# Spec Delta

## Purpose

Turns the Atlas sheet into the public snapshot files the map and downloads read, keeping visitors off the sheet and stopping a bad edit from wiping the public map.

## ADDED Requirements

### Requirement: Snapshot contents
A publish SHALL produce `atlas.json` containing the generation time, the `types`, `distributions` and `versions` lists, and every valid marker whose `status` is `active`, with only public marker fields plus a derived `country` (ISO 3166-1 alpha-3).

#### Scenario: Hidden and closed markers excluded
- **WHEN** a marker's `status` is `hidden` or `closed`
- **THEN** it does not appear in any published file

#### Scenario: Invalid rows excluded
- **WHEN** a marker row fails validation
- **THEN** it is left out of the snapshot and listed in `problems`
- **AND** all valid rows are still published

#### Scenario: Country derived from coordinates
- **WHEN** a marker is at latitude -1.29, longitude 36.82
- **THEN** its published `country` is `KEN`

### Requirement: Download formats
Each publish SHALL also produce `markers.geojson` (a FeatureCollection of the same markers) and `markers.csv` (one row per marker, public fields only), generated from the same data as `atlas.json`.

#### Scenario: Formats agree
- **WHEN** a publish completes
- **THEN** `atlas.json`, `markers.geojson` and `markers.csv` contain the same set of marker ids

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
- **WHEN** an admin closes 150 stale markers and forces the publish
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
