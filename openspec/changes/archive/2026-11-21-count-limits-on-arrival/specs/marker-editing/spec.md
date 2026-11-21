## MODIFIED Requirements

### Requirement: Daily limits on adding and uploading
A person who isn't an admin SHALL be able to add at most 5 markers and upload at most 20 logos per day (UTC). This SHALL hold when requests are sent at the same time. A request past a limit SHALL be refused with 429 and a message to try again tomorrow, and SHALL write nothing. A request that fails SHALL NOT count. Admins SHALL have no limit. The counts MAY reset when the service restarts.

#### Scenario: Sixth add
- **WHEN** a person who isn't an admin adds a sixth marker on the same day
- **THEN** it is refused with a message to try again tomorrow, and nothing is written or emailed

#### Scenario: Admin bulk add
- **WHEN** an admin adds a sixth marker on the same day
- **THEN** it is added

#### Scenario: Burst of adds
- **WHEN** a person who isn't an admin sends 50 add requests at the same moment
- **THEN** 5 markers are added, and the other 45 requests are refused with 429

#### Scenario: Failed add
- **WHEN** a person's add is refused because the name is missing, and they fix it and add five markers that day
- **THEN** all five are added
