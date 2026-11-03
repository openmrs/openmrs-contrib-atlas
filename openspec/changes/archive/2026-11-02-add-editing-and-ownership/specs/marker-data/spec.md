# Spec Delta

## MODIFIED Requirements

### Requirement: Sheet structure
The Atlas sheet SHALL contain the tabs `markers`, `private`, `changes`, `pending`, `types`, `distributions`, `versions` and `problems`. Each marker is one row in `markers`; its private fields are one row in `private` with the same `id`.

#### Scenario: Marker columns
- **WHEN** the `markers` tab is read
- **THEN** its header row contains `id`, `name`, `organisation`, `latitude`, `longitude`, `type`, `distribution`, `openmrs_version`, `site_count`, `url`, `logo_url`, `notes`, `created_at`, `updated_at`, `confirmed_at` and `status`

#### Scenario: Private columns
- **WHEN** the `private` tab is read
- **THEN** its header row contains `id`, `owner`, `editors`, `contact_name` and `contact_email`

#### Scenario: Lookup columns
- **WHEN** the lookup tabs are read
- **THEN** `types` has `name`, `colour` and `sort`; `distributions` has `name`, `url` and `is_standard`; `versions` has `version` and `release_date`

#### Scenario: Pending columns
- **WHEN** the `pending` tab is read
- **THEN** its header row contains `marker_id`, `from`, `to`, `created_at` and `expires_at`

### Requirement: Private fields stay private
Fields in the `private`, `changes` and `pending` tabs SHALL never appear in any published file, or in any page or response available to someone without rights to them.

#### Scenario: Contact email not published
- **WHEN** any public file or page is generated
- **THEN** it contains no value from `contact_email`, `contact_name`, `owner` or `editors`

#### Scenario: Pending transfer not published
- **WHEN** a marker has a pending transfer and a publish runs
- **THEN** no public file mentions the transfer or its recipient

### Requirement: Field value rules
Optional marker fields SHALL be validated when present: `type` matches a `types` name; `distribution` matches a `distributions` name; `openmrs_version` matches a `versions` entry or is `Other`; `site_count` is a whole number of 1 or more; `url` and `logo_url` are http or https URLs; `status` is `active`, `hidden`, `closed` or `deleted`.

#### Scenario: Unknown type
- **WHEN** a marker's `type` is "Hospital" and `types` has no such name
- **THEN** the row is invalid with the reason "unknown type: Hospital"

#### Scenario: Blank site count
- **WHEN** a marker's `site_count` is blank
- **THEN** the row is valid and the marker counts as 1 site

#### Scenario: Zero site count
- **WHEN** a marker's `site_count` is 0
- **THEN** the row is invalid with the reason "site_count must be 1 or more"

#### Scenario: Deleted status
- **WHEN** a marker's `status` is `deleted`
- **THEN** the row is valid

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

## ADDED Requirements

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
