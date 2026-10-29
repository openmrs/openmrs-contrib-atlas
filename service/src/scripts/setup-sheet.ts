/**
 * Prepares a Google Sheet for Atlas: creates any missing tabs, writes header rows,
 * formats text-only columns as plain text, and seeds empty lookup tabs.
 * Safe to re-run; existing data rows are never changed.
 *
 *   npm run setup:sheet -- <spreadsheet-id> [--sample]
 *
 * --sample also adds the sample test markers when the markers tab is empty.
 * Credentials: Application Default Credentials with the Sheets scope (see README).
 */
import { auth, sheets as sheetsApi } from "@googleapis/sheets";
import { COLUMNS, TABS, TEXT_COLUMNS, type Cell } from "@openmrs-atlas/shared";
import { SAMPLE_MARKERS, SEED_LOOKUPS } from "@openmrs-atlas/shared/seed";

type Tab = keyof typeof TABS;

const [spreadsheetId, ...flags] = process.argv.slice(2);
if (!spreadsheetId) {
  console.error("usage: npm run setup:sheet -- <spreadsheet-id> [--sample]");
  process.exit(1);
}
const withSamples = flags.includes("--sample");

const client = sheetsApi({
  version: "v4",
  auth: new auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets"] }),
});

async function existingTabs() {
  const { data } = await client.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  return new Map((data.sheets ?? []).map((s) => [s.properties!.title!, s.properties!.sheetId!]));
}

async function main() {
  let tabs = await existingTabs();
  const wanted = Object.values(TABS);
  const missing = wanted.filter((t) => !tabs.has(t));

  // A new spreadsheet has one empty "Sheet1"; reuse it rather than leave it behind.
  const requests: object[] = [];
  const spare = tabs.get("Sheet1");
  if (spare !== undefined && missing.length > 0) {
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: spare, title: missing.shift() },
        fields: "title",
      },
    });
  }
  for (const title of missing) requests.push({ addSheet: { properties: { title } } });
  if (requests.length > 0) {
    await client.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    tabs = await existingTabs();
  }

  // Header rows, bold and frozen; text-only columns formatted as plain text.
  const format: object[] = [];
  const data: { range: string; values: Cell[][] }[] = [];
  for (const [key, title] of Object.entries(TABS) as [Tab, string][]) {
    const sheetId = tabs.get(title)!;
    const columns = COLUMNS[key];
    data.push({ range: `${title}!A1`, values: [[...columns]] });
    format.push(
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: "userEnteredFormat.textFormat.bold",
        },
      },
      {
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: "gridProperties.frozenRowCount",
        },
      },
    );
    columns.forEach((column, index) => {
      if (!TEXT_COLUMNS.has(column)) return;
      format.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, startColumnIndex: index, endColumnIndex: index + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: "TEXT" } } },
          fields: "userEnteredFormat.numberFormat",
        },
      });
    });
  }
  await client.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: format } });
  await client.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data },
  });

  // Seed lookups (and optionally sample markers) only into empty tabs.
  const seeds: Partial<Record<Tab, Cell[][]>> = { ...SEED_LOOKUPS };
  if (withSamples) {
    seeds.markers = SAMPLE_MARKERS.map((m) => COLUMNS.markers.map((c) => m[c] ?? ""));
  }
  for (const [key, rows] of Object.entries(seeds) as [Tab, Cell[][]][]) {
    const title = TABS[key];
    const { data: current } = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${title}!A2:A`,
    });
    if ((current.values ?? []).length > 0) {
      console.log(`${title}: has data, left as is`);
      continue;
    }
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A2`,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });
    console.log(`${title}: seeded ${rows.length} rows`);
  }

  console.log(`tabs: ${[...(await existingTabs()).keys()].join(", ")}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
