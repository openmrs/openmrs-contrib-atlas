import { OTHER_VERSION, type Cell } from "./schema.ts";

/**
 * Pure mapping from Atlas 2.0 database rows to Atlas 3.0 sheet rows.
 * See openspec specs/legacy-migration. The CLI in migration/ does the I/O.
 */

/** A row of the 2.0 `atlas` table (MySQL read with dateStrings: true). */
export interface Atlas2Marker {
  id: string;
  latitude: string | number;
  longitude: string | number;
  name: string;
  url: string | null;
  type: string;
  image: Uint8Array | null;
  contact: string | null;
  email: string | null;
  notes: string | null;
  date_created: string | null;
  date_changed: string | null;
  created_by: string | null;
  openmrs_version: string | null;
  distribution: number | null;
}

/** A row of the 2.0 `auth` table. */
export interface Atlas2Auth {
  id: number;
  atlas_id: string;
  principal: string;
  privileges: string | null;
}

export interface Atlas2Distribution {
  id: number;
  name: string;
  is_standard: number | boolean;
}

export interface MigratedRows {
  markers: Record<string, Cell>[];
  private: Record<string, Cell>[];
  report: {
    markers: number;
    owners: number;
    orphans: string[];
    logos: number;
    /** Raw 2.0 version values that became "Other", with counts. */
    unmappedVersions: Record<string, number>;
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

/** A 2.0 timestamp as ISO 8601 UTC, or "" when missing or zero. */
export function legacyDate(value: string | null): string {
  const v = text(value);
  if (!v || v.startsWith("0000-00-00")) return "";
  const date = new Date(v.includes("T") ? v : `${v.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/**
 * Maps a 2.0 version to a versions-tab entry by its leading major.minor
 * ("2.4.2", "v2.4", "2.4-SNAPSHOT", "2.4.0 Build abc" all give "2.4"); anything else is
 * "Other". Blank and "Unknown" stay blank.
 */
export function normaliseVersion(raw: string | null, versions: string[]): string {
  const v = text(raw);
  if (!v || v.toLowerCase() === "unknown") return "";
  const match = /^v?(\d+\.\d+)/i.exec(v);
  return match && versions.includes(match[1]!) ? match[1]! : OTHER_VERSION;
}

/**
 * Owner: the first auth principal with ALL privileges, else created_by, else blank.
 * Editors: every other person principal. Module principals (UUIDs) are dropped.
 */
export function ownership(
  marker: Pick<Atlas2Marker, "created_by">,
  auth: Atlas2Auth[],
): { owner: string; editors: string[] } {
  const people = [...auth]
    .sort((a, b) => a.id - b.id)
    .filter((a) => text(a.principal) && !UUID.test(text(a.principal)));
  const owner =
    text(people.find((a) => text(a.privileges).toUpperCase() === "ALL")?.principal) ||
    text(marker.created_by);
  const editors = [...new Set(people.map((a) => text(a.principal)))].filter((p) => p !== owner);
  return { owner, editors };
}

export function migrateAtlas2(
  data: { atlas: Atlas2Marker[]; auth: Atlas2Auth[]; distributions: Atlas2Distribution[] },
  versions: string[],
  logoUrl: (id: string) => string,
): MigratedRows {
  const distributionNames = new Map(data.distributions.map((d) => [d.id, d.name]));
  const authByMarker = new Map<string, Atlas2Auth[]>();
  for (const a of data.auth) {
    authByMarker.set(a.atlas_id, [...(authByMarker.get(a.atlas_id) ?? []), a]);
  }

  const report: MigratedRows["report"] = {
    markers: 0,
    owners: 0,
    orphans: [],
    logos: 0,
    unmappedVersions: {},
  };
  const owners = new Set<string>();
  const markers: Record<string, Cell>[] = [];
  const privateRows: Record<string, Cell>[] = [];

  for (const m of data.atlas) {
    const changed = legacyDate(m.date_changed);
    const created = legacyDate(m.date_created) || changed;
    const version = normaliseVersion(m.openmrs_version, versions);
    if (version === OTHER_VERSION) {
      const raw = text(m.openmrs_version);
      report.unmappedVersions[raw] = (report.unmappedVersions[raw] ?? 0) + 1;
    }
    const hasLogo = !!m.image && m.image.length > 0;
    if (hasLogo) report.logos++;

    markers.push({
      id: m.id,
      name: text(m.name),
      organisation: "",
      latitude: Number(m.latitude),
      longitude: Number(m.longitude),
      type: text(m.type),
      distribution: m.distribution === null ? "" : (distributionNames.get(m.distribution) ?? ""),
      openmrs_version: version,
      site_count: "",
      url: text(m.url),
      logo_url: hasLogo ? logoUrl(m.id) : "",
      notes: text(m.notes),
      created_at: created,
      updated_at: changed,
      confirmed_at: changed,
      status: "active",
    });

    const { owner, editors } = ownership(m, authByMarker.get(m.id) ?? []);
    if (owner) owners.add(owner);
    else report.orphans.push(m.id);
    privateRows.push({
      id: m.id,
      owner,
      editors: editors.join(", "),
      contact_name: text(m.contact),
      contact_email: text(m.email),
    });
  }

  report.markers = markers.length;
  report.owners = owners.size;
  return { markers, private: privateRows, report };
}
