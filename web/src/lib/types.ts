// Type-only imports keep shared's runtime (and its country data) out of the browser bundle.
export type { AtlasSnapshot, PublicMarker } from "@openmrs-atlas/shared";

export type ColourBy = "type" | "distribution" | "version";

/** Matches markers with no value for a filtered or coloured attribute. */
export const UNKNOWN = "Unknown";

export interface Filters {
  types: string[];
  distributions: string[];
  versions: string[];
  /** ISO 3166-1 alpha-2 codes. */
  countries: string[];
  /** Only markers confirmed within this many years. */
  confirmedWithinYears?: number;
}

export const NO_FILTERS: Filters = {
  types: [],
  distributions: [],
  versions: [],
  countries: [],
};

export interface MapView {
  zoom: number;
  lat: number;
  lng: number;
}
