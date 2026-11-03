# Spec Delta

## MODIFIED Requirements

### Requirement: Sheet structure
The Atlas sheet SHALL contain the tabs `markers`, `private`, `changes`, `pending`, `reminders`, `unsubscribed`, `types`, `distributions`, `versions` and `problems`. Each marker is one row in `markers`; its private fields are one row in `private` with the same `id`.

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

#### Scenario: Reminder columns
- **WHEN** the `reminders` tab is read
- **THEN** its header row contains `marker_id`, `stage`, `confirmed_at`, `sent_at` and `result`, where `result` is `sent`, `withheld` or a reason it was skipped

#### Scenario: Unsubscribed columns
- **WHEN** the `unsubscribed` tab is read
- **THEN** its header row contains `email` and `unsubscribed_at`

## ADDED Requirements

### Requirement: Reminder tabs stay private
The `reminders` and `unsubscribed` tabs SHALL never be published. Admins MAY delete a row from `unsubscribed` to start reminders to that address again.

#### Scenario: Resubscribe
- **WHEN** an admin deletes an address's row from `unsubscribed`
- **THEN** that address gets reminders again when its markers are next due
