# Proposal

## Why

Firebase Hosting serves the site with caching headers only. The code review found no way for
anyone to inject script into the pages: React escapes everything, there is no `innerHTML`, and the
service escapes its own HTML. But a signed-in person's access token sits in `sessionStorage`,
where any script on the page could read it. A Content-Security-Policy that allows only the
origins the site really uses is cheap insurance against a future mistake or a compromised
dependency. The other standard headers cost nothing.

## What Changes

- **An enforced Content-Security-Policy** on every page and asset. It allows scripts from the site
  itself and Google Analytics, and data and images from the site, its public bucket and Google
  Analytics. It also allows connections to the bucket, OpenFreeMap (map style, tiles and fonts),
  Nominatim (place search), Keycloak and Google Analytics. Keycloak may also be framed, for
  renewing a session. Workers come from the site, framing is limited to the site, and plugins,
  `<base>` changes and form posts elsewhere are blocked.
- **`X-Content-Type-Options: nosniff`**, a **`Permissions-Policy`** that turns off the camera,
  microphone, geolocation, payment and USB, and **`Referrer-Policy: strict-origin-when-cross-origin`**
  site-wide. The reminder page keeps its stricter `no-referrer`.
- **Both environments get the same headers**, apart from their own Keycloak host. The existing
  check that the staging and production hosting settings don't drift apart covers the headers too.
- **The browser tests run under the policy**, read from `firebase.json`, and fail on any
  violation. This catches a new origin before it reaches staging.

Out of scope:

- Headers on the service's own responses (`/api`, `/marker` pages and the reminder links). The
  `/marker` pages hold no script and redirect at once. They can follow in a later change.
- Violation reporting. There's nowhere to collect reports, and the browser tests and staging check
  take their place.
- HSTS, which Firebase Hosting already sends.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deployment`: the map site is served with these security headers in both environments.

## Impact

- `firebase.json`: a `"source": "**"` headers entry in each target.
- `infra/firebase.test.ts`: normalise each environment's Keycloak host, and check the headers
  are present.
- `web/e2e/fixtures.ts`: apply the staging target's headers to pages in tests and fail on
  `securitypolicyviolation`.
- `infra/README.md`: what to change when the site starts using a new origin.
