# Spec Delta

## ADDED Requirements

### Requirement: Signing in keeps recent markers current
When a signed-in session starts, by signing in or by opening the site while already signed in, the service SHALL set `confirmed_at` to the current time on each `active` marker the person owns or edits that was confirmed less than 12 months ago and more than one day ago, and log each as a confirmation by that person. Admin rights alone SHALL NOT make a marker eligible. A failure SHALL NOT stop the session starting.

#### Scenario: Owner signs in
- **WHEN** an owner whose marker was confirmed 5 months ago signs in
- **THEN** that marker's `confirmed_at` becomes the current time, and the change log records a confirmation by the owner

#### Scenario: Editor signs in
- **WHEN** an editor of a marker confirmed 11 months ago opens the site while already signed in
- **THEN** that marker's `confirmed_at` becomes the current time

#### Scenario: Old marker
- **WHEN** an owner signs in and one of their markers was confirmed 14 months ago
- **THEN** that marker is not confirmed, and still offers "Still current"

#### Scenario: Confirmed today
- **WHEN** an owner signs in twice on the same day
- **THEN** the second sign-in writes nothing to the sheet

#### Scenario: Admin
- **WHEN** an admin who neither owns nor edits a marker confirmed 3 months ago signs in
- **THEN** that marker is not confirmed

#### Scenario: Closed marker
- **WHEN** an owner signs in and one of their markers is closed
- **THEN** that marker is not confirmed

#### Scenario: Service unavailable
- **WHEN** the confirmation fails as a session starts
- **THEN** the person is still signed in and My markers still works

## MODIFIED Requirements

### Requirement: Still current
A person allowed to edit a marker SHALL be able to mark it "still current" in one action from its details when it is `active` and its `confirmed_at` is 12 or more months ago or empty. That action SHALL set `confirmed_at` to the current time and change no other marker field except `updated_at`. Marker details SHALL NOT offer "Still current" on a marker confirmed less than 12 months ago. The service SHALL still accept a confirmation of any active marker the person may edit.

#### Scenario: Confirming a faded marker
- **WHEN** an editor chooses "Still current" on a marker last confirmed 4 years ago
- **THEN** its `confirmed_at` becomes the current time and it is drawn at full opacity

#### Scenario: Recently confirmed marker
- **WHEN** an owner opens the details of a marker confirmed 3 months ago
- **THEN** "Still current" is not offered, and Edit is

#### Scenario: Never confirmed
- **WHEN** an owner opens the details of an active marker with no `confirmed_at`
- **THEN** "Still current" is offered

#### Scenario: Closed site
- **WHEN** a person views a closed marker they may edit
- **THEN** "Still current" is not offered, and a request to confirm it is refused with 409

### Requirement: Activity restarts the freshness clock
Saving the add or edit form, "Still current" on the map, from My markers or from an emailed link, starting a signed-in session (as set out in "Signing in keeps recent markers current"), changing editors, offering or accepting a transfer, an admin setting the owner, reopening a site, and setting `status` to `active` on the website SHALL set `confirmed_at` to the current time. Requests SHALL NOT be able to choose the value.

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
