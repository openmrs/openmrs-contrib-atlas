# Design

## Context

Everything here is in the web app.

**`SharingControls.tsx`** keeps one `busy` flag for the whole section. Adding or removing an
editor:

- sets `busy`, which disables the box, the Add button and every Remove link;
- awaits the request;
- then calls `onEditors(result.editors)`, which puts the list in the form's `form.editors`.

Errors show as one `role="alert"` line.

**`MarkerForm.tsx`:**

- **Opening for edit:** it renders nothing but `<p role="status">Loading…</p>` until
  `GET /api/markers/:id` returns (`loading` state). That response holds the fields, contact,
  owner, editors, role, version and problems.
- **Saving:** it sets `saving`, which disables only the Save button and shows "Saving…". It
  then awaits the PATCH or POST and calls `onSaved`. App closes the form and updates the map.
  On an error it shows field errors, a conflict or a message.
- **The location:** a map click handler (`map.on("click")`) and a draggable pin, both active
  once `ready`.

**`App.tsx`** knows the marker as shown on the map: `allMarkers` is the published snapshot with
this person's saved changes on top (`saved`). It mounts the form with a `key`, so each open
starts fresh.

## Goals / Non-Goals

**Goals:**
- A change appears, or its progress is shown, the moment someone acts.
- Nothing typed during a save or a load is silently lost.
- A failure always leaves the screen showing what's really in the sheet.

**Non-Goals:**
- Closing the form before the save succeeds.
- Several editor changes in flight at once.
- Service changes.

## Decisions

### Editors: one pending change, shown in the list

`SharingControls` gets a `pending` state:

- `{ kind: "add", name }` for an add;
- `{ kind: "remove", name }` for a remove;
- `undefined` when nothing is in flight.

The list it shows is derived:

- for an add, `editors` plus the pending name, shown as `name` and "Adding…" with no Remove link;
- for a remove, `editors` without the pending name.

The name is shown normalised, trimmed and lower-case, the way the service stores it. A name
already listed, or the owner's, isn't shown twice. The service returns the list unchanged, and
it simply appears that way.

While a change is pending:

- the box, the Add button and the Remove links stay disabled, as now, so only one change is in
  flight. This keeps the answers in order, since each returns the whole list;
- the Add button says "Adding…".

On success, `onEditors(result.editors)` replaces the list, and `pending` is cleared.

On failure, `pending` is cleared, so the list is what it was. The error shows as now. For a
failed add, the typed text goes back in the box. The box is cleared as soon as the add starts,
so restoring it lets the owner fix a typo.

The list is the place people look, so a visible "Adding…" is enough. A screen reader hears it
because the list item's text includes it. The existing alert line covers errors.

**Alternative considered:** letting several changes run at once. Each answer carries the whole
list, so answers arriving out of order could show a wrong list. One at a time is simpler, and
each change takes about a second.

### Saving: lock the form and say so

The form's inputs are wrapped in one `<fieldset disabled={locked}>`, styled to look like
nothing, where `locked = saving || loadingPreview`. A disabled fieldset disables every input,
select and button inside it, including the place search, without touching each field.

The map click handler and the pin's dragging check `locked` as well:

- the click handler returns early;
- `pin.setDraggable(!locked)`.

The Save and Cancel row stays outside the fieldset. Save is disabled while `saving`, as now, and
so is Cancel. Cancelling mid-save would close the form while the save still landed, leaving the
map out of step for no gain, since a save takes about a second.

While saving, a `<p role="status">` under the buttons says "Saving your changes and updating
the map…". The text says why it takes a moment, and `role="status"` announces it politely. On
success the form closes. On failure the fieldset unlocks with the values untouched, because
`values` is never reset on error, and the errors show as today.

`SharingControls` and the less common actions sit outside the main form and keep their own
states.

### Opening: show the public details first

App passes `preview={selected}`, the marker as shown on the map, when it opens the edit form.
It passes nothing when the marker isn't on the map, such as a hidden marker from My markers, or
when adding.

On mount with a `preview` and no draft waiting for this marker:

- `values` start as `toValues`-style values from the preview's public fields: name,
  organisation, latitude, longitude, type, distribution, version, site count, URL, logo and
  notes. Contact and owner start empty. `initial` is the same, so nothing reads as changed.
- `loadingPreview` is true, so the form renders, locked, with a `<p role="status">` saying
  "Loading the rest of this marker…" in place of the plain "Loading…".
- Parts that depend on the response stay hidden until it arrives. These are the contact
  fieldset (it needs `role`), the owner field and status (admin), `SharingControls` and
  `problems`. They appear when it arrives. The form grows at that point, but nothing above
  the fold moves, because those parts sit below the public fields.

When `GET /api/markers/:id` returns, `applyLoaded` runs as now. It replaces `values` and
`initial` with the service's values, which are the truth even when the map is behind, and
clears `loadingPreview`. Because the form was locked, nothing typed is overwritten.

On a load error, the form shows the error as today and stays locked, rather than offering a
form that can't be saved. On an expired session, it behaves as today.

A waiting draft (from signing in again mid-edit) skips the preview, so the draft's values are
never shown and then replaced. `takeDraft` is only read, not taken, for this check.

## Risks / Trade-offs

- **The form grows when the rest loads.** It appears in about 0.6 seconds, below the public
  fields. That's better than a blank panel, and the status line says more is coming.
- **The preview shows the map's values for a moment.** If the map is behind the sheet (up to
  the 5-minute cache), the name may change when the service answers. The form is locked until
  then, so nothing is lost. The "map is behind" test covers it.

## Migration Plan

Web-only. The deploy ships it, and rolling back ships the previous web bundle.

## Open Questions

None.
