import { COLUMNS } from "@openmrs-atlas/shared";
import { describe, expect, it } from "vitest";
import { moveLogoUrls, planLogoMove } from "./logo-move.ts";
import { FakeSheet } from "./testing.ts";

const BUCKET = "https://storage.googleapis.com/openmrs-atlas-stg/logos/";
const FOLDER = "https://atlas-stg.openmrs.org/data/logos/";

/** A sheet with three markers: one with a bucket logo, one with another address, one with none. */
function sheet() {
  const s = new FakeSheet();
  const row = s.tabs.markers![1]!;
  s.setMarker("logo_url", `${BUCKET}a.webp`);
  s.tabs.markers!.push(
    row.map((v, i) =>
      COLUMNS.markers[i] === "id"
        ? "id-2"
        : COLUMNS.markers[i] === "logo_url"
          ? "https://elsewhere.example/b.png"
          : v,
    ),
    row.map((v, i) =>
      COLUMNS.markers[i] === "id" ? "id-3" : COLUMNS.markers[i] === "logo_url" ? "" : v,
    ),
  );
  return s;
}

const snapshot = (s: FakeSheet) => JSON.stringify(s.tabs);

describe("Logo addresses can be moved in bulk (specs/marker-editing)", () => {
  it("Scenario: Preview", async () => {
    const s = sheet();
    const before = snapshot(s);
    const { moves, applied } = await moveLogoUrls(s, { from: BUCKET, to: FOLDER, apply: false });
    expect(applied).toBe(false);
    expect(moves).toEqual([{ row: 2, id: s.marker("id"), to: `${FOLDER}a.webp` }]);
    expect(snapshot(s)).toBe(before);
  });

  it("Scenario: Apply", async () => {
    const s = sheet();
    const confirmed = s.marker("confirmed_at");
    const changes = JSON.stringify(s.tabs.changes);
    await moveLogoUrls(s, { from: BUCKET, to: FOLDER, apply: true });
    expect(s.marker("logo_url")).toBe(`${FOLDER}a.webp`);
    expect(s.marker("logo_url", 2)).toBe("https://elsewhere.example/b.png");
    expect(s.marker("logo_url", 3)).toBe("");
    // Nothing else moves: not the freshness clock, not the change log behind the feed.
    expect(s.marker("confirmed_at")).toBe(confirmed);
    expect(JSON.stringify(s.tabs.changes)).toBe(changes);
  });

  it("running it again changes nothing", async () => {
    const s = sheet();
    await moveLogoUrls(s, { from: BUCKET, to: FOLDER, apply: true });
    const after = snapshot(s);
    const again = await moveLogoUrls(s, { from: BUCKET, to: FOLDER, apply: true });
    expect(again).toEqual({ moves: [], applied: false });
    expect(snapshot(s)).toBe(after);
  });

  it("Scenario: Moving back", async () => {
    const s = sheet();
    await moveLogoUrls(s, { from: BUCKET, to: FOLDER, apply: true });
    await moveLogoUrls(s, { from: FOLDER, to: BUCKET, apply: true });
    expect(s.marker("logo_url")).toBe(`${BUCKET}a.webp`);
  });

  it("needs whole folder addresses, so one folder can't match another's name", () => {
    const markers = sheet().tabs.markers!;
    expect(() => planLogoMove(markers, BUCKET.slice(0, -1), FOLDER)).toThrow(/ending in "\/"/);
    expect(() => planLogoMove(markers, "logos/", FOLDER)).toThrow(/http/);
    expect(() => planLogoMove(markers, BUCKET, BUCKET)).toThrow(/the same/);
    const other = planLogoMove(
      markers,
      "https://storage.googleapis.com/openmrs-atlas-stg/log/",
      FOLDER,
    );
    expect(other).toEqual([]);
  });

  it("refuses a markers tab without a logo_url column", () => {
    const markers = sheet().tabs.markers!.map((r) => [...r]);
    markers[0]![COLUMNS.markers.indexOf("logo_url")] = "logo";
    expect(() => planLogoMove(markers, BUCKET, FOLDER)).toThrow(/logo_url/);
  });
});
