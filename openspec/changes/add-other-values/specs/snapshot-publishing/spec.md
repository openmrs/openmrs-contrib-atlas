## MODIFIED Requirements

### Requirement: Published snapshot contents
A publish SHALL produce `atlas.json` containing the generation time, the `types`, `distributions` and `versions` lists, and every valid marker whose `status` is `active` or `closed`, with only public marker fields, including `status`, plus a derived `country` (ISO 3166-1 alpha-2). Each distribution SHALL have its `name` and, when set, its `url`. A marker's `distribution` and `openmrs_version` SHALL be published as the list's entry when they match one ignoring case, and otherwise as the value in the sheet.

#### Scenario: Hidden markers excluded
- **WHEN** a marker's `status` is `hidden`
- **THEN** it does not appear in any published file

#### Scenario: Closed markers included
- **WHEN** a marker's `status` is `closed`
- **THEN** it appears in every published file with `status` `closed`

#### Scenario: Deleted markers excluded
- **WHEN** a marker's `status` is `deleted`
- **THEN** it does not appear in any published file

#### Scenario: Invalid rows excluded
- **WHEN** a marker row fails validation
- **THEN** it is left out of the snapshot and listed in `problems`
- **AND** all valid rows are still published

#### Scenario: Other value published
- **WHEN** a marker's `distribution` in the sheet is "AMPATH", which is not on the list
- **THEN** it is published, with `distribution` "AMPATH", and is not listed in `problems`

#### Scenario: List spelling published
- **WHEN** a marker's `distribution` in the sheet is "bahmni" and the list has "Bahmni"
- **THEN** it is published with `distribution` "Bahmni"

#### Scenario: Country derived from coordinates
- **WHEN** a marker is at latitude -1.29, longitude 36.82
- **THEN** its published `country` is `KE`
