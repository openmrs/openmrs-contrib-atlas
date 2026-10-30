import type { PublicMarker } from "./types.ts";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export const FADE_START_YEARS = 2;
export const FADE_END_YEARS = 5;
export const MIN_OPACITY = 0.35;

/** The date a marker was last confirmed, falling back to its last update or creation. */
export function lastConfirmed(marker: PublicMarker): string | undefined {
  return marker.confirmed_at ?? marker.updated_at ?? marker.created_at;
}

export function yearsSince(iso: string | undefined, now: Date): number {
  if (!iso) return Infinity;
  return (now.getTime() - new Date(iso).getTime()) / MS_PER_YEAR;
}

/**
 * Full opacity until 2 years after confirmation, then linear down to 35% at 5 years,
 * never lower. See specs/map-view, "Gradual fading by freshness".
 */
export function opacityFor(marker: PublicMarker, now: Date): number {
  const years = yearsSince(lastConfirmed(marker), now);
  if (years <= FADE_START_YEARS) return 1;
  if (years >= FADE_END_YEARS) return MIN_OPACITY;
  const t = (years - FADE_START_YEARS) / (FADE_END_YEARS - FADE_START_YEARS);
  return 1 - t * (1 - MIN_OPACITY);
}
