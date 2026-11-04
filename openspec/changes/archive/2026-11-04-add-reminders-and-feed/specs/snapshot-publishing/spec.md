# Spec Delta

## MODIFIED Requirements

### Requirement: Download formats
Each publish SHALL also produce `markers.geojson` (a FeatureCollection of the same markers), `markers.csv` (one row per marker, public fields only) and `rss.xml` (the change feed), generated from the same data as `atlas.json`.

#### Scenario: Formats agree
- **WHEN** a publish completes
- **THEN** `atlas.json`, `markers.geojson` and `markers.csv` contain the same set of marker ids, and every marker in `rss.xml` is among them
