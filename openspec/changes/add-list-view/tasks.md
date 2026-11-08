# Tasks

## 1. List logic

- [x] 1.1 Add `web/src/lib/list.ts` with `inView(marker, bounds)` and unit tests: inside, outside, `east - west >= 360`, a view crossing the antimeridian, a world copy (longitudes beyond ±180)
- [x] 1.2 Add `ListSort` (`name | country | sites | confirmed`) and `sortMarkers(markers, sort)` with tests: name A–Z ignoring case, country then name (unknown country last), sites most first with blank as 1, confirmed most recent first with never confirmed last, ties by name
- [x] 1.3 Add `entryMeta(marker)`, which returns "Uganda · Clinical · 12 sites · Mar 2026" and leaves out blanks and a site count of 1, with tests

## 2. Map and URL

- [x] 2.1 `AtlasMap`: include `bounds` in `onViewChange`, sent on `moveend` and once on load; update `MapView` or add a separate bounds callback, keeping `view` in the URL unchanged
- [x] 2.2 `urlState`: accept `panel=list` for everyone and `sort=country|sites|confirmed`; write `sort` only with `panel=list` and a sort other than name; tests for parse and format, including that `list` isn't treated as a signed-in panel
- [x] 2.3 Add `list_open` to `AtlasEvent`

## 3. Site

- [x] 3.1 Add `ListIcon` and a "List" top-bar button before Download (`aria-label`, `aria-expanded`, disabled while a form is open, records `list_open` when it opens the list)
- [x] 3.2 Add the `SiteList` panel: header "<n> implementations in view" with a close button, "Sort by" select, entries as `button[data-marker-id]` with the name and `entryMeta`, a "Closed" tag, the empty message, Escape closes it, and `focusId` focuses and scrolls to an entry
- [x] 3.3 `App`: add `"list"` to `Panel`; keep `bounds` and `sort` state; compute the in-view sorted list only while the list is open; choosing an entry calls `select` and sets `cameFrom`
- [x] 3.4 Replace `fromMine` with `cameFrom: { panel: "mine" | "list"; id }`; add `backLabel` to `MarkerDetails`; going back reopens the right panel with `focusId`; My markers behaviour and its tests are unchanged
- [x] 3.5 Styles for entries, the meta line, the Closed tag and the sort row; check the top bar at 360 pixels, signed in and out
- [x] 3.6 Component tests: count heading, entry content, sort change, empty state, choosing an entry, focus on `focusId`, "Back to the list" label and Backspace from a list-opened marker, no back control from search

## 4. End to end

- [x] 4.1 Playwright: open the list at the world view and see every fixture marker; zoom to a region and see only its markers; apply a filter and see the count change
- [x] 4.2 Playwright: sort by sites and by last confirmed; open an entry, go back with "<" and with Backspace, and find focus on that entry
- [x] 4.3 Playwright: a copied `?panel=list&sort=sites` URL opens the sorted list; extend "Top bar on a phone" for the List button; the list on a 360 pixel phone has no sideways scrolling

## 5. Docs and checks

- [x] 5.1 Update the URL parameter comment in `urlState.ts` and any README section that lists URL parameters or analytics events; remove the list view from `openspec/backlog.md`
- [x] 5.2 All checks pass (`format:check`, `typecheck`, `lint`, unit tests, e2e, build) and `openspec validate --strict`
- [ ] 5.3 (manual) On staging, open the list on a desktop and a phone, sort it, open a marker and go back, and share a list link
