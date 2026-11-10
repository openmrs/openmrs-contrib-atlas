# marker-data Specification

## Purpose
Defines how Atlas markers and their lookup lists are stored in the Atlas Google Sheet, which fields are valid, and which fields may never leave the sheet.

## Requirements

### Requirement: Sheet structure
The Atlas sheet SHALL contain the tabs `markers`, `private`, `changes`, `pending`, `claims`, `reminders`, `unsubscribed`, `types`, `distributions`, `versions` and `problems`. Each marker is one row in `markers`; its private fields are one row in `private` with the same `id`.

#### Scenario: Marker columns
- **WHEN** the `markers` tab is read
- **THEN** its header row contains `id`, `name`, `organisation`, `latitude`, `longitude`, `type`, `distribution`, `openmrs_version`, `site_count`, `url`, `logo_url`, `notes`, `created_at`, `updated_at`, `confirmed_at` and `status`

#### Scenario: Private columns
- **WHEN** the `private` tab is read
- **THEN** its header row contains `id`, `owner`, `editors`, `contact_name` and `contact_email`

#### Scenario: Lookup columns
- **WHEN** the lookup tabs are read
- **THEN** `types` has `name`, `colour` and `sort`; `distributions` has `name` and `url`; `versions` has `version` and `release_date`

#### Scenario: Leftover is_standard column
- **WHEN** the `distributions` tab still has an `is_standard` column
- **THEN** the column is ignored, and every row on the tab is a distribution

#### Scenario: Pending columns
- **WHEN** the `pending` tab is read
- **THEN** its header row contains `marker_id`, `from`, `to`, `created_at` and `expires_at`

#### Scenario: Claim columns
- **WHEN** the `claims` tab is read
- **THEN** its header row contains `id`, `marker_id`, `username`, `message`, `created_at`, `status`, `decided_by`, `decided_at` and `reason`, where `status` is `pending`, `approved`, `declined` or `withdrawn`

#### Scenario: Reminder columns
- **WHEN** the `reminders` tab is read
- **THEN** its header row contains `marker_id`, `stage`, `confirmed_at`, `username`, `sent_at` and `result`, where `result` is `sent`, `withheld` or a reason it was skipped

#### Scenario: Unsubscribed columns
- **WHEN** the `unsubscribed` tab is read
- **THEN** its header row contains `username` and `unsubscribed_at`

### Requirement: Required marker fields
A marker row SHALL be valid only if `id`, `name`, `latitude`, `longitude`, `type` and `status` are present and well-formed.

#### Scenario: Missing name
- **WHEN** a marker row has an empty `name`
- **THEN** the row is invalid and the reason "name is required" is reported for that row

#### Scenario: Coordinates out of range
- **WHEN** a marker row has latitude outside -90 to 90 or longitude outside -180 to 180
- **THEN** the row is invalid and the offending field is named in the reported reason

### Requirement: Field value rules
Optional marker fields SHALL be validated when present: `type` matches a `types` name; `site_count` is a whole number of 1 or more; `url` and `logo_url` are http or https URLs; `status` is `active`, `hidden`, `closed` or `deleted`. `distribution` and `openmrs_version` SHALL accept any text. A value matching a `distributions` or `versions` entry ignoring case SHALL be read as that entry, spelled as on the list. Any other value is an Other value; `Other` alone means one with no detail.

#### Scenario: Unknown type
- **WHEN** a marker's `type` is "Hospital" and `types` has no such name
- **THEN** the row is invalid with the reason "unknown type: Hospital"

#### Scenario: Distribution not on the list
- **WHEN** a marker's `distribution` is "AMPATH" and `distributions` has no such name
- **THEN** the row is valid, and its distribution is the Other value "AMPATH"

#### Scenario: Version not on the list
- **WHEN** a marker's `openmrs_version` is "2.4.2" and `versions` has no such entry
- **THEN** the row is valid, and its version is the Other value "2.4.2"

#### Scenario: Different case
- **WHEN** a marker's `distribution` is "bahmni" and `distributions` has "Bahmni"
- **THEN** its distribution is "Bahmni", which is on the list

#### Scenario: Value added to the list later
- **WHEN** a marker's `distribution` is "AMPATH", an Other value, and an admin then adds "AMPATH" to `distributions`
- **THEN** the marker's distribution is on the list, with no change to the marker's row

#### Scenario: Blank site count
- **WHEN** a marker's `site_count` is blank
- **THEN** the row is valid and the marker counts as 1 site

#### Scenario: Zero site count
- **WHEN** a marker's `site_count` is 0
- **THEN** the row is invalid with the reason "site_count must be 1 or more"

#### Scenario: Deleted status
- **WHEN** a marker's `status` is `deleted`
- **THEN** the row is valid

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
When a person edits a marker row directly in the sheet, the system SHALL set that row's `updated_at` to the edit time and append an entry to `changes` recording the time, the editor's account, the marker id and the fields changed. It SHALL NOT change `confirmed_at`, which admins MAY edit directly.

#### Scenario: Admin corrects a website
- **WHEN** an admin changes the `url` cell of a marker
- **THEN** that marker's `updated_at` becomes the time of the edit
- **AND** `changes` gains a row naming the admin, the marker id and `url`
- **AND** its `confirmed_at` is unchanged

#### Scenario: Admin sets the confirmed date
- **WHEN** an admin changes the `confirmed_at` cell of a marker
- **THEN** that marker's `confirmed_at` is the value the admin entered

### Requirement: Private fields stay private
Fields in the `private`, `changes` and `pending` tabs SHALL never appear in any published file, or in any page or response available to someone without rights to them.

#### Scenario: Contact email not published
- **WHEN** any public file or page is generated
- **THEN** it contains no value from `contact_email`, `contact_name`, `owner` or `editors`

#### Scenario: Pending transfer not published
- **WHEN** a marker has a pending transfer and a publish runs
- **THEN** no public file mentions the transfer or its recipient

### Requirement: Validation problems are visible to admins
Each validation run SHALL replace the contents of the `problems` tab with one row per invalid marker row, giving the marker id (if any), the sheet row number and every reason it is invalid.

#### Scenario: Two problems on one row
- **WHEN** a row has an unknown type and a malformed URL
- **THEN** `problems` lists that row once with both reasons

#### Scenario: All rows valid
- **WHEN** a validation run finds no invalid rows
- **THEN** `problems` contains only its header row

### Requirement: Field length limits
Text fields SHALL have maximum lengths: `name` and `organisation` 200 characters, `url` and `logo_url` 2000, `notes` 2000, `contact_name` 200 and `contact_email` 320. `contact_email`, when present, SHALL look like an email address. These limits SHALL apply to edits made in the Atlas, not to values already in the sheet that are left unchanged.

#### Scenario: Name too long
- **WHEN** a person saves a marker with a 300 character name
- **THEN** it is rejected with the reason "name must be 200 characters or fewer"

### Requirement: Edit tracking in the Atlas
Each change made through the Atlas SHALL set the marker's `updated_at` where the marker row changes and append to `changes` the time, the person's OpenMRS ID, the marker id, the action and the fields changed. Changes to `owner` and `editors` SHALL record the old and new values.

#### Scenario: Editor changes notes
- **WHEN** `asmith` changes a marker's notes in the Atlas
- **THEN** `changes` gains a row naming `asmith`, the marker id, the action `edit` and `notes`

#### Scenario: Ownership accepted
- **WHEN** `asmith` accepts ownership from `jdoe`
- **THEN** `changes` gains a row with the action `transfer` recording both usernames

### Requirement: Direct edits to private fields are logged
A person's direct edit to the `private` tab SHALL append to `changes` the time, their account, the marker id and the fields changed. It SHALL NOT start a publish, since nothing public changed.

#### Scenario: Admin changes an owner in the sheet
- **WHEN** an admin changes an `owner` cell in the `private` tab
- **THEN** `changes` gains a row naming the admin, the marker id and `owner`, and no publish runs

### Requirement: Reminder tabs stay private
The `reminders`, `unsubscribed` and `claims` tabs SHALL never be published. None of them SHALL hold email addresses. Admins MAY delete a row from `unsubscribed` to start reminders to that person again.

#### Scenario: Resubscribe
- **WHEN** an admin deletes a person's row from `unsubscribed`
- **THEN** that person gets reminders again when their markers are next due

#### Scenario: Claims tab
- **WHEN** the snapshot is published while the `claims` tab has rows
- **THEN** nothing from the `claims` tab is in `atlas.json` or the feed
