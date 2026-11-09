# Design

## Context

`add-marker-permalinks` built everything sharing points at:
- `/marker/<id>` pages with preview tags;
- versioned cards in the public bucket;
- `/marker/<id>/card.png`, which redirects to the current card;
- a world image.

The service keeps the snapshot and card manifest in memory for 60 seconds. It answers every page,
including 404s, with `Cache-Control: public, max-age=300, s-maxage=300`.

On the site:
- `MarkerDetails` is a side panel. Owners and editors see `MarkerActions` as its children.
- `App.tsx` owns the panels, a single `notice` string, and `applyResult`, which every saved change
  goes through.
- Adding ends in `MarkerForm`'s `onSaved`, "Still current" in `MarkerActions`, and "Update" in
  `MyMarkers`. Each returns a `MarkerResult` with `marker` (the public marker, or null) and
  `published`.
- The reminder confirmation page (`web/src/reminder/ReminderPage.tsx`) is a separate page and
  already links to `/?marker=<id>`.
- `saveBlob` in `web/src/export/download.ts` saves a blob under a file name.
- Analytics events are typed in `web/src/lib/analytics.ts`.
- The bucket's CORS allows `GET` from the site's address, web.app, firebaseapp.com and localhost.
  The site already fetches `atlas.json` through a hosting redirect to the bucket.

## Goals / Non-Goals

**Goals:**
- Share in two clicks from any public marker, on a phone or a desktop, by mouse or keyboard.
- Load nothing from the social networks.
- Give implementers a badge they can paste into any website, CMS or README.
- A link shared seconds after adding a marker previews correctly the first time a network fetches
  it, because LinkedIn and Facebook keep that first answer for days.

**Non-Goals:**
- Badges that differ per marker, or a badge for the whole Atlas.
- Counting clicks on shared links or on badges.
- Brand logos on the network buttons.

## Decisions

### One Share dialog, owned by `App`

`App` holds `shareFor: {id, source: "details" | "prompt" | "email"}` and renders one
`ShareDialog` above everything else. It doesn't belong inside `MarkerDetails`, because the prompt
from "Update" in My markers opens it while My markers stays open.
- Details gets a Share button, after the details and before the owner's actions.
- The notice gets an optional action.
- The reminder page's link sets `share=1`.

The dialog is a modal `role="dialog"` with `aria-modal`, labelled by its heading
"Share <name>". It works like the existing delete `alertdialog`:
- Focus moves to the first control and is kept inside the dialog (Tab wraps).
- Escape stops propagation, so the details panel's `useEscape` doesn't also close.
- When it closes, focus returns to whatever opened it.

The native `<dialog>` element would do some of this, but jsdom doesn't implement `showModal`, and
the component tests run in jsdom.

On phones the dialog becomes a bottom sheet the width of the screen, scrolling vertically.

### Links use the visitor's own address

The permalink is `${location.origin}/marker/<id>`, and so are the badge `src` and `href`.
- On staging that gives atlas-stg.openmrs.org links, which work today.
- On production it gives atlas.openmrs.org after the DNS switch.
- Someone on openmrs-atlas.web.app gets web.app links. They also work, because Firebase rewrites
  `/marker/**` there too, and their canonical tag points at `SITE_URL`.

The alternative was the build-time `VITE_SITE_URL`. It would produce atlas.openmrs.org links on
production before the switch, and those would land on Atlas 2.0 and fail.

### Network links

All four are plain `<a target="_blank" rel="noopener noreferrer">` links built from these URLs:

| Network  | URL |
|----------|-----|
| LinkedIn | `https://www.linkedin.com/sharing/share-offsite/?url=<permalink>` |
| Facebook | `https://www.facebook.com/sharer/sharer.php?u=<permalink>` |
| X        | `https://x.com/intent/post?url=<permalink>&text=<name> on the OpenMRS Atlas` |
| WhatsApp | `https://wa.me/?text=<name> on the OpenMRS Atlas <permalink>` |

Each part is encoded with `encodeURIComponent`. A pure function `shareLinks(marker, origin)` in
`web/src/lib/share.ts` builds them, so unit tests can pin them down.

### Device share sheet

"More options…" appears only when `navigator.share` exists. It calls
`navigator.share({title, text, url})`. An `AbortError` (the person cancelled) is ignored. Any
other error shows "Sharing didn't work" in the dialog.

Cards aren't attached as files. `navigator.canShare({files})` is uneven across browsers, and every
target that matters unfurls the link into the card anyway.

### Copying

`navigator.clipboard.writeText` is used, and the button reads "Link copied" (or "Code copied")
for a few seconds, announced through a `role="status"` region.

If the clipboard isn't available, or refuses (an insecure origin, or a permissions policy), the
dialog selects the text in a read-only field and says "Press Ctrl+C to copy" (⌘C on a Mac). The
link field and the snippet textarea are always visible, so the fallback has something to select.

### Download image

The dialog fetches `/marker/<id>/card.png`, following the redirect to the bucket. CORS allows this
because the request starts on the site's own address. It then saves the blob with `saveBlob` as
`<slug>-openmrs-atlas.png`.
- The slug is the name lowercased, with accents removed and anything other than a–z and 0–9
  turned into single hyphens, at most 60 characters. A name with nothing left uses
  `openmrs-atlas-site`.
- A 404 shows "The image isn't ready yet. Try again in a few minutes."
- Other failures show "The image couldn't be downloaded."

The preview at the top is `<img src="/marker/<id>/card.png">` with alt text. On an error, it is
removed.

### Badges are static, generated SVG

`web/public/badges/on-the-atlas-light.svg` and `on-the-atlas-dark.svg` are 200 × 44.

| Version | Background | Border | Text |
|---------|------------|--------|------|
| Light | white | `#d9dee4` | ink `#1f2933` |
| Dark | OpenMRS green `#00463f` | none | white |

Each has rounded corners and the OpenMRS cross on the left. Next to it, "On the" is set small
above "OpenMRS Atlas" in bold.

`service/src/scripts/badges.ts` draws them, reusing `service/src/cards/text.ts` and the bundled Noto
Sans, so the text is outlines. The cross is inlined as a base64 PNG, so the files load nothing
else. The script writes into `web/public/badges/`.
- `npm run badges -w service` runs it.
- A Vitest test regenerates both in memory and compares them with the committed files. A font or
  layout change can't then leave stale badges behind.

The files are committed rather than built in CI, so the web build doesn't depend on the service's
font code. Firebase's default caching (1 hour) is fine, and the addresses never change. Other
websites will hotlink these files for years, so a change to how a badge looks applies everywhere
at once. That is intended.

The snippet:

```html
<a href="https://atlas.openmrs.org/marker/<id>"><img src="https://atlas.openmrs.org/badges/on-the-atlas-light.svg" alt="On the OpenMRS Atlas" width="200" height="44"></a>
```

It is built by `badgeSnippet(id, origin, theme)`, which escapes attribute values. Ids are UUIDs,
but a test still covers odd ids.

### The prompt is an action on the notice

`notice` becomes `{text, share?: string}`, where `share` holds a marker id.
`applyResult(id, result, {prompt})` sets `share` when all of these are true:
- `prompt` is set;
- `result.published` is true;
- `result.marker` exists and its `status` is `active`.

Three callers pass `prompt`:
- adding: `onSaved` when there was no `markerId`;
- `MarkerActions` after `/confirm`;
- `MyMarkers` "Update".

Other callers (edits, close, reopen, delete, accepting an offer) don't. The notice keeps its
dismiss button. Its Share button opens the dialog with `source: "prompt"` and clears the notice.

### `share=1` from the reminder page

The reminder page's "done" state for a confirmed marker adds
`<a href="/?marker=<id>&share=1">Share it</a>` next to "See it on the map".
- `parseUrlState` reads `share`.
- `App` opens the dialog once the marker is found in the snapshot.
- `formatUrlState` never writes `share`. The next `replaceState` removes it, so a copied address
  doesn't reopen the dialog.
- If the marker isn't in the snapshot, the existing "not found" notice shows and no dialog opens.

### Analytics

`AtlasEvent` gains `"share"`, sent as `track("share", {method, source, marker_id})`. The method
is one of:
- `copy_link`, `linkedin`, `facebook`, `x`, `whatsapp`, `native`, `badge_copy`, `image_download`.

The network links record on click and don't wait for the event, so the new tab opens at once.
Opening the dialog is not tracked on its own.

### Permalink misses re-read, rate-limited

In `createPermalinks`, `published()` gains `refresh()`. When a request's marker, or its card, is
missing from the value in memory, and that value is more than 5 seconds old, the service reads the
snapshot and manifest again and looks once more. All concurrent requests share one read in flight.
A flood of unknown ids therefore costs at most one pair of bucket reads every 5 seconds.

404 responses send `Cache-Control: public, max-age=60, s-maxage=60`. Found pages keep 5 minutes.

Without this, a person who adds a marker and shares it within a minute could hit an instance
still holding the old snapshot. LinkedIn would then keep the 404, or the world image, for a week.

## Risks / Trade-offs

- [Share URLs change: networks retire or rename share endpoints, as twitter.com did] → They live
  in one function with tests. When one breaks, it is a one-line fix. X still redirects the old
  twitter.com intent.
- [Hotlinked badges add load on Firebase Hosting] → They are tiny static files behind Firebase's
  CDN, with negligible cost.
- [People on web.app share web.app links] → They work and canonicalise to `SITE_URL`. Once the
  domain switch is done, the web.app address is rarely used.
- [Card not drawn when the prompt appears: an edit publish draws at most 10 cards] → A new marker
  is a "missing" card. It is drawn in the same publish unless 10 changed cards come first, which
  only happens after a bulk change. The preview then uses the world image until the nightly run.
- [Focus trap edge cases in a hand-rolled modal] → Component tests cover Tab wrapping, Escape and
  focus return. Playwright covers a phone layout.
- [Clipboard permissions in embedded browsers, such as the LinkedIn app's webview] → The visible,
  selectable fallback text covers it.

## Migration Plan

None. This change only adds features. Deploying to staging through CI is enough to test it. For
production, it goes out in the next release tag. Links from production are only useful after the
DNS switch, as with permalinks.

## Open Questions

None. Badge colours and layout can be adjusted after the user sees them on staging. Regenerating
the badges is one command.
