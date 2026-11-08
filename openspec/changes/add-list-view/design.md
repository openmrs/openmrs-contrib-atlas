# Design

## Context

- **Panels.** `App.tsx` has one `panel` state (`filters`, `download`, `sign-in`, `mine`, `add`,
  `edit`). Every panel uses the `.panel` overlay: 340 pixels wide on the right, and a bottom sheet
  up to 60% high on phones. Marker details show only when no panel is open.
- **Markers on the map.** `markers` in `App` is the filtered list (`applyFilters`), and it already
  drives the features, legend and stats. `select(marker)` opens details, records `marker_open`
  and calls `revealMarker`.
- **Map view.** `AtlasMap` reports `{ zoom, lat, lng }` through `onViewChange` on `moveend`. It
  doesn't report the visible bounds. With `renderWorldCopies`, the visible longitudes can cover
  more than 360 degrees, or cross the antimeridian.
- **Back to My markers.** `simplify-confirming` added `fromMine`, `MarkerDetails`'s `onBack`
  (with "<", Backspace and Delete), and `focusId` in `MyMarkers`. The list needs the same thing.
- **URL state.** `panel=` accepts only the signed-in panels `mine|add|edit`.
- **Formatting helpers.** `countryName(code)` and `lastConfirmed(marker)` ("Mar 2026") already
  exist in `web/src/lib`.

## Goals / Non-Goals

**Goals:**
- Show what is in view, sorted usefully, in a panel that works the same on phones and desktops.
- Reuse the existing panel, selection and back patterns rather than adding new ones.

**Non-Goals:**
- A wide table with column headers, or a list docked beside the map that resizes it.
- Linking hover between the list and the map.

## Decisions

### A panel like the others, opened from the top bar
- A "List" icon button (`ListIcon`) goes in the top bar before Download, with `aria-label="List"`
  and `aria-expanded`. It toggles `panel === "list"`, and is disabled while a form is open, like
  Download.
- `SiteList` renders in the `.panel` slot. A panel keeps the map at full size, works as a bottom
  sheet on phones without new layout code, and matches how every other tool opens.
- Alternative considered: a fixed column beside the map. It would shrink the map on desktops, need
  its own phone layout, and change how the other panels sit. Rejected for now.

### Entries are two-line buttons, sorted by a "Sort by" choice
- Each entry is a `<button data-marker-id>` with the name on the first line and a quiet meta line:
  country · type · "N sites" (if more than 1) · last confirmed, with a "Closed" tag. 340 pixels is
  too narrow for five columns, and a single list of buttons is simple to use by keyboard and with
  a screen reader.
- A `<select>` labelled "Sort by" offers Name, Country, Sites and Last confirmed. Sorting uses
  `localeCompare(…, "en", { sensitivity: "base" })` for text, with name as the tie-breaker. The
  sort function lives in `web/src/lib/list.ts` with unit tests.

### The map reports its visible bounds
- `onViewChange` also gets `bounds: { west, south, east, north }` from `map.getBounds()`, sent on
  `moveend` and once when the map loads, so the list is right before anyone moves the map.
- `inView(marker, bounds)` (in `lib/list.ts`): latitude within south..north; longitude within
  west..east after shifting it by multiples of 360 into the range starting at `west`. If
  `east - west >= 360`, every longitude is in view. This covers world copies and views across the
  antimeridian.
- `App` keeps `bounds` in state. The list is `sortMarkers(markers.filter(m => inView(m, bounds)),
  sort)`, memoised, and computed only while the list is open.

### Back to the list reuses the My markers mechanism
- `fromMine` becomes `cameFrom?: { panel: "mine" | "list"; id: string }`. Opening from My markers
  or the list sets it. Selecting a marker any other way clears it, as `fromMine` is cleared today.
- `MarkerDetails` takes a `backLabel` beside `onBack` ("Back to My markers" or "Back to the list").
  Its Backspace and Delete handling is unchanged.
- Going back reopens the panel it came from with `focusId` set. `SiteList` focuses that entry and
  scrolls it into view, as `MyMarkers` does.
- The sort is kept in `App`, not in `SiteList`, so it survives the list closing and reopening.

### URL and analytics
- `panel=list` is accepted for everyone. The signed-in panel check still applies only to
  `mine|add|edit`.
- `sort=country|sites|confirmed` is written only while the list is open and the sort isn't name.
- `AtlasEvent` gains `list_open`, recorded when the list opens from the button. It isn't recorded
  when a link opens it, or when going back from details.

## Risks / Trade-offs

- [One more button in the top bar at 360 pixels] → It is an icon-only button like Download. The
  existing "Top bar on a phone" Playwright test is extended to cover it, signed in and not. If it
  doesn't fit, the fallback is to put the List control inside the search box beside Filters.
- [The list changes as the map moves, which could disorient] → It changes only on `moveend`, not
  during a drag, and the heading count shows what changed.
- [Choosing an entry moves the map, so going back shows a different area] → Going back restores
  the list for the area now in view, which still contains that marker. Focus lands on its entry.
- [Up to about 450 entries at the world view] → Rendering that many buttons is cheap. Paging can
  come later if the Atlas grows a lot.
