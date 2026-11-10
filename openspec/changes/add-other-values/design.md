# Design

## Context

- **Validation:** `shared/src/validate.ts` checks `distribution` against the `distributions` names,
  and `openmrs_version` against the `versions` entries plus `OTHER_VERSION` ("Other"). A miss is a
  `problems` reason, which takes the marker off the map. The service runs the same check on every
  save (`checkMarkerRow` in `shared/src/input.ts`), so the form can only send list values.
- **The web app** treats each field's value as its own category:
  - `lib/colours.ts` gives each distribution a categorical colour and each version a ramp colour,
    with "Other" grey.
  - `FilterPanel.tsx` lists each value present.
  - `lib/filters.ts` matches values exactly.
  - `MarkerForm.tsx` uses a plain `<select>`, and keeps showing a value that is no longer on the list.
- **Production data:** 1 marker uses AMPATH (`is_standard` FALSE), 2 use the bare "Other" version,
  and every other value is on its list. Nothing reads `is_standard`.

## Goals / Non-Goals

**Goals:**
- One rule, in `shared/`, for "on the list, Other, or Unknown", used by publishing, the service and
  the map alike.
- No change to `atlas.json`'s shape beyond dropping `is_standard`. CSV and GeoJSON are unchanged.

**Non-Goals:**
- A separate free-text column, or flags in the published file saying which values are Other.

## Decisions

**1. Other is decided in the browser, from the lists in the same snapshot.**
`atlas.json` already carries the `distributions` and `versions` lists next to the markers. Whether
a value is Other is a lookup in a `Set` built once per snapshot: about 450 lookups, well under a
millisecond. Publishing an extra flag per marker would grow the file and change its format for
anyone reading it, and the answer is already in the file.
_Alternative:_ an `is_other` field on each marker, or a third `distribution_group` value. Rejected
because it duplicates the lists.

**2. Case is fixed when reading the sheet, so the published value is canonical.**
`validateMarkers` maps a value that matches a list entry ignoring case (after trimming) to the
entry's spelling. That covers sheet edits and publishing in one place. The service saves through
the same function, so the form's values are normalised too and written to the sheet with the
list's spelling. The browser then needs only an exact `Set` lookup.

**3. One shared helper names the group.**
`shared/src/lookups.ts` (new) exports `OTHER` ("Other") and
`groupOf(value, list): string | undefined`. It returns the value when the value is on the list,
`OTHER` for any other text (including "Other" itself), and `undefined` when blank. The web's
`valueOf` in `colours.ts`, `filters.ts` and `FilterPanel.tsx` use it, with `undefined` shown as
Unknown. The URL filter value `dist=Other` / `ver=Other` means the group. `OTHER_VERSION` in
`schema.ts` becomes this `OTHER`.

**4. A list entry named "Other" is ignored.**
If an admin adds a row named "Other", it would collide with the group. `parseLookups` drops it
from `distributions` and `versions`, so the group is always the only "Other".

**5. Limits live with the other length limits.**
`MAX_LENGTH` in `shared/src/input.ts` gains `distribution: 30` and `openmrs_version: 12`. Like the
existing limits, they apply only to values a person is changing, and only to values that are not
on the list, so a long list entry (an admin's choice) is never refused. Values the sheet already
holds are not limited. The form puts the same numbers on its text fields' `maxLength`.

**6. The form's control: a select, then a text field.**
Each of the two fields becomes a `<select>` of the list plus "Other". When "Other" is chosen, a
labelled text field ("Distribution name" / "Version") appears below it and takes focus. A saved
value that is not on the list opens with "Other" chosen and the value in the text field. On save,
the field's value is the text, or `Other` when the text is blank. This replaces today's habit of
listing a stale value in the select.

**7. Dropping `is_standard` is lenient.**
`parseLookups` stops requiring the column, and `COLUMNS.distributions` drops it, so `setup:sheet`
no longer adds it. Columns are found by header, so a sheet that still has the column keeps
working. The migration CLI writes `name` and `url` only.

## Risks / Trade-offs

- **[An admin's typo in the sheet becomes an Other value instead of a `problems` entry]** → It is
  still visible: it shows by name in the details, and under Other in the legend. The case rule
  catches the commonest slip. The maintainer accepted this trade-off (inferring over explicit
  columns).
- **[Renaming a list entry moves its markers into Other]** → This is the intended behaviour, and
  it is reversible: rename it back, or edit the markers. It is noted in the service README for
  admins.
- **[An old shared link filters by a value that is now Other, e.g. `dist=AMPATH`]** → It matches
  nothing, as an unknown value does today. Such links are rare: filters by distribution were
  barely used before.
- **[A 30-character distribution wraps in the details on a narrow phone]** → An e2e check at 375 px
  covers the longest allowed value. If it wraps, shorten the label column there rather than the
  limit.

## Migration Plan

1. Ship in 3.2: staging first, then the release tag.
2. **(manual)** Delete the `is_standard` column from the `distributions` tab in the staging and
   production sheets. Before or after the deploy both work, because the column is ignored.
3. **(manual, optional)** Admins prune the lists. Values removed from a list become Other values on
   the next publish, which the Apps Script triggers within about a minute.
4. Rollback: redeploy 3.1. Its validation would again reject Other values and leave those markers
   off the map until they are fixed, so only roll back if necessary.
