# Proposal

## Why

Adding a marker and uploading a logo have daily limits (5 and 20 a person, from
`limit-untrusted-input` in 3.3). `POST /markers` and `POST /logos` check the limit when a request
arrives, but count the use only after the write succeeds. A burst of 50 adds sent at once all pass
the check before any is counted, so the limit doesn't hold. Writes are queued one at a time, but
the check happens before the queue, so queuing doesn't help.

The counts are also kept in a map that is never cleared, so it holds one entry for every person
who has ever added or uploaded since the service started. It is small, but it never shrinks.

This completes the add-a-site protections (C2, C3) from the design spec.

## What Changes

- **A use is counted when the request arrives.** Checking and counting become one step, so parallel
  requests can't all get in. A request past the limit is refused with 429, as now.
- **A failed request gives its use back.** If an add or upload fails for any reason (bad input,
  an image that can't be read, or a sheet or bucket error), it doesn't count against the person.
  This matches today's behaviour.
- **Old days are forgotten.** When the UTC day changes, the counts from earlier days are dropped.

Out of scope:

- Limits that survive a restart, or limits by IP address. Both are still accepted as before.
- New limits on other requests.
- The logo sweep (`guard-logo-sweep`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `marker-editing`: the daily limits hold when requests are sent at the same time.

## Impact

- `service/src/limits.ts`: `DailyLimit` gets a `take` that checks and counts in one step, a
  `giveBack`, and drops old days.
- `service/src/api.ts`: `POST /markers` and `POST /logos` take a use on arrival and give it back
  if the request fails.
- Tests in `service/src/` for limits and both routes. No sheet, config or front-end changes.
