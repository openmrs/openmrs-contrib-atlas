# Proposal

## Why

Account searches are limited to 30 a minute per person. The service keeps each person's recent
search times in a map, and only tidies a person's entry when that same person searches again. So
the map gains an entry for everyone who has ever searched since the service last started, and
never loses one. Each entry is small, at most a minute of times, but the map only grows.

The daily limits were fixed the same way in `count-limits-on-arrival`. This finishes that work.

## What Changes

- **Idle searchers are forgotten.** About once a minute, while searches come in, the service drops
  entries for people who haven't searched in the last minute. The map then holds only people who
  are searching now.
- **The search limit moves next to the daily limits.** It becomes a small `MinuteLimit` class in
  `service/src/limits.ts`, with its own tests, so `api.ts` no longer holds the logic.

The limit itself is unchanged: 30 searches a minute per person, counted on arrival, refused with
429 past that, and reset by a restart.

Out of scope:

- Changing the limit, or the window.
- Limits by IP address, or limits that survive a restart.
- The daily limits and the logo sweep, already done in this release.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The `account-lookup` requirement ("Searches SHALL be limited to 30 a minute per person")
and its scenario are unchanged, so there is no delta spec.

## Impact

- `service/src/limits.ts`: a `MinuteLimit` class.
- `service/src/api.ts`: `allowSearch` and its map are replaced by a `MinuteLimit`.
- `service/src/limits.test.ts`: unit tests for it. The existing "Too many searches" API test still
  covers the route.
