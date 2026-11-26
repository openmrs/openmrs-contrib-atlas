import {
  buildSnapshot,
  checkPublishSafety,
  MissingColumnsError,
  parseLookups,
  toCsv,
  toGeoJson,
  toRss,
  validateMarkers,
  type Cell,
  type Problem,
} from "@openmrs-atlas/shared";
import { planLogoSweep, type LogoStore, type LogoSweepPlan } from "./logos.ts";
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
  /** Deletes history copies published before `before`; returns how many. */
  pruneHistory?(before: Date): Promise<number>;
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
    /**
     * Unused logos (specs/marker-editing). Every publish plans the sweep, so a hold-back stays in
     * `problems` while its cause remains; only the nightly one (`sweep`) deletes.
     */
    logos?: {
      store: Pick<LogoStore, "publicPrefix" | "listLogos" | "removeLogos">;
      sweep: boolean;
    };
    /** The nightly publish deletes history copies published before this (specs/snapshot-publishing). */
    history?: { before: Date };
  },
): Promise<PublishResult> {
  // Reads that don't depend on one another start together. The listing and the manifest are
  // only used later, so a failure there is caught where they're used.
  const later = <T>(promise: Promise<T>) => {
    promise.catch(() => undefined);
    return promise;
  };
  const listing = options.logos && later(options.logos.store.listLogos());
  const manifest = options.cards && later(options.cards.store.readManifest());
  const [values, current] = await Promise.all([sheet.read(), snapshots.currentCount()]);
  let problems: Problem[];
  let snapshot: ReturnType<typeof buildSnapshot>;
  let rss: string;
  try {
    const lookups = parseLookups(values);
    const validated = validateMarkers(values.markers, lookups);
    problems = validated.problems;
    snapshot = buildSnapshot(validated.markers, lookups, options.now);
    rss = toRss(snapshot, values.changes, options.siteUrl);
  } catch (err) {
    // A missing header is a sheet mistake: refuse, even when forced, and say why in `problems`.
    if (!(err instanceof MissingColumnsError)) throw err;
    const reason = `${err.message}. Restore the header, for example from version history, then publish again.`;
    await sheet.writeProblems([{ row: 0, reasons: [reason] }]);
    return { status: "refused", reason, problems: 0 };
  }

  let sweep: LogoSweepPlan | undefined;
  if (options.logos) {
    // Planning never holds up a publish; a failure just means no sweep this time.
    try {
      sweep = await planLogoSweep(options.logos.store, values.markers, options.now, await listing);
    } catch (err) {
      console.error(JSON.stringify({ event: "logos-sweep-failed", error: String(err) }));
    }
  }
  const notes: Problem[] =
    sweep && "holdBack" in sweep ? [{ row: 0, reasons: [sweep.holdBack] }] : [];
  if (sweep && "holdBack" in sweep && options.logos?.sweep) {
    const { unused, total } = sweep;
    console.warn(JSON.stringify({ event: "logos-sweep-held-back", unused, total }));
  }

  const safety = checkPublishSafety(current, snapshot.markers.length, options.force);
  if (!safety.ok) {
    await sheet.writeProblems([{ row: 0, reasons: [safety.reason] }, ...notes, ...problems]);
    return { status: "refused", reason: safety.reason, problems: problems.length };
  }

  const json = JSON.stringify(snapshot);
  const stamp = options.now.toISOString().replace(/[:.]/g, "-");
  // The public files and the problems tab don't depend on one another.
  const files = snapshots.write([
    { name: "atlas.json", body: json, contentType: "application/json" },
    {
      name: "markers.geojson",
      body: JSON.stringify(toGeoJson(snapshot)),
      contentType: "application/geo+json",
    },
    { name: "markers.csv", body: toCsv(snapshot), contentType: "text/csv; charset=utf-8" },
    {
      name: "rss.xml",
      body: rss,
      contentType: "application/rss+xml; charset=utf-8",
    },
    { name: `history/atlas-${stamp}.json`, body: json, contentType: "application/json" },
  ]);
  await Promise.all([files, sheet.writeProblems([...notes, ...problems])]);
  if (options.cards) {
    // Cards never hold up or undo a publish; what's missed is drawn next time.
    try {
      const { store, ...cardOptions } = options.cards;
      const result = await refreshCards(snapshot, store, {
        ...cardOptions,
        siteUrl: options.siteUrl,
        manifest,
      });
      console.log(JSON.stringify({ event: "cards", ...result }));
    } catch (err) {
      console.error(JSON.stringify({ event: "cards-failed", error: String(err) }));
    }
  }
  if (options.logos?.sweep && sweep && "remove" in sweep) {
    // Like cards, the sweep never holds up or undoes a publish; it runs again tomorrow.
    try {
      if (sweep.remove.length > 0) await options.logos.store.removeLogos(sweep.remove);
      console.log(JSON.stringify({ event: "logos-swept", deleted: sweep.remove.length }));
    } catch (err) {
      console.error(JSON.stringify({ event: "logos-sweep-failed", error: String(err) }));
    }
  }
  if (options.history && snapshots.pruneHistory) {
    // Old history never holds up a publish either; it is tried again tomorrow.
    try {
      const removed = await snapshots.pruneHistory(options.history.before);
      console.log(JSON.stringify({ event: "history-pruned", removed }));
    } catch (err) {
      console.error(JSON.stringify({ event: "history-prune-failed", error: String(err) }));
    }
  }
  return { status: "published", markers: snapshot.markers.length, problems: problems.length };
}
