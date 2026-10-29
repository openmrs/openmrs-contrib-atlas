import { describe, expect, it } from "vitest";
import { lookupValues, markerRow, markerValues } from "./fixtures.ts";
import { parseLookups, parsePrivateRows, toRawRows } from "./rows.ts";
import { COLUMNS } from "./schema.ts";

describe("toRawRows", () => {
  it("keys cells by header and numbers rows from the sheet", () => {
    const rows = toRawRows(markerValues(markerRow()), COLUMNS.markers);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.row).toBe(2);
    expect(rows[0]?.cells.name).toBe("Example Hospital");
  });

  it("finds columns by header regardless of order", () => {
    const rows = toRawRows(
      [
        ["name", "id"],
        ["A", "1"],
      ],
      ["id", "name"],
    );
    expect(rows[0]?.cells).toEqual({ name: "A", id: "1" });
  });

  it("skips fully blank rows but keeps sheet row numbers", () => {
    const rows = toRawRows([["id"], [""], [null], ["x"]], ["id"]);
    expect(rows.map((r) => r.row)).toEqual([4]);
  });

  it("rejects a tab with missing columns", () => {
    expect(() => toRawRows([["id"]], ["id", "name"])).toThrow("missing columns: name");
  });
});

describe("parseLookups", () => {
  it("reads types sorted by sort order, distributions and versions", () => {
    const lookups = parseLookups(lookupValues);
    expect(lookups.types.map((t) => t.name)).toEqual(["Clinical", "Research", "Other"]);
    expect(lookups.distributions[0]).toEqual({
      name: "Bahmni",
      url: "https://www.bahmni.org",
      is_standard: true,
    });
    expect(lookups.distributions[2]?.is_standard).toBe(false);
    expect(lookups.versions.map((v) => v.version)).toEqual(["1.10", "2.4"]);
  });
});

describe("parsePrivateRows", () => {
  it("splits editors and drops blanks", () => {
    const rows = parsePrivateRows([
      [...COLUMNS.private],
      ["m1", "jdoe", "asmith, bwong", "Jane Doe", "jane@example.org"],
      ["m2", "", "", "", ""],
    ]);
    expect(rows[0]).toEqual({
      id: "m1",
      owner: "jdoe",
      editors: ["asmith", "bwong"],
      contact_name: "Jane Doe",
      contact_email: "jane@example.org",
    });
    expect(rows[1]).toEqual({ id: "m2", editors: [] });
  });
});
