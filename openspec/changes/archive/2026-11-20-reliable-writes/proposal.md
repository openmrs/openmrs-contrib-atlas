# Proposal

## Why

A code review found four places where a write or an email can go missing, quietly. The most
serious: the new-marker notice, the claim notice and claim decisions are sent after the response
is returned and are never awaited. Cloud Run throttles a service's CPU once its response has
gone, and the Atlas service sits idle between a few edits a week, so those emails can stall or
never be sent. The new-marker notice is the admins' check on unmoderated adds (A6), so losing it
matters. The other three are smaller but leave the sheet half-written or hold up edits. They
should be fixed before more implementers start using the Atlas after the announcement.

## What Changes

- **Emails are sent within the request.** The new-marker notice, the claim notice and claim
  decisions are awaited before the response. The mailer's 15-second timeout and Keycloak's
  timeout bound the wait. A failure is still logged and never fails the edit.
- **A marker is never added without its owner.** Adding writes the private row (owner, editors,
  contact) before the public row. If the second write fails, what is left is an unpublished
  private row, rather than a published marker with no owner that anyone could claim.
- **Confirming on sign-in reads the sheet once and always logs what it wrote.** The check that
  rows didn't move reads the `id` column in one request, not one request per marker. The
  confirmations are logged right after they are written, and a failed check is only logged as an
  error and doesn't undo or hide them.
- **The daily reminder job no longer holds up edits.** It holds the write queue only while it
  reads the sheet and while it records results, not during its Keycloak lookups and emails. A
  second run started while one is in progress is refused, so no reminder is sent twice.

Out of scope:

- Other review findings: logo addresses, rate limits and the token type (`limit-untrusted-input`),
  security headers (`add-security-headers`), and the refactor of `edits.ts` (`tidy-service`).
- Changing Cloud Run's CPU throttling. Awaiting the work keeps the service cheap to run.
- Retrying a failed notice or claim email. A failure is logged, as now.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `email-delivery`: Atlas email that follows an edit is sent before the edit's response.
- `marker-editing`: adding never leaves a marker without its private row, and sign-in
  confirmations are always logged once written.
- `reminder-emails`: edits aren't held up by the daily job, and overlapping runs can't send twice.

## Impact

- `service/src/api.ts`: await `sendNotice`, `sendClaimNotice` and `sendClaimDecisions`.
- `service/src/edits.ts`: the write order in `add`, and the read and log order in
  `confirmRecent`.
- `service/src/sheets.ts`: read one column of a tab in a single request.
- `service/src/reminders.ts` and `service/src/app.ts`: queue use and a guard against overlapping
  runs.
- Tests in `service/src/` for each.
- No sheet, configuration or deploy changes.
