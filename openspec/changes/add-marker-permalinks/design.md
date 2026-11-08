# Design

## Context

- **Hosting.** Firebase Hosting serves `web/dist` and already rewrites `/api/**` to the Cloud Run
  service in each target (`firebase.json`). Rewrites match paths only, never query strings.
- **Service.** Hono on Cloud Run with `--min-instances=0`, default 512 MiB memory and a
  300-second request timeout. `sharp` is already a dependency, used for logos.
- **Publishing.** `publish()` reads the sheet, validates, runs the safety check, and writes
  `atlas.json`, the downloads, `rss.xml` and a history copy through `SnapshotStore.write`. It
  runs in the write queue. Callers: `POST /publish` (Apps Script after sheet edits, the nightly
  Cloud Scheduler job, or an admin) and `publishAfterEdit` (website edits and emailed links).
- **Public bucket.** `BUCKET`, read by visitors at `DATA_URL`. Snapshot files are cached for 5
  minutes, and logos for a year under unique names.
- **Country outlines.** `@rapideditor/country-coder`, already used to derive `country`, exports
  `borders`: 392 simplified GeoJSON features.
- **Site build.** `web/vite.config.ts` already has a `preloads()` plugin that edits
  `index.html` from build-time environment variables. `deploy.yml` passes `VITE_DATA_BASE_URL`
  and others, but no site URL.

## Goals / Non-Goals

**Goals:**
- Rich previews for marker links on every major platform, with no JavaScript needed by crawlers.
- No extra work or risk added to the map's own page load, and no reads of the sheet from public
  routes.
- Cards that look the same whether rendered on a Mac or on Cloud Run.

**Non-Goals:**
- Real map tiles in cards, or rendering a browser on the server.
- The Share dialog and the badge (in `add-share-dialog`).

## Decisions

### `/marker/<id>` is a service page that hands over to the map
- `firebase.json` gets a `/marker/**` rewrite to the service in both targets, next to `/api/**`.
  `infra/firebase.test.ts` checks both.
- `GET /marker/:id` returns a small HTML page with `og:*`, `twitter:*`, `<link rel="canonical">`
  and `<title>`, then `<script>location.replace("/?marker=<id>")</script>` and a `<noscript>`
  link to the map.
- It hands over with a script, not `<meta http-equiv="refresh">`, because some crawlers
  (Facebook's among them) follow a meta refresh and would read the map's generic tags instead.
- All values are HTML-escaped, and the id in the script is JSON-encoded.
- Pages are sent with `Cache-Control: public, max-age=300, s-maxage=300`, so the Firebase CDN
  answers repeat visits without waking the service.
- An unpublished id gets a 404 with a page that sends people to `/`, and `noindex`.
- Alternative considered: serving the app itself at `/marker/<id>` with tags injected into
  `index.html`. That avoids the hand-over, but the service would have to fetch and patch the
  current `index.html`, and the app would need path routing. Rejected: the hand-over is one
  quick step for people, and invisible to crawlers.

### Public routes read the published snapshot, cached in memory
- `SnapshotStore` gains `readSnapshot()` and `readCards()`, the card manifest, both read from
  the bucket.
- The routes keep each one in memory for 60 seconds, so a burst of crawler hits reads the bucket
  once. With the CDN's 5 minutes, a publish shows within the required 10 minutes.
- They never touch the sheet, need no sign-in, and are mounted outside `/api`.
- `GET /marker/:id/card.png` answers 302 to the card's bucket address, or 404.

### Cards are SVG built in code, with text as paths, turned into PNG by sharp
- `service/src/cards/` builds each card as an SVG string and converts it with
  `sharp(Buffer.from(svg)).png()`.
- Text is laid out with `opentype.js` (new dependency) from a bundled OFL font, Noto Sans Regular
  and Bold in `service/assets/fonts/`, and drawn as `<path>`s. This gives exact width
  measurement for two-line wrapping and the ellipsis, and identical output on a Mac and on Cloud
  Run, with no fonts or fontconfig needed in the image.
- Characters missing from the font are dropped from the card. Previews still carry the full name
  in `og:title`.
- **Layout:** OpenMRS Atlas logo and name at the top left; the marker's name, country, "N sites"
  and "Closed" in a left text column about 520 pixels wide; a regional map filling the right of
  the card and fading under the text column; the site address at the bottom left.
- **Map:** a Web Mercator projection centred on the marker, about 40 degrees of longitude
  across, drawn from country-coder's country features. Longitudes are shifted to within 180
  degrees of the marker so the antimeridian works. The marker's own country is filled in the
  accent colour, and a teardrop pin marks its position.
- **World image:** the same renderer, at a fixed world view, with a dot for each marker and the
  counts.

### Card files, the manifest and versioned names
- **Card files:** `cards/<id>-<hash>.png`, where `hash` is the first 12 hex characters of a
  SHA-256 of `[CARD_VERSION, name, country, site_count, status, latitude, longitude]`. They are
  served with `public, max-age=31536000, immutable`. `CARD_VERSION` is a constant, bumped when
  the design changes, so the nightly publish redraws them all.
- **Manifest:** `cards/manifest.json`, `{ markers: { [id]: { hash, file } } }`, with the usual
  5-minute caching.
- **World image:** `cards/world.png`, at a fixed address with one-hour caching, because the
  static `index.html` can't know a versioned name. Permalinks of markers without a card use it
  too.
- `SnapshotStore` gains `writeBinary(name, body, contentType, cacheControl)` (no gzip) and
  `remove(names)`.

### Drawing cards is a separate step after a successful publish
- `publish()` takes a `cards: { limit: number }` option. After writing the snapshot files and
  problems, it calls `refreshCards(snapshot, store, limit)` in a `try`/`catch`. A failure there
  is logged as `{ event: "cards", ... }` and never changes the publish result.
- `refreshCards` reads the manifest and works out which markers are missing or have a changed
  hash. It draws up to `limit` of them, one at a time, then redraws the world image and writes
  the new manifest. Per-card failures are logged by id and left out of the manifest, so the next
  run tries again.
- **Limits:** the nightly scheduler call has no limit. Every other caller (`publishAfterEdit`, Apps
  Script, an admin) gets 10, which adds about a second at most to a publish in the queue.
  Changed markers are drawn first, ahead of markers that have never had a card.
- **Removal:** cards of markers no longer published leave the manifest at once, so their
  permalinks stop showing them. Their files, and superseded versions, are deleted only by the
  nightly run, which deletes every `cards/` file the manifest doesn't name. A page cached in the
  last 5 minutes therefore never points at a missing image.
- A refused publish returns before this step, so cards are unchanged.

### Home page tags are added at build time
- The `preloads()` plugin, or a sibling `previews()` plugin, adds `og:title`, `og:description`,
  `og:image` (`${VITE_DATA_BASE_URL}/cards/world.png`), `og:url` (`VITE_SITE_URL`) and
  `twitter:card` to `index.html`, only when both variables are set.
- `deploy.yml` passes `VITE_SITE_URL: ${{ vars.SITE_URL }}`. Development and e2e builds get no
  preview tags.

## Risks / Trade-offs

- [Cold start when someone clicks a shared link] → The CDN caches each permalink page for 5
  minutes. A cold start adds a second or two to the first click.
- [The nightly run takes longer on its first night: about 450 cards, at an estimated 100–200 ms
  each] → One to two minutes, well within the 300-second timeout. Measure it on staging. If it
  is slow, raise the service's timeout or memory in `setup.sh` and the deploy flags.
- [The bundled font lacks some scripts] → Names on the Atlas are almost all in Latin script.
  Missing characters are left out of the card, and the title tag still has the full name.
  Another Noto font can be added if needed.
- [Platforms cache previews for days] → Versioned card addresses mean a fresh share shows the
  new card. Previews already posted keep their old image, which is how those platforms work.
- [Production previews need the DNS switch] → `SITE_URL` is atlas.openmrs.org, which serves
  Atlas 2.0 until the switch. Test on staging. Production previews start working at the switch.
- [Coarse outlines] → country-coder's borders are simplified. That's fine at a 40-degree regional
  view, and very small island states may look blocky.
