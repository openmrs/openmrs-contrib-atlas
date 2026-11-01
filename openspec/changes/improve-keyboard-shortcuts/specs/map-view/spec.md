## MODIFIED Requirements

### Requirement: Keyboard access
Search, filters, the colour-by choice, the download controls and marker details SHALL be operable by keyboard, and search results SHALL give keyboard users a way to reach any marker. Escape SHALL close an open marker panel wherever focus is, except in the search box, where it SHALL only clear the search. Pressing `/` SHALL move focus to the search box unless the visitor is typing in a field.

#### Scenario: Keyboard-only visitor
- **WHEN** a visitor uses only the keyboard
- **THEN** they can search for a site, open its details and close them again

#### Scenario: Escape with focus on the map
- **WHEN** a marker panel is open and focus is on the map
- **THEN** pressing Escape closes the panel

#### Scenario: Escape in the search box
- **WHEN** a marker panel is open and focus is in the search box
- **THEN** pressing Escape clears the search and closes its list of results, and the panel stays open

#### Scenario: Slash moves focus to search
- **WHEN** a visitor presses `/` while not typing in a field
- **THEN** focus moves to the search box and no `/` is typed into it

#### Scenario: Slash while typing
- **WHEN** a visitor presses `/` while typing in a field
- **THEN** the `/` is typed as usual
