# Spec Delta

## Purpose

Lets anyone follow additions and changes to the Atlas in a feed reader, at the `/rss` address kept from Atlas 2.0.

## ADDED Requirements

### Requirement: RSS feed at /rss
`/rss` SHALL return a valid RSS 2.0 feed of the 50 most recent marker events, newest first. Events are a marker being added, updated, confirmed still current, closed or reopened. Each item SHALL have a title such as "Eldoret Clinic joins the Atlas" or "Eldoret Clinic entry updated", the date of the event, and a link to the marker on the map.

#### Scenario: New marker in the feed
- **WHEN** a marker named "Eldoret Clinic" is added and published
- **THEN** the feed's first item is "Eldoret Clinic joins the Atlas", dated when it was added, linking to `/?marker=<id>`

#### Scenario: Kept address
- **WHEN** a feed reader subscribed to 2.0's `https://atlas.openmrs.org/rss` fetches it after cutover
- **THEN** it receives the 3.0 feed

### Requirement: The feed holds public data only
Feed items SHALL be built from public marker fields and the kind and time of each event. They SHALL NOT include who made a change, contact details, owners, editors, or which fields changed. Events for markers that are not published SHALL be left out.

#### Scenario: Who made a change
- **WHEN** an editor updates a marker
- **THEN** the feed item does not name the editor

#### Scenario: Private change only
- **WHEN** an owner adds an editor or changes the contact email, and nothing public changes
- **THEN** no feed item is added

#### Scenario: Deleted marker
- **WHEN** a marker that was added last week is deleted
- **THEN** its items leave the feed at the next publish

### Requirement: The feed is current
The feed SHALL be rewritten by every publish, so it is never more than 10 minutes behind the sheet.

#### Scenario: After an edit
- **WHEN** a marker is updated in the Atlas
- **THEN** the feed shows the update within 10 minutes
