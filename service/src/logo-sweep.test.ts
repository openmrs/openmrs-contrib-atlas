import { COLUMNS, type Cell } from "@openmrs-atlas/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";
import { sweepLogos } from "./logos.ts";
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

describe("sweepLogos", () => {
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
    expect(await sweepLogos(logos, markers, NOW)).toEqual({ deleted: 1 });
    expect([...logos.files.keys()].sort()).toEqual([
      "logos/active.webp",
      "logos/being-edited.webp",
      "logos/deleted-marker.webp",
    ]);
  });

  it("deletes nothing when every old logo is used", async () => {
    const markers = markersWith(
      { logo: url("logos/abandoned.webp") },
      { logo: url("logos/active.webp") },
      { logo: url("logos/deleted-marker.webp") },
    );
    expect(await sweepLogos(logos, markers, NOW)).toEqual({ deleted: 0 });
  });
});

describe("The nightly publish sweeps logos", () => {
  let sheet: FakeSheet;
  let logos: FakeLogos;
  let app: ReturnType<typeof createApp>;
  const auth = { publishSecret: "s", schedulerEmail: "sched@x.iam", audience: "aud" };

  beforeEach(() => {
    sheet = new FakeSheet();
    logos = new FakeLogos();
    logos.add("logos/abandoned.webp", hoursAgo(48));
    app = createApp({
      siteUrl: "https://atlas.example.org",
      sheet,
      snapshots: new FakeBucket(),
      auth,
      verify: async (token) => (token === "oidc" ? auth.schedulerEmail : undefined),
      now: () => NOW,
      editing: {
        store: sheet,
        verifyPerson: async () => ({ username: "jdoe", admin: false }),
        logos,
      },
    });
  });

  const publish = (token: string) =>
    app.request("/publish", { method: "POST", headers: { Authorization: `Bearer ${token}` } });

  it("only the scheduler's run sweeps", async () => {
    expect((await publish("s")).status).toBe(200);
    expect(logos.files.has("logos/abandoned.webp")).toBe(true);
    expect((await publish("oidc")).status).toBe(200);
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
    expect((await publish("oidc")).status).toBe(200);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("logos-sweep-failed"));
    error.mockRestore();
  });
});
