import { countryName } from "./countries.ts";
import { lastConfirmed } from "./freshness.ts";
import type { PublicMarker } from "./types.ts";

/** The map's visible area, in degrees. West and east may run past ±180 on world copies. */
export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type ListSort = "name" | "country" | "sites" | "confirmed";
export const LIST_SORTS: { value: ListSort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "country", label: "Country" },
  { value: "sites", label: "Sites" },
  { value: "confirmed", label: "Last confirmed" },
];

/** Whether a marker lies in the visible area, allowing for world copies and the antimeridian. */
export function inView(marker: PublicMarker, bounds: Bounds): boolean {
  if (marker.latitude < bounds.south || marker.latitude > bounds.north) return false;
  if (bounds.east - bounds.west >= 360) return true;
  // Shift the longitude into the 360 degrees that start at the west edge.
  const lng = bounds.west + ((((marker.longitude - bounds.west) % 360) + 360) % 360);
  return lng <= bounds.east;
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const byName = (a: PublicMarker, b: PublicMarker) => collator.compare(a.name, b.name);
const sites = (m: PublicMarker) => m.site_count ?? 1;
const confirmedTime = (m: PublicMarker) => {
  const iso = lastConfirmed(m);
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? -Infinity : t;
};

/** A sorted copy. Ties, and markers with no country, fall back to name order. */
export function sortMarkers(markers: PublicMarker[], sort: ListSort): PublicMarker[] {
  const compare: Record<ListSort, (a: PublicMarker, b: PublicMarker) => number> = {
    name: byName,
    country: (a, b) => {
      const [ca, cb] = [countryName(a.country), countryName(b.country)];
      if (!ca !== !cb) return ca ? -1 : 1;
      return collator.compare(ca, cb) || byName(a, b);
    },
    sites: (a, b) => sites(b) - sites(a) || byName(a, b),
    confirmed: (a, b) => {
      const [ta, tb] = [confirmedTime(a), confirmedTime(b)];
      return ta === tb ? byName(a, b) : tb > ta ? 1 : -1;
    },
  };
  return [...markers].sort(compare[sort]);
}

const monthYear = new Intl.DateTimeFormat("en", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "Uganda · Clinical · 12 sites · Mar 2026", leaving out blanks and a single site. */
export function entryMeta(marker: PublicMarker): string {
  const confirmed = lastConfirmed(marker);
  const date = confirmed ? new Date(confirmed) : undefined;
  return [
    countryName(marker.country),
    marker.type,
    sites(marker) > 1 ? `${sites(marker)} sites` : "",
    date && !Number.isNaN(date.getTime()) ? monthYear.format(date) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
