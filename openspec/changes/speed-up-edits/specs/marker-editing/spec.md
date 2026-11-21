## ADDED Requirements

### Requirement: Edit timings are logged
Each write request to the Atlas service SHALL write one log line giving its route pattern, its response status, its total time, and for each kind of sheet, bucket and account call the time taken and the number of calls, including the publish that follows. The line SHALL name the route pattern, never the requested path, and SHALL NOT contain emails, usernames or private sheet data.

#### Scenario: Editor added
- **WHEN** an owner adds an editor
- **THEN** the logs hold one line for `POST /markers/:id/editors` with the total time, the account lookup, the sheet reads and writes, and the publish

#### Scenario: Username in the path
- **WHEN** an owner removes the editor `jdoe`
- **THEN** the timing line names `DELETE /markers/:id/editors/:username` and does not contain `jdoe`

#### Scenario: Refused request
- **WHEN** a request is refused, for example with 403 or 429
- **THEN** its timing line is still logged with that status
