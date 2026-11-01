# Spec Delta

## Purpose

Defines how Atlas markers and their lookup lists are stored in the Atlas Google Sheet, which fields are valid, and which fields may never leave the sheet.

## ADDED Requirements

### Requirement: Sheet structure
The Atlas sheet SHALL contain the tabs `markers`, `private`, `changes`, `types`, `distributions`, `versions` and `problems`. Each marker is one row in `markers`; its private fields are one row in `private` with the same `id`.

#### Scenario: Marker columns
- **WHEN** the `markers` tab is read
- **THEN** its header row contains `id`, `name`, `organisation`, `latitude`, `longitude`, `type`, `distribution`, `openmrs_version`, `site_count`, `url`, `logo_url`, `notes`, `created_at`, `updated_at`, `confirmed_at` and `status`

#### Scenario: Private columns
- **WHEN** the `private` tab is read
- **THEN** its header row contains `id`, `owner`, `editors`, `contact_name` and `contact_email`

#### Scenario: Lookup columns
- **WHEN** the lookup tabs are read
- **THEN** `types` has `name`, `colour` and `sort`; `distributions` has `name`, `url` and `is_standard`; `versions` has `version` and `release_date`

### Requirement: Required marker fields
A marker row SHALL be valid only if `id`, `name`, `latitude`, `longitude`, `type` and `status` are present and well-formed.

#### Scenario: Missing name
- **WHEN** a marker row has an empty `name`
- **THEN** the row is invalid and the reason "name is required" is reported for that row

#### Scenario: Coordinates out of range
- **WHEN** a marker row has latitude outside -90 to 90 or longitude outside -180 to 180
- **THEN** the row is invalid and the offending field is named in the reported reason

### Requirement: Field value rules
Optional marker fields SHALL be validated when present: `type` matches a `types` name; `distribution` matches a `distributions` name; `openmrs_version` matches a `versions` entry or is `Other`; `site_count` is a whole number of 1 or more; `url` and `logo_url` are http or https URLs; `status` is `active`, `hidden` or `closed`.

#### Scenario: Unknown type
- **WHEN** a marker's `type` is "Hospital" and `types` has no such name
- **THEN** the row is invalid with the reason "unknown type: Hospital"

#### Scenario: Blank site count
- **WHEN** a marker's `site_count` is blank
- **THEN** the row is valid and the marker counts as 1 site

#### Scenario: Zero site count
- **WHEN** a marker's `site_count` is 0
- **THEN** the row is invalid with the reason "site_count must be 1 or more"

### Requirement: Date fields
`created_at`, `updated_at` and `confirmed_at`, when present, SHALL be dates: ISO 8601 text, or a date value entered through the spreadsheet. Valid dates SHALL be published as ISO 8601 UTC timestamps.

#### Scenario: Date typed into the sheet
- **WHEN** an admin types 2025-06-01 into `confirmed_at` and the sheet stores it as a date value
- **THEN** the marker is valid and its `confirmed_at` is published as `2025-06-01T00:00:00.000Z`

#### Scenario: Unreadable date
- **WHEN** a marker's `confirmed_at` is "last spring"
- **THEN** the row is invalid with the reason "confirmed_at must be a date"

### Requirement: Marker identifiers
Every marker SHALL have a unique, stable `id`. Rows added without an `id` SHALL be given a new UUID automatically, and an `id` SHALL never change once assigned.

#### Scenario: Admin adds a row without an id
- **WHEN** an admin types a new marker row and leaves `id` blank
- **THEN** a UUID is written into `id` for that row before the next publish

#### Scenario: Duplicate id
- **WHEN** two marker rows share the same `id`
- **THEN** both rows are reported as invalid with the reason "duplicate id"

### Requirement: Edit tracking in the sheet
When a person edits a marker row directly in the sheet, the system SHALL set that row's `updated_at` to the edit time and append an entry to `changes` recording the time, the editor's account, the marker id and the fields changed.

#### Scenario: Admin corrects a website
- **WHEN** an admin changes the `url` cell of a marker
- **THEN** that marker's `updated_at` becomes the time of the edit
- **AND** `changes` gains a row naming the admin, the marker id and `url`

### Requirement: Private fields stay private
Fields in the `private` tab and the `changes` tab SHALL never appear in any published file, page or response available without admin rights.

#### Scenario: Contact email not published
- **WHEN** any public file or page is generated
- **THEN** it contains no value from `contact_email`, `contact_name`, `owner` or `editors`

### Requirement: Validation problems are visible to admins
Each validation run SHALL replace the contents of the `problems` tab with one row per invalid marker row, giving the marker id (if any), the sheet row number and every reason it is invalid.

#### Scenario: Two problems on one row
- **WHEN** a row has an unknown type and a malformed URL
- **THEN** `problems` lists that row once with both reasons

#### Scenario: All rows valid
- **WHEN** a validation run finds no invalid rows
- **THEN** `problems` contains only its header row
