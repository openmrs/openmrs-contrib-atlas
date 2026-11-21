# Tasks

## 1. Search limit

- [x] 1.1 In `service/src/limits.ts`, add `MinuteLimit` with `take` and `people`. It sweeps out idle people at most once per window.
- [x] 1.2 In `service/src/api.ts`, replace `allowSearch` and its map with a `MinuteLimit` of `SEARCHES_PER_MINUTE`.
- [x] 1.3 Unit tests in `service/src/limits.test.ts`: 30 allowed and the 31st refused; allowed again once the window passes; a refused search doesn't extend the wait; people who stopped searching are dropped after the next sweep.

## 2. Checks

- [x] 2.1 Run the typecheck, lint, format check and unit tests, and `openspec validate prune-search-limit --strict`.
