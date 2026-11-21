import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { ADDS_PER_DAY, DailyLimit, UPLOADS_PER_DAY } from "./limits.ts";
import { FakeBucket, FakeLogos, FakeSheet, NOW } from "./testing.ts";

/** specs/marker-editing: Daily limits on adding and uploading. */

let sheet: FakeSheet;
let logos: FakeLogos;
let now: Date;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  sheet = new FakeSheet();
  logos = new FakeLogos(() => now);
  now = NOW;
  app = createApp({
    siteUrl: "https://atlas.example.org",
    sheet,
    snapshots: new FakeBucket(),
    auth: { publishSecret: "s", schedulerEmail: "", audience: "" },
    now: () => now,
    editing: {
      store: sheet,
      verifyPerson: async (token) => ({
        username: token.replace("admin:", ""),
        admin: token.startsWith("admin:"),
      }),
      logos,
    },
  });
});

const fields = { name: "New site", latitude: 0.5, longitude: 32.5, type: "Clinical" };
const add = (who: string, body: unknown = { fields }) =>
  app.request("/api/markers", {
    method: "POST",
    headers: { Authorization: `Bearer ${who}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

let png: Buffer;
const upload = async (who: string) => {
  png ??= await sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set("logo", new File([new Uint8Array(png)], "logo.png"));
  return app.request("/api/logos", {
    method: "POST",
    headers: { Authorization: `Bearer ${who}` },
    body: form,
  });
};

describe("DailyLimit", () => {
  const late = new Date("2026-11-02T23:59:00Z");
  const next = new Date("2026-11-03T00:00:00Z");

  it("takes up to the limit per person, and resets on a new UTC day", () => {
    const limit = new DailyLimit(2);
    expect(limit.take("a", late)).toBe(true);
    expect(limit.take("a", late)).toBe(true);
    expect(limit.take("a", late)).toBe(false);
    expect(limit.take("b", late)).toBe(true);
    expect(limit.take("a", next)).toBe(true);
  });

  it("gives a use back, never below zero", () => {
    const limit = new DailyLimit(1);
    expect(limit.take("a", late)).toBe(true);
    limit.giveBack("a", late);
    limit.giveBack("a", late);
    expect(limit.take("a", late)).toBe(true);
    expect(limit.take("a", late)).toBe(false);
  });

  it("ignores a give-back from an earlier day", () => {
    const limit = new DailyLimit(1);
    limit.take("a", late);
    expect(limit.take("a", next)).toBe(true);
    limit.giveBack("a", late);
    expect(limit.take("a", next)).toBe(false);
  });

  it("keeps only today's counts", () => {
    const limit = new DailyLimit(5);
    for (const name of ["a", "b", "c"]) limit.take(name, late);
    expect(limit.people).toBe(3);
    limit.take("d", next);
    expect(limit.people).toBe(1);
  });
});

describe("Daily limits on adding and uploading", () => {
  it("Scenario: Sixth add", async () => {
    for (let i = 0; i < ADDS_PER_DAY; i++) expect((await add("newbie")).status).toBe(201);
    const rows = sheet.tabs.markers!.length;
    const res = await add("newbie");
    expect(res.status).toBe(429);
    expect(await res.text()).toContain("try again tomorrow");
    expect(sheet.tabs.markers).toHaveLength(rows);
    // Someone else, and the same person the next day, can add.
    expect((await add("other")).status).toBe(201);
    now = new Date(NOW.getTime() + 86_400_000);
    expect((await add("newbie")).status).toBe(201);
  });

  it("Scenario: Admin bulk add", async () => {
    for (let i = 0; i < ADDS_PER_DAY + 2; i++) expect((await add("admin:root")).status).toBe(201);
  });

  it("doesn't count a rejected add", async () => {
    for (let i = 0; i < ADDS_PER_DAY + 2; i++) {
      expect((await add("newbie", { fields: { ...fields, latitude: 999 } })).status).toBe(422);
    }
    expect((await add("newbie")).status).toBe(201);
  });

  it("limits logo uploads to 20 a day", async () => {
    for (let i = 0; i < UPLOADS_PER_DAY; i++) expect((await upload("newbie")).status).toBe(201);
    const stored = logos.files.size;
    expect((await upload("newbie")).status).toBe(429);
    expect(logos.files.size).toBe(stored);
    expect((await upload("admin:root")).status).toBe(201);
  });

  it("Scenario: Burst of adds", async () => {
    const results = await Promise.all(Array.from({ length: 50 }, () => add("newbie")));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(ADDS_PER_DAY);
    expect(statuses.filter((s) => s === 429)).toHaveLength(50 - ADDS_PER_DAY);
  });

  it("holds the upload limit for a burst", async () => {
    const results = await Promise.all(Array.from({ length: 25 }, () => upload("newbie")));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(UPLOADS_PER_DAY);
    expect(statuses.filter((s) => s === 429)).toHaveLength(25 - UPLOADS_PER_DAY);
    expect(logos.files.size).toBe(UPLOADS_PER_DAY);
  });

  it("Scenario: Failed add", async () => {
    expect((await add("newbie", { fields: { ...fields, name: "" } })).status).toBe(422);
    for (let i = 0; i < ADDS_PER_DAY; i++) expect((await add("newbie")).status).toBe(201);
  });

  it("doesn't count a failed upload", async () => {
    const form = new FormData();
    form.set("logo", new File([new Uint8Array([1, 2, 3])], "logo.png"));
    for (let i = 0; i < UPLOADS_PER_DAY + 2; i++) {
      const res = await app.request("/api/logos", {
        method: "POST",
        headers: { Authorization: "Bearer newbie" },
        body: form,
      });
      expect(res.status).toBe(422);
    }
    expect((await upload("newbie")).status).toBe(201);
  });

  it("doesn't limit an admin burst", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => add("admin:root")));
    expect(results.every((r) => r.status === 201)).toBe(true);
  });
});
