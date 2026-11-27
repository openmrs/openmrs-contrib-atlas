## ADDED Requirements

### Requirement: Only files of a known type are cached for good
The site's hashed files under `/assets/` SHALL be cached for a year, and browsers told they never change, only when the container serves them with a known content type. A file it can only send as `application/octet-stream` SHALL be cached for no more than an hour, so a missing content type can't stay in browsers' caches for long.

#### Scenario: A known type
- **WHEN** a browser fetches `/assets/maplibre-gl-worker-<hash>.mjs`
- **THEN** it is served as JavaScript and may be cached for a year

#### Scenario: An unknown type
- **WHEN** a browser fetches a file under `/assets/` whose type the container doesn't know
- **THEN** it is served as `application/octet-stream` and may be cached for no more than an hour
