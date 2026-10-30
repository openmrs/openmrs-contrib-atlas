import { describe, expect, it } from "vitest";
import { lookupValues, markerRow, markerValues } from "./fixtures.ts";
import { parseLookups } from "./rows.ts";
import { COLUMNS } from "./schema.ts";
import { buildSnapshot, toCsv, toGeoJson } from "./snapshot.ts";
import { validateMarkers } from "./validate.ts";

const lookups = parseLookups(lookupValues);
const now = new Date("2026-10-29T12:00:00Z");

function snapshotOf(...rows: ReturnType<typeof markerRow>[]) {
  const { markers } = validateMarkers(markerValues(...rows), lookups);
  return buildSnapshot(markers, lookups, now);
}

const ids = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

describe("buildSnapshot", () => {
  it("includes generation time and lookups", () => {
    const snapshot = snapshotOf(markerRow());
    expect(snapshot.generated_at).toBe("2026-10-29T12:00:00.000Z");
    expect(snapshot.types.map((t) => t.name)).toEqual(["Clinical", "Research", "Other"]);
    expect(snapshot.versions).toHaveLength(2);
  });

  it("Scenario: Hidden and closed markers excluded", () => {
    const snapshot = snapshotOf(
      markerRow({ id: ids(1) }),
      markerRow({ id: ids(2), status: "hidden" }),
      markerRow({ id: ids(3), status: "closed" }),
    );
    expect(snapshot.markers.map((m) => m.id)).toEqual([ids(1)]);
  });

  it("Scenario: Invalid rows excluded", () => {
    const values = markerValues(markerRow({ id: ids(1) }), markerRow({ id: ids(2), type: "Bad" }));
    const { markers, problems } = validateMarkers(values, lookups);
    const snapshot = buildSnapshot(markers, lookups, now);
    expect(snapshot.markers.map((m) => m.id)).toEqual([ids(1)]);
    expect(problems.map((p) => p.markerId)).toEqual([ids(2)]);
  });

  it("Scenario: Country derived from coordinates", () => {
    const snapshot = snapshotOf(markerRow({ latitude: -1.29, longitude: 36.82 }));
    expect(snapshot.markers[0]?.country).toBe("KE");
  });

  it("omits country for a point at sea", () => {
    const snapshot = snapshotOf(markerRow({ latitude: 0, longitude: 0 }));
    expect(snapshot.markers[0]).not.toHaveProperty("country");
  });

  it("publishes no status and omits blank optional fields", () => {
    const marker = snapshotOf(markerRow({ organisation: "", logo_url: "" })).markers[0];
    expect(marker).not.toHaveProperty("status");
    expect(marker).not.toHaveProperty("organisation");
    expect(marker).not.toHaveProperty("logo_url");
  });
});

// Requirement: Download formats / Private fields stay private
describe("download formats", () => {
  const snapshot = snapshotOf(
    markerRow({ id: ids(1), notes: 'Says "hi", then\nleaves' }),
    markerRow({ id: ids(2), site_count: 50 }),
    markerRow({ id: ids(3), status: "hidden" }),
  );

  it("Scenario: Formats agree", () => {
    const fromJson = snapshot.markers.map((m) => m.id);
    const fromGeoJson = toGeoJson(snapshot).features.map((f) => f.id);
    const csv = toCsv(snapshot);
    const fromCsv = [...csv.matchAll(/^(\d{8}-[\d-]+),/gm)].map((m) => m[1]);
    expect(fromJson).toEqual([ids(1), ids(2)]);
    expect(fromGeoJson).toEqual(fromJson);
    expect(fromCsv).toEqual(fromJson);
  });

  it("puts coordinates in GeoJSON geometry as [longitude, latitude]", () => {
    const feature = toGeoJson(snapshot).features[0];
    expect(feature?.geometry.coordinates).toEqual([36.8219, -1.2921]);
    expect(feature?.properties).not.toHaveProperty("latitude");
  });

  it("quotes CSV cells containing commas, quotes or newlines", () => {
    expect(toCsv(snapshot)).toContain('"Says ""hi"", then\nleaves"');
  });

  it("Scenario: Contact email not published", () => {
    const outputs = [
      JSON.stringify(snapshot),
      JSON.stringify(toGeoJson(snapshot)),
      toCsv(snapshot),
    ];
    for (const output of outputs) {
      for (const field of COLUMNS.private.filter((c) => c !== "id")) {
        expect(output).not.toContain(field);
      }
    }
  });
});
