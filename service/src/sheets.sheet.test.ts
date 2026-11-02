import { COLUMNS } from "@openmrs-atlas/shared";
import { describe, expect, it } from "vitest";
import { googleSheetStore, sheetsClient } from "./sheets.ts";

// Opt-in: runs against the developer's test sheet (`npm run test:sheet`), never in CI.
const sheetId = process.env.TEST_SHEET_ID;

describe.skipIf(!sheetId)("googleSheetStore against the test sheet", () => {
  const store = googleSheetStore(sheetId!);

  it("reads every tab the publisher needs, header first", async () => {
    const values = await store.read();
    expect(values.markers[0]).toEqual([...COLUMNS.markers]);
    expect(values.types[0]).toEqual([...COLUMNS.types]);
    expect(values.distributions[0]).toEqual([...COLUMNS.distributions]);
    expect(values.versions[0]).toEqual([...COLUMNS.versions]);
    // Plain-text formatting keeps "1.10" as text rather than the number 1.1.
    expect(values.versions.flat()).toContain("1.10");
  });

  it("appends, updates, reads back and clears rows, storing text literally", async () => {
    const formula = '=IMPORTXML("http://example.org","//a")';
    const before = (await store.readEdits()).pending.length;
    await store.appendRow("pending", ["test-marker", formula, "1.10", "", ""]);
    const added = await store.readEdits();
    const row = added.pending.length;
    expect(row).toBeGreaterThan(before);
    expect(added.pending[row - 1]?.slice(0, 3)).toEqual(["test-marker", formula, "1.10"]);

    await store.updateCells([{ tab: "pending", row, column: 2, value: "=1+1" }]);
    expect(await store.readCell("pending", row, 2)).toBe("=1+1");

    await store.clearRow("pending", row);
    expect(await store.readCell("pending", row, 0)).toBeUndefined();
  });

  it("reads the private tab for editing, header first", async () => {
    const values = await store.readEdits();
    expect(values.private[0]).toEqual([...COLUMNS.private]);
    expect(values.pending[0]).toEqual([...COLUMNS.pending]);
  });

  it("replaces the problems tab", async () => {
    await store.writeProblems([{ markerId: "test-id", row: 7, reasons: ["a", "b"] }]);
    const { data } = await sheetsClient().spreadsheets.values.get({
      spreadsheetId: sheetId!,
      range: "problems!A2:C",
    });
    expect(data.values).toEqual([["test-id", "7", "a; b"]]);
    await store.writeProblems([]);
    const after = await sheetsClient().spreadsheets.values.get({
      spreadsheetId: sheetId!,
      range: "problems!A2:C",
    });
    expect(after.data.values ?? []).toEqual([]);
  });
});
