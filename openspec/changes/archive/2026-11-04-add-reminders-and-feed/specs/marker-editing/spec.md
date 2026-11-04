# Spec Delta

## MODIFIED Requirements

### Requirement: Activity restarts the freshness clock
Saving the add or edit form, "Still current" on the map or from an emailed link, changing editors, offering or accepting a transfer, an admin setting the owner, reopening a site, and setting `status` to `active` on the website SHALL set `confirmed_at` to the current time. Requests SHALL NOT be able to choose the value.

#### Scenario: Owner adds an editor
- **WHEN** an owner adds an editor to a marker last confirmed 4 years ago
- **THEN** its `confirmed_at` becomes the current time

#### Scenario: Admin reactivates a marker
- **WHEN** an admin sets a hidden marker's status to `active` on the website
- **THEN** its `confirmed_at` becomes the current time

#### Scenario: Confirmed from a reminder
- **WHEN** an owner presses "Still current" on the page opened from a reminder
- **THEN** its `confirmed_at` becomes the current time

#### Scenario: Actions that do not restart the clock
- **WHEN** a marker is deleted, a site is closed, its status is set to `closed` or `hidden`, a transfer offer is declined, cancelled or expires, or a reminder is sent
- **THEN** its `confirmed_at` is unchanged
