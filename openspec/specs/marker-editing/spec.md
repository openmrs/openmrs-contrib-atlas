# marker-editing Specification

## Purpose
Lets signed-in people add, change, confirm and delete markers from the map, keeping the sheet valid and the public map up to date.

## Requirements

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
- **WHEN** a visitor wants to add a marker without being signed in
- **THEN** signing in takes them to My markers, where "Add a site" is the first action

#### Scenario: Latitude and longitude labels
- **WHEN** a person opens the form on any screen
- **THEN** the latitude and longitude labels each fit on one line and their fields line up, under a "Location (required)" heading

### Requirement: Optional marker fields
The form SHALL offer organisation, website, logo, notes, distribution, OpenMRS version, site count, contact name and contact email, and SHALL explain that contact details are not published. Distribution and version SHALL each be a list value or "Other" with free text of at most 30 characters for a distribution or 12 for a version, which the service enforces. Text matching a list entry ignoring case SHALL be saved as that entry, and blank text as `Other`.

#### Scenario: Pick lists
- **WHEN** a person opens the form
- **THEN** type is chosen from the current `types` list, and distribution and version from the current `distributions` and `versions` lists, each followed by "Other"

#### Scenario: Choosing Other
- **WHEN** a person chooses "Other" as the distribution
- **THEN** a text field appears for the distribution's name, limited to 30 characters

#### Scenario: Saving an Other value
- **WHEN** a person chooses "Other" as the version, types "2.4.2" and saves
- **THEN** the marker's `openmrs_version` is "2.4.2"

#### Scenario: Other value typed like a list entry
- **WHEN** a person chooses "Other" as the distribution, types "bahmni" and saves
- **THEN** the marker's `distribution` is "Bahmni", the entry on the list

#### Scenario: Other left blank
- **WHEN** a person chooses "Other" as the version, leaves the text blank and saves
- **THEN** the marker's `openmrs_version` is "Other"

#### Scenario: Editing a marker with an Other value
- **WHEN** a person edits a marker whose distribution is "AMPATH", which is not on the list
- **THEN** the form shows "Other" chosen, with "AMPATH" in the text field

#### Scenario: Too long
- **WHEN** a request saves a distribution of 31 characters that is not on the list
- **THEN** nothing is written and the form says the distribution must be 30 characters or fewer

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
A person allowed to edit a marker SHALL be able to mark it "still current" in one action from its details when it is `active` and its `confirmed_at` is 12 or more months ago or empty. That action SHALL set `confirmed_at` to the current time and change no other marker field except `updated_at`. Marker details SHALL NOT offer "Still current" on a marker confirmed less than 12 months ago. The service SHALL still accept a confirmation of any active marker the person may edit.

#### Scenario: Confirming a faded marker
- **WHEN** an editor chooses "Still current" on a marker last confirmed 4 years ago
- **THEN** its `confirmed_at` becomes the current time and it is drawn at full opacity

#### Scenario: Recently confirmed marker
- **WHEN** an owner opens the details of a marker confirmed 3 months ago
- **THEN** "Still current" is not offered, and Edit is

#### Scenario: Never confirmed
- **WHEN** an owner opens the details of an active marker with no `confirmed_at`
- **THEN** "Still current" is offered

#### Scenario: Closed site
- **WHEN** a person views a closed marker they may edit
- **THEN** "Still current" is not offered, and a request to confirm it is refused with 409

### Requirement: Activity restarts the freshness clock
Saving the add or edit form, "Still current" on the map, from My markers or from an emailed link, starting a signed-in session (as set out in "Signing in keeps recent markers current"), changing editors, offering or accepting a transfer, an admin setting the owner, reopening a site, and setting `status` to `active` on the website SHALL set `confirmed_at` to the current time. Requests SHALL NOT be able to choose the value.

#### Scenario: Owner adds an editor
- **WHEN** an owner adds an editor to a marker last confirmed 4 years ago
- **THEN** its `confirmed_at` becomes the current time

#### Scenario: Admin reactivates a marker
- **WHEN** an admin sets a hidden marker's status to `active` on the website
- **THEN** its `confirmed_at` becomes the current time

#### Scenario: Confirmed from a reminder
- **WHEN** an owner presses "Still current" on the page opened from a reminder
- **THEN** its `confirmed_at` becomes the current time

#### Scenario: Actions that do not restart the clock
- **WHEN** a marker is deleted, a site is closed, its status is set to `closed` or `hidden`, a transfer offer is declined, cancelled or expires, or a reminder is sent
- **THEN** its `confirmed_at` is unchanged

### Requirement: Close and reopen a site
The owner or an admin SHALL be able to close an `active` marker, meaning the implementation has ended, and to reopen a `closed` one. Closing SHALL keep the marker on the public map, and SHALL NOT change `confirmed_at`. Reopening SHALL set `status` to `active` and restart the clock. Each SHALL be logged and published.

#### Scenario: Owner closes a site
- **WHEN** an owner chooses "Close site"
- **THEN** its status is `closed`, it stays on the map as a closed site, and its `confirmed_at` is unchanged

#### Scenario: Owner reopens a site
- **WHEN** an owner chooses "Reopen site" on a closed marker
- **THEN** its status is `active` and its `confirmed_at` is the current time

#### Scenario: Marker in another status
- **WHEN** a request closes a `hidden` marker or reopens an `active` one
- **THEN** it is refused with 409 and nothing changes

### Requirement: Less common actions are set apart
"Edit" and "Still current" SHALL be shown directly in a marker's details. "Close site" or "Reopen site" and "Delete" SHALL be in a separate actions menu, which SHALL work by keyboard and which people without those rights SHALL NOT see.

#### Scenario: Owner's menu
- **WHEN** an owner opens the actions menu on an active marker
- **THEN** it offers "Close site" and "Delete"

#### Scenario: Editor has no menu
- **WHEN** an editor views a marker
- **THEN** no actions menu is shown

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

### Requirement: Signing in keeps recent markers current
When a signed-in session starts, by signing in or by opening the site while already signed in, the service SHALL set `confirmed_at` to the current time on each `active` marker the person owns or edits that was confirmed less than 12 months ago and more than one day ago, and log each as a confirmation by that person. Admin rights alone SHALL NOT make a marker eligible. A failure SHALL NOT stop the session starting.

#### Scenario: Owner signs in
- **WHEN** an owner whose marker was confirmed 5 months ago signs in
- **THEN** that marker's `confirmed_at` becomes the current time, and the change log records a confirmation by the owner

#### Scenario: Editor signs in
- **WHEN** an editor of a marker confirmed 11 months ago opens the site while already signed in
- **THEN** that marker's `confirmed_at` becomes the current time

#### Scenario: Old marker
- **WHEN** an owner signs in and one of their markers was confirmed 14 months ago
- **THEN** that marker is not confirmed, and still offers "Still current"

#### Scenario: Confirmed today
- **WHEN** an owner signs in twice on the same day
- **THEN** the second sign-in writes nothing to the sheet

#### Scenario: Admin
- **WHEN** an admin who neither owns nor edits a marker confirmed 3 months ago signs in
- **THEN** that marker is not confirmed

#### Scenario: Closed marker
- **WHEN** an owner signs in and one of their markers is closed
- **THEN** that marker is not confirmed

#### Scenario: Service unavailable
- **WHEN** the confirmation fails as a session starts
- **THEN** the person is still signed in and My markers still works
