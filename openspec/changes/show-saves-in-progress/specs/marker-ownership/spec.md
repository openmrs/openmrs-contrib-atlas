## ADDED Requirements

### Requirement: Editor changes show at once
When an owner adds or removes an editor, the editors list SHALL show the change before the service answers, with an added OpenMRS ID marked as being added. Once the service answers, the list SHALL show what it returned. If the change fails, the list SHALL return to how it was and the reason SHALL be shown.

#### Scenario: Adding
- **WHEN** an owner adds `asmith` as an editor
- **THEN** `asmith` appears in the list at once, marked "Adding…", and stays without the mark once the service confirms it

#### Scenario: Removing
- **WHEN** an owner removes `asmith`
- **THEN** `asmith` disappears from the list at once

#### Scenario: Unknown OpenMRS ID
- **WHEN** an owner adds `asmiht`, which is not an OpenMRS ID
- **THEN** `asmiht` appears marked "Adding…", then disappears; the owner is told the OpenMRS ID was not found, and `asmiht` is back in the box to correct

#### Scenario: Removal fails
- **WHEN** removing `asmith` fails because the service can't be reached
- **THEN** `asmith` is back in the list and the owner is told the change didn't work
