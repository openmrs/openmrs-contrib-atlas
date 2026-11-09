# Proposal

## Why

Markers now have permalinks that preview well, with a card for each site (`add-marker-permalinks`),
but nothing on the map offers them. To share a site today, someone has to know to type
`/marker/<id>`. Before the announcement, implementers should be able to share their site in a
couple of clicks and put a badge on their own website pointing back to the Atlas. This is the
second half of "Share cards and a website badge" (Adoption, Phase 3).

## What Changes

- **A Share button** on every public marker's details, for everyone, whether signed in or not.
- **A Share dialog** with:
  - the marker's card as a preview, when it has one;
  - **Copy link**, which copies the permalink `<site>/marker/<id>`;
  - **LinkedIn, Facebook, X and WhatsApp**, plain share links that open in a new tab, with no
    scripts from those sites;
  - **More options…**, the device's own share sheet (Web Share API), only where the browser
    offers one;
  - **Website badge**: an "On the OpenMRS Atlas" badge in light and dark, with a copyable
    `<a><img></a>` snippet linking to the permalink. It needs no JavaScript and no iframe;
  - **Download image**, which saves the marker's card as a PNG.
- **One generic badge pair**, light and dark, served as static SVG files by the site. The text
  is drawn as outlines, so it looks the same everywhere.
- **An optional prompt to share** after adding a marker, after "Still current", and after
  "Update" in My markers. It appears as a Share button in the "Saved" notice, which people can
  ignore or dismiss. The email reminder's confirmation page gets a "Share it" link that opens the
  map with the Share dialog open.
- **New markers preview straight away.** When a permalink or its card is missing from what the
  service has in memory, it reads the published files again (at most every few seconds) before
  answering. A 404 is cached for a minute, not five. Otherwise a link shared the moment a marker
  is added could be stored by LinkedIn or Facebook as "not found" for days.
- **A `share` analytics event**, recording which method was used.

Out of scope:
- Badges with a mini-map, the site's name or its own picture. There is one generic pair.
- A badge or Share button for the whole Atlas, or for a filtered view of it.
- Brand logos for the social networks. Buttons are labelled with text.
- Email as a share method, other than through the device's own share sheet.
- Prompting to share after an ordinary edit, a close, a reopen or an ownership change.
- Changing what the address bar shows. It keeps `/?marker=<id>`.

## Capabilities

### New Capabilities
- `marker-sharing`: the Share button and dialog, what each share method does, the website badge
  and its snippet, the prompt after adding or confirming, and the "Share it" link from the
  reminder confirmation page.

### Modified Capabilities
- `marker-permalinks`: "Unknown permalinks" and "Permalinks read only published data". A marker
  that was just published is found at once, and 404 pages are cached for at most a minute.
- `map-view`: "Usage analytics" adds the `share` event.

## Impact

- **Site:**
  - a `ShareDialog` component and a Share button in `MarkerDetails`;
  - the `share` event in `analytics.ts`;
  - a notice that can carry a Share button (`App.tsx`), with the prompt wired into adding
    (`MarkerForm`'s save), `MarkerActions` "Still current" and `MyMarkers` "Update";
  - a one-time `share=1` URL parameter, which opens the dialog and is then removed from the
    address bar;
  - the reminder confirmation page links to it.
- **Badges:** `web/public/badges/on-the-atlas-light.svg` and `-dark.svg`, made by a script that
  draws the text with the Noto Sans font the service already bundles. A test checks that the
  committed files match the script's output.
- **Service:** `permalinks.ts` re-reads the snapshot and manifest on a miss, at most every
  5 seconds, and gives 404s a shorter cache time.
- **Hosting:** no new routes. Badges are static files and cards are fetched through the existing
  `/marker/<id>/card.png` redirect. The bucket's CORS already allows the site's own address.
- **Production timing:** links are built from the address the visitor is on, so they work on
  staging now and on atlas.openmrs.org after the DNS switch.
