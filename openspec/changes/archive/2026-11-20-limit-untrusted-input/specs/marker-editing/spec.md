## ADDED Requirements

### Requirement: Logo addresses come from uploads
A `logo_url` set through the Atlas SHALL be blank or an address in the public bucket's `logos/` folder. Any other address SHALL be refused, with the reason given for the logo field, and nothing SHALL be written. Values already in the sheet, and values admins type into the sheet, SHALL NOT be checked.

#### Scenario: Address from an upload
- **WHEN** a person saves a marker with the address the logo upload returned
- **THEN** it is saved

#### Scenario: Address elsewhere
- **WHEN** a request sets `logo_url` to `https://tracker.example/pixel.png`
- **THEN** nothing is written and the logo field says the logo must be uploaded to the Atlas

### Requirement: Daily limits on adding and uploading
A person who isn't an admin SHALL be able to add at most 5 markers and upload at most 20 logos per day (UTC). A request past a limit SHALL be refused with 429 and a message to try again tomorrow, and SHALL write nothing. Admins SHALL have no limit. The counts MAY reset when the service restarts.

#### Scenario: Sixth add
- **WHEN** a person who isn't an admin adds a sixth marker on the same day
- **THEN** it is refused with a message to try again tomorrow, and nothing is written or emailed

#### Scenario: Admin bulk add
- **WHEN** an admin adds a sixth marker on the same day
- **THEN** it is added

### Requirement: Unused logos are removed
The nightly publish SHALL delete each file in the bucket's `logos/` folder that no row of the `markers` tab uses, whatever its status, and that is more than one day old.

#### Scenario: Abandoned upload
- **WHEN** a logo was uploaded two days ago and its form was never saved
- **THEN** the next nightly publish deletes it

#### Scenario: Upload being edited
- **WHEN** a logo was uploaded an hour ago and its form is still open
- **THEN** the nightly publish keeps it

#### Scenario: Deleted marker
- **WHEN** a marker with a logo has status `deleted`
- **THEN** its logo is kept, so an admin can restore the marker
