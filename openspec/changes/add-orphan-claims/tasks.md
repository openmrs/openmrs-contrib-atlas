# Tasks

## 1. Sheet

- [ ] 1.1 Add `claims` to `TABS` and `COLUMNS` (`id`, `marker_id`, `username`, `message`, `created_at`, `status`, `decided_by`, `decided_at`, `reason`), with `id`, `marker_id`, `username` and the dates as text columns
- [ ] 1.2 Read `claims` with the edit tabs in `sheets.ts` (`EDIT_TABS`, `EditValues`), parse it in `Tabs`, and add it to the test fakes. Check that `setup:sheet` creates it and that the snapshot and feed never read it
- [ ] 1.3 (manual) Run `npm run setup:sheet -- <staging sheet id>` to add the `claims` tab before pushing the code

## 2. Service: claim rules

- [ ] 2.1 `MarkerEditor.claim(person, id, message)`: the marker is active or closed and has no owner; the message is 1–1,000 characters after trimming; no pending claim from this person on it; fewer than 10 pending claims from this person. Append a pending row and log `claim`
- [ ] 2.2 `withdrawClaim(person, id, claimId)`: only the claimant, only while pending. Mark it `withdrawn` and log `claim-withdraw`
- [ ] 2.3 `approveClaim(person, id, claimId)`: admins only. In one queued write, refuse with 409 if the owner isn't blank, set the owner, keep the other editors, restart the clock, mark it approved, decline the other pending claims with "Another claim for this site was approved.", and log each. Return a `MarkerResult`
- [ ] 2.4 `declineClaim(person, id, claimId, reason?)`: admins only, reason up to 500 characters. Mark it declined and log `claim-decline`
- [ ] 2.5 In `change`, when an admin changes the owner, decline that marker's pending claims with "This site now has an owner." and return them so their claimants can be emailed
- [ ] 2.6 `me`: add `claimable`, `claims` and, for admins, `review` (with messages)
- [ ] 2.7 Routes: `POST /markers/:id/claims`, `DELETE /markers/:id/claims/:claimId`, `POST /markers/:id/claims/:claimId/approve` and `/decline`, with the status codes and messages from the design
- [ ] 2.8 Tests, one per scenario in `specs/marker-claims`:
  - claim, owner present, hidden, empty or long message, editor claims, duplicate, 10 pending
  - withdraw by the claimant and by someone else
  - approve: editors kept, clock restarted, competing claims declined, owner set in the sheet meanwhile, non-admin gets 403, a second decision gets 410
  - decline with and without a reason
  - admin sets the owner in the form
  - `me` fields for a person, an editor and an admin; `review` absent for non-admins
  - nothing from `claims` in the snapshot

## 3. Service: email

- [ ] 3.1 `claims-mail.ts`: render and send the claim notice to `NOTICE_EMAIL` (marker, OpenMRS ID, escaped message, links to the marker and the sheet). Send it after a claim, not awaited; log failures
- [ ] 3.2 Render and send the decision email to the claimant after approve, decline and an owner set in the form. Look up the address with `Accounts.lookup` in the admin's request; skip when there is no account or email. Log failures by kind and marker id only
- [ ] 3.3 Add `claim-notice` and `claim-decision` to `EmailKind`
- [ ] 3.4 Tests: notice content and escaping; no notice address; Mandrill down; approval and decline emails, with the reason; no email on file; Keycloak down; no address in any log line

## 4. Site

- [ ] 4.1 Types and API calls in `web/src/lib/api.ts` for the new `me` fields and the four routes; add `"claim"` to `AtlasEvent`
- [ ] 4.2 `ClaimPanel` in the marker's details:
  - claim form with a labelled textarea, a character count and Send;
  - "Your claim is waiting for an admin" with Withdraw;
  - for admins, each pending claim (OpenMRS ID, date, message as plain text) with Approve, and Decline with an optional reason
- [ ] 4.3 The sign-in hint "Is this your site? Sign in to update or claim it." on every marker's details for visitors who aren't signed in, returning to the same marker after sign-in
- [ ] 4.4 My markers: "Your claims" with Withdraw and, for admins, "Claims to review" at the top; each entry opens the marker
- [ ] 4.5 Wire into `App`: reload `/api/me` after each claim action, send approvals through `applyResult`, show errors in the panel, and `track("claim", {marker_id})`
- [ ] 4.6 Component tests for `ClaimPanel` and the My markers sections: keyboard use, validation messages, admin-only controls, and no other person's claim shown

## 5. End-to-end and docs

- [ ] 5.1 Playwright, with the stub service: a visitor sees the hint; a signed-in person claims an orphan and sees it waiting; they withdraw it; an admin approves from details and the marker shows as owned; an admin declines with a reason; a phone at 375 px
- [ ] 5.2 Update `service/README.md` (the tab, the routes and the two emails), `README.md` and `openspec/backlog.md`
- [ ] 5.3 Run format, typecheck, lint, unit tests, Playwright, build and `openspec validate --strict`

## 6. Staging

- [ ] 6.1 Push and watch CI deploy to staging
- [ ] 6.2 (manual) On staging, with a test account and an admin account on the allowlist: claim an orphan, check the notice email, decline it with a reason and check the email, claim again, approve, and check the test account now owns the marker and gets the approval email

## Workflow follow-up

- Archive `add-orphan-claims` after 6.2.
- (manual) Run `setup:sheet` on the production sheet before the release tag that carries this.
