# Proposal

## Why

When a person types someone's exact OpenMRS ID into an OpenMRS ID field (owner, editor or new
owner), the suggestions leave that account out. The browser filters out any suggestion whose
username equals what's typed, on the idea that suggesting it adds nothing. Typing `burke`
therefore suggests only `mercedesburke` (Mercedes Burke), and typing `paul` hides `paul`. That
reads as "did you mean someone else?", and people resort to searching by last name to find a
username they already know.

Pre-filled fields make it worse. The admin's Owner field on an existing marker opens its
suggestions as soon as the form loads, before anyone has typed. Enter picks the first suggestion,
so one keypress could replace the owner with the wrong person. This affects production now, and
the fix belongs in 3.3, before more owners and editors are entered after the announcement.

## What Changes

- **The exact match is suggested, and listed first.** Typing `burke` suggests `burke` (Burke
  Mamlin) first, then `mercedesburke` and any others, ignoring case.
- **Suggestions appear only after the person types in the field.** A field that opens already
  filled (the Owner of an existing marker) shows no suggestions until it is edited.

Out of scope:

- The service's search. It already returns the exact account; only the browser dropped it.
- Search ranking beyond putting the exact username first.
- Checking IDs on save. The service already does that.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account-lookup`: how suggestions are offered in OpenMRS ID fields.

## Impact

- `web/src/components/AccountPicker.tsx`: stop filtering out the exact match, sort it first, and
  search only once the field has been edited.
- New component tests for the picker. No service, sheet or deploy changes.
