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
  it("counts per person and resets on a new UTC day", () => {
    const limit = new DailyLimit(2);
    const late = new Date("2026-11-02T23:59:00Z");
    limit.record("a", late);
    limit.record("a", late);
    expect(limit.reached("a", late)).toBe(true);
    expect(limit.reached("b", late)).toBe(false);
    expect(limit.reached("a", new Date("2026-11-03T00:00:00Z"))).toBe(false);
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
});
