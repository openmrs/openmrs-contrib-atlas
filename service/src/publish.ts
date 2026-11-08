import {
  buildSnapshot,
  checkPublishSafety,
  parseLookups,
  toCsv,
  toGeoJson,
  toRss,
  validateMarkers,
  type Cell,
  type Problem,
} from "@openmrs-atlas/shared";
import { refreshCards, type CardOptions, type CardStore } from "./cards/refresh.ts";

/** The tabs a publish reads, as the Sheets API returns them (header row first). */
export interface SheetValues {
  markers: Cell[][];
  types: Cell[][];
  distributions: Cell[][];
  versions: Cell[][];
  /** The change log, for the feed. Only the time, marker and kind of each change are used. */
  changes: Cell[][];
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
  /** `siteUrl` is the public site, for links in the feed. */
  options: {
    force: boolean;
    now: Date;
    siteUrl: string;
    /** Social cards to bring up to date after a successful publish (specs/social-cards). */
    cards?: { store: CardStore } & Omit<CardOptions, "siteUrl">;
  },
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
    {
      name: "rss.xml",
      body: toRss(snapshot, values.changes, options.siteUrl),
      contentType: "application/rss+xml; charset=utf-8",
    },
    { name: `history/atlas-${stamp}.json`, body: json, contentType: "application/json" },
  ]);
  await sheet.writeProblems(problems);
  if (options.cards) {
    // Cards never hold up or undo a publish; what's missed is drawn next time.
    try {
      const { store, ...cardOptions } = options.cards;
      const result = await refreshCards(snapshot, store, {
        ...cardOptions,
        siteUrl: options.siteUrl,
      });
      console.log(JSON.stringify({ event: "cards", ...result }));
    } catch (err) {
      console.error(JSON.stringify({ event: "cards-failed", error: String(err) }));
    }
  }
  return { status: "published", markers: snapshot.markers.length, problems: problems.length };
}
