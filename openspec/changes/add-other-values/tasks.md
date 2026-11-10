# Tasks

## 1. Shared rules

- [x] 1.1 Add `shared/src/lookups.ts` with `OTHER` ("Other") and `groupOf(value, list)`, which returns the list value, `OTHER` or `undefined` (blank). Replace `OTHER_VERSION` in `schema.ts` with it
- [x] 1.2 Drop `is_standard` from `COLUMNS.distributions` and the `Distribution` type. In `parseLookups`, stop requiring the column, ignore it when present, and drop any `distributions` or `versions` entry named "Other"
- [x] 1.3 In `validateMarkers`, stop treating an unknown `distribution` or `openmrs_version` as a problem. Map a value matching a list entry ignoring case (after trimming) to the entry's spelling
- [x] 1.4 Add `distribution: 30` and `openmrs_version: 12` to the limits in `input.ts`, applied only to changed values that are not on their list
- [x] 1.5 Update `seed.ts`, `fixtures.ts` and `migration/src/cli.ts` (write `name` and `url` only)
- [x] 1.6 Tests, one per scenario in the `marker-data` and `snapshot-publishing` deltas: Other distribution and version valid and published, case mapped, value added to the list later, leftover `is_standard` column ignored, a list entry "Other" ignored, `atlas.json` distributions without `is_standard`, and the length limits on list and non-list values

## 2. Service

- [x] 2.1 Check that adding and editing go through the case mapping and limits (`checkMarkerRow`, `checkLimits`), so an Other "bahmni" is written to the sheet as "Bahmni"
- [x] 2.2 Tests for the `marker-editing` save scenarios: Other value saved, typed like a list entry, blank Other saved as `Other`, and too long refused with the field's reason

## 3. Map

- [x] 3.1 `lib/colours.ts`: colour by distribution or version through `groupOf`, with one "Other" colour and legend entry after the list values and before Unknown
- [x] 3.2 `lib/filters.ts` and `FilterPanel.tsx`: filter through `groupOf`, so the filters offer the present list values, then "Other", then "Unknown". `dist=Other` / `ver=Other` in the URL selects the group
- [x] 3.3 Check that `MarkerDetails.tsx` shows the value itself for an Other value. Shorten the label column on phones if a 30-character value wraps at 375 px
- [x] 3.4 Unit tests for the legend (two Other values make one entry), the filters (Other matches every Other value and nothing else) and the details

## 4. Form

- [x] 4.1 `MarkerForm.tsx`: distribution and version become the list plus "Other". Choosing Other shows a labelled text field (30 or 12 characters) and focuses it. A saved value not on the list opens as Other with its text, and blank text saves as `Other`
- [x] 4.2 Keep the form usable by keyboard and on phones, and keep server reasons shown against the right field
- [x] 4.3 Unit tests for the form scenarios: pick lists end with Other, choosing Other, editing a marker with an Other value, blank Other, and the length limits
- [x] 4.4 e2e: add a marker with an Other distribution, then see it in the details, in the legend as Other and under the Other filter, including at 375 px

## 5. Docs and release

- [x] 5.1 Update the README sheet description and `service/README.md`: Other values, the case rule, how to retire a list entry, and that `is_standard` is gone
- [x] 5.2 Run `npm run format:check`, `typecheck`, `lint`, `test`, the e2e tests and `openspec validate --strict`
- [x] 5.3 (manual) Delete the `is_standard` column from `distributions` in the staging sheet, and later in production
- [ ] 5.4 (manual) Check on staging: add a marker with an Other distribution and version, colour by each, filter by Other, and edit it again
- [ ] 5.5 (manual) Release 3.2 once staging checks out, with this change, the email postscript and the title font in its release notes

## Workflow follow-up

- Archive `add-other-values` after 3.2 is released and checked on production.
