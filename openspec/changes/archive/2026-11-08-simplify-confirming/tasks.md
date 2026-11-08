# Tasks

## 1. Shared rule

- [x] 1.1 Move `addMonths` from `service/src/reminders.ts` to `shared`, export it, and import it in reminders; reminder tests pass unchanged
- [x] 1.2 Add `needsConfirming(confirmedAt, now)` to `shared`, with tests: empty, 11 months 30 days, exactly 12 months, 31 January plus 12 months, 4 years

## 2. Service

- [x] 2.1 Add `Editor.confirmRecent(person)`: active markers the person owns or edits (not as admin), confirmed less than 12 months and more than 24 hours ago; one `updateCells` for all, row checks, one `confirm-on-sign-in` log row each, publish flag only when something changed
- [x] 2.2 Add `POST /api/me/confirm-recent` (signed in, write queue, publish once) returning `{ confirmed, published }`
- [x] 2.3 Tests for every scenario in "Signing in keeps recent markers current": owner, editor, old, never confirmed, confirmed today, admin-only, closed, hidden, deleted, and the change log row

## 3. Site

- [x] 3.1 `useSession`: after the first successful `GET /me` on page load, call `POST /me/confirm-recent`; reload `/me` if anything was confirmed; ignore failures
- [x] 3.2 `MarkerActions`: take `confirmedAt` and show "Still current" only when the marker isn't closed and `needsConfirming` is true
- [x] 3.3 `MyMarkers`: an "Update" link beside each active marker that needs confirming (accessible name "Mark <name> still current"); posts the confirm, shows "Updating…", refreshes, and reports errors in the panel
- [x] 3.4 Back control: `fromMine` in `App`, `onBack` on `MarkerDetails` with a "<" button labelled "Back to My markers", Backspace and Delete (ignored while typing or with Ctrl, Alt or Meta held), and `focusId` in `MyMarkers` to focus and scroll to the entry
- [x] 3.5 Component tests: button hidden and shown at the 12-month line; "Update" shown only for old active markers and calls the endpoint; back control and Backspace only for markers opened from My markers; Backspace in a field does nothing

## 4. End to end

- [x] 4.1 Playwright: open a marker from My markers, go back with "<" and with Backspace, and find focus on its entry
- [x] 4.2 Playwright: "Update" in My markers confirms an old marker, and the link disappears
- [x] 4.3 Playwright: signing in confirms a recent marker and leaves an old one alone (fake service data)

## 5. Docs and checks

- [x] 5.1 Update the help text in My markers, if any mentions "Still current", and `service/README.md`'s endpoint list
- [x] 5.2 All checks pass (`format:check`, `typecheck`, `lint`, unit tests, e2e) and `openspec validate --strict`
- [x] 5.3 (manual) On staging, sign in as `atlas-user` and confirm a recently confirmed marker's date moves to today, an old one shows "Update", and "<" and Backspace return to My markers
