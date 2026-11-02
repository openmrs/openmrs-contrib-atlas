# Spec Delta

## Purpose

Lets signed-in people add, change, confirm and delete markers from the map, keeping the sheet valid and the public map up to date.

## ADDED Requirements

### Requirement: Add a marker
Any signed-in person SHALL be able to add a marker by choosing a location and completing a form in which only name, location and type are required. The new marker SHALL be `active`, with `created_at`, `updated_at` and `confirmed_at` set to the current time.

#### Scenario: Choosing a place by search
- **WHEN** a person searches for "Eldoret" and picks a result
- **THEN** the map moves there and the marker's location is set, and they can adjust it before saving

#### Scenario: Choosing a place on the map
- **WHEN** a person clicks the map while adding a marker
- **THEN** the marker's location is set to that point

#### Scenario: Only required fields
- **WHEN** a person saves a marker with a name, location and type and nothing else
- **THEN** the marker is created and they become its owner

#### Scenario: Not signed in
- **WHEN** a visitor chooses to add a marker without being signed in
- **THEN** they are asked to sign in first, and then continue adding it

### Requirement: Optional marker fields
The form SHALL offer organisation, website, logo, notes, distribution, OpenMRS version, site count, contact name and contact email, and SHALL explain that contact details are not published.

#### Scenario: Pick lists
- **WHEN** a person opens the form
- **THEN** type, distribution and version are chosen from the current `types`, `distributions` and `versions` lists, with "Other" as a version

### Requirement: Edit a marker
A person allowed to edit a marker SHALL be able to change its fields from the marker's details. Saving SHALL set `updated_at` and `confirmed_at` to the current time, and SHALL NOT change `created_at` or `id`.

#### Scenario: Owner fixes a website
- **WHEN** an owner changes a marker's website and saves
- **THEN** the sheet holds the new website, and `updated_at` and `confirmed_at` are the time of the save

#### Scenario: Saving with nothing changed
- **WHEN** an owner opens the form and saves without changing anything
- **THEN** `updated_at` and `confirmed_at` become the time of the save

#### Scenario: No edit control without permission
- **WHEN** a signed-in person views a marker they may not edit
- **THEN** the details show no edit controls

### Requirement: Input is validated before writing
The service SHALL apply the marker-data validation rules to every add or edit and SHALL write nothing if any fail, returning each reason by field. The form SHALL show those reasons and keep what was typed.

#### Scenario: Invalid website
- **WHEN** a person saves a marker whose website is `ftp://example.org`
- **THEN** nothing is written and the form says the website must be an http or https URL

#### Scenario: Forged request
- **WHEN** a request sets a field the person may not change, such as `status` or `confirmed_at`, or supplies a new `id`
- **THEN** it is rejected and nothing is written

### Requirement: User text stays literal
Text from the form SHALL be stored exactly as typed and never interpreted by the sheet.

#### Scenario: Formula in a name
- **WHEN** a person saves a marker named `=IMPORTXML("http://example.org","//a")`
- **THEN** the sheet cell holds that literal text and no formula runs

### Requirement: Conflicting edits are not overwritten
A save SHALL fail if the marker changed after the form was opened, whether through the Atlas or the sheet. The person SHALL be told and SHALL keep what they typed.

#### Scenario: Two people edit one marker
- **WHEN** two people open the same marker and both save
- **THEN** the first save succeeds, and the second is refused with a message that the marker has changed, with its typed values kept

### Requirement: Still current
A person allowed to edit a marker SHALL be able to mark it "still current" in one action from its details, which SHALL set `confirmed_at` to the current time and change no other marker field except `updated_at`.

#### Scenario: Confirming a faded marker
- **WHEN** an editor chooses "Still current" on a marker last confirmed 4 years ago
- **THEN** its `confirmed_at` becomes the current time and it is drawn at full opacity

### Requirement: Activity restarts the freshness clock
Saving the add or edit form, "Still current", changing editors, offering or accepting a transfer, an admin setting the owner, and setting `status` to `active` on the website SHALL set `confirmed_at` to the current time. Requests SHALL NOT be able to choose the value.

#### Scenario: Owner adds an editor
- **WHEN** an owner adds an editor to a marker last confirmed 4 years ago
- **THEN** its `confirmed_at` becomes the current time

#### Scenario: Admin reactivates a marker
- **WHEN** an admin sets a hidden marker's status to `active` on the website
- **THEN** its `confirmed_at` becomes the current time

#### Scenario: Actions that do not restart the clock
- **WHEN** a marker is deleted, its status is set to `closed` or `hidden`, or a transfer offer is declined, cancelled or expires
- **THEN** its `confirmed_at` is unchanged

### Requirement: Delete a marker
The owner or an admin SHALL be able to delete a marker after confirming. Deleting SHALL set its `status` to `deleted` so that it leaves the public map, and SHALL keep its row so an admin can restore it by changing `status`.

#### Scenario: Owner deletes
- **WHEN** an owner deletes a marker and confirms
- **THEN** its status is `deleted`, it is removed from the next publish, its `confirmed_at` is unchanged, and its row remains in the sheet

#### Scenario: Confirmation declined
- **WHEN** an owner chooses delete and then cancels
- **THEN** nothing changes

### Requirement: Logo upload
A person editing a marker SHALL be able to upload a PNG, JPEG or WebP logo of at most 2 MB. The service SHALL decide the format from the file's contents, re-encode it to fit 300 × 300 pixels, and store only the result publicly.

#### Scenario: Oversized photo
- **WHEN** a person uploads a 1 MB JPEG of 2000 × 1000 pixels
- **THEN** the stored logo fits within 300 × 300 pixels at the same proportions

#### Scenario: Unsupported file
- **WHEN** a person uploads an SVG, a file over 2 MB, or a file misnamed as a PNG
- **THEN** it is rejected with a reason and the marker's logo is unchanged

### Requirement: The editor sees their change
After a successful save, the person who made it SHALL immediately see the result on their map and be told that others will see it within 10 minutes.

#### Scenario: After saving
- **WHEN** a person renames a marker and saves
- **THEN** their map and details show the new name at once, with a notice about when others will see it

### Requirement: Forms work on phones and by keyboard
The add and edit forms SHALL be usable on a 360 pixel wide touch screen and by keyboard alone. Escape SHALL ask before discarding unsaved changes.

#### Scenario: Escape with unsaved changes
- **WHEN** a person who has changed a field presses Escape
- **THEN** the form asks whether to discard the changes and stays open unless they agree
