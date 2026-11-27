# Design

## Context

See proposal.md, "Why". The four fixes are independent of each other. They touch the web build, its styles and the service's file serving. Each was reproduced in Playwright, in Chromium and WebKit.

- **Suggestions.** `web/src/styles.css` has a phone rule, `@media (max-width: 600px) { .search-results { position: fixed; top: 54px; left: 8px; right: 8px } }`. It moves the top bar's search results to the full width of the screen. `AccountPicker` reuses the class `search-results` for its own list, so on a phone that list is fixed at the top too: 54 px from the top in an iPhone-sized WebKit, with the field about 650 px further down.
- **Focus ring.** `MarkerDetails` focuses its `<h2 tabIndex={-1}>` whenever it mounts. It mounts again after the list or filters close. The global `:focus-visible { outline: 3px solid #f3a712 }` draws a ring on it whenever the last input was a key, such as Escape.
- **Caching.** `service/src/site.ts` sets `Cache-Control` to `CACHE.immutable` for every path under `assets/`. It sets `Content-Type` from `TYPES`, falling back to `application/octet-stream`.
- **Source map.** `AtlasMap.tsx` imports `maplibre-gl/dist/maplibre-gl-worker.mjs?url`, so Vite copies the file as an asset without processing it, comment and all. The file ends with `//# sourceMappingURL=maplibre-gl-worker.mjs.map`.

## Goals / Non-Goals

**Goals:**

- Each fix is as small as possible, and each is covered by a test that failed before it.

**Non-Goals:**

- Changing where focus goes, or the focus ring on controls.
- Shipping source maps.
- Changing the content security policy.

## Decisions

### Scope the phone rule to the top bar's search

Change the selector to `.search .search-results`, so it matches only results inside the top bar's `.search`. The account picker's list then keeps its base rule, `position: absolute; top: calc(100% + 4px)` inside `.account-picker { position: relative }`, and sits under its field at every width.

The alternative was to give the account picker its own class, but that would mean copying the shared list styles, and the next shared use would hit the same trap. Scoping keeps one set of list styles and one exception.

### No ring on headings Atlas focuses

Add `:is(h1, h2, h3)[tabindex="-1"]:focus-visible { outline: none; }`. Only headings Atlas focuses from code have `tabindex="-1"`, and a heading isn't a control, so a ring tells nobody anything. Screen readers still announce it, and Tab still moves on to the panel's first control.

The rule is limited to headings rather than every `[tabindex="-1"]`. A future menu that moves focus with `tabindex="-1"` on its items should keep its rings.

### Long caching follows the content type

In `site.ts`, choose `CACHE.immutable` only when the path is under `assets/` and its extension is in `TYPES`; otherwise use `CACHE.other` (`max-age=3600`). The same `TYPES` lookup already decides `Content-Type`, so the two can't disagree. The guard test that every type the build emits is known stays, so this is a safety net, not a way to serve unknown files.

### Strip the worker's source-map comment at build time

A small build-only Vite plugin removes a trailing `//# sourceMappingURL=…` line from emitted `.mjs` assets in `generateBundle`. Vite has already hashed the file's name by then, so the name stays `maplibre-gl-worker-CMkqA50c.mjs` while the contents lose one comment line. The code is unchanged, so browsers holding the old copy lose nothing, and none re-download it.

The alternatives were to publish the `.map` file, which serves no visitor and adds 2.6 MB to the image, or to ignore the 404. Since developers keep running into it, removing the comment is the better trade.

## Risks / Trade-offs

- **The hashed name no longer matches the worker's exact bytes.** The difference is one comment line, so that's harmless. If a MapLibre upgrade changes the worker, it gets a new hash as usual.
- **Another narrow-screen rule may also be shared.** The e2e check at phone size covers the account picker. The rest of the phone layout is unchanged and already tested.
- **A file served with a short cache is fetched more often.** That only happens for types the service doesn't know, and the guard test keeps the build from producing any.
