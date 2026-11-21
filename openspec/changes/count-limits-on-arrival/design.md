# Design

## Context

`DailyLimit` in `service/src/limits.ts` keeps a `Map<username, { day, count }>`, with
`reached()` and `record()`. In `service/src/api.ts`, `POST /markers` calls `reached()`, then
parses the body, then `await write(() => editor.add(...))`, and only then `record()`.
`POST /logos` does the same around form parsing, `processLogo` and `saveLogo`. Each `await`
lets other requests run, so concurrent requests all see a count of zero. The service runs as one
Cloud Run instance (`--max-instances=1`), so the in-memory counter is the only one.

## Goals / Non-Goals

**Goals:**
- At most the limit's number of successful adds or uploads per person per day, however the
  requests are timed.
- Failures don't count, as today.
- A map that doesn't grow forever.

**Non-Goals:**
- Counts that survive restarts, or are shared across instances.

## Decisions

**Take and give back.** `take(username, now): boolean` checks and increments with no `await` in
between. Node runs it to completion, so two requests can't both take the last use.
`giveBack(username, now)` decrements today's count, never below zero. If the day has changed
since the take, it does nothing, since that day's count is already gone. Both routes become:

```ts
if (!person.admin && !adds.take(person.username, deps.now())) throw tooMany(...);
try {
  … the existing work …
} catch (err) {
  if (!person.admin) adds.giveBack(person.username, deps.now());
  throw err;
}
```

The `try` covers only the work that can fail before the write is done: parsing, the write and,
for logos, processing and saving. The new-marker notice is sent after the add succeeds, and it
never throws, so it stays outside the `try`. `reached` and `record` are removed.

**Give back on every failure.** A request with bad input wrote nothing, so it shouldn't use up
the day. That matches today's behaviour, where only successes are counted. With parallel
requests, a failure can give its use back to a request that arrives later. The total of
successful writes still never passes the limit.

**Drop old days in one go.** `DailyLimit` stores the day its counts belong to. On the first call
on a new UTC day, it clears the map. The map then holds only today's people. That needs no timer
or pruning pass.

**The search limit stays as it is.** The account search limit (30 a minute, `allowSearch` in
`api.ts`) already counts on arrival, so it has no race. Its map also keeps an entry for everyone
who has searched, but each entry holds at most a minute of timestamps. Pruning it is left out, and
could be added the same way later.

## Risks / Trade-offs

- **A use taken by a request that hangs** stays counted until the request ends. Requests are
  bounded by the sheet and storage timeouts and Cloud Run's request timeout, so the use comes back
  or the write happens.
- **A restart resets the counts,** as the spec already allows.
