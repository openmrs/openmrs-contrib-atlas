import { auth, sheets as sheetsApi, type sheets_v4 } from "@googleapis/sheets";
import { TABS, type Cell, type Problem } from "@openmrs-atlas/shared";
import type { CellUpdate, EditStore, EditValues } from "./edits.ts";
import type { SheetStore, SheetValues } from "./publish.ts";

export function sheetsClient(): sheets_v4.Sheets {
  return sheetsApi({
    version: "v4",
    auth: new auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets"] }),
  });
}

const READ_TABS = [TABS.markers, TABS.types, TABS.distributions, TABS.versions] as const;
const EDIT_TABS = [TABS.private, TABS.pending] as const;

/** A1 column letters from a 0-based index. */
function columnLetter(index: number): string {
  const rest = Math.floor(index / 26);
  return (rest > 0 ? columnLetter(rest - 1) : "") + String.fromCharCode(65 + (index % 26));
}

/** The Atlas sheet, read in one call. Dates come back as serial numbers, text as typed. */
export function googleSheetStore(
  spreadsheetId: string,
  client: sheets_v4.Sheets = sheetsClient(),
): SheetStore & EditStore {
  async function batchRead(ranges: readonly string[]): Promise<Cell[][][]> {
    const { data } = await client.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [...ranges],
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
    return ranges.map((_, i) => (data.valueRanges?.[i]?.values ?? []) as Cell[][]);
  }

  return {
    async read(): Promise<SheetValues> {
      const [markers, types, distributions, versions] = await batchRead(READ_TABS);
      return {
        markers: markers!,
        types: types!,
        distributions: distributions!,
        versions: versions!,
      };
    },

    async readEdits(): Promise<EditValues> {
      const [markers, types, distributions, versions, priv, pending] = await batchRead([
        ...READ_TABS,
        ...EDIT_TABS,
      ]);
      return {
        markers: markers!,
        types: types!,
        distributions: distributions!,
        versions: versions!,
        private: priv!,
        pending: pending!,
      };
    },

    // RAW throughout: text from a form is stored as typed, and "=1+1" never becomes a formula.
    async appendRow(tab, cells) {
      await client.spreadsheets.values.append({
        spreadsheetId,
        range: `${TABS[tab]}!A:A`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [cells] },
      });
    },

    async updateCells(updates: CellUpdate[]) {
      await client.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: updates.map((u) => ({
            range: `${TABS[u.tab]}!${columnLetter(u.column)}${u.row}`,
            values: [[u.value]],
          })),
        },
      });
    },

    async clearRow(tab, row) {
      await client.spreadsheets.values.clear({
        spreadsheetId,
        range: `${TABS[tab]}!${row}:${row}`,
      });
    },

    async readCell(tab, row, column) {
      const { data } = await client.spreadsheets.values.get({
        spreadsheetId,
        range: `${TABS[tab]}!${columnLetter(column)}${row}`,
        valueRenderOption: "UNFORMATTED_VALUE",
      });
      return data.values?.[0]?.[0] as Cell;
    },

    async writeProblems(problems: Problem[]) {
      await client.spreadsheets.values.clear({ spreadsheetId, range: `${TABS.problems}!A2:C` });
      if (problems.length === 0) return;
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `${TABS.problems}!A2`,
        valueInputOption: "RAW",
        requestBody: {
          values: problems.map((p) => [p.markerId ?? "", p.row || "", p.reasons.join("; ")]),
        },
      });
    },
  };
}
