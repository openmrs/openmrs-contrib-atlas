# Proposal

## Why

Testing 4.0 on staging, in Safari and on an iPhone, turned up four small problems:

- **Phones:** OpenMRS ID suggestions appear at the top of the screen, far from the field. On an iPhone, with the keyboard up, that is off-screen, so adding an editor or transferring a marker seems to offer no suggestions at all.
- **Escape:** closing the list or the filters with Escape while a marker is open leaves a bright focus ring around the marker's name.
- **Caching:** the service tells browsers to keep every file under `/assets/` for a year, even one it can't give a proper type. Before 4.0's `.mjs` fix, that kept Safari on a broken copy of the map's worker until its cache was cleared.
- **A 404 in developer tools:** the map's worker asks for a debugging file (`maplibre-gl-worker.mjs.map`) the build doesn't include, whenever developer tools are open.

## What Changes

- **Suggestions sit under their field on phones.** The narrow-screen rule that moves the top bar's search results to the top of the screen applies only to that search box. It no longer applies to the suggestion lists of OpenMRS ID fields: adding an editor, transferring ownership, and an admin's Owner field.
- **No focus ring on the marker panel's heading.** Atlas moves focus to a panel's heading so screen readers announce it. That heading no longer draws a focus ring, whichever key or click came before. Buttons, links and fields keep their focus rings, including the List and Filters buttons after Escape.
- **Long caching only for files of a known type.** A file under `/assets/` is cached for a year only when the service knows its type. Anything it would send as `application/octet-stream` gets the same short caching as other files, so a mistake like the missing `.mjs` type lasts no more than an hour.
- **The worker no longer asks for a missing debugging file.** The build removes the worker's `sourceMappingURL` pointer, since the `.map` isn't published.

### Out of scope

- Safari's "Refused to apply a stylesheet" messages. They come from WebKit's own drop-down internals, and the only way to silence them would be to allow inline styles, which would weaken the content security policy.
- Safari's "preloaded but not used" warnings for `atlas.json` and the map fonts. Safari doesn't hand early downloads to `fetch()`, and nothing breaks.
- Clearing caches that already hold a broken worker. Only staging ever served one, and clearing the cache fixes it.
- Taking the focus ring off buttons, links or fields, or changing where focus goes when a panel closes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-lookup`: suggestions in an OpenMRS ID field appear directly under the field, on phones too (a new scenario under "Suggestions in OpenMRS ID fields").
- `map-view`: a heading Atlas focuses for screen readers shows no focus ring, while controls keep theirs (an added requirement, "Focus rings mark controls, not headings").
- `deployment`: long-lived caching applies only to files of a known type (an added requirement).

## Impact

- **Web:**
  - `web/src/styles.css`, two rules;
  - `web/vite.config.ts`, removing the worker's source-map comment from the build;
  - e2e tests in `web/e2e/` for the suggestions at phone size and the heading's focus ring after Escape.
- **Service:** `service/src/site.ts`, choosing the cache rule; `service/src/site.test.ts`.
- **No API, data or settings changes.** Staging shows the fixes once its image is updated, and production gets them in 4.1.
