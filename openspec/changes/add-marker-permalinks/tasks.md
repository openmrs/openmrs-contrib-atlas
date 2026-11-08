# Tasks

## 1. Card renderer

- [ ] 1.1 Add `opentype.js` to the service and bundle Noto Sans Regular and Bold (OFL, with its licence file) in `service/assets/fonts/`; copy `service/assets` in the Dockerfile
- [ ] 1.2 Text layout helper: measure, wrap to at most two lines with an ellipsis, and emit SVG paths; tests for wrapping, the ellipsis, accented Latin ("Clínica Nuevas Raíces") and dropped missing glyphs
- [ ] 1.3 Map helper: Web Mercator projection centred on a point, longitudes shifted for the antimeridian, country features from country-coder's `borders`, the marker's country picked out, and a teardrop pin; tests for the projection, a marker near 180°, and a marker at sea
- [ ] 1.4 `cardSvg(marker)` and `worldSvg(snapshot)`, with `renderPng(svg)` using sharp; tests that the PNG is 1200 × 630, that the card shows the name, country, "N sites" and "Closed", that the SVG has no raw `<`/`&` from marker fields, and that private fields never appear
- [ ] 1.5 `cardHash(marker)` with `CARD_VERSION`; tests that notes, URL or logo changes keep the hash, and that name, country, site count, status or position changes alter it

## 2. Publishing cards

- [ ] 2.1 Extend `SnapshotStore` with `readSnapshot`, `readCards`, `writeBinary` and `remove`, in the GCS store and the test fakes
- [ ] 2.2 `refreshCards(snapshot, store, { limit, sweep })`: changed cards first, then missing ones, up to `limit`; per-card failures logged and left out; world image redrawn; manifest written; `sweep` deletes every `cards/` file the manifest doesn't name
- [ ] 2.3 Call it from `publish()` after a successful write, in a try/catch with a `cards` log event; nightly scheduler calls get no limit and `sweep`; everyone else gets 10 and no sweep; a refused publish skips it
- [ ] 2.4 Tests for every scenario in "Cards follow publishes" and "Nightly publish completes the cards", including a failing card, a notes-only edit, a deleted marker, and the first publish with no cards

## 3. Permalink routes

- [ ] 3.1 `GET /marker/:id`: preview page with escaped tags, canonical URL, script hand-over and noscript link; the world image when there's no card; 404 page with `noindex` for unpublished ids; `Cache-Control: public, max-age=300, s-maxage=300`
- [ ] 3.2 `GET /marker/:id/card.png`: 302 to the card's bucket address, or 404
- [ ] 3.3 60-second in-memory cache of the snapshot and manifest for both routes
- [ ] 3.4 Tests for every scenario in the `marker-permalinks` spec: tags, no card yet, nothing private, markup in a name, deleted marker, card download, and no sheet reads

## 4. Hosting and site

- [ ] 4.1 `firebase.json`: `/marker/**` rewrite to the service in both targets; extend `infra/firebase.test.ts`
- [ ] 4.2 Vite plugin: home page `og:*` and `twitter:*` tags when `VITE_SITE_URL` and `VITE_DATA_BASE_URL` are set; `deploy.yml` passes `VITE_SITE_URL`; a test of the plugin's output
- [ ] 4.3 The site opens `/?marker=<id>` from the hand-over exactly as today (Playwright: the hand-over page's script lands on the open marker)

## 5. Docs and checks

- [ ] 5.1 `service/README.md`: the public routes, card files and manifest, and the card limits; `infra/README.md`: the rewrite; remove the cards part from `openspec/backlog.md`'s share item, leaving the dialog and badge
- [ ] 5.2 All checks pass (`format:check`, `typecheck`, `lint`, unit tests, e2e, build), the Docker image builds and renders a card, and `openspec validate --strict`
- [ ] 5.3 (manual) On staging, run the nightly publish once (Cloud Scheduler "Force run"), check that cards appear in the bucket and how long it took, then paste a permalink into LinkedIn's Post Inspector, the Facebook Sharing Debugger and a WhatsApp chat
