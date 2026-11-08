# Spec Delta

## MODIFIED Requirements

### Requirement: My markers
A signed-in person SHALL be able to list every marker they own or edit, with their role, its status and when it was last confirmed, along with offers awaiting their answer. Each entry SHALL open that marker's details, and hidden or invalid markers SHALL still be listed. Each `active` marker confirmed 12 or more months ago, or never, SHALL show an "Update" link that confirms it in one click, exactly as "Still current" does, and then shows its new last-confirmed date. Markers confirmed less than 12 months ago, and closed or hidden markers, SHALL NOT show the link. A marker opened from My markers SHALL show a back control before its name that returns to My markers, scrolled to where the person left it and with focus on that marker's entry. It SHALL show the email reminders go to and let the person turn reminders off and on.

#### Scenario: Owner and editor
- **WHEN** a person who owns two markers and edits one opens My markers
- **THEN** all three are listed with their roles

#### Scenario: Pending offer
- **WHEN** a person has an offer waiting
- **THEN** My markers shows it with accept and decline actions, and the page shows that an offer is waiting

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

#### Scenario: Update an old marker
- **WHEN** an owner presses "Update" beside a marker last confirmed 20 months ago
- **THEN** its `confirmed_at` becomes the current time, the entry shows it was confirmed this month, and the link disappears

#### Scenario: Recent marker
- **WHEN** an owner's marker was confirmed 2 months ago
- **THEN** its entry in My markers shows no "Update" link

#### Scenario: Back to the list
- **WHEN** a person opens a marker from My markers and chooses the back control
- **THEN** My markers is shown again where they left it, with focus on that marker's entry

#### Scenario: Opened from the map
- **WHEN** a person opens a marker by choosing it on the map
- **THEN** its details show no back control

