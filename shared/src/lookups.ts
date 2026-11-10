/**
 * Distributions and versions: a value on its list, or an Other value (specs/marker-data).
 */

/** The one group for every distribution or version that is not on its list. */
export const OTHER = "Other";

/** Longest Other value a person may enter, so it fits on one line in the marker's details. */
export const OTHER_MAX_LENGTH = { distribution: 30, openmrs_version: 12 } as const;

/** Lower-cased list entry → its spelling, for matching values regardless of case. */
export function spellings(list: readonly string[]): Map<string, string> {
  return new Map(list.map((entry) => [entry.toLowerCase(), entry]));
}

/** A value spelled as its list entry when it matches one ignoring case, else as given (trimmed). */
export function canonical(value: string, list: Map<string, string>): string {
  const trimmed = value.trim();
  return list.get(trimmed.toLowerCase()) ?? trimmed;
}

/**
 * The group a value belongs to: the value itself when it is on the list, `OTHER` for any other
 * text (including "Other"), and undefined when blank.
 */
export function groupOf(value: string | undefined, list: ReadonlySet<string>): string | undefined {
  if (!value) return undefined;
  return list.has(value) ? value : OTHER;
}
