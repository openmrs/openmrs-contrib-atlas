# Proposal

## Why

Keeping a marker current still takes a deliberate step: an owner has to open each marker and press
"Still current", even when they confirmed it a few months ago. That button is offered on every
marker, so it carries no signal. And once someone opens a marker from My markers, nothing takes
them back to the list. Before 3.0 is announced, keeping an entry current should take no effort for
people who are around, and one click for markers that have aged.

## What Changes

- **Signing in keeps recent markers current.** When an owner or editor starts a signed-in session
  (signing in, or opening the site while already signed in), each of their active markers
  confirmed less than 12 months ago is confirmed again. Markers confirmed in the last day are left
  as they are, so frequent visits don't rewrite the sheet. Markers confirmed 12 or more months ago
  are not confirmed automatically, so a sign-in for one site can't make an ended programme look
  current.
- **"Still current" only where it means something.** Marker details offer "Still current" only on
  an active marker confirmed 12 or more months ago (or never).
- **One click from My markers.** Beside each active marker confirmed 12 or more months ago (or
  never), My markers shows a small "Update" link that confirms it without opening it.
- **Back to My markers.** A marker opened from My markers shows a back control ("<") before its
  name. It, and Backspace (Delete on a Mac) when the person isn't typing in a field, return to My
  markers where they left it.

Unchanged: reminder emails and their emailed "still current" link (C4, C5), which reach owners
who never sign in; the actions that already restart the clock; the 12, 18 and 24-month reminder
stages.

Out of scope:

- The list view (M8) and share cards and the website badge, which follow as their own changes.
- Claiming orphaned markers (C9).
- Confirming markers when an admin signs in, unless the admin is the marker's owner or an editor.
- Any change to fading on the map, or to when reminders are due.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `marker-editing`: "Still current" is offered only on markers confirmed 12 or more months ago;
  starting a signed-in session confirms the person's recently confirmed markers.
- `marker-ownership`: My markers gains the "Update" link, and a marker opened from it can return
  to it.
- `map-view`: keyboard access gains Backspace and Delete to go back from a marker to My markers.

Requirement IDs served: C4 ("still current" one-click confirm), C6 (My markers).

## Impact

- Service: a new signed-in endpoint that confirms the person's recent markers, using the existing
  write queue, change log and publish; the existing confirm endpoint, used by the "Update" link.
- Web: `useSession` calls the new endpoint once when a session starts; `MarkerActions` hides
  "Still current" for recently confirmed markers; `MyMarkers` gains the link; `App` and
  `MarkerDetails` gain the back control and key.
- Sheet: more `confirmed_at` writes and `changes` log rows, at most one per marker per day.
- No change to email, reminders, the published snapshot format or deployment.
