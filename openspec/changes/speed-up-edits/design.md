# Design

## Context

An editor change today makes these calls, each waiting for the one before it.

The edit, inside the write queue (`edits/people.ts`, `edits/editor-base.ts`):

1. `readEdits`: one Sheets batchGet of nine tabs.
2. A Keycloak account lookup (adding only).
3. `writePrivate`: `updateCells` on the `private` tab.
4. `restartClock`, then `writeMarker`: `updateCells` on `markers`.
5. `readCell`: checks that the row still holds this marker.
6. `log`: `appendRow` to `changes`.

Then the publish, which the response waits for (`publish.ts`, `cards/refresh.ts`, `storage.ts`):

1. `sheet.read`: a batchGet of five tabs.
2. `planLogoSweep`: lists the logo folder in the bucket.
3. `snapshots.currentCount`: downloads `atlas.json`.
4. `snapshots.write`: uploads five files, one after another.
5. `writeProblems`: a clear, then an update.
6. `readManifest`.
7. Redraw the world image (about 60 ms of CPU), then upload it.
8. `writeManifest`.

That is about 17 round trips in a row, at roughly 100 to 300 ms each. Cloud Run's request logs
agree: 2.4 to 5.4 seconds for an editor change.

Two constraints hold:

- **The write queue** (`queue.ts`) must still run one task at a time. Everything below happens
  inside a single task.
- **The CPU is throttled** once the response is sent, so no work moves after the response.

## Goals / Non-Goals

**Goals:**
- Fewer round trips one after another in an edit and in a publish, with the same results.
- Logs that show where a request's time goes, without private data.

**Non-Goals:**
- Hosting changes (keeping an instance warm), front-end changes, and answering before the publish.
- Reusing the edit's read in the publish. The queue can merge several edits into one shared
  publish, so the publish must read the sheet itself.
- Cutting the number of Sheets calls inside `writeProblems`. Clearing and rewriting is simplest,
  and it now runs alongside the uploads.

## Decisions

### The publish runs independent steps together

The new order of `publish()`:

1. **Together:**
   - `sheet.read()`;
   - `snapshots.currentCount()`;
   - when logos are on, the logo folder listing;
   - when cards are on, the card manifest read.

   The listing and the manifest read are started as promises. Each failure is caught where it
   is used, as now: a failed listing means no sweep, and a failed manifest read means no cards
   this time.
2. **Validate and build**, as now.
3. **Plan the sweep from the listing.** `planLogoSweep` takes the listed files instead of
   listing them itself, so the plan is pure. Then run the safety check.
4. **If refused,** write `problems` and return, as now.
5. **Together:** `snapshots.write(files)` and `sheet.writeProblems(...)`.
6. **Then the cards,** then the nightly sweep, each in its own try, as now.

The cards still start only after the snapshot files are written. A card isn't drawn for a
snapshot that failed to publish, and cards still can't delay `atlas.json`. Running them alongside
would save about one round trip on a typical edit, but it would bring back the case "cards for a
snapshot that was never published".

`snapshots.write` uploads its five files with `Promise.all`. The files don't refer to each other.
If one upload fails, the publish fails as today, and the next publish rewrites all five. The
order within the batch no longer matters.

### The world image is redrawn only when it would change

`worldSvg(snapshot, siteUrl)` is cheap (about 4 ms). The PNG render (about 55 ms) and the upload
are the costly parts. The manifest gains `world?: string`, a SHA-256 of the SVG text.
`refreshCards`:

- builds the SVG and hashes it;
- renders and uploads the PNG only when the hash differs from `manifest.world`, or on the
  nightly run. Nightly is chosen by the existing `sweep` option, which only the scheduler sets.
- writes the manifest only when its `markers` or `world` changed.

A manifest without `world`, the state on first deploy, draws once. Hashing the SVG, rather than
picking the marker fields it uses, means a later change to the drawing redraws it without anyone
having to remember to.

`CardResult` gains `world: "drawn" | "unchanged"` for the log.

### An edit writes its cells in one call

The two `updateCells` calls become one when the `private` row already exists. Sheets'
`values.batchUpdate` applies all its ranges in one request, so the marker and `private` cells
are written together. A failure then leaves neither half written, which is better than today.

`EditorBase` gets one helper:

```ts
/** Writes marker and private cells in one call, then checks the row and logs, together. */
protected async save(tabs, marker, { markerCells, privateCells, log: { person, id, action, fields } })
```

It works like this:

- It builds the `CellUpdate[]` for both tabs.
- If the `private` row is missing, it appends that row first, as `writePrivate` does now. This
  happens only the first time a marker gets an owner or contact.
- It then runs `updateCells` once.
- Then it runs `Promise.all([row check, log append])`. The row check stays after the write
  because it guards against rows moved in between. It only logs, so it doesn't need to come
  before the change log entry.

`restartClock` becomes the cells `{ updated_at, confirmed_at }` passed to `save`. These callers
move to `save`:

- `People.saveEditors` and `People.accept`;
- `Claims.approve`;
- `Markers.update`, the owner's edit form;
- `Markers.confirm`.

Other paths keep their calls. For example, `clearOffers` and claim decisions sit between the
writes and touch other tabs. Their order doesn't change.

An editor change becomes: read, lookup (add only), one write, then the check and the log
together. That is four round trips in a row instead of six.

### Timings come from wrapped stores

`service/src/timing.ts` uses Node's `AsyncLocalStorage` and adds no dependency:

- `withTiming(fn)` starts a collector for the current request.
- `timed(name, promise)` adds the time and a count under `name` to the current collector, if
  there is one.
- `timedStore(prefix, store)` wraps each method of a store, so `sheet.read` and
  `bucket.write` are timed without threading a timer through every function. It wraps the
  `SheetStore` and `EditStore` (`sheet.*`), the `SnapshotStore`, `CardStore` and `LogoStore`
  (`bucket.*`), and `Accounts` (`accounts.*`). `renderPng` is timed as `draw.png`.

These are wired in `app.ts`:

- **In `/api` routes,** Hono middleware wraps each request after routing. It logs one line,
  using Hono's `routePath` for the pattern, never `c.req.path`:

  ```json
  {"event":"timing","route":"POST /api/markers/:id/editors","status":200,"total_ms":1840,
   "steps":{"sheet.readEdits":{"ms":310,"n":1},"accounts.find":{"ms":220,"n":1}, …,
            "publish":{"ms":930,"n":1}}}
  ```

  The middleware covers writes and the sign-in confirmation. Plain reads (`GET /me`, search) are
  logged too. The line is cheap, and it shows the cold-start cost of `/me`.
- **In `publish()`,** the timing is collected in its own scope, nested inside the request's when
  there is one. It is logged as a second line, `{"event":"publish-timing","caller", "result",
  "total_ms","steps":{…}}`. The request's line shows the publish as one `publish` step.

Times of calls that ran together add up to more than the wall time; the README says so. The step
names are fixed strings. Arguments and results are never recorded, so no email, username or
sheet data can reach the line.

**Alternative considered:** manual `const t = timer(); t.step(...)` calls in each function. It
is more precise, but adds code everywhere and is easy to forget. Wrapping the stores covers
every call by construction.

### Fixing the listener warning

The production warning is about 11 `close` and `error` listeners on a `PassThrough`. It means
eleven or more streams were opened on one emitter at once, which the parallel uploads will make
more likely.

The first task is to reproduce it locally against fake-gcs-server with
`node --trace-warnings` and find where it comes from. The likely cause is
`@google-cloud/storage`'s `file.save` with `gzip: true`, or the auth client shared by
`new Storage()` instances. The fix goes at the source, for example one shared `Storage` client
or a capped upload concurrency.

A global `setMaxListeners` that hides the warning is acceptable only if the trace shows a library
adding listeners it removes again. If so, it is scoped to that emitter and the reason is written
in a comment.

## Risks / Trade-offs

- **Parallel uploads fail part-way.** If, say, `markers.csv` fails while `atlas.json` succeeds,
  the public files disagree until the next publish. Today the same can happen in sequence, so it
  isn't new. The publish reports failure, the edit says "saved, will appear later", and the next
  publish fixes it.
- **The world image goes stale after a lost file.** If `cards/world.png` is deleted by hand,
  edits won't redraw it, but the nightly publish will. Restore from soft-delete in the meantime.
- **Timing log volume.** About one short line per API request, which is small at Atlas traffic.
- **Merged writes change which half fails.** One `batchUpdate` either writes both tabs or
  neither. That is safer than today's two calls.

## Migration Plan

No data migration. The manifest's new `world` field is optional, and the first publish after
deploy fills it in. To roll back, redeploy the previous release, which ignores the extra field.

## Open Questions

- **Where the listener warning comes from.** It did not reproduce locally. I ran these against
  fake-gcs-server with `node --trace-warnings`, and none gave the warning:
  - 5 and 20 parallel snapshot uploads, with gzip;
  - 20 card uploads, one after another and in parallel;
  - 30 reads of `atlas.json`, one after another and in parallel;
  - 12 logo saves;
  - a list and a delete.

  The production warnings (9 November, during the first days of 3.0) came with no stack trace.
  So the cause is probably something that only happens against the real Google APIs, such as
  the auth client or HTTPS connection reuse, rather than the uploads themselves. The service now
  starts with `--trace-warnings`, so the next time it happens the logs will say where it came
  from, and the fix can go there.
