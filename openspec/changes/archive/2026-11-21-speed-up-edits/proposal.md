# Proposal

## Why

Saving anything through the Atlas feels slow. Adding an editor takes 3 to 5 seconds, and
removing one takes 2.5 seconds. Cloud Run's request logs show the time splits into two halves of
about 1.2 to 1.6 seconds each:

- **The edit itself:** five Sheets calls made one after another.
- **The publish that follows,** which the response waits for. It makes about a dozen Sheets and
  bucket calls, nearly all one after another.

Many of those calls don't depend on each other. The five snapshot files are uploaded one at a
time, and the world card is redrawn and uploaded on every publish even when nothing it shows has
changed.

The logs also can't tell us which steps are slow. They only give the whole request's time, so the
numbers above are partly estimates.

Cold starts add about 2 seconds more, but that is a hosting question. It waits until we decide
where the Atlas runs.

## What Changes

- **Independent steps run at the same time.**
  - In a publish:
    - the sheet read, the published marker count and the card manifest are fetched together;
    - the five snapshot files are uploaded together, with the `problems` tab write alongside them.
  - In an edit: the marker's cells and its `private` cells are written in one Sheets call, then
    the row check and the change-log entry run together.
- **The world card is redrawn only when it would look different.** The card manifest remembers
  what the last world card showed. The manifest itself is rewritten only when something in it
  changes. For most edits, including every editor change, the cards step is then a single read.
- **Each edit and publish logs its timings.** One log line per request gives:
  - the total time;
  - how long each kind of Sheets, bucket and account call took, and how many there were.

  The line names the route pattern (for example `POST /markers/:id/editors`), never the
  path, so a username in the path stays out of the logs. Emails are never logged.
- **The `MaxListenersExceededWarning` lines in the logs are fixed at their source,** rather than
  hidden.

What stays the same: every edit still publishes before it answers, and writes still run one at a
time. A refused publish still writes nothing public, and a card failure still never holds up a
publish.

Out of scope:

- **Hosting changes:** keeping an instance warm, scheduled pings, moving off Google Cloud.
- **Front-end changes:** showing progress or making saves feel faster are a separate change, once
  the timings show what's left.
- **Answering before the publish finishes.** On Cloud Run that needs CPU that is always on.
- **Reusing the edit's sheet read for the publish that follows.** It would save one read, but it
  changes what a shared publish sees.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `social-cards`: the world image is redrawn when what it shows changes, not on every publish.
- `snapshot-publishing`: each publish logs its total time and the time of each step.
- `marker-editing`: each write through the Atlas logs its total time and the time of each step.

## Impact

- `service/src/publish.ts`: runs independent steps together.
- `service/src/storage.ts`: uploads the snapshot files in parallel, and fixes the listener
  warning.
- `service/src/cards/refresh.ts`: a world hash in the manifest; writes only what changed.
- `service/src/edits/editor-base.ts`, `people.ts`, `markers.ts`, `claims.ts`: one Sheets call for
  the marker and `private` cells, then the check and the log together.
- A new `service/src/timing.ts`:
  - collects timings for one request;
  - wraps the sheet, bucket and account stores.

  It is wired into `app.ts` and `api.ts`.
- Tests for the parallel publish, the world-card skip, the combined write and the timing line.
- The service README describes the timing log line.
- `service/Dockerfile`: the service starts with `--trace-warnings`, so the listener warning's
  source shows up in the logs.
- No sheet, config, dependency or front-end changes.
