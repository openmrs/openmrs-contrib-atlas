import { COLUMNS, type Cell } from "./schema.ts";

/** Sheet values used by unit tests, shaped as the Sheets API returns them. */

export const lookupValues: { types: Cell[][]; distributions: Cell[][]; versions: Cell[][] } = {
  types: [
    [...COLUMNS.types],
    ["Research", "#2E9E44", 2],
    ["Clinical", "#7B3FBF", 1],
    ["Other", "#D9443B", 5],
  ],
  distributions: [
    [...COLUMNS.distributions],
    ["Bahmni", "https://www.bahmni.org", true],
    ["KenyaEMR", "", true],
    ["AMPATH", "", false],
  ],
  versions: [[...COLUMNS.versions], ["1.10", ""], ["2.4", ""]],
};

/** A valid active marker row; tests override fields by name. */
export function markerRow(overrides: Partial<Record<(typeof COLUMNS.markers)[number], Cell>> = {}) {
  const base: Record<string, Cell> = {
    id: "9f1c2a6e-0d1b-4c3e-9a51-2f7e8b1d0a01",
    name: "Example Hospital",
    organisation: "Example Org",
    latitude: -1.2921,
    longitude: 36.8219,
    type: "Clinical",
    distribution: "KenyaEMR",
    openmrs_version: "2.4",
    site_count: "",
    url: "https://example.org",
    logo_url: "",
    notes: "Example notes",
    created_at: "2024-03-01T00:00:00Z",
    updated_at: "2024-03-01T00:00:00Z",
    confirmed_at: "2025-06-01T00:00:00Z",
    status: "active",
    ...overrides,
  };
  return COLUMNS.markers.map((col) => base[col]);
}

export function markerValues(...rows: Cell[][]): Cell[][] {
  return [[...COLUMNS.markers], ...rows];
}
