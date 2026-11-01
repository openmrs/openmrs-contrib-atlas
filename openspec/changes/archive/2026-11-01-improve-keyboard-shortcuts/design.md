## Context

Each component handled its keys on its own element, so keys were missed when focus was elsewhere, such as on the map canvas.

## Decisions

- **Listen on the document, inside the component that owns the behaviour,** through a shared `useEscape` hook for the panels. The listeners exist only while a panel is mounted. Only one panel is shown at a time, and the marker panel isn't mounted while another panel is open, so one Escape closes one panel.
- **The search box stops Escape from propagating.** The panel doesn't need to know about search. This applies even when the search box is empty, so Escape in the search box never closes the panel.
- **`/` is ignored while typing in any input, textarea, select or editable element, and with Ctrl, Cmd or Alt held,** so it can still be typed and browser shortcuts still work. Shift is allowed because some keyboard layouts need it to type `/`.

## Risks

- A filter field, the download title field or the colour-by menu with focus also closes an open panel on Escape, which matches the request: only the search box is an exception.
