## ADDED Requirements

### Requirement: Missing columns refuse the publish
A publish SHALL be refused, keeping the previous snapshot in place, when a tab it reads (`markers`, `types`, `distributions`, `versions` or `changes`) is missing a column header it needs. `problems` SHALL name the tab and the missing columns. Forcing a publish SHALL NOT get past it, and nothing SHALL be published or deleted.

#### Scenario: Header cleared by mistake
- **WHEN** someone clears the `logo_url` header on the `markers` tab and an admin chooses Atlas › Publish
- **THEN** the publish is refused, the sheet says to see the problems tab, and `problems` says the markers tab is missing the `logo_url` column
