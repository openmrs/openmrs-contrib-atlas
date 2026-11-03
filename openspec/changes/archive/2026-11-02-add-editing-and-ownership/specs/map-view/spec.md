# Spec Delta

## ADDED Requirements

### Requirement: Closed sites on the map
A marker with status `closed` SHALL be drawn as a grey pin whatever the colour-by choice. It SHALL otherwise behave like any other marker: it shows its site count when greater than 1, fades by freshness, counts towards the total of a cluster it falls into, and can be selected and found by search. It SHALL NOT be more prominent than other markers, and SHALL be drawn beneath them where they overlap.

#### Scenario: Closed site with many sites
- **WHEN** a closed marker has `site_count` 50 and was confirmed 9 years ago
- **THEN** it is a grey pin showing "50", drawn at 60% opacity

#### Scenario: Closed pin overlapping an active pin
- **WHEN** a closed marker and an active marker overlap
- **THEN** the active pin is drawn on top

#### Scenario: Closed site in search results
- **WHEN** a visitor's search matches a closed marker
- **THEN** the result says it is closed

## MODIFIED Requirements

### Requirement: Colour by attribute
Markers SHALL be coloured by type by default, and visitors SHALL be able to colour them by distribution or by OpenMRS version instead. A legend SHALL show the colour for each value present among markers that are not closed, with blank values shown as "Unknown", and SHALL show a "Closed" entry when any closed marker is on the map.

#### Scenario: Switch to distribution
- **WHEN** a visitor chooses "Colour by distribution"
- **THEN** markers recolour by distribution and the legend lists the distributions present plus "Unknown" if any marker has none

#### Scenario: Closed sites in the legend
- **WHEN** a closed marker is the only one with distribution "Bahmni"
- **THEN** the legend, coloured by distribution, shows "Closed" and does not list "Bahmni"

### Requirement: Marker details
Selecting a marker SHALL show its name, logo, organisation, type, distribution, OpenMRS version, site count, website link, notes and the month and year it was last confirmed, and SHALL say so if the site is closed. Fields that are blank SHALL be omitted. Notes SHALL be shown as plain text, with web addresses made into links.

#### Scenario: Popup content
- **WHEN** a visitor selects a marker with a name, website and notes but no logo
- **THEN** the details show the name, a working website link and the notes, with no empty logo space

#### Scenario: Markup in notes
- **WHEN** a marker's notes contain `<script>` or HTML tags
- **THEN** they are shown as literal text and nothing is executed

#### Scenario: Closed site details
- **WHEN** a visitor selects a closed marker
- **THEN** the details show "Closed" as its status

### Requirement: Filters
Visitors SHALL be able to filter markers by type, distribution, OpenMRS version, country, and "confirmed within the last N years", and to hide closed sites. Closed sites SHALL be shown unless hidden. Filters SHALL apply to markers, clusters, legend and headline stats together, and SHALL be clearable in one action. The control that opens the filters SHALL sit inside the search box and SHALL show when any filter is on.

#### Scenario: Hide old markers on request
- **WHEN** a visitor selects "confirmed within the last 2 years"
- **THEN** only markers confirmed in the last 2 years are shown, and the stats reflect only those markers

#### Scenario: Clear filters
- **WHEN** a visitor chooses "Clear filters"
- **THEN** every published marker is shown again

#### Scenario: Hide closed sites
- **WHEN** a visitor turns off "Show closed sites"
- **THEN** closed markers leave the map and the legend's "Closed" entry goes, and a copied URL keeps that choice

### Requirement: Headline stats
The map SHALL show the number of markers, countries and total sites, and how many markers were confirmed in the last 2 years, for the markers currently matching the filters. Closed markers SHALL NOT be counted in any of them.

#### Scenario: Default stats
- **WHEN** no filters are applied
- **THEN** the stats count every published marker that is not closed, and "confirmed in the last 2 years" counts those with `confirmed_at` within 2 years of today

#### Scenario: Closed site not counted
- **WHEN** an owner closes a marker with 50 sites, the only one in its country
- **THEN** implementations fall by 1, sites by 50 and countries by 1, and the pin stays on the map

### Requirement: Works on phones
The map, search, filters, legend and marker details SHALL be usable on a 360 pixel wide touch screen without horizontal scrolling, and the top bar SHALL fit on one line at that width.

#### Scenario: Phone visitor
- **WHEN** a visitor opens the Atlas on a 360 pixel wide phone
- **THEN** they can search, filter and open marker details using touch alone

#### Scenario: Top bar on a phone
- **WHEN** the Atlas is open on a 360 pixel wide phone, signed in or not
- **THEN** the name, search box, download and account controls share one line

#### Scenario: First view on a phone
- **WHEN** a visitor opens the Atlas with no query string on a 360 pixel wide phone
- **THEN** the map zooms out far enough to span every published marker from west to east

#### Scenario: First view on a wide screen
- **WHEN** a visitor opens the Atlas with no query string on a screen wider than one copy of the world at the usual zoom
- **THEN** the map shows exactly one copy of the world across its width, with no longitudes repeated
