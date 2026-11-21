# Tasks

## 1. Timings

- [x] 1.1 Add `service/src/timing.ts` with `withTiming`, `timed` and `timedStore`, using `AsyncLocalStorage`. Unit tests: nested scopes, parallel calls summed with counts, a call outside any scope isn't recorded, and arguments and results never appear in the output.
- [x] 1.2 In `service/src/app.ts`, wrap the sheet, edit, snapshot, card and logo stores and `Accounts` with `timedStore`. Add middleware on `/api` that logs one `timing` line per request with the route pattern (`routePath`), status, total and steps. Time `publish()` in its own scope and log a `publish-timing` line. Time `renderPng` as `draw.png`. API test: removing editor `jdoe` logs `DELETE /markers/:id/editors/:username` without `jdoe`, and a 403 request still logs its line.

## 2. Publish

- [x] 2.1 In `service/src/storage.ts`, upload the snapshot files with `Promise.all`. Test with a fake store that records overlapping writes.
- [x] 2.2 In `service/src/publish.ts`, start the sheet read, current count, logo listing and manifest read together. Have `planLogoSweep` take the listed files. Write the snapshot files and `problems` together. Then run the cards and the sweep as before. Existing publish, logo-sweep and card tests pass. A new test: a refused publish still draws no cards, and a failed manifest read still publishes.

## 3. World card

- [x] 3.1 In `service/src/cards/refresh.ts`, add `world` (a SHA-256 of the world SVG) to the manifest. Redraw and upload the world image only when the hash differs or on the nightly run. Write the manifest only when it changed. Add `world` to `CardResult`. Tests: an unchanged snapshot writes no world image and no manifest, a new marker redraws, a manifest without `world` redraws, and the nightly run always redraws.

## 4. Edit writes

- [x] 4.1 In `service/src/edits/editor-base.ts`, add `save()`. It writes marker and `private` cells in one `updateCells`, appending the `private` row first if it's missing. It then runs the row check and the change-log append together. `restartClock` builds on it.
- [x] 4.2 Move `People.saveEditors`, `People.accept`, `Claims.approve`, `Markers.update` and `Markers.confirm` to `save()`. Tests with a counting fake store: an editor change makes one read and one `updateCells` call, then runs the check and the log together. The sheet ends up the same as before for each of these actions. The existing edit tests pass.

## 5. Listener warning

- [ ] 5.1 Reproduce the `MaxListenersExceededWarning` locally against fake-gcs-server (`node --trace-warnings`) with parallel uploads, and record the source in the design's Open Questions.
- [ ] 5.2 Fix it at the source, for example with one shared `Storage` client or capped concurrency. Verify that a local publish with the parallel uploads logs no warning.

## 6. Docs and checks

- [x] 6.1 In `service/README.md`, describe the `timing` and `publish-timing` log lines and their step names. Note that parallel steps add up to more than the total, and that no private data is logged. Add a Logs Explorer query to find slow requests.
- [x] 6.2 Run the typecheck, lint, format check, unit tests, the e2e suite (`cd web && npx playwright test`) and `openspec validate speed-up-edits --strict`.
- [ ] 6.3 (manual) After deploying to staging, add and remove an editor and save a marker. Compare the times in the `timing` lines with today's 2.4 to 5.4 seconds.
