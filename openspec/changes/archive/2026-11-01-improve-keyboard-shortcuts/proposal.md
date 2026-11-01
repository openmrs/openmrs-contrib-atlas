## Why

Escape only closes the marker panel while focus is inside it, so it stops working once a visitor taps or drags the map, and it doesn't close the filter or download panels at all. There is also no quick way to reach search from the keyboard while browsing the map.

## What Changes

- Escape closes the open marker, filter or download panel wherever focus is, except in the search box, where it only clears the search.
- Pressing `/` moves focus to the search box, unless the visitor is typing in a field.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `map-view`: the Keyboard access requirement gains these two shortcuts.

## Impact

`MarkerDetails`, `FilterPanel`, `DownloadPanel` and `SearchBox` in `web/src/components/`, and their tests. No data or service changes.
