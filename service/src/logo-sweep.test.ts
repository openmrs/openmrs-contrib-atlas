import { COLUMNS, type Cell } from "@openmrs-atlas/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";
import { planLogoSweep, SWEEP_MAX } from "./logos.ts";
import { FakeBucket, FakeLogos, FakeSheet, ID, NOW } from "./testing.ts";

/** specs/marker-editing: Unused logos are removed. */

const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const url = (name: string) => `https://bucket.example/${name}`;

function markersWith(...rows: { logo: string; status?: string }[]): Cell[][] {
  return [
    [...COLUMNS.markers],
    ...rows.map((r, i) => {
      const row: Cell[] = COLUMNS.markers.map(() => "");
      row[COLUMNS.markers.indexOf("id")] = `m${i}`;
      row[COLUMNS.markers.indexOf("logo_url")] = r.logo;
      row[COLUMNS.markers.indexOf("status")] = r.status ?? "active";
      return row;
    }),
  ];
}

describe("planLogoSweep", () => {
  let logos: FakeLogos;
  beforeEach(() => {
    logos = new FakeLogos();
    logos.add("logos/abandoned.webp", hoursAgo(48));
    logos.add("logos/being-edited.webp", hoursAgo(1));
    logos.add("logos/active.webp", hoursAgo(500));
    logos.add("logos/deleted-marker.webp", hoursAgo(500));
  });

  it("Scenario: Abandoned upload, Upload being edited, and Deleted marker", async () => {
    const markers = markersWith(
      { logo: url("logos/active.webp") },
      { logo: url("logos/deleted-marker.webp"), status: "deleted" },
      { logo: "https://partner.example/logo.png" },
    );
    expect(await planLogoSweep(logos, markers, NOW)).toEqual({ remove: ["logos/abandoned.webp"] });
  });

  it("removes nothing when every old logo is used", async () => {
    const markers = markersWith(
      { logo: url("logos/abandoned.webp") },
      { logo: url("logos/active.webp") },
      { logo: url("logos/deleted-marker.webp") },
    );
    expect(await planLogoSweep(logos, markers, NOW)).toEqual({ remove: [] });
  });

  it("Scenario: Column cleared by mistake", async () => {
    const big = new FakeLogos();
    for (let i = 0; i < 39; i++) big.add(`logos/${i}.webp`, hoursAgo(500));
    const markers = markersWith(...Array.from({ length: 39 }, () => ({ logo: "" })));
    const plan = await planLogoSweep(big, markers, NOW);
    expect(plan).toMatchObject({ unused: 39, total: 39 });
    expect("holdBack" in plan && plan.holdBack).toContain("39 of 39 logos");
  });

  it("Scenario: Column renamed", async () => {
    const markers = markersWith({ logo: url("logos/active.webp") });
    markers[0]![COLUMNS.markers.indexOf("logo_url")] = "logo";
    const plan = await planLogoSweep(logos, markers, NOW);
    expect("holdBack" in plan && plan.holdBack).toContain("no logo_url column");
  });

  it(`removes exactly ${SWEEP_MAX} unused logos, but not one more`, async () => {
    const many = new FakeLogos();
    for (let i = 0; i < 100; i++) many.add(`logos/${i}.webp`, hoursAgo(500));
    const usedFrom = (n: number) =>
      markersWith(
        ...Array.from({ length: 100 - n }, (_, i) => ({ logo: url(`logos/${n + i}.webp`) })),
      );
    const plan = await planLogoSweep(many, usedFrom(SWEEP_MAX), NOW);
    expect("remove" in plan && plan.remove).toHaveLength(SWEEP_MAX);
    expect(await planLogoSweep(many, usedFrom(SWEEP_MAX + 1), NOW)).toHaveProperty("holdBack");
  });

  it("holds back past half of a small folder, but not for a few files", async () => {
    const small = new FakeLogos();
    for (let i = 0; i < 10; i++) small.add(`logos/${i}.webp`, hoursAgo(500));
    const usedFrom = (n: number) =>
      markersWith(
        ...Array.from({ length: 10 - n }, (_, i) => ({ logo: url(`logos/${n + i}.webp`) })),
      );
    // 5 of 10 is half, not more; 6 of 10 is more than half.
    expect(await planLogoSweep(small, usedFrom(5), NOW)).toHaveProperty("remove");
    expect(await planLogoSweep(small, usedFrom(6), NOW)).toHaveProperty("holdBack");
    // A lone abandoned upload is always swept, even when it's the whole folder.
    const one = new FakeLogos();
    one.add("logos/only.webp", hoursAgo(48));
    expect(await planLogoSweep(one, markersWith(), NOW)).toEqual({ remove: ["logos/only.webp"] });
  });
});

describe("The nightly publish sweeps logos", () => {
  let sheet: FakeSheet;
  let logos: FakeLogos;
  let bucket: FakeBucket;
  let app: ReturnType<typeof createApp>;
  const auth = { publishSecret: "s" };

  beforeEach(() => {
    sheet = new FakeSheet();
    logos = new FakeLogos();
    logos.add("logos/abandoned.webp", hoursAgo(48));
    bucket = new FakeBucket();
    app = createApp({
      siteUrl: "https://atlas.example.org",
      sheet,
      snapshots: bucket,
      auth,
      now: () => NOW,
      editing: {
        store: sheet,
        verifyPerson: async () => ({ username: "jdoe", admin: false, signedInAt: NOW.getTime() }),
        logos,
      },
    });
  });

  // "nightly" runs the service's own nightly job; anything else is sent as the Apps Script would.
  const publish = async (token: string, query = "") => {
    if (token === "nightly") {
      const result = await app.jobs.nightlyPublish();
      return Response.json(result, { status: result.status === "published" ? 200 : 409 });
    }
    return app.request(`/publish${query}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  it("Scenario: Column renamed", async () => {
    const header = sheet.tabs.markers![0]!;
    header[header.indexOf("logo_url")] = "logo";
    for (const [token, query] of [
      ["nightly", ""],
      ["s", "?force=true"],
    ] as const) {
      const res = await publish(token, query);
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ status: "refused" });
      expect(sheet.problems).toHaveLength(1);
      expect(sheet.problems[0]!.reasons[0]).toContain(
        "The markers tab is missing columns: logo_url",
      );
    }
    expect(bucket.writes).toBe(0);
    expect(logos.files.has("logos/abandoned.webp")).toBe(true);
  });

  it("only the scheduler's run sweeps", async () => {
    expect((await publish("s")).status).toBe(200);
    expect(logos.files.has("logos/abandoned.webp")).toBe(true);
    expect((await publish("nightly")).status).toBe(200);
    expect(logos.files.has("logos/abandoned.webp")).toBe(false);
  });

  it("edit publishes never sweep", async () => {
    const res = await app.request(`/api/markers/${ID}`, {
      method: "PATCH",
      headers: { Authorization: "Bearer jdoe", "Content-Type": "application/json" },
      body: JSON.stringify({ version: "2022-01-01T00:00:00.000Z", fields: { name: "X" } }),
    });
    expect(res.status).toBe(200);
    expect(logos.files.has("logos/abandoned.webp")).toBe(true);
  });

  it("a failing sweep still publishes", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logos.failing = true;
    expect((await publish("nightly")).status).toBe(200);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("logos-sweep-failed"));
    error.mockRestore();
  });

  describe("when the sweep holds back", () => {
    const old = Array.from({ length: SWEEP_MAX + 5 }, (_, i) => `logos/old-${i}.webp`);
    beforeEach(() => {
      for (const name of old) logos.add(name, hoursAgo(500));
    });
    const held = () =>
      sheet.problems.filter((p) => p.reasons.some((r) => r.includes("logo sweep")));

    it("Scenario: Column cleared by mistake", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect((await publish("nightly")).status).toBe(200);
      expect(logos.files.size).toBe(old.length + 1);
      expect(held()).toHaveLength(1);
      expect(held()[0]!.reasons[0]).toContain(
        `would delete ${old.length + 1} of ${old.length + 1}`,
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("logos-sweep-held-back"));
      warn.mockRestore();
    });

    it("Scenario: Edit while held back", async () => {
      const res = await app.request(`/api/markers/${ID}`, {
        method: "PATCH",
        headers: { Authorization: "Bearer jdoe", "Content-Type": "application/json" },
        body: JSON.stringify({ version: "2022-01-01T00:00:00.000Z", fields: { name: "X" } }),
      });
      expect(res.status).toBe(200);
      expect(logos.files.size).toBe(old.length + 1);
      expect(held()).toHaveLength(1);
    });

    it("Scenario: Sheet fixed", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      await publish("nightly");
      expect(held()).toHaveLength(1);
      // The column is restored: rows use the logos again, and the next publish clears the note.
      const rows = sheet.tabs.markers!;
      const [header, first] = [rows[0]!, rows[1]!];
      const at = (col: string) => header.indexOf(col);
      old.forEach((name, i) => {
        const row = [...first];
        row[at("id")] = `restored-${i}`;
        row[at("logo_url")] = `${logos.publicPrefix}${name}`;
        rows.push(row);
      });
      expect((await publish("s")).status).toBe(200);
      expect(held()).toHaveLength(0);
      expect((await publish("nightly")).status).toBe(200);
      expect(logos.files.has("logos/abandoned.webp")).toBe(false);
      expect(logos.files.size).toBe(old.length);
      vi.restoreAllMocks();
    });
  });
});
