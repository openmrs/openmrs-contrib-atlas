# Proposal

## Why

The service has grown one feature at a time, and the code review found it getting hard to work
in:

- **`service/src/edits.ts` is 1,125 lines**, one `MarkerEditor` class covering marker edits,
  editors and transfers, claims, reminder preferences and the emailed-link view.
- **The same HTML `escape()` is copied into five files** (`help.ts`, `notices.ts`,
  `claims-mail.ts`, `reminders.ts` and `permalinks.ts`), one of them slightly different.
- **The publish-after-write block** (publish, log and carry on if it fails) is written out three
  times, in `api.ts` twice and in `reminder-links.ts`.

Volunteers maintain this code, so it should be easy to find things in. This is the last of the
four changes from the review, done after the others so their diffs stay small.

## What Changes

- **`edits.ts` is split by subject** into a folder, `service/src/edits/`:
  - shared sheet access and errors
  - marker edits
  - editors and transfers
  - claims

  `MarkerEditor` keeps its public methods, so `api.ts`, `reminder-links.ts` and the tests don't
  change how they call it.
- **One `escapeHtml()`** in a new `service/src/html.ts`, used by all five files. It escapes `'`
  too, as the `permalinks.ts` copy does.
- **One `publishAfter()` helper** in the service for the publish-after-write pattern, used at all
  three places.

No behaviour changes: the same requests, responses, sheet writes, emails and logs.

Out of scope:

- Changes to `api.ts` beyond using the helper, or to `shared/`, `web/` and `migration/`.
- Behaviour changes of any kind. Those are in `reliable-writes`, `limit-untrusted-input` and
  `add-security-headers`, which come first.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a refactor, so the change declares `skip_specs`.

## Impact

- `service/src/edits.ts` → `service/src/edits/` (`index.ts` keeps the current exports).
- New `service/src/html.ts`.
- Small edits to `help.ts`, `notices.ts`, `claims-mail.ts`, `reminders.ts`, `permalinks.ts`,
  `api.ts`, `reminder-links.ts` and `app.ts`.
- The service's existing tests are the check, run unchanged apart from import paths.
