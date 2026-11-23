## MODIFIED Requirements

### Requirement: Logo addresses come from uploads
A `logo_url` set through the Atlas SHALL be blank or an address in the Atlas's public `logos/` folder, `<site>/data/logos/`. Any other address SHALL be refused, with the reason given for the logo field, and nothing SHALL be written. Values already in the sheet, and values admins type into the sheet, SHALL NOT be checked.

#### Scenario: Address from an upload
- **WHEN** a person saves a marker with the address the logo upload returned
- **THEN** it is saved

#### Scenario: Address elsewhere
- **WHEN** a request sets `logo_url` to `https://tracker.example/pixel.png`
- **THEN** nothing is written and the logo field says the logo must be uploaded to the Atlas

#### Scenario: Old bucket address
- **WHEN** a request sets `logo_url` to an address in the retired Cloud Storage bucket
- **THEN** nothing is written and the logo field says the logo must be uploaded to the Atlas

### Requirement: Unused logos are removed
The nightly publish SHALL delete each file in the Atlas's `logos/` folder that no row of the `markers` tab uses, whatever its status, and that is more than one day old. It SHALL delete nothing when that would be more than 20 files, or more than 5 files and more than half of the folder, or when the tab has no `logo_url` column. Then it SHALL record why in `problems`, and every publish SHALL keep that note there while the cause remains. The sweep SHALL try again the next night.

#### Scenario: Abandoned upload
- **WHEN** a logo was uploaded two days ago and its form was never saved
- **THEN** the next nightly publish deletes it

#### Scenario: Upload being edited
- **WHEN** a logo was uploaded an hour ago and its form is still open
- **THEN** the nightly publish keeps it

#### Scenario: Deleted marker
- **WHEN** a marker with a logo has status `deleted`
- **THEN** its logo is kept, so an admin can restore the marker

#### Scenario: Column cleared by mistake
- **WHEN** someone clears the `logo_url` column of 39 markers with logos, and the nightly publish runs
- **THEN** no logo is deleted, the publish otherwise goes ahead, and `problems` says the sweep held back 39 logos

#### Scenario: Column renamed
- **WHEN** the `logo_url` header is renamed and the nightly publish runs
- **THEN** the publish is refused, no logo is deleted, and `problems` says the markers tab is missing the `logo_url` column

#### Scenario: Edit while held back
- **WHEN** the sweep is held back and someone edits a marker the next morning
- **THEN** the publish after the edit deletes nothing, and the note stays in `problems`

#### Scenario: Sheet fixed
- **WHEN** the column is restored from version history the next day
- **THEN** the next publish removes the note, and that night's sweep deletes only the logos no row uses

#### Scenario: Addresses not yet moved
- **WHEN** the sheet's `logo_url` values still name the old bucket after the logos were copied to the folder, and the nightly publish runs
- **THEN** the sweep holds back, no logo is deleted, and `problems` says why

### Requirement: Edit timings are logged
Each write request to the Atlas service SHALL write one log line giving its route pattern, its response status, its total time, and for each kind of sheet, file and account call the time taken and the number of calls, including the publish that follows. The line SHALL name the route pattern, never the requested path, and SHALL NOT contain emails, usernames or private sheet data.

#### Scenario: Editor added
- **WHEN** an owner adds an editor
- **THEN** the logs hold one line for `POST /markers/:id/editors` with the total time, the account lookup, the sheet reads and writes, and the publish

#### Scenario: Username in the path
- **WHEN** an owner removes the editor `jdoe`
- **THEN** the timing line names `DELETE /markers/:id/editors/:username` and does not contain `jdoe`

#### Scenario: Refused request
- **WHEN** a request is refused, for example with 403 or 429
- **THEN** its timing line is still logged with that status

## ADDED Requirements

### Requirement: Logo addresses can be moved in bulk
A maintainer SHALL be able to rewrite every `logo_url` in an environment's sheet that starts with one address to start with another, so logos keep working when they move. The rewrite SHALL show what it would change and write nothing unless told to apply, and SHALL leave every other value untouched. Like an admin's direct sheet edit, it SHALL NOT restart any marker's freshness clock or add items to the change feed.

#### Scenario: Preview
- **WHEN** a maintainer runs the rewrite from the bucket address to `https://atlas-stg.openmrs.org/data/logos/` without applying
- **THEN** it reports how many values it would change and writes nothing

#### Scenario: Apply
- **WHEN** the maintainer runs it again and applies
- **THEN** those values start with the new address, no other cell is changed, and the feed and every `confirmed_at` are as before

#### Scenario: Moving back
- **WHEN** the move is rolled back and the maintainer rewrites from the new address to the bucket address
- **THEN** the values name the bucket again
