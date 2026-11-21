## MODIFIED Requirements

### Requirement: World image
A 1200 × 630 PNG world image SHALL show every published marker as a dot on a world outline map, with the OpenMRS Atlas name and the number of implementations and countries. After every successful publish it SHALL match the published markers. A publish after an edit SHALL redraw it only when what it shows changes; the nightly publish SHALL always redraw it.

#### Scenario: After a publish
- **WHEN** a publish adds a marker in a new country
- **THEN** the world image shows its dot and the higher country count

#### Scenario: Nothing it shows changed
- **WHEN** an owner adds an editor, and the publish that follows changes no marker's position and no count
- **THEN** the world image is not redrawn or uploaded again

#### Scenario: Not yet recorded
- **WHEN** the Atlas has no record of what the current world image shows
- **THEN** the next successful publish draws it

#### Scenario: Nightly
- **WHEN** the nightly publish runs and nothing has changed
- **THEN** the world image is still redrawn, so a lost or damaged file is replaced within a day
