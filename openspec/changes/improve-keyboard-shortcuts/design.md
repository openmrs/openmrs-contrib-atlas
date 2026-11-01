## Context

Each component handled its keys on its own element, so keys were missed when focus was elsewhere, such as on the map canvas.

## Decisions

- **Listen on the document, inside the component that owns the behaviour.** The listeners exist only while the component is mounted, so an open panel is the only thing listening for Escape.
- **The search box stops Escape from propagating.** The panel doesn't need to know about search. This applies even when the search box is empty, so Escape in the search box never closes the panel.
- **`/` is ignored while typing in any input, textarea, select or editable element, and with Ctrl, Cmd or Alt held,** so it can still be typed and browser shortcuts still work. Shift is allowed because some keyboard layouts need it to type `/`.

## Risks

- A filter field or colour-by menu with focus also closes an open panel on Escape, which matches the request: only the search box is an exception.
