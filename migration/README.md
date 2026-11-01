# Atlas 2.0 → 3.0 migration

Copies every Atlas 2.0 marker, owner, delegate and logo from the 2.0 MySQL database into an
Atlas 3.0 sheet. Marker ids are kept, so 2.0 links (`/?marker=<id>`) keep working.

- **The 2.0 database is only read.** The script uses a read-only transaction.
- **Each run replaces the sheet's data tabs**: `markers`, `private`, `types`, `distributions`,
  `versions`. It's safe to re-run, and anything typed only into the target sheet is overwritten.
  It also appends one `import` row to `changes`.
- **Logos** are resized to WebP within 300 × 300 and uploaded to `logos/<id>.webp` in the public
  bucket.

The full rules are in `openspec/specs/legacy-migration/spec.md`
(`openspec/specs/legacy-migration/` once archived).

## Before you start

- The target sheet must already have its tabs. Run `npm run setup:sheet -- <id>` once (see the
  root README).
- Google credentials: Application Default Credentials with the Sheets scope (root README, "Test
  sheet"), plus write access to the bucket for logo uploads.
- `MYSQL_URL` points at the 2.0 database. The default,
  `mysql://atlas:atlas@localhost:3306/atlasdb`, is the local Docker database.

## Always dry-run first

A dry run reads 2.0 and prints the report without writing anything:

```sh
npm run migrate -- --dry-run
```

```
Atlas 2.0 → 3.0 migration (dry run: nothing written)
  markers:            5
  owners:             2
  orphans (no owner): 0
  logos:              0
  unreadable logos:   0
  unmapped versions:  0
  failing validation: 0
```

| Report line          | What it means                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orphans`            | Markers with no owner; admins can assign one later.                                                                                               |
| `unreadable logos`   | 2.0 images that could not be converted, listed with the reason. The marker migrates with a blank `logo_url`, and admins can add a logo later.     |
| `unmapped versions`  | 2.0 version text that matched no entry in `versions` and became `Other`. The raw values are listed so admins can decide whether to add a version. |
| `failing validation` | Rows that will be listed in `problems` and left off the public map until fixed. Each is listed with its reasons.                                  |

## Run it

```sh
npm run migrate -- --sheet <spreadsheet-id> --bucket <bucket>
```

Against the local fake Cloud Storage (`docker compose up -d`):

```sh
npm run migrate -- --sheet <test-sheet-id> --bucket atlas-local --storage-endpoint http://localhost:4443
```

## From production

Read production through an SSH tunnel, using a MySQL user that only has `SELECT` on `atlasdb`:

```sh
ssh -N -L 13306:localhost:3306 <atlas-2.0-host>      # in another terminal
MYSQL_URL=mysql://<readonly-user>:<password>@127.0.0.1:13306/atlasdb npm run migrate -- --dry-run
```

If a tunnel isn't possible, restore a `mysqldump` of `atlasdb` into the local Docker MySQL and run
against that.

## At cutover

Run the migration once more, from the final 2.0 data into the production sheet, right before
atlas.openmrs.org switches to 3.0. Edits made in 2.0 during staging are then carried over. Edits
made only in the staging sheet are not.
