import type { Cell, Distribution, Lookups, MarkerType, PrivateRow, Version } from "./schema.ts";

/** A data row keyed by header name, with its 1-based sheet row number. */
export interface RawRow {
  row: number;
  cells: Record<string, Cell>;
}

/**
 * Turns a tab's values (header row first) into rows keyed by header name.
 * Columns are found by header, so column order in the sheet does not matter.
 * Fully blank rows are skipped.
 */
export function toRawRows(values: Cell[][], required: readonly string[]): RawRow[] {
  const [header = [], ...data] = values;
  const names = header.map((h) => text(h));
  const missing = required.filter((col) => !names.includes(col));
  if (missing.length > 0) {
    throw new Error(`missing columns: ${missing.join(", ")}`);
  }
  const rows: RawRow[] = [];
  data.forEach((cells, i) => {
    if (cells.every((c) => text(c) === "")) return;
    const record: Record<string, Cell> = {};
    names.forEach((name, col) => {
      if (name) record[name] = cells[col];
    });
    rows.push({ row: i + 2, cells: record });
  });
  return rows;
}

/** A cell as trimmed text; blank, null and undefined become "". */
export function text(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).trim();
}

function optional(cell: Cell): string | undefined {
  return text(cell) || undefined;
}

function bool(cell: Cell): boolean {
  if (typeof cell === "boolean") return cell;
  return ["true", "yes", "1"].includes(text(cell).toLowerCase());
}

export function parseLookups(values: {
  types: Cell[][];
  distributions: Cell[][];
  versions: Cell[][];
}): Lookups {
  const types: MarkerType[] = toRawRows(values.types, ["name", "colour", "sort"]).map(
    ({ cells }) => ({
      name: text(cells.name),
      colour: text(cells.colour),
      sort: Number(cells.sort) || 0,
    }),
  );
  const distributions: Distribution[] = toRawRows(values.distributions, [
    "name",
    "url",
    "is_standard",
  ]).map(({ cells }) => ({
    name: text(cells.name),
    url: optional(cells.url),
    is_standard: bool(cells.is_standard),
  }));
  const versions: Version[] = toRawRows(values.versions, ["version", "release_date"]).map(
    ({ cells }) => ({ version: text(cells.version), release_date: optional(cells.release_date) }),
  );
  types.sort((a, b) => a.sort - b.sort);
  return { types, distributions, versions };
}

export function parsePrivateRows(values: Cell[][]): PrivateRow[] {
  return toRawRows(values, ["id", "owner", "editors", "contact_name", "contact_email"]).map(
    ({ cells }) => ({
      id: text(cells.id),
      owner: optional(cells.owner),
      editors: text(cells.editors)
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
      contact_name: optional(cells.contact_name),
      contact_email: optional(cells.contact_email),
    }),
  );
}
