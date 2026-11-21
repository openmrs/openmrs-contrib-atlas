## ADDED Requirements

### Requirement: The daily job doesn't hold up edits
While the daily job looks up accounts and sends emails, edits SHALL NOT wait for it. The job SHALL hold the write queue only while it reads the sheet and while it records results. A run started while another is in progress SHALL be refused, and SHALL send nothing.

#### Scenario: Edit during the job
- **WHEN** an owner saves an edit while the daily job is sending 50 reminders
- **THEN** the edit is saved without waiting for the remaining reminders

#### Scenario: Overlapping runs
- **WHEN** the daily job is started while a run is still in progress
- **THEN** the second run is refused with 409, and no reminder is sent twice
