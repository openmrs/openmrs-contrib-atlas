import { mkdtemp, readFile, readdir, rm, utimes, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { folderStores, historyDate } from "./storage.ts";

const SITE = "https://atlas.example.org";
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "atlas-data-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const json = (markers: number) => JSON.stringify({ markers: Array.from({ length: markers }) });

describe("folder snapshot store", () => {
  it("has no current count until atlas.json is published", async () => {
    const { snapshots } = folderStores(dir, SITE);
    expect(await snapshots.currentCount()).toBeUndefined();
    await snapshots.write([{ name: "atlas.json", body: json(3), contentType: "application/json" }]);
    expect(await snapshots.currentCount()).toBe(3);
  });

  it("writes files into folders, by the bucket's names", async () => {
    const { snapshots } = folderStores(dir, SITE);
    await snapshots.write([
      { name: "markers.csv", body: "id\n", contentType: "text/csv" },
      { name: "history/atlas-2026-11-23T03-00-00-000Z.json", body: "{}", contentType: "x" },
    ]);
    expect(await readFile(join(dir, "markers.csv"), "utf8")).toBe("id\n");
    expect(await readdir(join(dir, "history"))).toEqual(["atlas-2026-11-23T03-00-00-000Z.json"]);
  });

  it("replaces a file whole: a reader during a write sees the old file or the new one", async () => {
    const { snapshots } = folderStores(dir, SITE);
    const big = (n: number) => JSON.stringify({ markers: Array.from({ length: n }, (_, i) => i) });
    await snapshots.write([{ name: "atlas.json", body: big(10), contentType: "x" }]);
    const reads: Promise<string>[] = [];
    const writes: Promise<void>[] = [];
    for (let i = 0; i < 20; i++) {
      writes.push(
        snapshots.write([{ name: "atlas.json", body: big(50_000 + i), contentType: "x" }]),
      );
      reads.push(readFile(join(dir, "atlas.json"), "utf8"));
    }
    await Promise.all(writes);
    for (const body of await Promise.all(reads)) expect(() => JSON.parse(body)).not.toThrow();
    // No temporary files are left behind.
    expect(await readdir(dir)).toEqual(["atlas.json"]);
  });

  it("refuses names outside the folder", async () => {
    const { snapshots } = folderStores(dir, SITE);
    await expect(
      snapshots.write([{ name: "../escape.json", body: "{}", contentType: "x" }]),
    ).rejects.toThrow(/bad file name/);
  });

  it("prunes history published before a date, and nothing else", async () => {
    const { snapshots } = folderStores(dir, SITE);
    await snapshots.write([
      { name: "history/atlas-2026-08-24T03-00-00-000Z.json", body: "{}", contentType: "x" },
      { name: "history/atlas-2026-08-26T03-00-00-000Z.json", body: "{}", contentType: "x" },
      { name: "history/notes.txt", body: "", contentType: "x" },
      { name: "atlas.json", body: json(1), contentType: "x" },
    ]);
    const removed = await snapshots.pruneHistory!(new Date("2026-08-25T00:00:00Z"));
    expect(removed).toBe(1);
    expect((await readdir(join(dir, "history"))).sort()).toEqual([
      "atlas-2026-08-26T03-00-00-000Z.json",
      "notes.txt",
    ]);
  });

  it("reads a history copy's date from its name", () => {
    expect(historyDate("history/atlas-2026-11-23T03-00-00-000Z.json")).toEqual(
      new Date("2026-11-23T03:00:00.000Z"),
    );
    expect(historyDate("history/other.json")).toBeUndefined();
  });
});

describe("folder logo store", () => {
  it("saves logos under the site's /data/ address, lists them with dates, and removes them", async () => {
    const { logos } = folderStores(dir, `${SITE}/`);
    expect(logos.publicPrefix).toBe(`${SITE}/data/`);
    const url = await logos.saveLogo("logos/a.webp", Buffer.from("png"));
    expect(url).toBe(`${SITE}/data/logos/a.webp`);
    await logos.saveLogo("logos/b.webp", Buffer.from("png"));
    const old = new Date("2026-01-01T00:00:00Z");
    await utimes(join(dir, "logos/b.webp"), old, old);

    const listed = await logos.listLogos();
    expect(listed.map((l) => l.name)).toEqual(["logos/a.webp", "logos/b.webp"]);
    expect(listed[1]!.created).toEqual(old);

    await logos.removeLogos(["logos/b.webp", "logos/missing.webp"]);
    expect((await logos.listLogos()).map((l) => l.name)).toEqual(["logos/a.webp"]);
  });

  it("lists nothing when the folder doesn't exist yet, and skips temporary files", async () => {
    const { logos } = folderStores(dir, SITE);
    expect(await logos.listLogos()).toEqual([]);
    await mkdir(join(dir, "logos"));
    await writeFile(join(dir, "logos", ".a.webp.123.tmp"), "");
    expect(await logos.listLogos()).toEqual([]);
  });
});

describe("folder card store", () => {
  it("reads the snapshot and manifest, writes cards, lists and removes by prefix", async () => {
    const { cards, snapshots } = folderStores(dir, SITE);
    expect(await cards.readSnapshot()).toBeUndefined();
    expect(await cards.readManifest()).toBeUndefined();

    await snapshots.write([{ name: "atlas.json", body: json(2), contentType: "x" }]);
    expect((await cards.readSnapshot())?.markers).toHaveLength(2);

    await cards.writeManifest({ markers: {}, world: "abc" });
    await cards.writeCard("cards/m1-aaa.png", Buffer.from("1"));
    await cards.writeWorld(Buffer.from("w"));
    expect(await cards.readManifest()).toEqual({ markers: {}, world: "abc" });
    expect(await cards.list("cards/")).toEqual([
      "cards/m1-aaa.png",
      "cards/manifest.json",
      "cards/world.png",
    ]);

    await cards.remove(["cards/m1-aaa.png"]);
    expect(await cards.list("cards/")).toEqual(["cards/manifest.json", "cards/world.png"]);
    expect(cards.publicUrl("cards/world.png")).toBe(`${SITE}/data/cards/world.png`);
  });
});
