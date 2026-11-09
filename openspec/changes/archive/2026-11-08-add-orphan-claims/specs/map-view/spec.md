## MODIFIED Requirements

### Requirement: Usage analytics
When a Google Analytics measurement ID is configured, the site SHALL record page views and the events search, filter change, marker opened, list opened, download, share and claim. The share event SHALL record which method was used. When none is configured, no analytics requests SHALL be made.

#### Scenario: Staging without analytics
- **WHEN** the site is built without a measurement ID
- **THEN** no requests are sent to Google Analytics

#### Scenario: Sharing on LinkedIn
- **WHEN** analytics is configured and a visitor presses LinkedIn in the Share dialog
- **THEN** a share event is recorded with the method "linkedin"

#### Scenario: Claim sent
- **WHEN** analytics is configured and a signed-in person sends a claim
- **THEN** a claim event is recorded with the marker's id and nothing from the message
