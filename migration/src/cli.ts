/**
 * Copies Atlas 2.0 (MySQL) into an Atlas 3.0 sheet. See migration/README.md and
 * openspec specs/legacy-migration.
 *
 *   npm run migrate -- --dry-run
 *   npm run migrate -- --sheet <spreadsheet-id> --data-dir <folder> --logo-base <address>
 *
 * Logos are written to <folder>/logos/, the Atlas's data folder or a copy of it, and their
 * `logo_url` is <address>/<id>.webp, such as https://atlas.openmrs.org/data/logos/<id>.webp.
 *
 * MYSQL_URL (default mysql://atlas:atlas@localhost:3306/atlasdb) names the 2.0 database,
 * which is only ever read.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { auth, sheets as sheetsApi } from "@googleapis/sheets";
import {
  COLUMNS,
  TABS,
  migrateAtlas2,
  parseLookups,
  validateMarkers,
  type Atlas2Auth,
  type Atlas2Distribution,
  type Atlas2Marker,
  type Cell,
} from "@openmrs-atlas/shared";
import { SEED_LOOKUPS } from "@openmrs-atlas/shared/seed";
import mysql from "mysql2/promise";
import { convertLogos } from "./logos.ts";

const { values: args } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    sheet: { type: "string" },
    "data-dir": { type: "string" },
    "logo-base": { type: "string" },
  },
});
const dryRun = args["dry-run"];
if (!dryRun && (!args.sheet || !args["data-dir"] || !args["logo-base"])) {
  console.error(
    "usage: npm run migrate -- --dry-run | --sheet <id> --data-dir <folder> --logo-base <address>",
  );
  process.exit(1);
}

const mysqlUrl = process.env.MYSQL_URL ?? "mysql://atlas:atlas@localhost:3306/atlasdb";
const logoBase = (args["logo-base"] ?? "<logo-base>").replace(/\/$/, "");
const logoUrl = (id: string) => `${logoBase}/${id}.webp`;

async function readAtlas2() {
  const db = await mysql.createConnection({ uri: mysqlUrl, dateStrings: true });
  try {
    // A read-only transaction: the 2.0 database cannot be changed by this script.
    await db.query("START TRANSACTION READ ONLY");
    const [atlas] = await db.query("SELECT * FROM atlas ORDER BY date_created, id");
    const [authRows] = await db.query("SELECT id, atlas_id, principal, privileges FROM auth");
    const [distributions] = await db.query("SELECT id, name, is_standard FROM distributions");
    const [types] = await db.query("SELECT name FROM types");
    await db.query("ROLLBACK");
    return {
      atlas: atlas as Atlas2Marker[],
      auth: authRows as Atlas2Auth[],
      distributions: distributions as Atlas2Distribution[],
      typeNames: (types as { name: string }[]).map((t) => t.name),
    };
  } finally {
    await db.end();
  }
}

/** Seed lookups, plus any 2.0 types or distributions the seed lacks. */
function lookupRows(data: Awaited<ReturnType<typeof readAtlas2>>) {
  const types = [...SEED_LOOKUPS.types];
  for (const name of data.typeNames) {
    if (!types.some((t) => t[0] === name)) types.push([name, "#9AA0A6", types.length + 1]);
  }
  const distributions = data.distributions.map((d): Cell[] => {
    const seed = SEED_LOOKUPS.distributions.find((s) => s[0] === d.name);
    return [d.name, seed?.[1] ?? ""];
  });
  for (const seed of SEED_LOOKUPS.distributions) {
    if (!distributions.some((d) => d[0] === seed[0])) distributions.push(seed);
  }
  return { types, distributions, versions: SEED_LOOKUPS.versions };
}

const toValues = (columns: readonly string[], rows: Record<string, Cell>[]) =>
  rows.map((r) => columns.map((c) => r[c] ?? ""));

async function main() {
  const data = await readAtlas2();
  // Before anything is written, so a dry run finds unreadable logos and they get no logo_url.
  const { logos, unreadable } = await convertLogos(data.atlas);
  for (const m of data.atlas) {
    if (!logos.has(m.id)) m.image = null;
  }
  const lookups = lookupRows(data);
  const versions = lookups.versions.map((v) => String(v[0]));
  const migrated = migrateAtlas2(data, versions, logoUrl);

  const parsed = parseLookups({
    types: [[...COLUMNS.types], ...lookups.types],
    distributions: [[...COLUMNS.distributions], ...lookups.distributions],
    versions: [[...COLUMNS.versions], ...lookups.versions],
  });
  const markerValues = toValues(COLUMNS.markers, migrated.markers);
  const { problems } = validateMarkers([[...COLUMNS.markers], ...markerValues], parsed);

  const { report } = migrated;
  console.log(`Atlas 2.0 → 3.0 migration${dryRun ? " (dry run: nothing written)" : ""}`);
  console.log(`  markers:            ${report.markers}`);
  console.log(`  owners:             ${report.owners}`);
  console.log(`  orphans (no owner): ${report.orphans.length}`);
  console.log(`  logos:              ${report.logos}`);
  console.log(`  unreadable logos:   ${unreadable.length}`);
  for (const u of unreadable) console.log(`    ${u.id}: ${u.reason}`);
  const unmapped = Object.entries(report.unmappedVersions);
  console.log(
    `  unmapped versions:  ${unmapped.reduce((n, [, c]) => n + c, 0)}` +
      (unmapped.length ? ` (${unmapped.map(([v, c]) => `"${v}" ×${c}`).join(", ")})` : ""),
  );
  console.log(`  failing validation: ${problems.length}`);
  for (const p of problems)
    console.log(`    ${p.markerId ?? `row ${p.row}`}: ${p.reasons.join("; ")}`);

  if (dryRun) return;

  const folder = join(args["data-dir"]!, "logos");
  await mkdir(folder, { recursive: true });
  for (const [id, logo] of logos) await writeFile(join(folder, `${id}.webp`), logo);
  console.log(`wrote ${report.logos} logos to ${folder}, served at ${logoBase}/`);

  const client = sheetsApi({
    version: "v4",
    auth: new auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets"] }),
  });
  const spreadsheetId = args.sheet!;
  const replace: [string, Cell[][]][] = [
    [TABS.markers, markerValues],
    [TABS.private, toValues(COLUMNS.private, migrated.private)],
    [TABS.types, lookups.types],
    [TABS.distributions, lookups.distributions],
    [TABS.versions, lookups.versions],
  ];
  await client.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: { ranges: replace.map(([tab]) => `${tab}!A2:ZZ`) },
  });
  await client.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: replace.map(([tab, values]) => ({ range: `${tab}!A2`, values })),
    },
  });
  await client.spreadsheets.values.append({
    spreadsheetId,
    range: `${TABS.changes}!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[new Date().toISOString(), "migration", "", "import", `${report.markers} markers`]],
    },
  });
  console.log(`wrote ${report.markers} markers to sheet ${spreadsheetId}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
