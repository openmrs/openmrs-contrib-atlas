## MODIFIED Requirements

### Requirement: Optional marker fields
The form SHALL offer organisation, website, logo, notes, distribution, OpenMRS version, site count, contact name and contact email, and SHALL explain that contact details are not published. Distribution and version SHALL each be chosen from their list, or as "Other" with a free-text value. A free-text distribution SHALL be at most 30 characters and a free-text version at most 12, and the service SHALL refuse longer ones. A free-text value that matches a list entry ignoring case SHALL be saved as that entry. "Other" with the text left blank SHALL be saved as `Other`.

#### Scenario: Pick lists
- **WHEN** a person opens the form
- **THEN** type is chosen from the current `types` list, and distribution and version from the current `distributions` and `versions` lists, each followed by "Other"

#### Scenario: Choosing Other
- **WHEN** a person chooses "Other" as the distribution
- **THEN** a text field appears for the distribution's name, limited to 30 characters

#### Scenario: Saving an Other value
- **WHEN** a person chooses "Other" as the version, types "2.4.2" and saves
- **THEN** the marker's `openmrs_version` is "2.4.2"

#### Scenario: Other value typed like a list entry
- **WHEN** a person chooses "Other" as the distribution, types "bahmni" and saves
- **THEN** the marker's `distribution` is "Bahmni", the entry on the list

#### Scenario: Other left blank
- **WHEN** a person chooses "Other" as the version, leaves the text blank and saves
- **THEN** the marker's `openmrs_version` is "Other"

#### Scenario: Editing a marker with an Other value
- **WHEN** a person edits a marker whose distribution is "AMPATH", which is not on the list
- **THEN** the form shows "Other" chosen, with "AMPATH" in the text field

#### Scenario: Too long
- **WHEN** a request saves a distribution of 31 characters that is not on the list
- **THEN** nothing is written and the form says the distribution must be 30 characters or fewer
