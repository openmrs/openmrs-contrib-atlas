# Spec Delta

## Purpose

Copies Atlas 2.0 data from its MySQL database into an Atlas 3.0 sheet so that every existing marker, owner and logo carries over, and can be re-run at cutover.

## ADDED Requirements

### Requirement: Full, repeatable migration
The migration SHALL read the Atlas 2.0 database without modifying it and SHALL replace the full contents of the target sheet's data tabs on each run, so that running it twice on the same source gives the same sheet.

#### Scenario: Re-run before cutover
- **WHEN** the migration runs against staging, 2.0 data changes, and it runs again
- **THEN** the sheet reflects the 2.0 data at the time of the second run
- **AND** edits made only in the staging sheet are replaced

#### Scenario: Source untouched
- **WHEN** the migration completes
- **THEN** no row in the Atlas 2.0 database has been inserted, updated or deleted

### Requirement: Every marker carried over
Every row of the 2.0 `atlas` table SHALL become one `markers` row with the same `id`, so that `/?marker=<id>` links from 2.0 resolve to the same site. Migrated markers SHALL have `status` `active`.

#### Scenario: Marker count matches
- **WHEN** the 2.0 database has 451 markers
- **THEN** the sheet has 451 marker rows with the same 451 ids

#### Scenario: Invalid 2.0 data still imported
- **WHEN** a 2.0 marker has a malformed URL
- **THEN** it is still imported, and the validation run lists it in `problems` for an admin to fix

### Requirement: Field mapping
The migration SHALL map 2.0 fields as follows: `date_changed` becomes both `updated_at` and `confirmed_at`; `date_created` becomes `created_at` (falling back to `date_changed` when missing or zero); the distribution id becomes its name; `contact` and `email` go to `private`; patient, encounter and observation counts and module data are dropped.

#### Scenario: Zero creation date
- **WHEN** a 2.0 marker has `date_created` of `0000-00-00 00:00:00`
- **THEN** its `created_at` is its `date_changed`

#### Scenario: Contact details stay private
- **WHEN** a 2.0 marker has a contact email
- **THEN** the email is in that marker's `private` row and not in `markers`

### Requirement: Version normalisation
A 2.0 `openmrs_version` SHALL map to a `versions` entry when it matches one, after trimming and ignoring a leading "v" or trailing patch numbers; otherwise it SHALL become `Other`. A blank version SHALL stay blank.

#### Scenario: Patch version
- **WHEN** a 2.0 marker's version is "2.4.2"
- **THEN** its migrated `openmrs_version` is "2.4"

#### Scenario: Unrecognised version
- **WHEN** a 2.0 marker's version is "custom build"
- **THEN** its migrated `openmrs_version` is "Other"

### Requirement: Owners and editors
Each marker's `owner` SHALL be the first 2.0 `auth` principal with `ALL` privileges, else its `created_by`, else blank. Other person principals for that marker SHALL become `editors`. Module principals (UUIDs) SHALL be dropped.

#### Scenario: Marker with a delegate
- **WHEN** a 2.0 marker has `auth` rows for "jdoe" (ALL) and "asmith" (ALL)
- **THEN** `owner` is "jdoe" and `editors` is "asmith"

#### Scenario: Orphan marker
- **WHEN** a 2.0 marker has no `auth` rows and an empty `created_by`
- **THEN** `owner` is blank and the marker is counted as an orphan in the report

### Requirement: Logos carried over
Each 2.0 marker image SHALL be converted to PNG, JPEG or WebP no larger than 300 × 300 pixels, stored in public storage, and referenced by the marker's `logo_url`.

#### Scenario: Large image
- **WHEN** a 2.0 image is 800 × 400 pixels
- **THEN** the stored logo is 300 × 150 pixels and `logo_url` points to it

### Requirement: Migration report
Each run SHALL print a report with counts of markers, owners, orphans, logos, unmapped versions and rows failing validation, and SHALL support a dry run that writes nothing.

#### Scenario: Dry run
- **WHEN** the migration runs in dry-run mode
- **THEN** the report is printed and neither the sheet nor storage is changed
