## Why

Escape only closes the marker panel while focus is inside it, so it stops working once a visitor taps or drags the map. There is also no quick way to reach search from the keyboard while browsing the map.

## What Changes

- Escape closes an open marker panel wherever focus is, except in the search box, where it only clears the search.
- Pressing `/` moves focus to the search box, unless the visitor is typing in a field.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `map-view`: the Keyboard access requirement gains these two shortcuts.

## Impact

`web/src/components/MarkerDetails.tsx`, `web/src/components/SearchBox.tsx` and their tests. No data or service changes.
