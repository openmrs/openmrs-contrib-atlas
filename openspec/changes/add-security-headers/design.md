# Design

## Context

- **What the site loads**, from the code:
  - **Scripts:** Vite bundles from `/assets` (no inline scripts in `index.html` or
    `reminder.html`). `analytics.ts` adds `https://www.googletagmanager.com/gtag/js` in
    production only.
  - **Worker:** MapLibre 6's worker, shipped as an asset and set with `setWorkerUrl` (same origin).
  - **Fetches:**
    - `/data/*`, which Hosting redirects to `storage.googleapis.com/<bucket>/`
    - `/api` (same origin)
    - `https://nominatim.openstreetmap.org/search` (place search)
    - card images through `/marker/<id>/card.png`, which redirects to the bucket
    - OIDC metadata and token calls to Keycloak
  - **Map:** style, tiles, sprites and glyphs from `https://tiles.openfreemap.org`.
  - **Images:**
    - logos and cards from the bucket
    - badges, favicons and the OpenMRS cross from the site
    - canvas exports as `blob:`
    - MapLibre's own `data:` images
  - **Frames:** `signinSilent` opens Keycloak in a hidden iframe, which returns to the site's own
    `/`. The site therefore frames Keycloak, and Keycloak frames the site.
  - **Styles:** bundled CSS files, plus React `style` props. Props are set through the DOM and
    aren't affected by `style-src`. MapLibre sets element styles the same way.
- **`firebase.json`** has one hosting target per environment. `infra/firebase.test.ts` checks
  that the two are identical once each environment's service name and bucket are swapped for
  placeholders.
- **The e2e tests** run against `vite preview`, which doesn't apply `firebase.json` headers. The map
  style comes from `/e2e/style.json`, served by the tests themselves.

## Goals / Non-Goals

**Goals:** a policy tight enough to stop injected or third-party script reading the token, tested
automatically, and easy to extend when the site starts using a new origin.

**Non-Goals:** nonces or hashes for inline code (there is none), Trusted Types, and reporting.

## Decisions

**1. The policy.** Staging's Keycloak is `https://id-stg.openmrs.org`; production uses
`https://id.openmrs.org`.

```
default-src 'self';
script-src 'self' https://www.googletagmanager.com;
style-src 'self';
img-src 'self' data: blob: https://storage.googleapis.com https://*.google-analytics.com https://*.googletagmanager.com;
font-src 'self';
connect-src 'self' https://storage.googleapis.com https://tiles.openfreemap.org https://nominatim.openstreetmap.org https://id.openmrs.org https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com;
worker-src 'self' blob:;
frame-src https://id.openmrs.org;
frame-ancestors 'self';
object-src 'none';
base-uri 'self';
form-action 'self'
```

- `style-src 'self'` with no `'unsafe-inline'`: the e2e run will show whether any library injects
  a `<style>` element. If one does, the fix is `'unsafe-inline'` for styles only, which can't run
  script.
- `worker-src` keeps `blob:` as a fallback for MapLibre's worker setup. Drop it if the e2e run
  shows it isn't needed.
- Signing in and out are top-level redirects to Keycloak, which `form-action` doesn't govern.
- `frame-ancestors 'self'` instead of `'none'`, because silent sign-in frames the site in itself.

**2. One `"source": "**"` header block per target**, in addition to the caching blocks. Firebase
merges every matching block, and the reminder page's `no-referrer` stays more specific.

**3. The drift test also swaps each Keycloak host for a placeholder**, so the two targets must
otherwise match exactly. A new test checks that both targets send the CSP and the other three
headers on `**`.

**4. e2e under the real policy.** `fixtures.ts` reads the staging target's `**` headers from
`firebase.json`, and adds them to every HTML response through `page.route`. It also listens for
`securitypolicyviolation` events, both through `page.on("console")` and through an init script
that records them. Every test then fails if a violation happened. Because the style is served
from `/e2e/style.json` (same origin), the e2e run doesn't exercise OpenFreeMap. The manual staging
check covers it.

## Risks / Trade-offs

- **[A missed origin breaks a feature only in production]** → The e2e run covers everything except
  OpenFreeMap and Google Analytics, which the staging check covers. GA runs only in production, so
  the production check after release opens the browser console once.
- **[GA changes its domains]** → GA would stop counting, but nothing else would break. The
  wildcards follow Google's published CSP guidance.
- **[A new feature needs a new origin]** → The e2e failure says which directive blocked it.
  `infra/README.md` says where to add it.

## Migration Plan

1. Ship to staging, and check sign-in, sign-out, a place search, the map at several zooms, a data
   download, an image export and the Share dialog, with the browser console open.
2. Release. Check production the same way, plus that Google Analytics records a page view.
3. Rollback: redeploying the previous release restores the old headers.
