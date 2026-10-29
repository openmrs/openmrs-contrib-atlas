import { iso1A3Code } from "@rapideditor/country-coder";
import type { Distribution, Lookups, Marker, MarkerType, Version } from "./schema.ts";

/**
 * Public snapshot files built from validated sheet data.
 * See openspec specs/snapshot-publishing. Nothing from the private or changes tabs
 * is passed in, so nothing private can leak out.
 */

/** Marker fields that may be published, in CSV column order. */
export const PUBLIC_FIELDS = [
  "id",
  "name",
  "organisation",
  "latitude",
  "longitude",
  "country",
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
] as const;

export type PublicMarker = Omit<Marker, "status"> & {
  /** ISO 3166-1 alpha-3, derived from the coordinates; omitted at sea. */
  country?: string;
};

export interface AtlasSnapshot {
  generated_at: string;
  types: MarkerType[];
  distributions: Distribution[];
  versions: Version[];
  markers: PublicMarker[];
}

/** Builds atlas.json content: active markers only, public fields only. */
export function buildSnapshot(markers: Marker[], lookups: Lookups, now: Date): AtlasSnapshot {
  return {
    generated_at: now.toISOString(),
    types: lookups.types,
    distributions: lookups.distributions,
    versions: lookups.versions,
    markers: markers.filter((m) => m.status === "active").map(toPublicMarker),
  };
}

function toPublicMarker(marker: Marker): PublicMarker {
  const country = iso1A3Code([marker.longitude, marker.latitude]) ?? undefined;
  const out: Record<string, unknown> = {};
  for (const field of PUBLIC_FIELDS) {
    const value = field === "country" ? country : marker[field];
    if (value !== undefined) out[field] = value;
  }
  return out as PublicMarker;
}

export function toGeoJson(snapshot: AtlasSnapshot) {
  return {
    type: "FeatureCollection" as const,
    features: snapshot.markers.map(({ latitude, longitude, ...properties }) => ({
      type: "Feature" as const,
      id: properties.id,
      geometry: { type: "Point" as const, coordinates: [longitude, latitude] },
      properties,
    })),
  };
}

export function toCsv(snapshot: AtlasSnapshot): string {
  const lines = [PUBLIC_FIELDS.join(",")];
  for (const marker of snapshot.markers) {
    lines.push(PUBLIC_FIELDS.map((field) => csvCell(marker[field])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
