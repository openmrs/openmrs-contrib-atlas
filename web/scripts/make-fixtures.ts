/**
 * Builds snapshot fixtures with the same code the publisher uses, so their format stays true.
 *
 *   npm run fixtures -w web            sample data for `npm run dev` (dev-data/atlas.json)
 *                                      and end-to-end test data (e2e/static/atlas.json)
 *   npm run fixtures -w web -- --live  also: dev-data/live.json from the public Atlas 2.0 API,
 *                                      for trying the map with ~450 real markers (git-ignored)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildSnapshot,
  COLUMNS,
  parseLookups,
  validateMarkers,
  type Cell,
} from "@openmrs-atlas/shared";
import { SAMPLE_MARKERS, SEED_LOOKUPS } from "@openmrs-atlas/shared/seed";

const lookups = parseLookups({
  types: [[...COLUMNS.types], ...SEED_LOOKUPS.types],
  distributions: [[...COLUMNS.distributions], ...SEED_LOOKUPS.distributions],
  versions: [[...COLUMNS.versions], ...SEED_LOOKUPS.versions],
});

function snapshotFrom(rows: Record<string, Cell>[], now: Date) {
  const values = [[...COLUMNS.markers], ...rows.map((r) => COLUMNS.markers.map((c) => r[c] ?? ""))];
  const { markers, problems } = validateMarkers(values, lookups);
  return { snapshot: buildSnapshot(markers, lookups, now), problems };
}

async function write(path: string, data: unknown) {
  const file = resolve(import.meta.dirname, "..", path);
  await mkdir(resolve(file, ".."), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`wrote ${path}`);
}

/** End-to-end markers. Tests run with the clock fixed at 2026-11-01. */
const E2E_MARKERS: Record<string, Cell>[] = [
  {
    id: "e2e00000-0000-4000-8000-000000000001",
    name: "Kampala Rollout",
    organisation: "Uganda Health Partners",
    latitude: 0.3476,
    longitude: 32.5825,
    type: "Clinical",
    distribution: "OpenMRS 1.x",
    openmrs_version: "1.10",
    site_count: 50,
    confirmed_at: "2026-01-01",
    status: "active",
  },
  {
    id: "e2e00000-0000-4000-8000-000000000002",
    name: "Makerere Research Clinic",
    latitude: 0.35,
    longitude: 32.59,
    type: "Research",
    distribution: "KenyaEMR",
    openmrs_version: "2.4",
    confirmed_at: "2025-09-01",
    status: "active",
  },
  {
    id: "e2e00000-0000-4000-8000-000000000003",
    name: "Entebbe Road Health Centres",
    latitude: 0.34,
    longitude: 32.57,
    type: "Clinical",
    site_count: 3,
    confirmed_at: "2018-01-01",
    status: "active",
  },
  {
    id: "e2e00000-0000-4000-8000-000000000004",
    name: "Nairobi Teaching Hospital",
    organisation: "Kenya Research Network",
    latitude: -1.2921,
    longitude: 36.8219,
    type: "Research",
    distribution: "Bahmni",
    openmrs_version: "2.4",
    url: "https://example.org/nairobi",
    notes: "Details at https://example.org/about. <script>window.hacked = true</script>",
    confirmed_at: "2025-06-01",
    status: "active",
  },
  {
    id: "e2e00000-0000-4000-8000-000000000005",
    name: "Kathmandu Development Lab",
    latitude: 27.7172,
    longitude: 85.324,
    type: "Development",
    distribution: "Bahmni",
    openmrs_version: "Other",
    confirmed_at: "2017-11-01",
    status: "active",
  },
  {
    id: "e2e00000-0000-4000-8000-000000000006",
    name: "Clínica Nuevas Raíces",
    organisation: "Partners In Health",
    latitude: -12.0464,
    longitude: -77.0428,
    type: "Evaluation",
    distribution: "Reference Application 2.x",
    openmrs_version: "2.2",
    confirmed_at: "2023-05-01",
    status: "active",
  },
  {
    id: "e2e00000-0000-4000-8000-000000000007",
    name: "Port-au-Prince O3 Pilot",
    latitude: 18.5944,
    longitude: -72.3074,
    type: "Clinical",
    distribution: "Reference Application 3.x (O3)",
    openmrs_version: "3.8",
    confirmed_at: "2026-06-01",
    status: "active",
  },
  {
    id: "e2e00000-0000-4000-8000-000000000008",
    name: "Boston Training Server",
    latitude: 42.36,
    longitude: -71.06,
    type: "Other",
    confirmed_at: "2026-09-01",
    status: "active",
  },
];

/** Maps an Atlas 2.0 /api/markers row to a sheet row (public fields only). */
function fromAtlas2(m: Record<string, unknown>): Record<string, Cell> {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const date = (v: unknown) => (s(v).startsWith("0000") ? "" : s(v));
  return {
    id: s(m.id),
    name: s(m.name),
    latitude: s(m.latitude),
    longitude: s(m.longitude),
    type: s(m.type),
    url: s(m.url).startsWith("http") ? s(m.url) : "",
    notes: s(m.notes),
    created_at: date(m.date_created),
    updated_at: date(m.date_changed),
    confirmed_at: date(m.date_changed),
    status: "active",
  };
}

async function main() {
  const fixed = new Date("2026-11-01T00:00:00Z");
  await write("dev-data/atlas.json", snapshotFrom(SAMPLE_MARKERS, fixed).snapshot);
  await write("e2e/static/atlas.json", snapshotFrom(E2E_MARKERS, fixed).snapshot);

  if (process.argv.includes("--live")) {
    const res = await fetch("https://atlas.openmrs.org/api/markers");
    const rows = ((await res.json()) as Record<string, unknown>[]).map(fromAtlas2);
    const { snapshot, problems } = snapshotFrom(rows, new Date());
    await write("dev-data/live.json", snapshot);
    console.log(
      `live: ${snapshot.markers.length} markers, ${problems.length} invalid rows skipped`,
    );
  }
}

await main();
