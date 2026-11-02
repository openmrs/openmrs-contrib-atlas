# Spec Delta

## Purpose

Defines who may do what to a marker, and lets owners share and hand over their markers without needing an admin.

## ADDED Requirements

### Requirement: Marker roles
Each marker SHALL have at most one owner and any number of editors, identified by OpenMRS ID. A marker with no owner SHALL be editable only by admins.

#### Scenario: Orphaned marker
- **WHEN** a signed-in non-admin views a marker with a blank owner, on which they are not an editor
- **THEN** no edit controls are shown, and requests to change it are rejected with 403

### Requirement: Role permissions
Editors SHALL be able to edit public fields, upload a logo and confirm a marker. Only the owner and admins SHALL be able to delete it, see or change contact details, manage editors or transfer ownership.

#### Scenario: Editor tries to delete
- **WHEN** an editor sends a request to delete a marker
- **THEN** it is rejected with 403 and nothing changes

#### Scenario: Editor opens the form
- **WHEN** an editor opens the edit form
- **THEN** it does not show or return the marker's contact name, contact email, owner or other editors

### Requirement: Admin permissions
Admins SHALL be able to do everything an owner can on any marker, set `owner` and `editors` directly without acceptance, set `status`, and add a marker on behalf of a named owner.

#### Scenario: Admin assigns an orphan
- **WHEN** an admin sets the owner of an orphaned marker to `jdoe`
- **THEN** `jdoe` is the owner at once

#### Scenario: Admin adds on behalf of someone
- **WHEN** an admin adds a marker and names `asmith` as owner
- **THEN** `asmith` is the owner and the change log names the admin

### Requirement: Manage editors
An owner SHALL be able to add and remove editors by OpenMRS ID only, with no lookup by email. The form SHALL warn that the ID is not checked, because the Atlas cannot confirm that an account exists.

#### Scenario: Add an editor
- **WHEN** an owner adds `asmith` as an editor
- **THEN** `asmith` can edit the marker the next time they sign in or reload

#### Scenario: Remove an editor
- **WHEN** an owner removes `asmith`
- **THEN** further edits from `asmith` are rejected with 403

#### Scenario: Owner listed as editor
- **WHEN** an owner adds their own OpenMRS ID, or one already listed, as an editor
- **THEN** the list does not change

### Requirement: Transfer ownership
An owner SHALL be able to offer ownership to one OpenMRS ID at a time. Nothing SHALL change until the recipient accepts. An offer SHALL expire after 30 days, and the owner SHALL be able to cancel it earlier.

#### Scenario: Offer made
- **WHEN** an owner offers a marker to `asmith`
- **THEN** the owner is still the owner, `confirmed_at` becomes the current time, the offer appears in `asmith`'s My markers, and the owner sees that it is pending and is told to let `asmith` know

#### Scenario: Offer accepted
- **WHEN** `asmith` accepts an offer
- **THEN** `asmith` is the owner and leaves the editor list, the previous owner becomes an editor, and `confirmed_at` becomes the current time

#### Scenario: Offer declined
- **WHEN** `asmith` declines an offer
- **THEN** the owner is unchanged and the offer is gone

#### Scenario: Offer expired or cancelled
- **WHEN** `asmith` tries to accept an offer that has expired or been cancelled
- **THEN** the request is refused and the owner is unchanged

#### Scenario: Someone else accepts
- **WHEN** anyone other than the named recipient tries to accept an offer
- **THEN** it is rejected with 403

#### Scenario: Ownership changes while an offer is pending
- **WHEN** an admin sets a new owner on a marker with a pending offer
- **THEN** the offer is cancelled

### Requirement: My markers
A signed-in person SHALL be able to list every marker they own or edit, with their role, its status and when it was last confirmed, along with offers awaiting their answer. Each entry SHALL open that marker's details, and hidden or invalid markers SHALL still be listed.

#### Scenario: Owner and editor
- **WHEN** a person who owns two markers and edits one opens My markers
- **THEN** all three are listed with their roles

#### Scenario: Pending offer
- **WHEN** a person has an offer waiting
- **THEN** My markers shows it with accept and decline actions, and the page shows that an offer is waiting

#### Scenario: Marker failing validation
- **WHEN** a person's marker has a row that fails validation
- **THEN** it is listed with the reasons, and they can open it, correct it and save

#### Scenario: Closed marker
- **WHEN** a person's marker has status `closed`
- **THEN** it is listed with that status

#### Scenario: Deleted marker
- **WHEN** a person's marker has status `deleted`
- **THEN** it is not listed for that person
