import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { COLUMNS } from "@openmrs-atlas/shared";
import { describe, expect, it } from "vitest";

// Apps Script files share one global scope; load Code.js the same way.
type Plan = {
  idColumn: number;
  updatedColumn: number;
  ids: string[][];
  updated: string[][];
  changes: { markerId: string; action: string; fields: string[] }[];
};
const context: {
  planMarkerEdit?: (
    header: string[],
    rows: unknown[][],
    start: number,
    count: number,
    now: string,
    newId: () => string,
  ) => Plan;
} = {};
runInNewContext(readFileSync(resolve(import.meta.dirname, "Code.js"), "utf8"), context);
const plan = context.planMarkerEdit!;

const header: string[] = [...COLUMNS.markers];
const col = (name: string) => header.indexOf(name) + 1;
const NOW = "2026-11-01T12:00:00.000Z";
const row = (values: Record<string, unknown>) => header.map((h) => values[h] ?? "");

describe("planMarkerEdit (Edit tracking in the sheet)", () => {
  it("Scenario: Admin corrects a website", () => {
    const result = plan(
      header,
      [row({ id: "m1", name: "Site", url: "https://new.example" })],
      col("url"),
      1,
      NOW,
      () => "unused",
    );
    expect(result.updatedColumn).toBe(col("updated_at"));
    expect(result.updated).toEqual([[NOW]]);
    expect(result.ids).toEqual([["m1"]]);
    expect(result.changes).toEqual([{ markerId: "m1", action: "edit", fields: ["url"] }]);
  });

  it("Scenario: Admin adds a row without an id", () => {
    const result = plan(header, [row({ name: "New site" })], col("name"), 1, NOW, () => "uuid-1");
    expect(result.idColumn).toBe(col("id"));
    expect(result.ids).toEqual([["uuid-1"]]);
    expect(result.changes[0]).toEqual({ markerId: "uuid-1", action: "add", fields: ["name"] });
  });

  it("handles a multi-row, multi-column paste and leaves blank rows alone", () => {
    const result = plan(
      header,
      [row({ id: "a", name: "A" }), row({}), row({ id: "b", name: "B" })],
      col("name"),
      3,
      NOW,
      () => "x",
    );
    expect(result.ids).toEqual([["a"], [""], ["b"]]);
    expect(result.updated).toEqual([[NOW], [""], [NOW]]);
    expect(result.changes.map((c) => c.markerId)).toEqual(["a", "b"]);
    expect(result.changes[0]?.fields).toEqual(["name", "organisation", "latitude"]);
  });
});
