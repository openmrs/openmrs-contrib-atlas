import { COLUMNS, type Cell, type Problem } from "@openmrs-atlas/shared";
import { SEED_LOOKUPS } from "@openmrs-atlas/shared/seed";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import {
  publish,
  type PublicFile,
  type SheetStore,
  type SheetValues,
  type SnapshotStore,
} from "./publish.ts";
import { FakeCards } from "./testing.ts";

const now = new Date("2026-11-01T12:00:00Z");

function markerRow(i: number, overrides: Record<string, Cell> = {}): Cell[] {
  const row: Record<string, Cell> = {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    name: `Site ${i}`,
    latitude: -1.29,
    longitude: 36.82,
    type: "Clinical",
    confirmed_at: "2025-06-01",
    status: "active",
    ...overrides,
  };
  return COLUMNS.markers.map((c) => row[c] ?? "");
}

const SITE = "https://atlas.example.org";

class FakeSheet implements SheetStore {
  problems: Problem[] | undefined;
  markers: Cell[][];
  changes: Cell[][] = [];
  constructor(markers: Cell[][]) {
    this.markers = markers;
  }
  async read(): Promise<SheetValues> {
    return {
      markers: [[...COLUMNS.markers], ...this.markers],
      types: [[...COLUMNS.types], ...SEED_LOOKUPS.types],
      distributions: [[...COLUMNS.distributions], ...SEED_LOOKUPS.distributions],
      versions: [[...COLUMNS.versions], ...SEED_LOOKUPS.versions],
      changes: [[...COLUMNS.changes], ...this.changes],
    };
  }
  async writeProblems(problems: Problem[]) {
    this.problems = problems;
  }
}

class FakeBucket implements SnapshotStore {
  files = new Map<string, PublicFile>();
  private published: number | undefined;
  constructor(published?: number) {
    this.published = published;
  }
  async currentCount() {
    return this.published;
  }
  async write(files: PublicFile[]) {
    for (const f of files) this.files.set(f.name, f);
  }
}

const auth = { publishSecret: "s3cret-value" };

function setup(rows: Cell[][], published?: number, snapshots?: FakeBucket) {
  const sheet = new FakeSheet(rows);
  const bucket = snapshots ?? new FakeBucket(published);
  const app = createApp({ sheet, snapshots: bucket, auth, now: () => now, siteUrl: SITE });
  const call = (headers: Record<string, string> = {}, query = "") =>
    app.request(`/publish${query}`, { method: "POST", headers });
  return { sheet, bucket, call, nightly: app.jobs.nightlyPublish };
}

const asSecret = { Authorization: `Bearer ${auth.publishSecret}` };

describe("POST /publish", () => {
  it("publishes the three files and a history copy, then rewrites problems", async () => {
    const { sheet, bucket, call } = setup([markerRow(1), markerRow(2, { type: "Hospital" })]);
    const res = await call(asSecret);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "published", markers: 1, problems: 1 });
    expect([...bucket.files.keys()]).toEqual([
      "atlas.json",
      "markers.geojson",
      "markers.csv",
      "rss.xml",
      "history/atlas-2026-11-01T12-00-00-000Z.json",
    ]);
    const snapshot = JSON.parse(bucket.files.get("atlas.json")!.body);
    expect(snapshot.markers.map((m: { name: string }) => m.name)).toEqual(["Site 1"]);
    expect(sheet.problems?.[0]?.reasons).toEqual(["unknown type: Hospital"]);
  });

  it("Scenario: Rows accidentally deleted", async () => {
    const rows = Array.from({ length: 250 }, (_, i) => markerRow(i));
    const { sheet, bucket, nightly } = setup(rows, 450);
    expect((await nightly()).status).toBe("refused");
    expect(bucket.files.size).toBe(0);
    expect(sheet.problems?.[0]?.reasons[0]).toContain("publish refused");
  });

  it("Scenario: Intentional large cleanup", async () => {
    const rows = Array.from({ length: 300 }, (_, i) => markerRow(i));
    const { bucket, call } = setup(rows, 450);
    const res = await call(asSecret, "?force=true");
    expect(res.status).toBe(200);
    expect(JSON.parse(bucket.files.get("atlas.json")!.body).markers).toHaveLength(300);
  });
});

// Requirement: Download formats / The feed is current
describe("feed", () => {
  it("Scenario: Formats agree, with the feed written by every publish", async () => {
    const { sheet, bucket, call } = setup([markerRow(1)]);
    const id = String(markerRow(1)[0]);
    sheet.changes = [["2026-11-01T11:00:00.000Z", "jdoe", id, "edit", '["url"]']];
    await call(asSecret);
    const rss = bucket.files.get("rss.xml")!;
    expect(rss.contentType).toBe("application/rss+xml; charset=utf-8");
    expect(rss.body).toContain("<title>Site 1 entry updated</title>");
    expect(rss.body).toContain(`${SITE}/?marker=${id}`);
    expect(rss.body).not.toContain("jdoe");
  });
});

describe("Publish endpoint is protected", () => {
  it("Scenario: Anonymous publish request", async () => {
    const { bucket, call } = setup([markerRow(1)]);
    expect((await call()).status).toBe(401);
    expect((await call({ Authorization: "Bearer wrong" })).status).toBe(401);
    expect((await call({ Authorization: auth.publishSecret })).status).toBe(401);
    expect(bucket.files.size).toBe(0);
  });

  it("has no outside scheduler: only the service's own nightly job runs as the scheduler", async () => {
    const { call, nightly } = setup([markerRow(1)]);
    expect((await call({ Authorization: "Bearer scheduler" })).status).toBe(401);
    expect(await nightly()).toMatchObject({ status: "published" });
  });
});

describe("history pruning", () => {
  it("only the nightly publish prunes history, back 90 days", async () => {
    const bucket = new PruningBucket();
    const { call, nightly } = setup([markerRow(1)], undefined, bucket);
    await call(asSecret);
    expect(bucket.prunedBefore).toEqual([]);
    await nightly();
    expect(bucket.prunedBefore).toEqual([new Date("2026-08-03T12:00:00Z")]);
  });

  class PruningBucket extends FakeBucket {
    prunedBefore: Date[] = [];
    failing = false;
    async pruneHistory(before: Date) {
      if (this.failing) throw new Error("disk full");
      this.prunedBefore.push(before);
      return 1;
    }
  }

  it("prunes history when asked, after the files are written", async () => {
    const bucket = new PruningBucket();
    const before = new Date("2026-08-03T12:00:00Z");
    const result = await publish(new FakeSheet([markerRow(1)]), bucket, {
      force: false,
      now,
      siteUrl: SITE,
      history: { before },
    });
    expect(result.status).toBe("published");
    expect(bucket.prunedBefore).toEqual([before]);
    expect(bucket.files.has("atlas.json")).toBe(true);
  });

  it("prunes nothing when not asked, or when the publish is refused", async () => {
    const bucket = new PruningBucket();
    await publish(new FakeSheet([markerRow(1)]), bucket, { force: false, now, siteUrl: SITE });
    const refusing = new PruningBucket(100);
    await publish(new FakeSheet([markerRow(1)]), refusing, {
      force: false,
      now,
      siteUrl: SITE,
      history: { before: now },
    });
    expect(bucket.prunedBefore).toEqual([]);
    expect(refusing.prunedBefore).toEqual([]);
  });

  it("a failed prune doesn't fail the publish", async () => {
    const bucket = new PruningBucket();
    bucket.failing = true;
    const result = await publish(new FakeSheet([markerRow(1)]), bucket, {
      force: false,
      now,
      siteUrl: SITE,
      history: { before: now },
    });
    expect(result.status).toBe("published");
  });
});

describe("independent steps run together", () => {
  const run = (sheet: FakeSheet, bucket: FakeBucket, cards: FakeCards) =>
    publish(sheet, bucket, {
      force: false,
      now,
      siteUrl: SITE,
      cards: { store: cards, limit: 10, sweep: false },
    });

  it("a refused publish draws no cards", async () => {
    const cards = new FakeCards();
    const result = await run(new FakeSheet([markerRow(1)]), new FakeBucket(100), cards);
    expect(result.status).toBe("refused");
    expect(cards.files.size).toBe(0);
    expect(cards.manifest).toBeUndefined();
  });

  it("a failed manifest read still publishes", async () => {
    const cards = new FakeCards();
    cards.readManifest = () => Promise.reject(new Error("bucket down"));
    const bucket = new FakeBucket();
    const sheet = new FakeSheet([markerRow(1)]);
    const result = await run(sheet, bucket, cards);
    expect(result.status).toBe("published");
    expect(bucket.files.has("atlas.json")).toBe(true);
    expect(sheet.problems).toEqual([]);
  });
});
