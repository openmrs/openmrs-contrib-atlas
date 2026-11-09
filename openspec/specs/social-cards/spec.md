# social-cards Specification

## Purpose
A picture for each published marker, and one for the whole Atlas, that link previews and the Share
dialog can show.

## Requirements

### Requirement: Card content
Each published marker SHALL have a 1200 × 630 PNG card showing its name (shortened with an ellipsis if it doesn't fit on two lines), its country, its number of sites when more than 1, "Closed" for a closed site, a map of the surrounding region with the marker's country picked out and a pin at its position, and the OpenMRS Atlas name and address. Cards SHALL use only fields published in `atlas.json`.

#### Scenario: A card
- **WHEN** the card for "Kampala Rollout" in Uganda with 50 sites is drawn
- **THEN** it shows "Kampala Rollout", "Uganda", "50 sites", a map of East Africa with Uganda picked out and a pin near Kampala, and "OpenMRS Atlas"

#### Scenario: Long name
- **WHEN** a marker's name is too long for two lines
- **THEN** the card shows two lines ending in an ellipsis, and nothing overlaps

#### Scenario: Closed site card
- **WHEN** the card for a closed marker is drawn
- **THEN** it says "Closed"

#### Scenario: At sea or near the antimeridian
- **WHEN** a marker has no country, or lies near longitude 180
- **THEN** its card is drawn without a country name, with the map centred on the pin

### Requirement: World image
A 1200 × 630 PNG world image SHALL show every published marker as a dot on a world outline map, with the OpenMRS Atlas name and the number of implementations and countries. It SHALL be redrawn by every successful publish.

#### Scenario: After a publish
- **WHEN** a publish adds a marker in a new country
- **THEN** the world image shows its dot and the higher country count

### Requirement: Cards follow publishes
After a successful publish, each published marker SHALL have a card matching its current name, country, number of sites, status and position, and cards for markers no longer published SHALL be removed. A refused publish SHALL leave cards unchanged. Drawing cards SHALL NOT delay or fail the publish of `atlas.json` and the other snapshot files.

#### Scenario: Rename
- **WHEN** an owner renames a marker
- **THEN** after the publish that follows, its card shows the new name

#### Scenario: Unrelated edit
- **WHEN** an owner changes only a marker's notes
- **THEN** its card is not redrawn

#### Scenario: Marker deleted
- **WHEN** a marker is deleted or hidden
- **THEN** after the next publish its card is removed

#### Scenario: Card drawing fails
- **WHEN** drawing one card fails
- **THEN** `atlas.json` and the other snapshot files are still published, the failure is logged, and the next publish tries that card again

### Requirement: Nightly publish completes the cards
A publish run by anything other than the nightly job MAY leave some cards to be drawn later. The nightly publish SHALL draw every card that is missing or out of date.

#### Scenario: First publish after release
- **WHEN** the first publish after this change runs after an edit, with 449 markers and no cards
- **THEN** it publishes as usual and draws only a few cards, and the next nightly publish draws the rest

### Requirement: Card addresses change with the card
Each card SHALL be published at a public address that changes whenever its content changes, and SHALL be served with long-lived caching. Previews made after a change SHALL therefore show the new card, not one cached by the network.

#### Scenario: Preview after a rename
- **WHEN** a marker is renamed and its card redrawn
- **THEN** its permalink's `og:image` is a different address from before
