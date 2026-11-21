# Design

## Context

- **Emails after edits.** `api.ts` calls `sendNotice` (new marker), `sendClaimNotice` and
  `sendClaimDecisions` (through `tellClaimants`) with `void`, after the write and before
  `c.json(...)`. All three already catch and log their own failures. `mandrillMailer` aborts after
  `TIMEOUT_MS` (15 s), and the Keycloak account lookup has its own timeout. The deploy sets
  `--max-instances=1` and leaves Cloud Run's default, which throttles the CPU once no request is
  running.
- **Adding.** `MarkerEditor.add` appends the `markers` row, then calls `writePrivate`. A marker
  whose private row is missing has no owner, so it is offered for claiming.
- **Sign-in confirmation.** `confirmRecent` writes `updated_at` and `confirmed_at` in one batch.
  It then calls `readCell` once per marker to check the row still holds that id, and only then
  appends the `changes` rows. A thrown read leaves the cells written and unlogged.
- **Reminders.** `/reminders` runs `runReminders` inside `queue.run`. For each person, the job
  looks up the account (Keycloak) and sends (Mandrill), flushing `reminders` rows every 10 people.
  Up to 50 sends at up to 15 s each can hold the queue for minutes. Every edit waits behind it, and
  Firebase Hosting drops a proxied request after 60 s.

## Goals / Non-Goals

**Goals:** close each gap with the smallest change, without changing how the Atlas looks or works.

**Non-Goals:** queues or retries for email, Cloud Run CPU settings, and restructuring `edits.ts`
(`tidy-service`).

## Decisions

**1. Await the emails, not allocate CPU.**
`await` each send before responding. The person waits for Mandrill, usually well under a second
and at most the timeout. `--no-cpu-throttling` would also work, but it bills for CPU around the
clock to save that second.
_Alternative:_ `c.executionCtx.waitUntil`. Rejected: Cloud Run on Node has no such hook, and
throttling would still apply.

**2. Private row first.**
`add` calls `writePrivate` before `appendRow("markers", ...)`. A private row with no marker isn't
read by anything public: the snapshot, `me` and claims all start from `markers`. The next add can't
reuse the id, because ids are UUIDs.
_Alternative:_ delete the marker row when the private write fails. Rejected: the compensating
write can fail too.

**3. One read of the id column, and log before checking.**
A new store method, `readColumn(tab, column)`, returns one column in one `values.get`. The fake
store gets it too. `confirmRecent` now:
1. writes the cells;
2. appends the `changes` rows;
3. reads the `id` column once and compares the rows;
4. on a mismatch or a failed read, logs `row-moved` or `confirm-check-failed` and returns normally.

The same `readCell` check in the single-marker write path (`edits.ts`, about line 372) is left
alone: it reads one cell.

**4. Reminders: lock the run, queue only the sheet work.**
`runReminders` takes a `queue` and a single-run guard.

- A module-level `running` flag in `app.ts` makes a second call to `/reminders` get 409 while a
  run is in progress. The service is a single instance, so memory is enough.
- The job reads the sheet and selects who is due inside `queue.run`, then releases the queue.
- Each flush of up to 10 `reminders` rows goes through `queue.run` on its own.
- Account lookups and sends happen outside the queue.

A marker confirmed by its owner after the selection still gets that day's reminder. Its "Still
current" link stops working once the marker is confirmed by any means (reminder-emails), so the
worst case is a reminder that's no longer needed. That was already possible a moment later.

## Risks / Trade-offs

- **[A person waits up to 15 s when Mandrill is slow]** → This is rare, and the form already shows
  "Saving…". It is bounded and well under Firebase's 60 s.
- **[A crash mid-run leaves `running` set]** → The flag lives in memory, so a restart clears it.
  `finally` clears it on any error.
- **[Reminders recorded later in the run]** → Rows are still flushed every 10 people. A crash
  loses at most the rows of people not yet flushed, and those people are retried the next day.
  That's no worse than today.

## Migration Plan

Deploy to staging, check an add (notice arrives) and a claim decision, then release with the rest
of the next release. Rollback is the previous release. No data changes.
