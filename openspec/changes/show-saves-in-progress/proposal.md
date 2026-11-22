# Proposal

## Why

Atlas 3.5 brought an editor change down to about 1 second and a marker save to about 1.4 seconds.
What's left is mostly Sheets round trips that have to happen one after another, so the remaining
wins are in what people see while they wait:

- **Editors:** adding or removing one disables the whole Sharing section, and nothing changes
  on screen until the service answers.
- **Saving a marker:** the Save button already says "Saving…", but the fields can still be
  edited. Anything typed during a save is silently replaced when the form closes, and the
  service gives no other sign that it is working.
- **Opening a marker's edit form:** the form shows only "Loading…" until the service answers,
  which takes 0.6 seconds, or 1.4 seconds or more on a cold instance. Yet most of what the form
  shows is already on the map.

## What Changes

- **Editor changes show at once.**
  - An added OpenMRS ID appears in the editors list straight away, marked "Adding…".
  - A removed one disappears straight away.
  - When the service answers, the list shows what it returned. If the change fails, the list
    goes back to how it was, the error is shown, and a username that couldn't be added is put
    back in the box.
  - One editor change runs at a time, as now.
- **Saving shows its progress and locks the form.** While a save is in progress:
  - the fields, the location search and the map pin can't be changed;
  - the Save button says "Saving…", and a status line under the buttons says the change is
    being saved and published.

  On success the form closes and the map updates, as now. On a failure the form unlocks with
  everything as typed, and the errors point at their fields as today. The form never closes
  before the save has succeeded.
- **The edit form opens at once.** When the marker is on the map, the form shows its public
  fields straight away from the map's data, locked, with a line saying the rest is loading.
  When the service answers, the form fills in the service's values, adds the parts only it
  knows (contact details, owner, editors), and unlocks. A marker that isn't on the map (for
  example, a hidden one opened from My markers) shows "Loading…" as now.

Out of scope:

- Any service change. The service already returns everything these need.
- Closing the form before a save succeeds. A slightly slower save is better than a form that
  has to reopen.
- Transfers, claims, close, reopen and delete. They keep their current busy states.
- Making the Sheets calls themselves faster (see `speed-up-edits`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `marker-ownership`: editor changes show in the list at once, and are undone on failure.
- `marker-editing`: a save shows its progress and locks the form; the edit form opens at once
  from the map's data.

## Impact

- `web/src/components/SharingControls.tsx`: pending editor entries and a rollback on failure.
- `web/src/components/MarkerForm.tsx`:
  - a `preview` prop for opening at once;
  - a locked state, covering loading and saving, for the fields, the place search and the map
    pin;
  - a status line while saving.
- `web/src/App.tsx`: passes the marker as shown on the map to the form.
- Styles for the pending editor entry and the status line.
- Playwright tests for each behaviour, with the service's answers delayed. No service, sheet or
  config changes.
