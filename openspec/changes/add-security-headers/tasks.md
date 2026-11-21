# Tasks

## 1. Headers

- [x] 1.1 Add the headers to both targets in `firebase.json` as the design's decision 2 places them: the CSP (with each environment's Keycloak host) and `Referrer-Policy` on the pages, `X-Content-Type-Options` and `Permissions-Policy` on `**`
- [x] 1.2 `infra/firebase.test.ts`: swap each Keycloak host for a placeholder before comparing the targets, and check that both send the headers where the design puts them

## 2. Tests under the policy

- [x] 2.1 `web/e2e/fixtures.ts`: add the staging target's page headers to every HTML response, and fail any test that records a `securitypolicyviolation`
- [x] 2.2 Run the full e2e suite and adjust the policy to what the site really needs (for example `style-src` or `worker-src`), noting any change in the design
- [x] 2.3 A test that proves the check works: a script from an unlisted origin is blocked and reported

## 3. Docs and ship

- [x] 3.1 `infra/README.md`: the headers, and where to add an origin when the site needs a new one
- [x] 3.2 Run `npm run format:check`, `typecheck`, `lint`, `test`, the e2e tests and `openspec validate --strict`
- [x] 3.3 (manual) On staging, with the browser console open: sign in and out, search for a place, pan and zoom the map, download data and an image, and open the Share dialog. Check that nothing is blocked
- [ ] 3.4 (manual) After the release, the same on production, plus that Google Analytics records a page view
