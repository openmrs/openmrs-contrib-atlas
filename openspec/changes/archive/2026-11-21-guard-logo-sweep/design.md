# Design

## Context

`sweepLogos` in `service/src/logos.ts` reads the `markers` tab's values, collects the `logo_url`
values that start with the bucket's public prefix, lists `logos/`, and removes every file not
in use that is more than a day old. `publish()` calls it after the snapshot is written and after
`sheet.writeProblems(problems)`, inside a try/catch, so a failed sweep never holds up a publish.

Production has 39 logos today. A normal night has a few unused files, at most: abandoned uploads,
and old logos replaced by new ones. One person can upload at most 20 logos a day.

Both buckets already report a soft delete retention of 604800 seconds (7 days). That is Google's
default for new buckets, not something `setup.sh` sets.

## Goals / Non-Goals

**Goals:**
- A sheet mistake can't delete the logos.
- Admins find out in the sheet, where they would make the fix.
- A file deleted by mistake can still be restored weeks later.

**Non-Goals:**
- Making the sweep smarter about which files are "really" unused.
- Restoring from the Atlas UI.

## Decisions

**Hold back the whole sweep, don't cap it.** Deleting up to N files a night would still lose
every logo, a few nights later, if the sheet stayed broken. If the count is over the ceiling,
nothing is deleted. A real backlog over the ceiling is rare, and an admin can clear it by hand.

**Ceiling: more than 20, or more than half of the folder when that is more than 5.** 20 matches one
person's daily upload limit, so one day's abandoned uploads from one person never trip it. The
"half" rule covers a small bucket, where 20 could be every logo. It applies only above 5 files, so
in a nearly empty folder (one abandoned upload is the whole folder) the sweep still works. Losing a
handful of files isn't worth stopping for, and soft delete keeps them. Staging has 28 logos. With 39 logos, clearing the column (39 unused) trips both
rules. A sort that moved half the column would trip at least one rule. These are `SWEEP_MAX` and `SWEEP_SMALL`
in `logos.ts`, next to the grace period.

**Missing column means stop.** Today the sweep would read a missing header as no logos in use,
and so delete everything. In practice the publish never gets that far: validation needs every
`markers` header, and throws a plain `Error("missing columns: …")` from `toRawRows`. `publish()`
doesn't catch it, so the request fails with 500 and `problems` is left as it was (found on
staging). The fix is a `MissingColumnsError` that names the tab. Every `toRawRows` caller passes
its tab's name. `publish()` catches the error while reading and building the snapshot and feed,
writes one row-0 problem ("The markers tab is missing columns: logo_url. Restore the header, for
example from version history, then publish again."), and returns `refused`. The Apps Script
already shows "Publish refused: see the problems tab." for 409. Forcing doesn't get past it,
because there is nothing valid to publish. The sweep keeps its own column check, in case it is
ever called another way.

**Decide before `problems` is written, on every publish.** The sweep is split in two:
`planLogoSweep(store, markers, now)` returns `{ remove: string[] }`, or `{ holdBack, unused, total }`.
`publish()` calls it before `writeProblems`. A hold-back adds a row-0 problem, as a refused
publish does (for example, "The logo sweep held back: it would delete 39 of 39 logos. Check the
logo_url column."). `problems` is rewritten on every publish, so every publish plans the sweep.
That keeps the note in place while the sheet is wrong, and clears it once the sheet is fixed.
Planning costs one listing of `logos/`. Only the nightly publish removes the planned files, after
the snapshot is written, inside the existing try/catch. So `publish()` always gets the logo
store, plus a `sweep` flag that only the nightly run sets. A failure while planning (such as
listing the bucket) is logged, and the publish goes ahead with no sweep, as now.

**Soft delete, not versioning.** Soft delete keeps deleted and overwritten objects for a set time,
and needs no lifecycle rules for old versions. `setup.sh` adds `--soft-delete-duration=30d` to
its existing `buckets update`. Overwritten snapshot and card files are kept too. At a few MB a
day, the cost is negligible. To restore, use
`gcloud storage ls --soft-deleted gs://<bucket>/logos/` and
`gcloud storage restore gs://<bucket>/logos/<name>#<generation>`. The README gives both commands.

## Risks / Trade-offs

- **A note in `problems` that people ignore** → logos that really are unused build up. They are
  small public files, so it costs storage, not safety.
- **The ceiling could be too low** after a burst of legitimate unused files, such as an admin
  replacing many logos. Then the admin deletes them by hand, or the constants change.
- **Soft delete depends on the bucket's settings,** which can change outside `setup.sh`. Rerunning
  setup puts them back.
