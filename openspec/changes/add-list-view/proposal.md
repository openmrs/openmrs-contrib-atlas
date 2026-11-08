# Proposal

## Why

The map shows where implementations are, but not what they are at a glance. To compare sites in
a region, a visitor opens markers one at a time. Atlas 2.0 offered a list, and the design spec
makes it a Should for Phase 3 (M8: "a sortable list of the sites on screen, beside the
map"). It is the next item agreed for before the 3.0 announcement.

## What Changes

- A "List" button in the top bar opens a list panel beside the map, in the same place as the other
  panels (a bottom sheet on phones).
- The list shows the markers that match the current filters and lie within the map's visible
  area. It updates as the visitor pans, zooms or changes filters. At the first, whole-world view
  it shows every marker.
- Each entry shows the name, then country, type, number of sites and the month last confirmed,
  and "Closed" for closed sites. A heading gives the count, for example "38 implementations in
  view".
- The list can be sorted by name, country, number of sites or last confirmed. Name is the
  default.
- Choosing an entry opens that marker's details, as choosing it on the map does. Details opened
  from the list get a "<" back control, and Backspace or Delete, that return to the list with
  focus on that entry, as already happens for My markers.
- The open list and a sort other than name are kept in the page URL, so a shared link opens the
  same list.
- A `list_open` analytics event is recorded when the list opens.

Out of scope:
- A table with column headers. The panel is 340 pixels wide, so entries are two-line rows with a
  "Sort by" choice instead.
- Highlighting a marker on the map while hovering its entry.
- Downloading the list. The existing download panel already offers CSV and GeoJSON.
- Search inside the list. The search box already finds any marker.
- Paging or virtual scrolling. There are fewer than 500 published markers.

## Capabilities

### New Capabilities
- `site-list`: the list of markers in view beside the map: what it shows, how it is sorted, and
  how it leads to and back from marker details.

### Modified Capabilities
- `map-view`: "Shareable URLs" also restores the open list and its sort, and "Usage analytics"
  adds the list-open event.

## Impact

- Site only (`web/`): a new `SiteList` component, a list icon, `App.tsx` panel state, the map's
  visible bounds reported from `AtlasMap`, URL state (`panel=list`, `sort=`), analytics event
  names, and styles.
- No changes to the service, the sheet, the snapshot or deployments.
