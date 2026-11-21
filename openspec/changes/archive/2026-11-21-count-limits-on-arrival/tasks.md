# Tasks

## 1. Counter

- [x] 1.1 In `service/src/limits.ts`, replace `reached`/`record` with `take` and `giveBack`, and clear the counts when the UTC day changes.
- [x] 1.2 Unit tests for `DailyLimit`: take up to the limit, refuse past it, give back, never go below zero, ignore a give-back from an earlier day, and keep only today's counts.

## 2. Routes

- [x] 2.1 In `service/src/api.ts`, take on arrival in `POST /markers` and `POST /logos`, and give back if the work throws. Admins skip both.
- [x] 2.2 API tests: a burst of 50 parallel adds gives 5 adds (201) and 45 refusals (429); the same for 25 parallel uploads with a limit of 20; a failed add (missing name) doesn't count; a failed upload (unreadable image) doesn't count; an admin burst isn't limited.

## 3. Docs and checks

- [x] 3.1 In `service/README.md`, update the limits section to say a use is counted on arrival and given back on failure.
- [x] 3.2 Run the typecheck, lint, format check and unit tests, and `openspec validate count-limits-on-arrival --strict`.
