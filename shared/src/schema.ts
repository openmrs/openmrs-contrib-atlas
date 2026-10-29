/**
 * The Atlas sheet: tab names, column headers and the record types they hold.
 * See openspec specs/marker-data.
 */

export const TABS = {
  markers: "markers",
  private: "private",
  changes: "changes",
  types: "types",
  distributions: "distributions",
  versions: "versions",
  problems: "problems",
} as const;

export const COLUMNS = {
  markers: [
    "id",
    "name",
    "organisation",
    "latitude",
    "longitude",
    "type",
    "distribution",
    "openmrs_version",
    "site_count",
    "url",
    "logo_url",
    "notes",
    "created_at",
    "updated_at",
    "confirmed_at",
    "status",
  ],
  private: ["id", "owner", "editors", "contact_name", "contact_email"],
  changes: ["timestamp", "user", "marker_id", "action", "fields"],
  types: ["name", "colour", "sort"],
  distributions: ["name", "url", "is_standard"],
  versions: ["version", "release_date"],
  problems: ["marker_id", "row", "reasons"],
} as const satisfies Record<keyof typeof TABS, readonly string[]>;

/** Columns whose cells must be plain text in the sheet, so "1.10" is not turned into 1.1. */
export const TEXT_COLUMNS = new Set<string>([
  "id",
  "openmrs_version",
  "version",
  "created_at",
  "updated_at",
  "confirmed_at",
  "release_date",
  "timestamp",
  "owner",
  "editors",
]);

/** The version value allowed in addition to the versions tab. */
export const OTHER_VERSION = "Other";

export const MARKER_STATUSES = ["active", "hidden", "closed"] as const;
export type MarkerStatus = (typeof MARKER_STATUSES)[number];

/** A cell as returned by the Sheets API with UNFORMATTED_VALUE rendering. */
export type Cell = string | number | boolean | null | undefined;

export interface Marker {
  id: string;
  name: string;
  organisation?: string;
  latitude: number;
  longitude: number;
  type: string;
  distribution?: string;
  openmrs_version?: string;
  /** Omitted means 1. */
  site_count?: number;
  url?: string;
  logo_url?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  confirmed_at?: string;
  status: MarkerStatus;
}

export interface PrivateRow {
  id: string;
  owner?: string;
  /** Keycloak usernames. */
  editors: string[];
  contact_name?: string;
  contact_email?: string;
}

export interface MarkerType {
  name: string;
  colour: string;
  sort: number;
}

export interface Distribution {
  name: string;
  url?: string;
  is_standard: boolean;
}

export interface Version {
  version: string;
  release_date?: string;
}

export interface Lookups {
  types: MarkerType[];
  distributions: Distribution[];
  versions: Version[];
}

/** One invalid marker row, as written to the problems tab. */
export interface Problem {
  markerId?: string;
  /** 1-based sheet row number, counting the header as row 1. */
  row: number;
  reasons: string[];
}
