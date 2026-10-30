import { lastConfirmed, yearsSince } from "./freshness.ts";
import { UNKNOWN, type Filters, type PublicMarker } from "./types.ts";

function matches(selected: string[], value: string | undefined): boolean {
  return selected.length === 0 || selected.includes(value ?? UNKNOWN);
}

export function applyFilters(markers: PublicMarker[], filters: Filters, now: Date) {
  return markers.filter(
    (m) =>
      matches(filters.types, m.type) &&
      matches(filters.distributions, m.distribution) &&
      matches(filters.versions, m.openmrs_version) &&
      matches(filters.countries, m.country) &&
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
      0 || filters.confirmedWithinYears !== undefined
  );
}
