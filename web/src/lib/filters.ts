import { lastConfirmed, yearsSince } from "./freshness.ts";
import { distributionGroup, versionGroup, type Lists } from "./groups.ts";
import { UNKNOWN, type Filters, type PublicMarker } from "./types.ts";

function matches(selected: string[], value: string | undefined): boolean {
  return selected.length === 0 || selected.includes(value ?? UNKNOWN);
}

/** Distribution and version filters match by group, so "Other" matches every Other value. */
export function applyFilters(markers: PublicMarker[], filters: Filters, now: Date, lists: Lists) {
  return markers.filter(
    (m) =>
      matches(filters.types, m.type) &&
      matches(filters.distributions, distributionGroup(m, lists)) &&
      matches(filters.versions, versionGroup(m, lists)) &&
      matches(filters.countries, m.country) &&
      !(filters.hideClosed && m.status === "closed") &&
      (filters.confirmedWithinYears === undefined ||
        yearsSince(lastConfirmed(m), now) <= filters.confirmedWithinYears),
  );
}

export function hasFilters(filters: Filters): boolean {
  return (
    filters.types.length +
      filters.distributions.length +
      filters.versions.length +
      filters.countries.length >
      0 ||
    filters.confirmedWithinYears !== undefined ||
    Boolean(filters.hideClosed)
  );
}
