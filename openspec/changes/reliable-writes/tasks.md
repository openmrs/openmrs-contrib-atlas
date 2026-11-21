# Tasks

## 1. Emails within the request

- [x] 1.1 In `api.ts`, `await` `sendNotice`, `sendClaimNotice` and `sendClaimDecisions` (make `tellClaimants` async and await it at its three call sites)
- [x] 1.2 Tests: the add, claim and decline responses arrive only after the fake mailer has been called. A mailer that rejects or times out still gives a successful response and a logged failure

## 2. Adding writes the owner first

- [x] 2.1 In `MarkerEditor.add`, call `writePrivate` before appending the `markers` row
- [x] 2.2 Test: with the `markers` append failing, the add fails, no marker is published, and the marker isn't claimable

## 3. Sign-in confirmation

- [x] 3.1 Add `readColumn(tab, column)` to the store interface, the Sheets store and the test fake
- [x] 3.2 In `confirmRecent`, append the `changes` rows right after the cell write, then check the ids with one `readColumn` call. Log `row-moved` or `confirm-check-failed` without throwing
- [x] 3.3 Tests: 40 eligible markers use one column read; a failing check still leaves every confirmation logged and returns them

## 4. Reminders

- [x] 4.1 In `app.ts`, a single-run guard for `/reminders`: 409 while a run is in progress, cleared in `finally`
- [x] 4.2 In `runReminders`, take the queue: read and select inside one `queue.run`, flush each batch of rows through `queue.run`, and look up accounts and send outside it
- [x] 4.3 Tests: an edit made while a send is pending completes before the send does; a second run during the first gets 409 and sends nothing; the existing reminder tests still pass

## 5. Check and ship

- [x] 5.1 Run `npm run format:check`, `typecheck`, `lint`, `test`, the e2e tests and `openspec validate --strict`
- [ ] 5.2 (manual) On staging, add a marker and decline a claim, and check that both emails arrive
