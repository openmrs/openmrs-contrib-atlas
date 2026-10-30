import {
  buildSnapshot,
  checkPublishSafety,
  parseLookups,
  toCsv,
  toGeoJson,
  validateMarkers,
  type Cell,
  type Problem,
} from "@openmrs-atlas/shared";

/** The tabs a publish reads, as the Sheets API returns them (header row first). */
export interface SheetValues {
  markers: Cell[][];
  types: Cell[][];
  distributions: Cell[][];
  versions: Cell[][];
}

export interface SheetStore {
  read(): Promise<SheetValues>;
  writeProblems(problems: Problem[]): Promise<void>;
}

export interface PublicFile {
  name: string;
  body: string;
  contentType: string;
}

export interface SnapshotStore {
  /** Markers in the currently published atlas.json, or undefined if none is published. */
  currentCount(): Promise<number | undefined>;
  /** Writes public files; each is served with short caching. */
  write(files: PublicFile[]): Promise<void>;
}

export type PublishResult =
  | { status: "published"; markers: number; problems: number }
  | { status: "refused"; reason: string; problems: number };

/**
 * Validates the sheet and publishes the snapshot files. See specs/snapshot-publishing.
 * The problems tab is always rewritten, whether or not the publish goes ahead.
 */
export async function publish(
  sheet: SheetStore,
  snapshots: SnapshotStore,
  options: { force: boolean; now: Date },
): Promise<PublishResult> {
  const values = await sheet.read();
  const lookups = parseLookups(values);
  const { markers, problems } = validateMarkers(values.markers, lookups);
  const snapshot = buildSnapshot(markers, lookups, options.now);

  const safety = checkPublishSafety(
    await snapshots.currentCount(),
    snapshot.markers.length,
    options.force,
  );
  if (!safety.ok) {
    await sheet.writeProblems([{ row: 0, reasons: [safety.reason] }, ...problems]);
    return { status: "refused", reason: safety.reason, problems: problems.length };
  }

  const json = JSON.stringify(snapshot);
  const stamp = options.now.toISOString().replace(/[:.]/g, "-");
  await snapshots.write([
    { name: "atlas.json", body: json, contentType: "application/json" },
    {
      name: "markers.geojson",
      body: JSON.stringify(toGeoJson(snapshot)),
      contentType: "application/geo+json",
    },
    { name: "markers.csv", body: toCsv(snapshot), contentType: "text/csv; charset=utf-8" },
    { name: `history/atlas-${stamp}.json`, body: json, contentType: "application/json" },
  ]);
  await sheet.writeProblems(problems);
  return { status: "published", markers: snapshot.markers.length, problems: problems.length };
}
