# Tasks

## 1. Editors

- [x] 1.1 In `web/src/components/SharingControls.tsx`, add the `pending` state and derive the shown list from it. Show an add as the normalised name with "Adding…" and no Remove link, and hide a removed name. Clear the box when an add starts and put the text back if it fails. The Add button says "Adding…" while an add is in flight. Verify with the e2e tests in 3.1.
- [x] 1.2 Style the pending entry in the stylesheet, muted and with no layout shift when the mark goes. Check it at phone width.

## 2. Marker form

- [x] 2.1 In `web/src/components/MarkerForm.tsx`, wrap the inputs in one unstyled `<fieldset disabled={locked}>`. Make the map click and the pin's dragging respect `locked`. While saving, disable Cancel and show the "Saving your changes and updating the map…" status line. Values stay as typed on any failure.
- [x] 2.2 Add the `preview` prop. When it's given and no draft is waiting, start with the public fields, locked, with the "Loading the rest of this marker…" status. Hide contact, owner, status, problems and sharing until the response arrives, then take the service's values and unlock. Keep today's behaviour on a load error, an expired session, or with no preview.
- [x] 2.3 In `web/src/App.tsx`, pass `preview={selected}` when opening the edit form for a marker on the map.

## 2b. Errors beside their box

- [x] 2b.1 In `SharingControls.tsx`, show editor errors between the editor box and the Add button, and transfer errors between the new owner's box and its button. E2E tests check that the error sits between the box and the button, for both.
- [x] 2b.2 In `service/src/edits/people.ts`, refuse adding the owner as an editor with 422 "That person already owns this marker." Adding someone already listed still answers 200 unchanged. API tests cover both.
- [x] 2b.3 Make the e2e tests that type a known ID leave the box before clicking, so the suggestions can't cover the button. Verify with repeated runs.

## 3. Tests and checks

- [x] 3.1 Playwright tests in `web/e2e/editing.spec.ts`, with a fake-API gate that holds a response until the test releases it:
  - adding shows "Adding…" at once, then the plain name;
  - removing hides the name at once;
  - an unknown ID disappears, shows the error and is back in the box;
  - a failed removal (503) puts the name back with an error;
  - a held save shows "Saving…" and the status line, with the name field and Cancel disabled;
  - a refused save (422) unlocks with the values as typed and the field marked;
  - opening a marker on the map shows its name at once and is locked until the gate opens, then shows the contact fields;
  - when the fake service returns a different name than the map, the form shows the service's name;
  - a hidden marker opened from My markers shows "Loading…".
- [x] 3.2 Run the typecheck, lint, format check, unit tests, the e2e suite and `openspec validate show-saves-in-progress --strict`.
- [ ] 3.3 (manual) On staging, add and remove an editor and edit a marker, and check that each feels immediate and that a mistyped OpenMRS ID is handled clearly.
