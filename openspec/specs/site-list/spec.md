# site-list Specification

## Purpose
A sortable list of the markers in view beside the map, so visitors can compare the implementations
in a region without opening them one at a time.

## Requirements

### Requirement: List of markers in view
A "List" control in the top bar SHALL open a list panel beside the map, and choosing it again or pressing Escape SHALL close it. The list SHALL contain every marker that matches the current filters and lies within the map's visible area, and SHALL update when the map stops moving or the filters change. A heading SHALL give the count, as "<n> implementations in view".

#### Scenario: Whole world
- **WHEN** a visitor opens the list at the first, whole-world view with no filters
- **THEN** it lists every published marker, and its heading count equals the implementations stat plus any closed markers

#### Scenario: Zoomed in on a region
- **WHEN** a visitor zooms in to Kenya and opens the list
- **THEN** only markers within the visible map area are listed

#### Scenario: Panning updates the list
- **WHEN** the list is open and the visitor pans the map to a different region
- **THEN** the list shows the markers in the new area once the map stops moving

#### Scenario: Filters apply
- **WHEN** the visitor filters to type "Research" with the list open
- **THEN** only Research markers in view are listed, and the count changes to match

#### Scenario: Nothing in view
- **WHEN** no matching marker lies in the visible area
- **THEN** the list says no implementations are in view and suggests zooming out or clearing filters

### Requirement: List entries
Each entry SHALL show the marker's name, then on a second line its country, type, number of sites when more than 1, and the month and year it was last confirmed, leaving out blank values. Closed markers SHALL be listed with "Closed". No contact or ownership details SHALL be shown.

#### Scenario: Entry content
- **WHEN** a marker named "Kampala Rollout" in Uganda, type "Clinical", with 12 sites, confirmed in March 2026 is in view
- **THEN** its entry shows "Kampala Rollout" and "Uganda · Clinical · 12 sites · Mar 2026"

#### Scenario: Closed site in the list
- **WHEN** a closed marker is in view and closed sites are not hidden
- **THEN** its entry shows "Closed"

### Requirement: Sorting the list
The list SHALL be sortable by name (A to Z, the default), country (A to Z, then name), number of sites (most first, blank counting as 1) or last confirmed (most recent first, never confirmed last). Ties SHALL be broken by name.

#### Scenario: Sort by sites
- **WHEN** the visitor sorts by number of sites
- **THEN** the marker with the most sites is listed first

#### Scenario: Sort by last confirmed
- **WHEN** the visitor sorts by last confirmed
- **THEN** the most recently confirmed marker is first and markers never confirmed are last

### Requirement: Opening a marker from the list
Choosing an entry SHALL open that marker's details and move the map to it, as choosing it on the map does, and SHALL record a marker-opened event. The list SHALL be reachable and operable by keyboard alone.

#### Scenario: Open from the list
- **WHEN** a visitor chooses an entry in the list
- **THEN** the map moves to that marker and its details are shown

#### Scenario: Keyboard-only visitor
- **WHEN** a visitor tabs to the List control, opens it, tabs to an entry and presses Enter
- **THEN** that marker's details open

### Requirement: Back to the list
Details opened from the list SHALL show a back control before the marker's name, labelled "Back to the list", that reopens the list with the same sort and with focus on that marker's entry. Backspace or Delete SHALL do the same, unless the person is typing in a field or holding Ctrl, Alt or Meta. Details opened from the map or from search SHALL NOT show it.

#### Scenario: Back with the control
- **WHEN** a visitor opens a marker from the list and chooses "<"
- **THEN** the list is shown again, sorted as before, with focus on that marker's entry

#### Scenario: Back with Backspace
- **WHEN** a visitor opens a marker from the list and presses Backspace while not typing in a field
- **THEN** the list is shown again with focus on that marker's entry

#### Scenario: Opened from search
- **WHEN** a visitor opens a marker by choosing a search result
- **THEN** its details show no back control and Backspace does nothing
