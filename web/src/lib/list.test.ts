import { describe, expect, it } from "vitest";
import { entryMeta, inView, sortMarkers, type Bounds } from "./list.ts";
import type { PublicMarker } from "./types.ts";

const m = (fields: Partial<PublicMarker> & { name: string }): PublicMarker => ({
  id: fields.name,
  latitude: 0,
  longitude: 0,
  type: "Clinical",
  status: "active",
  ...fields,
});
const names = (list: PublicMarker[]) => list.map((x) => x.name);

describe("inView", () => {
  const kenya: Bounds = { west: 33, south: -5, east: 42, north: 5 };

  it("includes a marker inside and excludes one outside", () => {
    expect(inView(m({ name: "Nairobi", latitude: -1.3, longitude: 36.8 }), kenya)).toBe(true);
    expect(inView(m({ name: "Kampala", latitude: 0.3, longitude: 32.6 }), kenya)).toBe(false);
    expect(inView(m({ name: "Addis", latitude: 9, longitude: 38.7 }), kenya)).toBe(false);
  });

  it("includes every longitude when the view spans the world", () => {
    const world: Bounds = { west: -250, south: -80, east: 250, north: 80 };
    expect(inView(m({ name: "Lima", latitude: -12, longitude: -77 }), world)).toBe(true);
    expect(inView(m({ name: "Pole", latitude: 85, longitude: 0 }), world)).toBe(false);
  });

  it("handles a view across the antimeridian", () => {
    const pacific: Bounds = { west: 170, south: -30, east: 190, north: 0 };
    expect(inView(m({ name: "Fiji", latitude: -18, longitude: 178 }), pacific)).toBe(true);
    expect(inView(m({ name: "Samoa", latitude: -14, longitude: -172 }), pacific)).toBe(true);
    expect(inView(m({ name: "Tonga far", latitude: -20, longitude: -160 }), pacific)).toBe(false);
  });

  it("handles a world copy to the west", () => {
    const copy: Bounds = { west: -330, south: -10, east: -320, north: 10 };
    expect(inView(m({ name: "Nairobi", latitude: -1.3, longitude: 36.8 }), copy)).toBe(true);
  });
});

describe("sortMarkers", () => {
  const list = [
    m({ name: "beta", country: "UG", site_count: 3, confirmed_at: "2025-01-01" }),
    m({ name: "Alpha", country: "KE", confirmed_at: "2026-03-01" }),
    m({ name: "Gamma", site_count: 12 }),
    m({ name: "Delta", country: "KE", site_count: 3, confirmed_at: "2026-03-01" }),
  ];

  it("sorts by name, ignoring case", () => {
    expect(names(sortMarkers(list, "name"))).toEqual(["Alpha", "beta", "Delta", "Gamma"]);
  });

  it("sorts by country then name, unknown country last", () => {
    expect(names(sortMarkers(list, "country"))).toEqual(["Alpha", "Delta", "beta", "Gamma"]);
  });

  it("Scenario: Sort by sites (most first, blank as 1, ties by name)", () => {
    expect(names(sortMarkers(list, "sites"))).toEqual(["Gamma", "beta", "Delta", "Alpha"]);
  });

  it("Scenario: Sort by last confirmed (never confirmed last)", () => {
    expect(names(sortMarkers(list, "confirmed"))).toEqual(["Alpha", "Delta", "beta", "Gamma"]);
  });

  it("leaves the input in place", () => {
    sortMarkers(list, "sites");
    expect(list[0]!.name).toBe("beta");
  });
});

describe("entryMeta", () => {
  it("Scenario: Entry content", () => {
    const marker = m({
      name: "Kampala Rollout",
      country: "UG",
      site_count: 12,
      confirmed_at: "2026-03-15T00:00:00Z",
    });
    expect(entryMeta(marker)).toBe("Uganda · Clinical · 12 sites · Mar 2026");
  });

  it("leaves out blanks and a single site", () => {
    expect(entryMeta(m({ name: "x", site_count: 1 }))).toBe("Clinical");
  });

  it("falls back to the last update when never confirmed", () => {
    expect(entryMeta(m({ name: "x", updated_at: "2024-07-02T00:00:00Z" }))).toBe(
      "Clinical · Jul 2024",
    );
  });
});
