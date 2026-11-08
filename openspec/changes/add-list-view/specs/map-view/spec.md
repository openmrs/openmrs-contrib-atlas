# Spec Delta

## MODIFIED Requirements

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

### Requirement: Usage analytics
When a Google Analytics measurement ID is configured, the site SHALL record page views and the events search, filter change, marker opened, list opened and download. When none is configured, no analytics requests SHALL be made.

#### Scenario: Staging without analytics
- **WHEN** the site is built without a measurement ID
- **THEN** no requests are sent to Google Analytics
