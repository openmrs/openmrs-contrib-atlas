# Design

## Context

See proposal.md for why. What exists today:

- **Roles.** `private.owner` and `private.editors` decide who may change a marker
  (`shared/src/permissions.ts`). A blank owner leaves a marker to admins and editors.
  Admins can already set `owner` in the edit form's Admin section (`MarkerEditor.change`), and
  doing so cancels a pending transfer offer (`clearOffers`).
- **Offers.** Transfer offers live in the `pending` tab. `MarkerEditor.me` returns them, and My
  markers shows them with Accept and Decline. Claims follow the same shape, in the other
  direction, with an admin in place of the recipient.
- **What the site knows.** The site learns a signed-in person's role on each marker from
  `GET /api/me` (`me.markers`). It knows nothing about markers it has no role on, and the public
  snapshot says nothing about owners.
- **Sheet access.** `sheets.ts` reads the edit tabs in one `batchGet` (`EDIT_TABS`). A tab
  missing from the sheet fails the whole read. `npm run setup:sheet` adds missing tabs.
- **Email.**
  - `notices.ts` sends the entry notice to `NOTICE_EMAIL` without blocking the request.
  - `Accounts.lookup(username)` returns an account's email. It may only be called from a
    signed-in request or the reminder job (specs/account-lookup).
  - The mailer withholds anything outside the allowlist on staging.
- **Change log.** Every write goes through the single write queue and logs to `changes` with an
  action name.

## Goals / Non-Goals

**Goals:**
- A claim costs the claimant one form and the admin one click.
- No email address is written to the sheet, a log or a response other than the person's own.
- Nothing about claims, or about which markers have no owner, reaches the public snapshot.

**Non-Goals:**
- A separate admin page. Admins already use My markers and the details panel.
- Rate limiting beyond the 10 pending claims a person may have.

## Decisions

### The `claims` tab

Columns: `id`, `marker_id`, `username`, `message`, `created_at`, `status`, `decided_by`,
`decided_at`, `reason`.
- `id` is a UUID, so a route can name one claim.
- Rows are never deleted. A decision updates `status`, `decided_by`, `decided_at` and `reason`
  in place, so the tab is the record of every claim.
- `id`, `marker_id`, `username` and the dates are text columns, and the message and reason are
  written RAW, as every form value is, so `=…` never becomes a formula.

The tab joins `EDIT_TABS`, `EditValues` and `Tabs` (as `claims: Claim[]`). Since a missing tab
breaks every edit, `setup:sheet` must run on staging before the push that deploys this, and on
production before the release that carries it. That is a manual task, as it was for
`reminders`.

Alternative: one more `pending` row type. Rejected: offers expire and are cleared when done,
and claims are kept with a decision, so they need different columns.

### What `/api/me` adds

```ts
claimable: string[];          // marker ids this person may claim now
claims: { id; marker_id; name; created_at }[];               // their own pending claims
review?: { id; marker_id; name; username; message; created_at }[]; // admins only: all pending
```

- `claimable`: active or closed markers whose owner is blank, where the person has no pending
  claim. Editors of such a marker are included.
- About 85 ids, roughly 3 KB, sent only to signed-in people.

The details panel then decides what to show without another request:
- an id in `claimable`: "Claim this site";
- an id in `claims`: "Your claim is waiting for an admin" with Withdraw;
- an admin with entries in `review` for this id: those claims with Approve and Decline.

Alternative: a `GET /api/markers/:id/claim` request each time details open. Rejected: a request
and a loading state on every marker opened, to hide something only signed-in people see anyway.

The sign-in hint shows to anyone not signed in, on every marker. It calls the existing `signIn`
with the current address, so the person comes back to the same marker.

### Routes and rules

All are under the signed-in `/api` middleware and run through the write queue.

| Route | Who | Does |
|---|---|---|
| `POST /markers/:id/claims` `{message}` | signed in | Adds a pending claim and sends the notice |
| `DELETE /markers/:id/claims/:claimId` | the claimant | Marks it `withdrawn` |
| `POST /markers/:id/claims/:claimId/approve` | admin | Sets the owner, declines the rest, emails |
| `POST /markers/:id/claims/:claimId/decline` `{reason?}` | admin | Marks it `declined`, emails |

Refusals:
- marker missing, hidden or deleted: 404;
- marker has an owner: 409 "This site already has an owner.";
- message empty after trimming, or over 1,000 characters: 422;
- a pending claim on this marker already: 409;
- 10 pending claims already: 429 "You have 10 claims waiting. Please wait for an admin to answer
  them.";
- a claim that isn't pending: 410 "That claim is no longer open.";
- decline reason over 500 characters: 422.

**Approve** in one queued write:
1. Check that the claim is pending and the marker's owner is still blank. If not, 409.
2. Write `owner` = claimant and `editors` = existing editors without the claimant.
3. Restart the clock (`updated_at` and `confirmed_at`).
4. Mark this claim `approved`. Mark every other pending claim on the marker `declined`, with the
   reason "Another claim for this site was approved."
5. Log `claim-approve` with the owner change, and `claim-decline` for each other claim.

It returns a `MarkerResult` like any edit, so the site publishes and refreshes as usual.

**Admin sets the owner in the form.** In `change`, where `clearOffers` already runs when the
owner changes, pending claims on that marker are also declined with "This site now has an
owner." Their claimants are emailed after the write, as for a decline.

### Emails

Two new kinds, `claim-notice` and `claim-decision`, in a new `claims-mail.ts` next to
`notices.ts`, with the same layout and no-reply footer.
- **Notice:** to `NOTICE_EMAIL`. Subject "Claim for <name> on the OpenMRS Atlas". It names the
  claimant's OpenMRS ID, quotes the message as escaped text, and links to the marker (where the
  admin decides) and the sheet.
- **Decision:** to the claimant. Subject "Your claim for <name> was approved" or "…was
  declined". It gives the reason when there is one and links to the marker.
  - The address comes from `Accounts.lookup(claimant)` inside the admin's request, after the
    write has finished.
  - No account, no email, or Keycloak down: logged by kind and marker id only, never the address.

Both are sent after the write and not awaited by the response, like the entry notice. A failed
send never undoes the claim or the decision.

### Site

- **`MarkerDetails`** gets a `claims` slot after the Share button, filled by a `ClaimPanel` that
  `App` renders from `me`:
  - claim form: a textarea labelled "How are you connected to this site?", a character count,
    and Send;
  - waiting: a status line with Withdraw;
  - admin review: one entry per claim, showing the OpenMRS ID, the date and the message as plain
    text. Approve asks for no confirmation. Decline opens an optional reason field and a
    Decline button.
- **My markers** gets "Your claims" (each opens the marker, with Withdraw) and, for admins,
  "Claims to review" at the top (each opens the marker).
- After any claim action, `App` reloads `/api/me`. An approval goes through `applyResult`, so
  the notice and publish behave as for any edit.
- `track("claim", {marker_id})` when a claim is sent.

## Risks / Trade-offs

- [Spam claims] → Sign-in is required, there are at most 10 pending per person, and an admin
  approves every claim. A decline costs one click.
- [Signed-in people can tell which markers have no owner] → It reveals no person, and the
  feature can't work without it. It never reaches the public snapshot.
- [Missing tab breaks every edit] → `setup:sheet` runs before the deploy (manual task). A
  service test fails if `EDIT_TABS` and `setup:sheet` disagree.
- [An admin approves a claim on a marker whose owner was just set in the sheet] → Approve
  rereads the sheet in the queued write and refuses if the owner isn't blank.
- [Two admins act on the same claim] → The write queue serialises them. The second gets 410.
- [The message holds personal details] → It stays in the private tab, is shown only to admins
  and the claimant, and goes to the notice address, which is the admins.

## Migration Plan

1. (manual) Run `npm run setup:sheet -- <staging sheet id>` to add `claims`, then push.
2. Test on staging with the test accounts and the allowlist.
3. (manual) Run `setup:sheet` on the production sheet before the release tag that carries this.

Rollback: revert the deploy. The `claims` tab can stay. The old code ignores it.

## Open Questions

None.
