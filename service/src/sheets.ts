import { auth, sheets as sheetsApi, type sheets_v4 } from "@googleapis/sheets";
import { TABS, type Cell, type Problem } from "@openmrs-atlas/shared";
import type { SheetStore, SheetValues } from "./publish.ts";

export function sheetsClient(): sheets_v4.Sheets {
  return sheetsApi({
    version: "v4",
    auth: new auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets"] }),
  });
}

const READ_TABS = [TABS.markers, TABS.types, TABS.distributions, TABS.versions] as const;

/** The Atlas sheet, read in one call. Dates come back as serial numbers, text as typed. */
export function googleSheetStore(
  spreadsheetId: string,
  client: sheets_v4.Sheets = sheetsClient(),
): SheetStore {
  return {
    async read(): Promise<SheetValues> {
      const { data } = await client.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: [...READ_TABS],
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "SERIAL_NUMBER",
      });
      const [markers, types, distributions, versions] = READ_TABS.map(
        (_, i) => (data.valueRanges?.[i]?.values ?? []) as Cell[][],
      );
      return {
        markers: markers!,
        types: types!,
        distributions: distributions!,
        versions: versions!,
      };
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
