# Tasks

## 1. Suggestions under their field on phones

- [x] 1.1 Add an e2e scenario to the "Account picker" tests in `web/e2e/editing.spec.ts`, with a phone-sized viewport (390 × 844). A signed-in owner opens the edit form, types `smit` into "Add an editor by OpenMRS ID", and the suggestion list's top edge is within a few pixels of the field's bottom edge. Check that it fails before the fix: today the list sits at the top of the screen.
- [x] 1.2 In `web/src/styles.css`, change the phone rule's selector from `.search-results` to `.search .search-results`. Run the new scenario and the existing map, search and list e2e tests. The top bar's search results still take the screen's width on a phone (specs/map-view, "Works on phones").

## 2. No focus ring on the marker panel's heading

- [x] 2.1 Add e2e scenarios for specs/map-view, "Focus rings mark controls, not headings":
  - with a marker open, open the list, press Escape: the focused element is the marker's `h2`, and its computed `outline-style` is `none`;
  - the same with the filter panel;
  - with no marker open, click Filters, press Escape: focus is on the Filters button, and its outline is not `none`.
  Check that the first two fail before the fix.
- [x] 2.2 In `web/src/styles.css`, after the global `:focus-visible` rule, add `:is(h1, h2, h3)[tabindex="-1"]:focus-visible { outline: none; }`, with a comment pointing at the spec.

## 3. Long caching only for known types

- [x] 3.1 In `service/src/site.test.ts`, add a file under `web/assets/` with an extension that isn't in `TYPES`, such as `assets/thing-abc123.xyz`. It is served as `application/octet-stream` with `CACHE.other`. The `.mjs` worker and `main-abc123.js` keep `CACHE.immutable`. Check that the new test fails before the fix.
- [x] 3.2 In `service/src/site.ts`, use `CACHE.immutable` only when the path is under `assets/` and its extension is in `TYPES`, and `CACHE.other` otherwise. Update the comment on `TYPES` to say so.

## 4. No source-map pointer in the worker

- [x] 4.1 In `web/vite.config.ts`, add a build-only plugin that removes a trailing `//# sourceMappingURL=…` line from emitted `.mjs` assets in `generateBundle`. After `npm run build -w web`, the built worker no longer contains `sourceMappingURL`, and its file name is unchanged (`maplibre-gl-worker-CMkqA50c.mjs` with the current MapLibre).

## 5. Checks and staging

- [x] 5.1 Run the format check, typecheck, lint, unit tests, the e2e suite (`cd web && npx playwright test`) and `npm run build`.
- [ ] 5.2 Commit and push to `main`. Once CI has pushed `staging`, update `gode` and check:
  - `/health` reports the new commit;
  - `curl -sI` on the worker still shows `text/javascript` with the year-long cache;
  - `curl -s` on the worker no longer contains `sourceMappingURL`.
- [ ] 5.3 (manual) On staging, on an iPhone: adding an editor shows suggestions under the field. In Chrome and Safari: with a marker open, open the list, press Escape, and the marker's name has no ring. With Web Inspector open, there's no 404 for `maplibre-gl-worker.mjs.map`.

## Workflow follow-up

- Archive this change with its specs synced once 5.3 passes. It ships to production with 4.1, together with `shut-down-google-cloud`.
