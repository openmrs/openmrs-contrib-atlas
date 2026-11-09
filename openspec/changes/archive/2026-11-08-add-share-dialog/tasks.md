# Tasks

## 1. Badges

- [x] 1.1 `service/src/scripts/badges.ts` (with `npm run badges -w service`): build the light and dark 200 × 44 badge SVGs. Text goes through `cards/text.ts` with Noto Sans and the cross is an inline base64 PNG. Write them to `web/public/badges/on-the-atlas-light.svg` and `-dark.svg`
- [x] 1.2 Generate and commit both badges. Add a test that regenerates them in memory and matches the committed files, and that they contain no `<text>`, `<script>` or external references

## 2. Share helpers

- [x] 2.1 `web/src/lib/share.ts`:
  - `permalink(id, origin)`
  - `shareLinks(marker, origin)` for LinkedIn, Facebook, X and WhatsApp
  - `badgeSnippet(id, origin, theme)`
  - `cardFileName(name)`, the slug, with accents, punctuation, length and empty names handled
- [x] 2.2 Unit tests for each helper: encoded URLs and text, an escaped snippet with no script, iframe or `on*` attributes, an odd id, and the slug cases
- [x] 2.3 Add `"share"` to `AtlasEvent` in `analytics.ts`

## 3. Share dialog

- [x] 3.1 `ShareDialog` component, a modal `role="dialog"`. In order:
  - card preview, removed if the image fails to load
  - permalink field with Copy link
  - LinkedIn, Facebook, X and WhatsApp links (new tab, `noopener noreferrer`)
  - "More options…" only when `navigator.share` exists
  - Website badge: light/dark choice, previews, snippet textarea, Copy code
  - Download image
- [x] 3.2 Behaviour:
  - Copy with a clipboard fallback (select the text, "Press Ctrl+C/⌘C")
  - a `role="status"` region for "Link copied" and "Code copied"
  - `AbortError` from `navigator.share` ignored
  - Download fetches `/marker/<id>/card.png` and saves it with `saveBlob`, with a not-ready message on 404 and an error message otherwise
  - `track("share", {method, source, marker_id})` for each method
- [x] 3.3 Accessibility and layout:
  - focus moves in and is kept inside (Tab wraps)
  - Escape and Close stop propagation and return focus
  - a bottom sheet on phones
  - styles in `styles.css`, using the existing tokens
- [x] 3.4 Component tests:
  - each spec scenario that can run in jsdom: closing, focus return, Escape not closing the details, no card yet, Copy link and its fallback, the network `href`s, native share shown or hidden and cancel ignored, the badge snippet for dark, download ok and 404
  - a check that nothing is requested from the networks
  - analytics calls

## 4. Wiring into the map

- [x] 4.1 In `App`:
  - `shareFor` state and one `ShareDialog` rendered above the panels
  - a Share button in `MarkerDetails` for every public marker, before the owner's actions, with a `ShareIcon` in `Icons.tsx`
- [x] 4.2 Prompt:
  - `notice` becomes `{text, share?}`
  - `applyResult` takes `{prompt}` and offers Share only when published and the marker is public and active
  - `prompt` is passed from adding (`onSaved` without a `markerId`), `MarkerActions` "Still current" and `MyMarkers` "Update"
  - the notice's Share button opens the dialog (`source: "prompt"`) and clears the notice
- [x] 4.3 `share=1`:
  - `parseUrlState` reads it and `formatUrlState` never writes it
  - `App` opens the dialog (`source: "email"`) once the marker is found
  - unknown markers keep the existing notice
  - in `ReminderPage`, the confirmed "done" state links "Share it" to `/?marker=<id>&share=1`
- [x] 4.4 Component tests:
  - Share in details while signed out and for a closed marker
  - the prompt after add, "Still current" and "Update"
  - no prompt after an ordinary edit or an unpublished save
  - `share=1` opens once and leaves the address bar
  - the reminder page link

## 5. Permalink freshness (service)

- [x] 5.1 `permalinks.ts`:
  - when the marker or its card is missing from memory and the cached value is over 5 s old, re-read the snapshot and manifest, sharing one read in flight, then look again
  - 404s send `Cache-Control: public, max-age=60, s-maxage=60`
- [x] 5.2 Tests:
  - shared as soon as it is added (found after a re-read, card included)
  - 100 unknown ids in a burst cause at most one re-read
  - the 404 cache header
  - found pages still cached for 5 minutes

## 6. End to end, docs and checks

- [x] 6.1 Playwright:
  - open a marker, Share, Copy link (clipboard permission granted), and check the LinkedIn link's `href`
  - the badge snippet
  - Download image saves a PNG (card route stubbed)
  - the dialog fits a 375-pixel-wide phone with no sideways scroll
  - Escape returns to the details
- [x] 6.2 Docs:
  - `service/README.md`: the badge script and the permalink re-read and 404 caching
  - `openspec/backlog.md`: mark the share item done
  - `web` README or comments wherever the badge addresses are documented for other sites
- [x] 6.3 All checks pass (`format:check`, `typecheck`, `lint`, unit tests, e2e, build) and `openspec validate --strict`
- [x] 6.4 (manual) On staging:
  - share a marker to LinkedIn, Facebook, X and WhatsApp
  - try "More options…" on a phone
  - paste the badge snippet into a test page (light and dark)
  - download a card
  - add a test marker, share it from the prompt at once, and check LinkedIn's Post Inspector shows its card
