# Proposal

## Why

The nightly publish deletes every logo in the bucket's `logos/` folder that is more than a day
old and that no row of the `markers` tab uses. There is no limit on how many it deletes. If
someone clears or mangles the `logo_url` column, the marker count doesn't change, so the publish
safety check passes. That night's sweep then deletes every logo. Version history in the sheet
brings the cells back, but not the files.

There is a second gap. If the `logo_url` header is renamed or deleted, the sweep finds no logos in
use, and deletes them all.

The files aren't lost straight away. Both buckets have Google's default soft delete, which keeps
deleted objects for 7 days. But `setup.sh` doesn't set this, nothing documents it, and 7 days is
short for volunteers.

This extends the sweep added in `limit-untrusted-input` (3.3), in the spirit of the publish safety
check.

## What Changes

- **A ceiling on the sweep.** The sweep deletes nothing if it would delete more than 20 logos, or
  more than half of the logos in the folder (when that is more than 5). Instead it records the reason in `problems`, so
  admins see it in the sheet, and logs it. It tries again each night, and runs once the sheet is
  fixed. Normal nights, with a few abandoned uploads, are unaffected.
- **A missing column refuses the publish.** Today, a missing header on any tab the publish reads
  makes the publish fail with a bare HTTP 500, and nothing in `problems`. Found while testing on
  staging. Instead, the publish is refused, as the safety check refuses one, and `problems` names
  the tab and the columns. So a missing `logo_url` header stops the publish before the sweep. The
  sweep also checks for the column itself, in case it is ever called another way.
- **Deleted logos can be restored for 30 days.** `setup.sh` sets the bucket's soft delete
  retention to 30 days. The infra README explains how to list and restore deleted logos.

Out of scope:

- Bucket object versioning. Soft delete already keeps deleted and overwritten files.
- A way for admins to force a large sweep. A real backlog of unused logos is rare. An admin can
  delete the files by hand, or let the ceiling pass once the count is lower.
- Restoring logos from the Atlas itself. Restoring is a rare manual job, done with `gcloud`.
- The daily limits (`count-limits-on-arrival`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `marker-editing`: the unused logo sweep has a ceiling, and it stops if the `logo_url` column is
  missing.
- `deployment`: the public bucket keeps deleted files for 30 days.
- `snapshot-publishing`: a missing column header refuses the publish, with the reason in
  `problems`.

## Impact

- `service/src/logos.ts`: the sweep decides what to delete, and returns a reason when it holds
  back.
- `service/src/publish.ts`: the sweep's decision is made before `problems` is written, so its
  reason appears there.
- `shared/src/rows.ts`, `shared/src/validate.ts`, `shared/src/feed.ts`: a missing-columns error
  that names the tab.
- `infra/setup.sh`: soft delete retention on the bucket. Applying it to both live buckets means
  rerunning setup (manual).
- `infra/README.md` and `service/README.md`: the ceiling, and how to restore a logo.
- Tests for the sweep and the publish. No sheet or front-end changes.
