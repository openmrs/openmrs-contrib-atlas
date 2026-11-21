# Tasks

## 1. Picker

- [x] 1.1 In `AccountPicker.tsx`, keep the exact username match and sort it first (ignoring case)
- [x] 1.2 Search only after the person has edited the field: a `touched` flag set by their own changes, not by the parent's

## 2. Tests and ship

- [x] 2.1 Component tests: typing `burke` suggests `burke` first and `mercedesburke` second; a pre-filled field shows no suggestions until edited; editing it then shows them
- [x] 2.2 Run `npm run format:check`, `typecheck`, `lint`, `test`, the e2e tests and `openspec validate --strict`
- [ ] 2.3 (manual) On staging, open an existing marker as an admin: the Owner field shows no list; type an exact OpenMRS ID: it's suggested first
