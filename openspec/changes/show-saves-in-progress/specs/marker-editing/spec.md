## ADDED Requirements

### Requirement: Saving shows its progress
While a marker is being saved, its form SHALL say so and SHALL NOT accept changes to its fields or location. The form SHALL close only after the save succeeds. If the save fails, the form SHALL unlock with everything as entered.

#### Scenario: Save in progress
- **WHEN** an owner saves a marker and the service takes a second to answer
- **THEN** the Save button says "Saving…", a status line says the change is being saved, and the fields and map pin can't be changed until the answer arrives

#### Scenario: Save refused
- **WHEN** a save is refused because the website is not a valid address
- **THEN** the form stays open and unlocked, with everything as entered and the website field marked

### Requirement: The edit form opens at once
When a person opens the edit form for a marker shown on the map, the form SHALL appear at once with the marker's public details, locked and saying the rest is loading. When the service answers, the form SHALL show the service's values, add the details only the service has, and unlock.

#### Scenario: Opening
- **WHEN** an owner opens the edit form for their marker and the service takes a second to answer
- **THEN** the form shows the marker's name and other public details at once, locked, and unlocks with its contact details once the service answers

#### Scenario: The map is behind
- **WHEN** the map shows an older name than the sheet holds
- **THEN** the form shows the sheet's name once the service answers, before anything can be typed

#### Scenario: Marker not on the map
- **WHEN** an owner opens the edit form for a hidden marker from My markers
- **THEN** the form says "Loading…" until the service answers, as before
