# Proposal

## Why

85 markers have no owner, so only admins can update them. Their reminders never go out, so they
slowly go stale. The people who run those sites can't take them over today without writing to
an admin and waiting for a manual sheet edit. Before the Talk announcement invites implementers
back to the Atlas, they need a way to claim their own site in the Atlas, with an admin approving
it. This is "Claim an orphaned marker" (C9, Should) from Phase 3.

## What Changes

- **"Claim this site"** on the details of every public marker (active or closed) that has no
  owner, for signed-in people, including its editors. The person writes a short
  message on how they're connected to the site (required, up to 1,000 characters) and sends it.
- **A hint for visitors who aren't signed in.** The details of every marker end with "Is this
  your site? Sign in to update or claim it." It shows on every marker, so it doesn't reveal which
  markers have no owner.
- **Claims are stored in a new private `claims` tab** in the sheet, one row per claim, with its
  status (`pending`, `approved`, `declined` or `withdrawn`), who decided and when, and the reason.
- **Admins are told.** Each new claim sends one email to the notice address, with the marker, the
  claimant's OpenMRS ID, their message and a link to the marker.
- **Admins decide in the Atlas.** An admin sees the pending claims on the marker's details, each
  with the claimant and message, and approves or declines with one click. A decline can carry an
  optional reason. My markers lists every pending claim for admins, so they can find them.
- **Approval makes the claimant the owner.** Existing editors stay, and `confirmed_at` restarts.
  Any other pending claims on that marker are declined with the reason "Another claim for this
  site was approved." If an admin sets an owner in the Atlas form, pending claims are declined
  the same way, with "This site now has an owner." If the owner was set in the sheet, approving
  is refused and the admin can still decline.
- **The claimant is told.** One email with the decision and, for a decline, the reason. The
  service looks up the claimant's email in Keycloak during the admin's signed-in request, so the
  email never touches the sheet or the logs.
- **The claimant can follow it.** My markers shows their pending claims, which they can withdraw.
  The marker's details say "Your claim is waiting for an admin" instead of offering a second claim.
- **Limits.** One pending claim per person per marker, and at most 10 pending claims per person.
- **A `claim` analytics event** when a claim is sent.

Out of scope:
- Claiming a marker that already has an owner. People whose owner has gone quiet still write to
  the admins, who can set the owner directly as they can today.
- Claiming as an editor. An approved claim always makes the claimant the owner; they can add
  editors afterwards.
- Proof of connection beyond the message, such as checking email domains. Admins judge each claim.
- Claims expiring. A claim stays pending until an admin decides or the claimant withdraws it.
- Telling anyone other than the claimant and the notice address, such as existing editors.
- Publishing which markers have no owner. Only signed-in people learn it, from the Claim button.
- Hidden and deleted markers: they can't be claimed.

## Capabilities

### New Capabilities
- `marker-claims`: claiming a marker with no owner, the claim's life (pending, approved, declined,
  withdrawn), the admin review in the Atlas, the notice to admins, the decision email to the
  claimant, and the limits.

### Modified Capabilities
- `marker-data`: "Sheet structure" adds the `claims` tab and its columns. "Reminder tabs stay
  private" also covers `claims`, which holds no email addresses.
- `marker-ownership`: "My markers" also lists a person's pending claims, and every pending claim
  for admins.
- `map-view`: "Usage analytics" adds the `claim` event.

## Impact

- **Shared:** `claims` in `TABS` and `COLUMNS`.
- **Service:**
  - `edits.ts`: `claim`, `withdrawClaim`, `approveClaim` and `declineClaim`, the claim rules,
    and closing stale claims on markers that have an owner;
  - `me` returns the person's claims, the ids of the markers they could claim, and, for admins,
    every pending claim;
  - routes under `/api/markers/:id/claims`;
  - a claim notice next to the entry notice, and a decision email to the claimant;
  - `sheets.ts` reads the new tab; `setup:sheet` creates it.
- **Site:** a Claim form in the marker's details, the sign-in hint, the admin's review list on
  the details, claims in My markers, and the `claim` event.
- **Sheet:** `npm run setup:sheet` must be run on staging and production to add the tab
  (manual). Production gets it as part of the final migration.
- **Email:** two new kinds, `claim-notice` and `claim-decision`. Staging still sends only to its
  allowlist.
- **Production timing:** none beyond the tab. The feature works on staging at once.
