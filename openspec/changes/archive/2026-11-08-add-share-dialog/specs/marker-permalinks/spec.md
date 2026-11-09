## MODIFIED Requirements

### Requirement: Unknown permalinks
A permalink for an id that isn't published, including hidden and deleted markers, SHALL answer with status 404 and a page that sends people to the map, with no marker-specific preview tags. A 404 page SHALL be cacheable for at most one minute, so a marker published just afterwards isn't hidden for long.

#### Scenario: Deleted marker
- **WHEN** someone opens the permalink of a deleted marker
- **THEN** the response status is 404 and the visitor is sent on to the map

#### Scenario: 404 cached briefly
- **WHEN** a permalink answers 404
- **THEN** its `Cache-Control` allows caching for no more than 60 seconds

### Requirement: Permalinks read only published data
Permalink pages and the card download address SHALL be answered from the published snapshot, never from the sheet. Anyone SHALL be able to fetch them without signing in. They SHALL reflect a publish within 10 minutes. A marker, or a marker's card, missing from what the service last read SHALL be looked up in the published files again before answering, at most once every 5 seconds, so a marker shared as soon as it is published previews correctly.

#### Scenario: After a publish
- **WHEN** an owner renames a marker and the publish completes
- **THEN** within 10 minutes its permalink page shows the new name

#### Scenario: Shared as soon as it is added
- **WHEN** a marker is added, the publish completes, and its permalink is fetched a few seconds later
- **THEN** the page has the marker's preview tags, with its card as the image if the card was drawn, not a 404

#### Scenario: Many requests for unknown ids
- **WHEN** a crawler requests 100 unknown permalinks within a second
- **THEN** the published files are read again at most once
