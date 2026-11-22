## MODIFIED Requirements

### Requirement: Manage editors
An owner SHALL be able to add and remove editors by OpenMRS ID, finding them by username or name. An editor SHALL be added only if the OpenMRS ID exists and is enabled. Adding the marker's owner SHALL be refused with a reason; adding an editor already listed SHALL change nothing, without an error.

#### Scenario: Add an editor
- **WHEN** an owner adds `asmith` as an editor
- **THEN** `asmith` can edit the marker the next time they sign in or reload

#### Scenario: Unknown OpenMRS ID
- **WHEN** an owner adds `asmiht`, which is not an OpenMRS ID
- **THEN** nothing changes and the owner is told the OpenMRS ID was not found

#### Scenario: Remove an editor
- **WHEN** an owner removes `asmith`
- **THEN** further edits from `asmith` are rejected with 403

#### Scenario: Owner listed as editor
- **WHEN** an owner adds their own OpenMRS ID as an editor
- **THEN** nothing changes, and they are told "That person already owns this marker."

#### Scenario: Editor already listed
- **WHEN** an owner adds `asmith`, who is already an editor
- **THEN** the list does not change and no error is shown

## ADDED Requirements

### Requirement: Sharing errors show beside their box
An error from adding or removing an editor SHALL be shown between the editor box and its Add button, and an error from offering or cancelling a transfer between the new owner's box and its button, so that it is in view where the person is working.

#### Scenario: Error in view
- **WHEN** an owner adds `asmiht` at the bottom of a long form
- **THEN** the reason appears directly under the box, above the Add editor button


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
