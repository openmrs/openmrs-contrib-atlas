import { text, toRawRows, type RawRow } from "./rows.ts";
import {
  COLUMNS,
  MARKER_STATUSES,
  OTHER_VERSION,
  type Cell,
  type Lookups,
  type Marker,
  type MarkerStatus,
  type Problem,
} from "./schema.ts";

export interface ValidationResult {
  /** Valid markers in sheet order, any status. */
  markers: Marker[];
  problems: Problem[];
}

const DATE_FIELDS = ["created_at", "updated_at", "confirmed_at"] as const;

/** Validates the markers tab against the lookups. See openspec specs/marker-data. */
export function validateMarkers(values: Cell[][], lookups: Lookups): ValidationResult {
  const rows = toRawRows(values, COLUMNS.markers);
  const types = new Set(lookups.types.map((t) => t.name));
  const distributions = new Set(lookups.distributions.map((d) => d.name));
  const versions = new Set([...lookups.versions.map((v) => v.version), OTHER_VERSION]);

  const idCounts = new Map<string, number>();
  for (const { cells } of rows) {
    const id = text(cells.id);
    if (id) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }

  const markers: Marker[] = [];
  const problems: Problem[] = [];
  for (const raw of rows) {
    const { marker, reasons } = checkRow(raw, { types, distributions, versions });
    const id = text(raw.cells.id);
    if (id && (idCounts.get(id) ?? 0) > 1) reasons.push("duplicate id");
    if (reasons.length > 0 || !marker) {
      problems.push({ markerId: id || undefined, row: raw.row, reasons });
    } else {
      markers.push(marker);
    }
  }
  return { markers, problems };
}

interface Allowed {
  types: Set<string>;
  distributions: Set<string>;
  versions: Set<string>;
}

function checkRow({ cells }: RawRow, allowed: Allowed): { marker?: Marker; reasons: string[] } {
  const reasons: string[] = [];
  const field = (name: string) => text(cells[name]);

  for (const name of ["id", "name", "latitude", "longitude", "type", "status"]) {
    if (!field(name)) reasons.push(`${name} is required`);
  }

  const latitude = coordinate(cells.latitude, "latitude", 90, reasons);
  const longitude = coordinate(cells.longitude, "longitude", 180, reasons);

  const type = field("type");
  if (type && !allowed.types.has(type)) reasons.push(`unknown type: ${type}`);

  const distribution = field("distribution");
  if (distribution && !allowed.distributions.has(distribution)) {
    reasons.push(`unknown distribution: ${distribution}`);
  }

  const version = field("openmrs_version");
  if (version && !allowed.versions.has(version)) {
    reasons.push(`unknown openmrs_version: ${version}`);
  }

  let siteCount: number | undefined;
  const siteCountText = field("site_count");
  if (siteCountText) {
    const n = Number(siteCountText);
    if (!Number.isInteger(n)) reasons.push("site_count must be a whole number");
    else if (n < 1) reasons.push("site_count must be 1 or more");
    else siteCount = n;
  }

  for (const name of ["url", "logo_url"]) {
    const value = field(name);
    if (value && !isHttpUrl(value)) reasons.push(`${name} must be an http or https URL`);
  }

  const status = field("status");
  if (status && !(MARKER_STATUSES as readonly string[]).includes(status)) {
    reasons.push(`unknown status: ${status}`);
  }

  const dates: Partial<Record<(typeof DATE_FIELDS)[number], string>> = {};
  for (const name of DATE_FIELDS) {
    if (!field(name)) continue;
    const iso = toIsoDate(cells[name]);
    if (iso) dates[name] = iso;
    else reasons.push(`${name} must be a date`);
  }

  if (reasons.length > 0) return { reasons };
  return {
    reasons,
    marker: {
      id: field("id"),
      name: field("name"),
      organisation: field("organisation") || undefined,
      latitude: latitude!,
      longitude: longitude!,
      type,
      distribution: distribution || undefined,
      openmrs_version: version || undefined,
      site_count: siteCount,
      url: field("url") || undefined,
      logo_url: field("logo_url") || undefined,
      notes: field("notes") || undefined,
      ...dates,
      status: status as MarkerStatus,
    },
  };
}

function coordinate(cell: Cell, name: string, limit: number, reasons: string[]) {
  if (text(cell) === "") return undefined;
  const n = Number(cell);
  if (!Number.isFinite(n)) {
    reasons.push(`${name} must be a number`);
    return undefined;
  }
  if (n < -limit || n > limit) {
    reasons.push(`${name} must be between -${limit} and ${limit}`);
    return undefined;
  }
  return n;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Days between the spreadsheet epoch (1899-12-30) and the Unix epoch. */
const SHEETS_EPOCH_OFFSET_DAYS = 25569;
const MS_PER_DAY = 86_400_000;

/**
 * An ISO 8601 UTC timestamp from ISO text or a spreadsheet date serial number
 * (what Sheets returns for a date cell with UNFORMATTED_VALUE).
 */
export function toIsoDate(cell: Cell): string | undefined {
  if (typeof cell === "number") {
    const ms = (cell - SHEETS_EPOCH_OFFSET_DAYS) * MS_PER_DAY;
    return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
  }
  const value = text(cell);
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return undefined;
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
