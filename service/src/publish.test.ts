import { COLUMNS, type Cell, type Problem } from "@openmrs-atlas/shared";
import { SEED_LOOKUPS } from "@openmrs-atlas/shared/seed";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import type { IdTokenVerifier } from "./auth.ts";
import type { PublicFile, SheetStore, SheetValues, SnapshotStore } from "./publish.ts";

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

class FakeSheet implements SheetStore {
  problems: Problem[] | undefined;
  constructor(public markers: Cell[][]) {}
  async read(): Promise<SheetValues> {
    return {
      markers: [[...COLUMNS.markers], ...this.markers],
      types: [[...COLUMNS.types], ...SEED_LOOKUPS.types],
      distributions: [[...COLUMNS.distributions], ...SEED_LOOKUPS.distributions],
      versions: [[...COLUMNS.versions], ...SEED_LOOKUPS.versions],
    };
  }
  async writeProblems(problems: Problem[]) {
    this.problems = problems;
  }
}

class FakeBucket implements SnapshotStore {
  files = new Map<string, PublicFile>();
  constructor(private published?: number) {}
  async currentCount() {
    return this.published;
  }
  async write(files: PublicFile[]) {
    for (const f of files) this.files.set(f.name, f);
  }
}

const auth = {
  publishSecret: "s3cret-value",
  schedulerEmail: "scheduler@project.iam.gserviceaccount.com",
  audience: "https://atlas-service.example",
};
const verify: IdTokenVerifier = async (token) =>
  token === "valid-oidc" ? auth.schedulerEmail : token === "other-oidc" ? "x@y.z" : undefined;

function setup(rows: Cell[][], published?: number) {
  const sheet = new FakeSheet(rows);
  const bucket = new FakeBucket(published);
  const app = createApp({ sheet, snapshots: bucket, auth, verify, now: () => now });
  const call = (headers: Record<string, string> = {}, query = "") =>
    app.request(`/publish${query}`, { method: "POST", headers });
  return { sheet, bucket, call };
}

const asSecret = { Authorization: `Bearer ${auth.publishSecret}` };
const asScheduler = { Authorization: "Bearer valid-oidc" };

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
      "history/atlas-2026-11-01T12-00-00-000Z.json",
    ]);
    const snapshot = JSON.parse(bucket.files.get("atlas.json")!.body);
    expect(snapshot.markers.map((m: { name: string }) => m.name)).toEqual(["Site 1"]);
    expect(sheet.problems?.[0]?.reasons).toEqual(["unknown type: Hospital"]);
  });

  it("Scenario: Rows accidentally deleted", async () => {
    const rows = Array.from({ length: 250 }, (_, i) => markerRow(i));
    const { sheet, bucket, call } = setup(rows, 450);
    const res = await call(asScheduler);
    expect(res.status).toBe(409);
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

describe("Publish endpoint is protected", () => {
  it("Scenario: Anonymous publish request", async () => {
    const { bucket, call } = setup([markerRow(1)]);
    expect((await call()).status).toBe(401);
    expect((await call({ Authorization: "Bearer wrong" })).status).toBe(401);
    expect((await call({ Authorization: "Bearer other-oidc" })).status).toBe(401);
    expect((await call({ Authorization: auth.publishSecret })).status).toBe(401);
    expect(bucket.files.size).toBe(0);
  });

  it("accepts the scheduler's OIDC token but not a forced publish from it", async () => {
    const { call } = setup([markerRow(1)]);
    expect((await call(asScheduler)).status).toBe(200);
    expect((await call(asScheduler, "?force=true")).status).toBe(403);
  });
});
