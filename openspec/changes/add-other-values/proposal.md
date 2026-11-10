# Proposal

## Why

Distributions and versions are too strict and too loose at once. The form offers every row of the
`distributions` and `versions` tabs, including entries that only exist for one site. A site whose
distribution or version isn't on the list has nowhere to say what it runs: version has a bare
"Other" with no detail, and distribution has nothing. A value an admin types into the sheet that
isn't on its list fails validation and silently takes the marker off the map. Early feedback is
that the lists confuse people, and the Talk announcement will bring implementers back to the
form, so this needs fixing first, in 3.2. Atlas 2.0 handled it with an "Other" choice and a free
text name. This brings that back, the way types work today: a fixed list, but with a way out.
It refines the form (C3), Colour by (M3) and filters (M5).

## What Changes

- **"Other" with free text for distribution and version.** The form offers the sheet's list plus
  "Other". Choosing "Other" shows a text field for the value: up to 30 characters for a
  distribution and 12 for a version, so it fits on one line in the marker's details. The value is
  stored as typed in `distribution` or `openmrs_version`. No new columns.
- **Other is inferred from the lists.** Any `distribution` or `openmrs_version` that isn't on its
  list is an Other value. It is published and shown by name in the marker's details. It is no
  longer a validation problem, so it no longer takes a marker off the map.
- **Values match the list regardless of case.** "bahmni", typed in the form or the sheet, is
  saved and published as "Bahmni".
- **One "Other" in Colour by and the filters.** Every Other value shares one "Other" colour and
  legend entry, and one "Other" filter matches them all. Adding a value to the list later moves
  its markers out of Other with no edits to the markers.
- **The bare "Other" version stays valid** and means Other with no detail, as today.
- **`is_standard` is dropped** from the `distributions` tab. It does nothing in 3.0. Every row on
  the tab is offered in the form. To retire a distribution, delete its row, and its markers keep
  their value as an Other value.

Out of scope:

- Types. They stay a fixed list with no "Other".
- Cleaning up the lists themselves (which versions and distributions to offer). That is sheet data
  for the admins.
- Re-running the 2.0 migration. It still maps unrecognised 2.0 versions to "Other". It is
  finished, and its spec is unchanged.
- Length limits on values admins type in the sheet. The limits apply to the form and the service.
- Any change to the published file formats beyond dropping `is_standard`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `marker-data`: `is_standard` leaves the `distributions` columns. Unknown distributions and
  versions are no longer invalid, and values that match a list entry regardless of case are
  stored as that entry.
- `marker-editing`: the pick lists gain "Other" with a free-text field and its length limits.
- `map-view`: Colour by, the legend and the filters group every Other value under one "Other",
  and the details show the value itself.
- `snapshot-publishing`: published distributions no longer include `is_standard`, and published
  values use the list's spelling.

## Impact

- `shared/`: `schema.ts` (columns, `Distribution`), `rows.ts` (`parseLookups`), `validate.ts`,
  `input.ts` (limits), `seed.ts` and `fixtures.ts`, plus a helper that says whether a value is an
  Other value.
- `service/`: saving normalises the case and applies the length limits. Publishing goes through
  the shared validation.
- `web/`: `MarkerForm.tsx`, `lib/colours.ts`, `components/FilterPanel.tsx`, `lib/filters.ts`,
  `components/Legend.tsx`, plus their unit and e2e tests.
- `migration/src/cli.ts` stops writing `is_standard`.
- **The sheets (manual):** delete the `is_standard` column from `distributions` in the staging and
  production sheets. Leaving it does no harm, because columns are found by header. Admins may
  also want to prune the lists.
