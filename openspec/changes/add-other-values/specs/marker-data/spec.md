## MODIFIED Requirements

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

### Requirement: Field value rules
Optional marker fields SHALL be validated when present: `type` matches a `types` name; `site_count` is a whole number of 1 or more; `url` and `logo_url` are http or https URLs; `status` is `active`, `hidden`, `closed` or `deleted`. `distribution` and `openmrs_version` SHALL accept any text. A value that matches an entry on its list (`distributions` names, or `versions` entries) ignoring case SHALL be read as that entry, spelled as on the list. A value on no list is an Other value. `Other` on its own means an Other value with no detail.

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
