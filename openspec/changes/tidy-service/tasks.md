# Tasks

## 1. Shared helpers

- [x] 1.1 Add `service/src/html.ts` with `escapeHtml()` (escaping `& < > " '`), and use it in `help.ts`, `notices.ts`, `claims-mail.ts`, `reminders.ts` and `permalinks.ts`, removing their copies
- [x] 1.2 Add `service/src/publishing.ts` with `publishSafely()`, and use it in `api.ts` (`write()` and `confirm-recent`) and `reminder-links.ts`

## 2. Split edits.ts

- [x] 2.1 Create `service/src/edits/` with `core.ts`, `editor-base.ts` and `index.ts` (re-exporting today's names), moving the shared types, errors and helpers
- [x] 2.2 Move marker edits to `markers.ts`, editors and transfers to `people.ts`, and claims to `claims.ts`, with `MarkerEditor` delegating so its public methods are unchanged
- [x] 2.3 Point `api.ts`, `reminder-links.ts`, `app.ts` and the tests at `./edits/index.ts`, and delete `edits.ts`

## 3. Check

- [x] 3.1 Run the service tests before and after; they pass with only import changes (and `&#39;` where a test's HTML holds a `'`)
- [x] 3.2 Run `npm run format:check`, `typecheck`, `lint`, `test`, the e2e tests and `openspec validate --strict`
- [ ] 3.3 (manual) On staging, edit a marker, add an editor, and claim and decline a claim; check nothing has changed
