# Spec Delta

## Purpose

The public world map of OpenMRS implementations: what visitors see, how markers are drawn, and how they search, filter and share what they find.

## ADDED Requirements

### Requirement: Map loads quickly with all markers
On first load, the map SHALL show the whole world with every published marker visible, within 3 seconds on a simulated Fast 3G connection with an empty cache.

#### Scenario: First visit
- **WHEN** a visitor opens the Atlas with no query string
- **THEN** a world map shows every marker in the snapshot, with none hidden by default

#### Scenario: Snapshot unavailable
- **WHEN** the snapshot cannot be loaded
- **THEN** the map shows a message that the data could not be loaded and offers a retry

### Requirement: Map attribution
The map SHALL always display attribution for OpenStreetMap contributors and the tile provider, including in downloaded images.

#### Scenario: Attribution visible
- **WHEN** the map is displayed at any zoom level
- **THEN** OpenStreetMap and OpenFreeMap attribution is visible

### Requirement: Colour by attribute
Markers SHALL be coloured by type by default, and visitors SHALL be able to colour them by distribution or by OpenMRS version instead. A legend SHALL show the colour for each value present, with blank values shown as "Unknown".

#### Scenario: Switch to distribution
- **WHEN** a visitor chooses "Colour by distribution"
- **THEN** markers recolour by distribution and the legend lists the distributions present plus "Unknown" if any marker has none

### Requirement: Site counts on markers
A marker whose `site_count` is greater than 1 SHALL display that number inside the marker.

#### Scenario: Fifty-site implementation
- **WHEN** a marker has `site_count` 50
- **THEN** it is drawn with "50" inside it

#### Scenario: Single site
- **WHEN** a marker has a blank `site_count`
- **THEN** it is drawn with no number

### Requirement: Clusters count sites
Markers SHALL be drawn as teardrop pins with their tip on the site's position. Markers that overlap but can still be told apart SHALL stay separate pins. Only markers effectively indistinguishable at the current zoom (within a fraction of a pixel) SHALL be grouped into a cluster labelled with the total sites of its markers (summing `site_count`, blank counting as 1). Selecting a cluster SHALL zoom in until its markers separate.

#### Scenario: Cluster total
- **WHEN** markers with site counts 50, blank and 3 form one cluster
- **THEN** the cluster is labelled "54"

#### Scenario: Overlapping markers stay separate
- **WHEN** three markers overlap at the current zoom but are a few pixels apart
- **THEN** three separate pins are drawn, with no cluster

### Requirement: Gradual fading by freshness
A marker SHALL be fully opaque until 2 years after its `confirmed_at`, then fade linearly to 35% opacity at 5 years, and never fade below 35% or disappear.

#### Scenario: Recently confirmed
- **WHEN** a marker was confirmed 8 months ago
- **THEN** it is drawn at full opacity

#### Scenario: Long unconfirmed
- **WHEN** a marker was confirmed 9 years ago
- **THEN** it is drawn at 35% opacity and is still visible and selectable

### Requirement: Marker details
Selecting a marker SHALL show its name, logo, organisation, type, distribution, OpenMRS version, site count, website link, notes and the month and year it was last confirmed. Fields that are blank SHALL be omitted. Notes SHALL be shown as plain text, with web addresses made into links.

#### Scenario: Popup content
- **WHEN** a visitor selects a marker with a name, website and notes but no logo
- **THEN** the details show the name, a working website link and the notes, with no empty logo space

#### Scenario: Markup in notes
- **WHEN** a marker's notes contain `<script>` or HTML tags
- **THEN** they are shown as literal text and nothing is executed

### Requirement: Search
Visitors SHALL be able to search markers by name, organisation or country name. Selecting a result SHALL move the map to that marker and open its details.

#### Scenario: Search by country
- **WHEN** a visitor types "Uganda"
- **THEN** the results include markers whose country is Uganda

### Requirement: Filters
Visitors SHALL be able to filter markers by type, distribution, OpenMRS version, country, and "confirmed within the last N years". Filters SHALL apply to markers, clusters, legend and headline stats together, and SHALL be clearable in one action.

#### Scenario: Hide old markers on request
- **WHEN** a visitor selects "confirmed within the last 2 years"
- **THEN** only markers confirmed in the last 2 years are shown, and the stats reflect only those markers

#### Scenario: Clear filters
- **WHEN** a visitor chooses "Clear filters"
- **THEN** every published marker is shown again

### Requirement: Headline stats
The map SHALL show the number of markers, countries and total sites, and how many markers were confirmed in the last 2 years, for the markers currently matching the filters.

#### Scenario: Default stats
- **WHEN** no filters are applied
- **THEN** the stats count every published marker, and "confirmed in the last 2 years" counts those with `confirmed_at` within 2 years of today

### Requirement: Shareable URLs
The page URL SHALL reflect the map view, colour-by choice, filters and selected marker, so that opening a copied URL restores the same view. The 2.0 form `/?marker=<id>` SHALL open that marker.

#### Scenario: Legacy marker link
- **WHEN** a visitor opens `/?marker=<id>` for a published marker
- **THEN** the map centres on that marker and opens its details

#### Scenario: Unknown marker link
- **WHEN** a visitor opens `/?marker=<id>` for an id not in the snapshot
- **THEN** the world map loads normally and a notice says the site was not found

#### Scenario: Copied view
- **WHEN** a visitor filters to Research markers in Kenya, copies the URL and opens it in another browser
- **THEN** the same filters, map area and colouring are shown

### Requirement: Works on phones
The map, search, filters, legend and marker details SHALL be usable on a 360 pixel wide touch screen without horizontal scrolling.

#### Scenario: Phone visitor
- **WHEN** a visitor opens the Atlas on a 360 pixel wide phone
- **THEN** they can search, filter and open marker details using touch alone

### Requirement: Keyboard access
Search, filters, the colour-by choice, the download controls and marker details SHALL be operable by keyboard, and search results SHALL give keyboard users a way to reach any marker.

#### Scenario: Keyboard-only visitor
- **WHEN** a visitor uses only the keyboard
- **THEN** they can search for a site, open its details and close them again

### Requirement: Usage analytics
When a Google Analytics measurement ID is configured, the site SHALL record page views and the events search, filter change, marker opened and download. When none is configured, no analytics requests SHALL be made.

#### Scenario: Staging without analytics
- **WHEN** the site is built without a measurement ID
- **THEN** no requests are sent to Google Analytics
