import { lastConfirmed, yearsSince } from "./freshness.ts";
import type { PublicMarker } from "./types.ts";

export interface Stats {
  markers: number;
  countries: number;
  /** Sum of site counts, blank counting as 1. */
  sites: number;
  confirmedLastTwoYears: number;
}

/** How many implementations are running: closed sites are on the map but don't count. */
export function computeStats(all: PublicMarker[], now: Date): Stats {
  const markers = all.filter((m) => m.status !== "closed");
  return {
    markers: markers.length,
    countries: new Set(markers.map((m) => m.country).filter(Boolean)).size,
    sites: markers.reduce((sum, m) => sum + (m.site_count ?? 1), 0),
    confirmedLastTwoYears: markers.filter((m) => yearsSince(lastConfirmed(m), now) <= 2).length,
  };
}
