## ADDED Requirements

### Requirement: Publish timings are logged
Each publish SHALL write one log line giving its caller, its result, its total time, and for each kind of sheet, bucket and drawing step the time taken and the number of calls. The line SHALL NOT contain emails, usernames or private sheet data.

#### Scenario: Publish after an edit
- **WHEN** a publish runs after an owner saves a marker
- **THEN** the logs hold one line with the publish's total time and the time spent reading the sheet, writing the snapshot files, writing `problems` and refreshing cards

#### Scenario: Refused publish
- **WHEN** a publish is refused by the safety check
- **THEN** its timing line is still logged, with the refusal as its result
