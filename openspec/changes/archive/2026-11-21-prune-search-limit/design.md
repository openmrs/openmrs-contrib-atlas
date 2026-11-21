# Design

## Context

`createApi` in `service/src/api.ts` keeps `searches: Map<string, number[]>`. `allowSearch`
filters the caller's times to the last 60 seconds, refuses past `SEARCHES_PER_MINUTE`, or pushes
the current time. Only the caller's entry is ever rewritten, and no entry is ever removed.

## Goals / Non-Goals

**Goals:**
- The map holds only people who searched in the last minute, give or take a minute.
- The same limit as today, with the same 429 message.

**Non-Goals:**
- Any change people can see.

## Decisions

**Sweep when a search arrives, at most once a minute.** `take(username, now)` first checks when
the map was last swept. If that was more than a minute ago, it deletes every entry whose newest
time is a minute old or more. Then it handles the caller as today. That needs no timer, which
would also keep a Cloud Run instance busy. The sweep's cost is one pass over a map of recent
searchers, once a minute. An entry can outlive its last search by up to two minutes, which is fine.

**A class next to `DailyLimit`.** `MinuteLimit(limit, windowMs = 60_000)` with `take(username,
now: Date): boolean`, as for `DailyLimit`, and a `people` count for tests. `api.ts` creates one
with `SEARCHES_PER_MINUTE`, and both search routes call `searches.take(...)`. A refused search
still doesn't add a time, as today, so retrying while refused doesn't lengthen the wait.

## Risks / Trade-offs

- **The move could change the limit by accident.** The existing "Too many searches" API test,
  plus new unit tests at the edges (the 30th and 31st search, and a search exactly a minute later),
  guard against it.
