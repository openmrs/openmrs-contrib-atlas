## MODIFIED Requirements

### Requirement: Colour by attribute
Markers SHALL be coloured by type by default, and visitors SHALL be able to colour them by distribution or by OpenMRS version instead. A legend SHALL show the colour for each value present among markers that are not closed, with blank values shown as "Unknown", and SHALL show a "Closed" entry when any closed marker is on the map. Coloured by distribution or version, every Other value (one not on its list, including `Other` itself) SHALL share one colour and one legend entry, "Other", listed after the values on the list and before "Unknown".

#### Scenario: Switch to distribution
- **WHEN** a visitor chooses "Colour by distribution"
- **THEN** markers recolour by distribution and the legend lists the distributions present plus "Unknown" if any marker has none

#### Scenario: Other values in the legend
- **WHEN** markers have the distributions "AMPATH" and "OpenMRS 1.x MDRTB", neither on the list, and the map is coloured by distribution
- **THEN** both share the "Other" colour, and the legend has one "Other" entry and lists neither name

#### Scenario: Closed sites in the legend
- **WHEN** a closed marker is the only one with distribution "Bahmni"
- **THEN** the legend, coloured by distribution, shows "Closed" and does not list "Bahmni"

### Requirement: Marker details
Selecting a marker SHALL show its name, logo, organisation, type, distribution, OpenMRS version, site count, website link, notes and the month and year it was last confirmed, and SHALL say so if the site is closed. Fields that are blank SHALL be omitted. Notes SHALL be shown as plain text, with web addresses made into links. An Other distribution or version SHALL be shown as its value.

#### Scenario: Popup content
- **WHEN** a visitor selects a marker with a name, website and notes but no logo
- **THEN** the details show the name, a working website link and the notes, with no empty logo space

#### Scenario: Other value in the details
- **WHEN** a visitor selects a marker whose distribution is "AMPATH", which is not on the list
- **THEN** the details show the distribution "AMPATH"

#### Scenario: Markup in notes
- **WHEN** a marker's notes contain `<script>` or HTML tags
- **THEN** they are shown as literal text and nothing is executed

#### Scenario: Closed site details
- **WHEN** a visitor selects a closed marker
- **THEN** the details show "Closed" as its status

### Requirement: Filters
Visitors SHALL be able to filter markers by type, distribution, OpenMRS version, country, and "confirmed within the last N years", and to hide closed sites. Closed sites SHALL be shown unless hidden. Filters SHALL apply to markers, clusters, legend and headline stats together, and SHALL be clearable in one action. The control that opens the filters SHALL sit inside the search box and SHALL show when any filter is on. The distribution and version filters SHALL offer the values on their lists that are present, then one "Other" that matches every Other value, then "Unknown".

#### Scenario: Hide old markers on request
- **WHEN** a visitor selects "confirmed within the last 2 years"
- **THEN** only markers confirmed in the last 2 years are shown, and the stats reflect only those markers

#### Scenario: Filter by Other
- **WHEN** a visitor filters by the distribution "Other"
- **THEN** every marker whose distribution is an Other value is shown, and no other marker

#### Scenario: Clear filters
- **WHEN** a visitor chooses "Clear filters"
- **THEN** every published marker is shown again

#### Scenario: Hide closed sites
- **WHEN** a visitor turns off "Show closed sites"
- **THEN** closed markers leave the map and the legend's "Closed" entry goes, and a copied URL keeps that choice
