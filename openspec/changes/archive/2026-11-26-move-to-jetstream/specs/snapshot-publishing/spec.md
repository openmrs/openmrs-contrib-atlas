## MODIFIED Requirements

### Requirement: Publish timings are logged
Each publish SHALL write one log line giving its caller, its result, its total time, and for each kind of sheet, file and drawing step the time taken and the number of calls. The line SHALL NOT contain emails, usernames or private sheet data.

#### Scenario: Publish after an edit
- **WHEN** a publish runs after an owner saves a marker
- **THEN** the logs hold one line with the publish's total time and the time spent reading the sheet, writing the snapshot files, writing `problems` and refreshing cards

#### Scenario: Refused publish
- **WHEN** a publish is refused by the safety check
- **THEN** its timing line is still logged, with the refusal as its result

## ADDED Requirements

### Requirement: Published files are replaced whole
Each published file, social card and logo SHALL be written so that a visitor fetching it during a publish gets either the old file or the new one complete, never part of one. A publish that fails partway SHALL leave every file it had not yet replaced as it was.

#### Scenario: Visitor during a publish
- **WHEN** a visitor fetches `/data/atlas.json` while a publish is writing it
- **THEN** the visitor gets a complete, valid snapshot

### Requirement: Snapshot history is kept for 90 days
Each publish SHALL keep a copy of `atlas.json` in the data folder's `history/` folder, which SHALL NOT be served to visitors. The nightly publish SHALL delete history copies more than 90 days old.

#### Scenario: Old history
- **WHEN** the nightly publish runs and a history copy is 91 days old
- **THEN** that copy is deleted, and copies from the last 90 days are kept

#### Scenario: History not public
- **WHEN** a visitor requests a file under `/data/history/`
- **THEN** the service answers 404
