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
- **THEN** `types` has `name`, `colour` and `sort`; `distributions` has `name`, `url` and `is_standard`; `versions` has `version` and `release_date`

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

### Requirement: Reminder tabs stay private
The `reminders`, `unsubscribed` and `claims` tabs SHALL never be published. None of them SHALL hold email addresses. Admins MAY delete a row from `unsubscribed` to start reminders to that person again.

#### Scenario: Resubscribe
- **WHEN** an admin deletes a person's row from `unsubscribed`
- **THEN** that person gets reminders again when their markers are next due

#### Scenario: Claims tab
- **WHEN** the snapshot is published while the `claims` tab has rows
- **THEN** nothing from the `claims` tab is in `atlas.json` or the feed
