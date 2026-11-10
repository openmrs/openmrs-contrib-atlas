# map-view Specification

## Purpose
The public world map of OpenMRS implementations: what visitors see, how markers are drawn, and how they search, filter and share what they find.

## Requirements

### Requirement: Map loads quickly with all markers
On first load, the map SHALL show the whole world with every published marker visible, within 3 seconds on a simulated Fast 4G connection with an empty cache. The base map may finish loading after the markers appear.

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
Markers SHALL be coloured by type by default, or by distribution or OpenMRS version. A legend SHALL show the colour of each value present among markers that are not closed, with blank values as "Unknown", and a "Closed" entry when any closed marker is on the map. Every Other distribution or version (one not on its list, or `Other` itself) SHALL share one colour and one legend entry, "Other", after the list values and before "Unknown".

#### Scenario: Switch to distribution
- **WHEN** a visitor chooses "Colour by distribution"
- **THEN** markers recolour by distribution and the legend lists the distributions present plus "Unknown" if any marker has none

#### Scenario: Other values in the legend
- **WHEN** markers have the distributions "AMPATH" and "OpenMRS 1.x MDRTB", neither on the list, and the map is coloured by distribution
- **THEN** both share the "Other" colour, and the legend has one "Other" entry and lists neither name

#### Scenario: Closed sites in the legend
- **WHEN** a closed marker is the only one with distribution "Bahmni"
- **THEN** the legend, coloured by distribution, shows "Closed" and does not list "Bahmni"

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
A marker SHALL be fully opaque until 2 years after its `confirmed_at`, then fade linearly to 60% opacity at 5 years, and never fade below 60% or disappear.

#### Scenario: Recently confirmed
- **WHEN** a marker was confirmed 8 months ago
- **THEN** it is drawn at full opacity

#### Scenario: Long unconfirmed
- **WHEN** a marker was confirmed 9 years ago
- **THEN** it is drawn at 60% opacity and is still visible and selectable

#### Scenario: Cluster fading
- **WHEN** nine markers at 60% opacity and one at 80% form a cluster
- **THEN** the cluster is drawn at 62% opacity, the average of its markers

#### Scenario: Counts stay readable
- **WHEN** a faded pin shows a count of sites
- **THEN** the pin is faded and the count is drawn at full opacity

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

### Requirement: Search
Visitors SHALL be able to search markers by name, organisation or country name. Selecting a result SHALL move the map to that marker and open its details.

#### Scenario: Search by country
- **WHEN** a visitor types "Uganda"
- **THEN** the results include markers whose country is Uganda

### Requirement: Filters
Visitors SHALL be able to filter by type, distribution, OpenMRS version, country and "confirmed within the last N years", and to hide closed sites, which are otherwise shown. Filters SHALL apply to markers, clusters, legend and stats together, and clear in one action. Their control SHALL sit inside the search box and show when any filter is on. Distribution and version filters SHALL offer the list values present, then one "Other" matching every Other value, then "Unknown".

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

### Requirement: Headline stats
The map SHALL show the number of markers, countries and total sites, and how many markers were confirmed in the last 2 years, for the markers currently matching the filters. Closed markers SHALL NOT be counted in any of them.

#### Scenario: Default stats
- **WHEN** no filters are applied
- **THEN** the stats count every published marker that is not closed, and "confirmed in the last 2 years" counts those with `confirmed_at` within 2 years of today

#### Scenario: Closed site not counted
- **WHEN** an owner closes a marker with 50 sites, the only one in its country
- **THEN** implementations fall by 1, sites by 50 and countries by 1, and the pin stays on the map

### Requirement: Shareable URLs
The page URL SHALL reflect the map view, colour-by choice, filters, selected marker, and whether the list is open and how it is sorted, so that opening a copied URL restores the same view. The 2.0 form `/?marker=<id>` SHALL open that marker.

#### Scenario: Legacy marker link
- **WHEN** a visitor opens `/?marker=<id>` for a published marker
- **THEN** the map centres on that marker and opens its details

#### Scenario: Unknown marker link
- **WHEN** a visitor opens `/?marker=<id>` for an id not in the snapshot
- **THEN** the world map loads normally and a notice says the site was not found

#### Scenario: Copied view
- **WHEN** a visitor filters to Research markers in Kenya, copies the URL and opens it in another browser
- **THEN** the same filters, map area and colouring are shown

#### Scenario: Copied list
- **WHEN** a visitor opens the list sorted by number of sites, copies the URL and opens it in another browser
- **THEN** the list is open, sorted by number of sites, for the same map area

### Requirement: Works on phones
The map, search, filters, list, legend and marker details SHALL be usable on a 360 pixel wide touch screen without horizontal scrolling, and the top bar SHALL fit on one line at that width.

#### Scenario: Phone visitor
- **WHEN** a visitor opens the Atlas on a 360 pixel wide phone
- **THEN** they can search, filter, open the list and open marker details using touch alone

#### Scenario: Top bar on a phone
- **WHEN** the Atlas is open on a 360 pixel wide phone, signed in or not
- **THEN** the name, search box, list, download and account controls share one line

#### Scenario: First view on a phone
- **WHEN** a visitor opens the Atlas with no query string on a 360 pixel wide phone
- **THEN** the map zooms out far enough to span every published marker from west to east

#### Scenario: First view on a wide screen
- **WHEN** a visitor opens the Atlas with no query string on a screen wider than one copy of the world at the usual zoom
- **THEN** the map shows exactly one copy of the world across its width, with no longitudes repeated

### Requirement: Keyboard access
Search, filters, the colour-by choice, the download controls and marker details SHALL be operable by keyboard, and search results SHALL give keyboard users a way to reach any marker. Escape SHALL close the open marker, filter or download panel wherever focus is, except in the search box, where it SHALL only clear the search. Pressing `/` SHALL move focus to the search box unless the visitor is typing in a field.

#### Scenario: Keyboard-only visitor
- **WHEN** a visitor uses only the keyboard
- **THEN** they can search for a site, open its details and close them again

#### Scenario: Escape with focus on the map
- **WHEN** a marker panel is open and focus is on the map
- **THEN** pressing Escape closes the panel

#### Scenario: Escape closes the filter or download panel
- **WHEN** the filter or download panel is open
- **THEN** pressing Escape closes it

#### Scenario: Escape with a marker selected behind a panel
- **WHEN** the filter or download panel is open while a marker is selected
- **THEN** pressing Escape closes that panel and shows the marker panel again, and pressing it again closes the marker panel

#### Scenario: Escape in the search box
- **WHEN** a panel is open and focus is in the search box
- **THEN** pressing Escape clears the search and closes its list of results, and the panel stays open

#### Scenario: Slash moves focus to search
- **WHEN** a visitor presses `/` while not typing in a field
- **THEN** focus moves to the search box and no `/` is typed into it

#### Scenario: Slash while typing
- **WHEN** a visitor presses `/` while typing in a field
- **THEN** the `/` is typed as usual

### Requirement: Backspace returns to My markers
When a marker was opened from My markers, pressing Backspace or Delete SHALL return to My markers unless the person is typing in a field or holding Ctrl, Alt or Meta.

#### Scenario: Backspace back to My markers
- **WHEN** a person opened a marker from My markers and presses Backspace (Delete on a Mac) while not typing in a field
- **THEN** My markers is shown again where they left it

#### Scenario: Backspace while typing
- **WHEN** a person presses Backspace while typing in a field
- **THEN** a character is deleted as usual and the panel stays open

#### Scenario: Backspace on a marker opened from the map
- **WHEN** a marker was opened from the map and the person presses Backspace
- **THEN** nothing happens

### Requirement: Usage analytics
When a Google Analytics measurement ID is configured, the site SHALL record page views and the events search, filter change, marker opened, list opened, download, share and claim. The share event SHALL record which method was used. When none is configured, no analytics requests SHALL be made.

#### Scenario: Staging without analytics
- **WHEN** the site is built without a measurement ID
- **THEN** no requests are sent to Google Analytics

#### Scenario: Sharing on LinkedIn
- **WHEN** analytics is configured and a visitor presses LinkedIn in the Share dialog
- **THEN** a share event is recorded with the method "linkedin"

#### Scenario: Claim sent
- **WHEN** analytics is configured and a signed-in person sends a claim
- **THEN** a claim event is recorded with the marker's id and nothing from the message

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
