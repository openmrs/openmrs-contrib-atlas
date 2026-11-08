# Proposal

## Why

Today, a link to a marker is `/?marker=<id>`. That link opens the marker, but when it's pasted
into LinkedIn, WhatsApp, X or an email it previews as the plain OpenMRS Atlas home page, or not
at all. Social media crawlers don't run JavaScript, so they never see which site the link is
about. Before the announcement, implementers will want to share their markers, and a rich preview
is what makes that worth doing. This is the first half of "Share cards and a website badge"
(Adoption, Phase 3). The Share dialog and the badge follow in a separate change,
`add-share-dialog`.

## What Changes

- **Permalinks.** `/marker/<id>` is a stable address for every published marker. The service
  answers it with a small HTML page carrying Open Graph and Twitter/X Card tags (title,
  description, image, canonical URL). The page sends people on to `/?marker=<id>` straight away,
  where the map opens the marker as it does today. Unknown, hidden or deleted markers get a 404
  page that sends people to the map.
- **Social cards.** A 1200 × 630 PNG card for each published marker shows its name, country,
  number of sites, a regional outline map with a pin, and OpenMRS Atlas branding. Closed sites
  say "Closed".
- **Cards are made when publishing.** A successful publish draws cards only for markers whose
  card details changed, and removes cards for markers no longer published. Cards are written to
  the public bucket under versioned names, so link previews refresh when a marker changes.
  Publishes after edits draw a few cards at most, and the nightly publish draws the rest. Until a
  marker has a card, its preview uses the world image.
- **Card download address.** `/marker/<id>/card.png` sends people on to the marker's current card,
  for the Share dialog's "Download image".
- **Home page previews.** The site's own page gets Open Graph and Twitter/X Card tags and a world
  image of all markers, redrawn when publishing.

Out of scope:
- The Share dialog, social network buttons, the website badge and the prompt after adding or
  confirming a marker. These are in `add-share-dialog`.
- Using permalinks in the RSS feed, emails or the "Copy link" behaviour of today's address bar.
  The address bar keeps `/?marker=<id>`, and old links keep working.
- Real map tiles in cards. Cards use simplified country outlines, with no roads or labels.
- Cards or previews for hidden, deleted or invalid markers.

## Capabilities

### New Capabilities
- `marker-permalinks`: the `/marker/<id>` pages, their preview tags and redirect, the card
  download address, and the home page's preview tags.
- `social-cards`: what a card shows, when cards are drawn, redrawn and removed, and where they
  are published.

### Modified Capabilities
None. Existing publishing, map and URL behaviour is unchanged. Cards are an extra output of a
successful publish, described in `social-cards`.

## Impact

- **Service:** a card renderer (SVG built in code, converted to PNG with `sharp`, which the
  service already uses for logos); a card step in `publish`; public routes `GET /marker/:id` and
  `GET /marker/:id/card.png`, reading the published `atlas.json`, not the sheet; card storage in
  the public bucket; a bundled font for card text.
- **Shared:** country outlines from `@rapideditor/country-coder`, already a dependency.
- **Hosting:** `firebase.json` rewrites `/marker/**` to the service in both targets, and
  `infra/firebase.test.ts` checks it.
- **Site:** preview tags in `web/index.html`, with the image address set per environment at build
  time.
- **Production timing:** permalinks and card addresses are built from `SITE_URL`
  (atlas.openmrs.org). Production previews only work after the DNS switch. Staging can be tested
  fully now.
