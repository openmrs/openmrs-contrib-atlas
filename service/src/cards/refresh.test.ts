import { COLUMNS, type AtlasSnapshot, type Cell, type PublicMarker } from "@openmrs-atlas/shared";
import { SEED_LOOKUPS } from "@openmrs-atlas/shared/seed";
import { describe, expect, it, vi } from "vitest";
import { EDIT_CARD_LIMIT, createApp } from "../app.ts";
import type { IdTokenVerifier } from "../auth.ts";
import type { SheetStore } from "../publish.ts";
import { FakeBucket, FakeCards } from "../testing.ts";
import { cardHash } from "./card.ts";
import { MANIFEST, WORLD, refreshCards } from "./refresh.ts";

const SITE = "https://atlas.example.org";
const id = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const marker = (i: number, fields: Partial<PublicMarker> = {}): PublicMarker => ({
  id: id(i),
  name: `Site ${i}`,
  latitude: -1.29,
  longitude: 36.82,
  type: "Clinical",
  status: "active",
  country: "KE",
  ...fields,
});
const snapshot = (markers: PublicMarker[]): AtlasSnapshot => ({
  generated_at: "2026-11-01T00:00:00Z",
  types: [],
  distributions: [],
  versions: [],
  markers,
});
const all = { siteUrl: SITE, limit: Infinity, sweep: false };
const cardFiles = (cards: FakeCards) => [...cards.files.keys()].filter((n) => n !== WORLD).sort();

describe("Cards follow publishes", () => {
  it("draws a card for each published marker, the world image and the manifest", async () => {
    const cards = new FakeCards();
    const result = await refreshCards(snapshot([marker(1), marker(2)]), cards, all);
    expect(result).toMatchObject({ drawn: 2, failed: 0, pending: 0 });
    expect(cardFiles(cards)).toEqual([
      `cards/${id(1)}-${cardHash(marker(1))}.png`,
      `cards/${id(2)}-${cardHash(marker(2))}.png`,
    ]);
    expect(cards.files.has(WORLD)).toBe(true);
    expect(Object.keys(cards.manifest!.markers)).toEqual([id(1), id(2)]);
  });

  it("Scenario: Rename (a new file, so the address changes)", async () => {
    const cards = new FakeCards();
    await refreshCards(snapshot([marker(1)]), cards, all);
    const before = cards.manifest!.markers[id(1)]!.file;
    await refreshCards(snapshot([marker(1, { name: "Renamed" })]), cards, all);
    const after = cards.manifest!.markers[id(1)]!.file;
    expect(after).not.toBe(before);
    expect(cards.files.has(after)).toBe(true);
  });

  it("Scenario: Unrelated edit", async () => {
    const cards = new FakeCards();
    await refreshCards(snapshot([marker(1)]), cards, all);
    const result = await refreshCards(snapshot([marker(1, { notes: "new notes" })]), cards, all);
    expect(result.drawn).toBe(0);
  });

  it("Scenario: Marker deleted (out of the manifest at once, file swept nightly)", async () => {
    const cards = new FakeCards();
    await refreshCards(snapshot([marker(1), marker(2)]), cards, all);
    const result = await refreshCards(snapshot([marker(1)]), cards, all);
    expect(result.removed).toBe(1);
    expect(Object.keys(cards.manifest!.markers)).toEqual([id(1)]);
    expect(cardFiles(cards)).toHaveLength(2);

    const swept = await refreshCards(snapshot([marker(1)]), cards, { ...all, sweep: true });
    expect(swept.deleted).toBe(1);
    expect(cardFiles(cards)).toEqual([`cards/${id(1)}-${cardHash(marker(1))}.png`]);
  });

  it("sweeping keeps the manifest, the world image and every current card", async () => {
    const cards = new FakeCards();
    await refreshCards(snapshot([marker(1)]), cards, all);
    await refreshCards(snapshot([marker(1, { name: "Renamed" })]), cards, { ...all, sweep: true });
    expect(cardFiles(cards)).toEqual([cards.manifest!.markers[id(1)]!.file]);
    expect(cards.files.has(WORLD)).toBe(true);
  });

  it("Scenario: Card drawing fails", async () => {
    const cards = new FakeCards();
    cards.failFor.add(id(2));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await refreshCards(snapshot([marker(1), marker(2)]), cards, all);
    expect(result).toMatchObject({ drawn: 1, failed: 1, pending: 1 });
    expect(cards.manifest!.markers[id(2)]).toBeUndefined();
    expect(error.mock.calls[0]![0]).toContain(id(2));
    error.mockRestore();

    cards.failFor.clear();
    expect((await refreshCards(snapshot([marker(1), marker(2)]), cards, all)).drawn).toBe(1);
  });

  it("draws changed cards before cards never drawn, up to the limit", async () => {
    const cards = new FakeCards();
    await refreshCards(snapshot([marker(1)]), cards, all);
    const markers = [marker(1, { name: "Renamed" }), marker(2), marker(3)];
    const result = await refreshCards(snapshot(markers), cards, { ...all, limit: 1 });
    expect(result).toMatchObject({ drawn: 1, pending: 2 });
    expect(cards.manifest!.markers[id(1)]!.hash).toBe(cardHash(markers[0]!));
  });
});

// Through the service: which publishes draw how many cards.
function markerRow(i: number): Cell[] {
  const row: Record<string, Cell> = {
    id: id(i),
    name: `Site ${i}`,
    latitude: -1.29,
    longitude: 36.82,
    type: "Clinical",
    confirmed_at: "2025-06-01",
    status: "active",
  };
  return COLUMNS.markers.map((c) => row[c] ?? "");
}

function setup(count: number, published?: number) {
  const sheet: SheetStore = {
    read: async () => ({
      markers: [[...COLUMNS.markers], ...Array.from({ length: count }, (_, i) => markerRow(i))],
      types: [[...COLUMNS.types], ...SEED_LOOKUPS.types],
      distributions: [[...COLUMNS.distributions], ...SEED_LOOKUPS.distributions],
      versions: [[...COLUMNS.versions], ...SEED_LOOKUPS.versions],
      changes: [[...COLUMNS.changes]],
    }),
    writeProblems: async () => {},
  };
  const bucket = new FakeBucket();
  if (published !== undefined) {
    bucket.currentCount = (async () => published) as unknown as FakeBucket["currentCount"];
  }
  const cards = new FakeCards();
  const auth = {
    publishSecret: "s3cret-value",
    schedulerEmail: "scheduler@example.iam.gserviceaccount.com",
    audience: "https://atlas-service.example",
  };
  const verify: IdTokenVerifier = async (t) => (t === "oidc" ? auth.schedulerEmail : undefined);
  const app = createApp({ sheet, snapshots: bucket, cards, auth, verify, siteUrl: SITE });
  const publish = (token: string) =>
    app.request("/publish", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  return { bucket, cards, publish, secret: auth.publishSecret };
}

describe("Nightly publish completes the cards", () => {
  it("Scenario: First publish after release", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { bucket, cards, publish, secret } = setup(25);
    expect((await publish(secret)).status).toBe(200);
    expect(bucket.files.has("atlas.json")).toBe(true);
    expect(Object.keys(cards.manifest!.markers)).toHaveLength(EDIT_CARD_LIMIT);

    expect((await publish("oidc")).status).toBe(200);
    expect(Object.keys(cards.manifest!.markers)).toHaveLength(25);
    vi.restoreAllMocks();
  });

  it("a refused publish leaves cards unchanged", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { cards, publish } = setup(2, 450);
    expect((await publish("oidc")).status).toBe(409);
    expect(cards.files.size).toBe(0);
    expect(cards.manifest).toBeUndefined();
    vi.restoreAllMocks();
  });

  it("a broken card store never fails the publish", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { bucket, cards, publish, secret } = setup(2);
    cards.readManifest = async () => {
      throw new Error("bucket down");
    };
    expect((await publish(secret)).status).toBe(200);
    expect(bucket.files.has("atlas.json")).toBe(true);
    expect(error.mock.calls[0]![0]).toContain("cards-failed");
    expect(MANIFEST).toBe("cards/manifest.json");
    vi.restoreAllMocks();
  });
});
