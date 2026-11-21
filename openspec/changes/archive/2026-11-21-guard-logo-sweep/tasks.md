# Tasks

## 1. Sweep ceiling

- [x] 1.1 In `service/src/logos.ts`, split the sweep into a plan and a removal. Add the ceiling constants (20 files, half the folder), and hold back when the `logo_url` header is missing.
- [x] 1.2 In `service/src/publish.ts` and `service/src/app.ts`, pass the logo store to every publish, with a `sweep` flag for the nightly one only. Plan the sweep before `writeProblems`. Add a row-0 problem when it holds back, and remove the planned files after the snapshot is written, only when `sweep` is set. A planning failure is logged and skips the sweep.
- [x] 1.3 Tests in `service/src/logo-sweep.test.ts` for the new scenarios: column cleared, column renamed, sheet fixed, the half rule on a small folder, and exactly 20 still swept.
- [x] 1.4 Publish tests: the hold-back reason appears in `problems` and the publish still succeeds; a publish after an edit keeps the note but deletes nothing; the note goes once the sheet is fixed.

## 2. Soft delete

- [x] 2.1 In `infra/setup.sh`, add `--soft-delete-duration=30d` to the bucket update.
- [x] 2.2 In `infra/README.md`, add the retention to the resources table, and add a "Restoring a deleted file" section with the list and restore commands.
- [x] 2.3 (manual) Rerun `infra/setup.sh` for staging and production, and check that each bucket's retention is 2592000 seconds.

## 3. Docs and checks

- [x] 3.1 In `service/README.md`, describe the sweep's ceiling and what the `problems` note means.
- [x] 3.2 Run the typecheck, lint, format check and unit tests, and `openspec validate guard-logo-sweep --strict`.

## 4. Missing columns (found on staging)

- [x] 4.1 In `shared/src/rows.ts`, add `MissingColumnsError` naming the tab and the columns. Pass the tab name from every `toRawRows` caller.
- [x] 4.2 In `service/src/publish.ts`, catch it while reading, validating and building the files. Write the reason to `problems` and return `refused`, with or without force.
- [x] 4.3 Tests: a publish with no `logo_url` header is refused (409), nothing is written or deleted, and `problems` names the tab and column; the same through a forced publish; and the shared error names the tab.
- [x] 4.4 Fix the "Column renamed" test to go through a whole publish, and run all checks again.
