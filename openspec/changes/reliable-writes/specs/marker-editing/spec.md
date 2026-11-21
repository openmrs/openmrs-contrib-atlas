## ADDED Requirements

### Requirement: An added marker always has its owner
Adding a marker SHALL write its private row (owner, editors and contact) before its public row. A failure between the two writes SHALL leave at most an unpublished private row, and never a published marker without an owner.

#### Scenario: Second write fails
- **WHEN** a person adds a marker and the write of its public row fails after its private row was written
- **THEN** the add fails, nothing is published, and no marker without an owner can be claimed

## MODIFIED Requirements

### Requirement: Signing in keeps recent markers current
When a signed-in session starts (signing in, or opening the site already signed in), the service SHALL set `confirmed_at` to now on each `active` marker the person owns or edits that was confirmed less than 12 months and more than one day ago, and log each as their confirmation. Admin rights alone SHALL NOT make a marker eligible. A failure SHALL NOT stop the session. Written confirmations SHALL always be logged, with the same number of sheet reads however many markers there are.

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

#### Scenario: Many markers
- **WHEN** an owner of 40 eligible markers signs in
- **THEN** all 40 are confirmed and logged, with the same number of sheet reads as for one marker

#### Scenario: Check after writing fails
- **WHEN** the check that rows didn't move fails after the confirmations were written
- **THEN** the confirmations are still in the change log, and the failure is logged
