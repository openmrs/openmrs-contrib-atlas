# Design

## Context

- **Confirming today.** `POST /api/markers/:id/confirm` runs `Editor.confirm` in the write queue. It sets
  `confirmed_at` and `updated_at` to an ISO timestamp (`restartClock`), logs a `confirm` row in
  `changes`, and publishes. `MarkerActions` shows "Still current" on every non-closed marker the
  person may edit.
- **Sessions.** `useSession` loads `GET /api/me` once when the page loads with a session, which
  includes the return from Keycloak after signing in. It loads it again through `refresh()` after
  every edit. `GET /api/me` lists the person's markers with `role`, `status` and `confirmed_at`.
- **Month maths.** `addMonths` and `stageFor` in `service/src/reminders.ts` define "12 months ago"
  for reminders. They count calendar months in UTC and clamp to the month's last day.
- **Panels.** `App.tsx` has one `panel` state. Marker details show only when no panel is open, and
  `openMine` selects a marker, which closes My markers. Hidden and invalid markers open straight
  in the edit form. `MyMarkers` unmounts when another panel opens, so its scroll position is lost.
- **Sheet writes.** `SheetStore.updateCells` already writes many cells, in any rows, in one
  `values.batchUpdate` call.

## Goals / Non-Goals

**Goals:**
- An owner or editor who visits at least once a year never has to confirm by hand.
- A marker that has aged past 12 months is never confirmed without a deliberate click.
- One definition of "needs confirming", shared by the service and the site.

**Non-Goals:**
- Changing reminders, fading, or the emailed link.
- Going back from the edit form to My markers. The form's Cancel already closes it.

## Decisions

### A separate POST when a session starts, not a side effect of `GET /me`
New endpoint: `POST /api/me/confirm-recent`, signed in, run in the write queue. It reads the tabs
once and picks the person's eligible markers:
- `active`;
- the person is owner or editor (`roleOn` with `admin: false`, as `me()` already does);
- `confirmed_at` less than 12 months ago and more than 24 hours ago.

For those markers it does one `updateCells` call setting `confirmed_at` and `updated_at` to one
timestamp, then checks each row as `writeMarker` does. It logs a `confirm-on-sign-in` row per
marker, and publishes once if anything changed. It returns `{ confirmed: [ids], published }`.

`useSession` calls it once per page load with a session, right after the first `GET /me`
succeeds. If anything was confirmed, it reloads `/me` so My markers shows the new dates. Errors
are swallowed and logged to the console. `refresh()` doesn't call it.

Why not inside `GET /me`: that GET runs after every edit and on every page load, and a GET that
writes is surprising and can't be retried safely. A dedicated POST is explicit, testable, and
runs once.

The 24-hour floor means reloading the page, or opening several tabs, writes at most once a day
per marker. That keeps the `changes` log and published snapshots from churning.

### "Needs confirming" is one shared function
`addMonths` moves from `service/src/reminders.ts` to `shared`, and reminders import it from there
unchanged. A new shared function, `needsConfirming(confirmedAt, now)`, is true when `confirmedAt`
is empty or `addMonths(confirmedAt, 12) <= now`. That is exactly when the first reminder becomes
due. The service uses it for the session confirmation, and the site uses it for "Still current"
and the "Update" link, so the button appears on the same day the 12-month reminder does.

### "Still current" and "Update" use the existing confirm endpoint
- `MarkerActions` gets the marker's `confirmed_at` and shows "Still current" only when the marker
  isn't closed and `needsConfirming` is true.
- `MyMarkers` shows a small link-styled "Update" button beside each active entry for which
  `needsConfirming` is true. Its accessible name is "Mark <name> still current". It posts to
  `/api/markers/:id/confirm`, calls `onResult`, and refreshes `/me`. While it waits, it shows
  "Updating…"; on failure, the panel's error line explains.

The confirm endpoint keeps accepting any active marker the person may edit. Only the website
hides the button, so an emailed link or an old tab still works.

### Back to My markers
- `App` keeps `fromMine` (the id of the marker opened from My markers). `openMine` sets it.
  Selecting a marker any other way, closing the details, or opening another panel clears it.
- `MarkerDetails` takes an optional `onBack`. When it's given, a "<" button with the accessible
  name "Back to My markers" sits before the marker's name, and a keydown listener on `document`
  handles Backspace and Delete. The listener ignores events from `input`, `textarea`, `select`
  and editable elements, ignores events with Ctrl, Alt or Meta held, and calls `preventDefault`
  so the browser doesn't go back a page.
- Going back reopens My markers with `focusId` set to that marker. `MyMarkers` focuses that
  entry's button and scrolls it into view. Restoring focus to the entry the person left is what
  "where they left it" means here, and it needs no saved scroll position.

## Risks / Trade-offs

- [Confirming on every visit makes freshness depend on someone visiting, not on the site being
  live] → Accepted: within 12 months the owner is around and responsible. Past 12 months it
  takes a deliberate click, so ended programmes still age.
- [An editor who no longer works on a site keeps it fresh by signing in for another one] →
  Owners can remove editors. Past 12 months nothing is automatic.
- [More writes to the sheet] → At most one batch per person per day, in the existing queue.
- [Backspace is easy to press by accident] → It only works when a marker was opened from My
  markers and the person isn't typing, and it only reopens a list. Nothing is lost.

## Migration Plan

None needed. The change ships with the next release; no sheet or settings changes.

## Open Questions

None.
