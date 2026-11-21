## ADDED Requirements

### Requirement: The site is served with security headers
Both environments SHALL serve the map site with an enforced Content-Security-Policy allowing only the origins it uses (itself, its bucket, OpenFreeMap, Nominatim, its Keycloak and Google Analytics), framing only by itself, and no plugins or form posts elsewhere. They SHALL also send `X-Content-Type-Options: nosniff`, a `Permissions-Policy` turning off unused device features, and a `Referrer-Policy`. The headers SHALL differ only in each environment's Keycloak host.

#### Scenario: Script from elsewhere
- **WHEN** a page tries to load a script from an origin the policy doesn't list
- **THEN** the browser refuses it

#### Scenario: Everything the site uses still works
- **WHEN** a visitor loads the map, searches for a place, signs in and downloads the data on staging
- **THEN** nothing is blocked by the policy

#### Scenario: Framed by another site
- **WHEN** another site puts the Atlas in a frame
- **THEN** the browser refuses to show it
