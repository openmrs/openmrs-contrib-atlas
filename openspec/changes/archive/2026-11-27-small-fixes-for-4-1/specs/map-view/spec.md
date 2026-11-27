## ADDED Requirements

### Requirement: Focus rings mark controls, not headings
When Atlas moves focus to a panel's heading, so that screen readers announce the panel, the heading SHALL NOT show a focus ring, however focus got there. Buttons, links and fields that have keyboard focus SHALL show their focus ring as before.

#### Scenario: Escape leaves the marker's name without a focus ring
- **WHEN** a marker is selected, the visitor opens the list or the filter panel, and presses Escape
- **THEN** the marker panel shows again with focus on the marker's name, and the name has no focus ring

#### Scenario: Escape leaves a button's focus ring
- **WHEN** no marker is selected, the visitor clicks the Filters button, and presses Escape
- **THEN** the filter panel closes, focus stays on the Filters button, and the button shows its focus ring
