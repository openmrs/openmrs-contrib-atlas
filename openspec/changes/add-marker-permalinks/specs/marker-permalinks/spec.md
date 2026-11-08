# Spec Delta

## Purpose

Stable addresses for markers that preview well wherever they are shared: on social media, in chat
apps and in email.

## ADDED Requirements

### Requirement: Marker permalinks
Every published marker SHALL have the address `<site>/marker/<id>`. Opening it in a browser SHALL show the map with that marker's details open, as `/?marker=<id>` does. The address SHALL keep working for as long as the marker is published, whatever else about it changes.

#### Scenario: Opening a permalink
- **WHEN** a visitor opens `/marker/<id>` for a published marker
- **THEN** the map opens centred on that marker with its details shown

#### Scenario: Marker renamed
- **WHEN** an owner renames a marker and someone later opens its permalink
- **THEN** the same marker opens, with its new name

#### Scenario: Closed marker
- **WHEN** a visitor opens the permalink of a closed marker
- **THEN** the marker opens and its details say it is closed

### Requirement: Link preview tags
The page served at a marker's permalink SHALL contain, without running any script, Open Graph and Twitter/X Card tags: the marker's name as the title, a description naming its country and number of sites, the marker's card as a 1200 × 630 image (or the world image when it has no card yet), the permalink as the canonical address, and the large-image card type. The tags SHALL use only fields published in `atlas.json`.

#### Scenario: Preview on social media
- **WHEN** a crawler that runs no JavaScript fetches `/marker/<id>` for "Kampala Rollout" in Uganda with 50 sites
- **THEN** the response has `og:title` "Kampala Rollout", an `og:description` mentioning Uganda and 50 sites, an `og:image` of its card, `og:url` of the permalink and `twitter:card` "summary_large_image"

#### Scenario: Marker without a card yet
- **WHEN** a marker was added a minute ago and its card hasn't been drawn
- **THEN** its permalink's `og:image` is the world image

#### Scenario: Nothing private
- **WHEN** any permalink page is fetched
- **THEN** it contains no contact name, email, owner or editor

#### Scenario: Markup in a name
- **WHEN** a marker's name contains `<`, `>`, `&` or quotes
- **THEN** they are escaped in the page and the tags, and nothing is executed

### Requirement: Unknown permalinks
A permalink for an id that isn't published, including hidden and deleted markers, SHALL answer with status 404 and a page that sends people to the map, with no marker-specific preview tags.

#### Scenario: Deleted marker
- **WHEN** someone opens the permalink of a deleted marker
- **THEN** the response status is 404 and the visitor is sent on to the map

### Requirement: Permalinks read only published data
Permalink pages and the card download address SHALL be answered from the published snapshot, never from the sheet. Anyone SHALL be able to fetch them without signing in. They SHALL reflect a publish within 10 minutes.

#### Scenario: After a publish
- **WHEN** an owner renames a marker and the publish completes
- **THEN** within 10 minutes its permalink page shows the new name

### Requirement: Card download address
`<site>/marker/<id>/card.png` SHALL redirect to the marker's current card, or answer 404 if the marker isn't published or has no card yet.

#### Scenario: Download a card
- **WHEN** a visitor opens `/marker/<id>/card.png` for a published marker with a card
- **THEN** they are redirected to a 1200 × 630 PNG of that marker's card

### Requirement: Home page previews
The site's home page SHALL contain Open Graph and Twitter/X Card tags with the title "OpenMRS Atlas", the site's description, and the world image, so a plain link to the Atlas previews with a picture.

#### Scenario: Sharing the home page
- **WHEN** a crawler fetches the site's home page
- **THEN** it finds `og:title` "OpenMRS Atlas" and an `og:image` of the world image
