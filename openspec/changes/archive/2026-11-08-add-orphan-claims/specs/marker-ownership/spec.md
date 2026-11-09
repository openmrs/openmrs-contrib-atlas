## MODIFIED Requirements

### Requirement: My markers
A signed-in person SHALL be able to list every marker they own or edit, with their role, its status and when it was last confirmed, along with offers awaiting their answer and their own pending claims. Admins SHALL also see every pending claim. Each entry SHALL open that marker's details, and hidden or invalid markers SHALL still be listed. It SHALL show the email reminders go to and let the person turn reminders off and on.

#### Scenario: Owner and editor
- **WHEN** a person who owns two markers and edits one opens My markers
- **THEN** all three are listed with their roles

#### Scenario: Pending offer
- **WHEN** a person has an offer waiting
- **THEN** My markers shows it with accept and decline actions, and the page shows that an offer is waiting

#### Scenario: Pending claim
- **WHEN** a person has a claim waiting for an admin
- **THEN** My markers shows it as waiting, with a way to withdraw it

#### Scenario: Admin with claims to review
- **WHEN** an admin opens My markers while three claims are pending
- **THEN** all three are listed, and each opens its marker's details, where it can be approved or declined

#### Scenario: Marker failing validation
- **WHEN** a person's marker has a row that fails validation
- **THEN** it is listed with the reasons, and they can open it, correct it and save

#### Scenario: Closed marker
- **WHEN** a person's marker has status `closed`
- **THEN** it is listed with that status, and choosing it opens its details on the map

#### Scenario: Adding from My markers
- **WHEN** a person opens My markers
- **THEN** "Add a site" is the first action in the panel

#### Scenario: Deleted marker
- **WHEN** a person's marker has status `deleted`
- **THEN** it is not listed for that person

#### Scenario: Reminder setting
- **WHEN** a person who unsubscribed opens My markers and turns reminders on
- **THEN** they are removed from `unsubscribed` and get reminders when their markers are next due
