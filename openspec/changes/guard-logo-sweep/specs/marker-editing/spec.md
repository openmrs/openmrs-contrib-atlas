## MODIFIED Requirements

### Requirement: Unused logos are removed
The nightly publish SHALL delete each file in the bucket's `logos/` folder that no row of the `markers` tab uses, whatever its status, and that is more than one day old. It SHALL delete nothing when that would be more than 20 files, or more than 5 files and more than half of the folder, or when the tab has no `logo_url` column. Then it SHALL record why in `problems`, and every publish SHALL keep that note there while the cause remains. The sweep SHALL try again the next night.

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
