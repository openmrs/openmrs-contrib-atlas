import { describe, expect, it } from "vitest";
import { colourOf, legendEntries, palette } from "./colours.ts";
import { countryName } from "./countries.ts";
import { applyFilters, hasFilters } from "./filters.ts";
import { MIN_OPACITY, opacityFor } from "./freshness.ts";
import { linkify } from "./linkify.ts";
import { searchMarkers } from "./search.ts";
import { computeStats } from "./stats.ts";
import { NO_FILTERS, type AtlasSnapshot, type PublicMarker } from "./types.ts";
import { formatUrlState, parseUrlState } from "./urlState.ts";
import fixture from "../../e2e/static/atlas.json";

const snapshot = fixture as AtlasSnapshot;
const markers = snapshot.markers;
const now = new Date("2026-11-01T00:00:00Z");
const byName = (name: string) => markers.find((m) => m.name === name)!;

const monthsAgo = (months: number): PublicMarker => ({
  id: "x",
  name: "x",
  latitude: 0,
  longitude: 0,
  type: "Clinical",
  confirmed_at: new Date(now.getTime() - months * 30.44 * 86_400_000).toISOString(),
});

describe("opacityFor (Gradual fading by freshness)", () => {
  it("Scenario: Recently confirmed", () => {
    expect(opacityFor(monthsAgo(8), now)).toBe(1);
  });

  it("fades part way at 3.5 years", () => {
    // Halfway between 2 and 5 years: halfway between 1 and 0.6.
    expect(opacityFor(monthsAgo(42), now)).toBeCloseTo(0.8, 2);
  });

  it("Scenario: Long unconfirmed", () => {
    expect(opacityFor(monthsAgo(108), now)).toBe(MIN_OPACITY);
  });

  it("falls back to updated_at, then treats undated markers as oldest", () => {
    const { confirmed_at, ...rest } = monthsAgo(8);
    expect(opacityFor({ ...rest, updated_at: confirmed_at }, now)).toBe(1);
    expect(opacityFor(rest, now)).toBe(MIN_OPACITY);
  });
});

describe("applyFilters", () => {
  it("filters by type and by Unknown distribution", () => {
    const clinical = applyFilters(markers, { ...NO_FILTERS, types: ["Clinical"] }, now);
    expect(clinical.map((m) => m.name)).toEqual([
      "Kampala Rollout",
      "Entebbe Road Health Centres",
      "Port-au-Prince O3 Pilot",
    ]);
    const unknown = applyFilters(markers, { ...NO_FILTERS, distributions: ["Unknown"] }, now);
    expect(unknown.map((m) => m.name)).toEqual([
      "Entebbe Road Health Centres",
      "Boston Training Server",
    ]);
  });

  it("Scenario: Hide old markers on request", () => {
    const recent = applyFilters(markers, { ...NO_FILTERS, confirmedWithinYears: 2 }, now);
    expect(recent.map((m) => m.name)).not.toContain("Kathmandu Development Lab");
    expect(recent.map((m) => m.name)).not.toContain("Entebbe Road Health Centres");
    expect(recent).toHaveLength(5);
  });

  it("combines filters and reports when any are set", () => {
    const f = { ...NO_FILTERS, types: ["Research"], countries: ["KE"] };
    expect(applyFilters(markers, f, now).map((m) => m.name)).toEqual(["Nairobi Teaching Hospital"]);
    expect(hasFilters(f)).toBe(true);
    expect(hasFilters(NO_FILTERS)).toBe(false);
  });
});

describe("computeStats (Headline stats)", () => {
  it("Scenario: Default stats", () => {
    expect(computeStats(markers, now)).toEqual({
      markers: 8,
      countries: 6,
      sites: 50 + 1 + 3 + 1 + 1 + 1 + 1 + 1,
      confirmedLastTwoYears: 5,
    });
  });
});

describe("searchMarkers", () => {
  it("Scenario: Search by country", () => {
    expect(searchMarkers(markers, "Uganda").map((m) => m.name)).toEqual([
      "Kampala Rollout",
      "Makerere Research Clinic",
      "Entebbe Road Health Centres",
    ]);
  });

  it("ignores accents and case, and lists name matches first", () => {
    expect(searchMarkers(markers, "clinica")[0]?.name).toBe("Clínica Nuevas Raíces");
    expect(searchMarkers(markers, "partners in")[0]?.name).toBe("Clínica Nuevas Raíces");
    expect(searchMarkers(markers, "research").map((m) => m.name)).toEqual([
      "Makerere Research Clinic",
      "Nairobi Teaching Hospital",
    ]);
  });

  it("needs at least two characters", () => {
    expect(searchMarkers(markers, "k")).toEqual([]);
  });
});

describe("countryName", () => {
  it("names alpha-2 codes in English", () => {
    expect(countryName("UG")).toBe("Uganda");
    expect(countryName(undefined)).toBe("");
  });
});

describe("linkify", () => {
  it("splits out URLs and leaves trailing punctuation as text", () => {
    expect(linkify("See https://example.org/about. Thanks")).toEqual([
      { text: "See " },
      { url: "https://example.org/about" },
      { text: ". Thanks" },
    ]);
  });

  it("keeps markup as plain text", () => {
    expect(linkify("<script>x</script>")).toEqual([{ text: "<script>x</script>" }]);
  });
});

describe("colours", () => {
  it("uses type colours from the snapshot and lists only values present", () => {
    const colours = palette(snapshot, "type");
    expect(colourOf(byName("Kampala Rollout"), "type", colours)).toBe("#7B3FBF");
    const legend = legendEntries(markers, "type", colours).map((e) => e.value);
    expect(legend).toEqual(["Clinical", "Research", "Development", "Evaluation", "Other"]);
  });

  it("Scenario: Switch to distribution", () => {
    const colours = palette(snapshot, "distribution");
    const legend = legendEntries(markers, "distribution", colours).map((e) => e.value);
    expect(legend).toEqual([
      "OpenMRS 1.x",
      "Reference Application 2.x",
      "Bahmni",
      "KenyaEMR",
      "Reference Application 3.x (O3)",
      "Unknown",
    ]);
  });

  it("orders versions with Other and Unknown at the end", () => {
    const colours = palette(snapshot, "version");
    const legend = legendEntries(markers, "version", colours).map((e) => e.value);
    expect(legend).toEqual(["1.10", "2.2", "2.4", "3.8", "Other", "Unknown"]);
  });
});

describe("URL state (Shareable URLs)", () => {
  it("Scenario: Legacy marker link", () => {
    expect(parseUrlState("?marker=abc").marker).toBe("abc");
  });

  it("round-trips view, colour and filters", () => {
    const state = {
      marker: "abc",
      view: { zoom: 5.5, lat: -1.29, lng: 36.82 },
      colourBy: "distribution" as const,
      filters: {
        types: ["Research"],
        distributions: ["Platform 1.x + Legacy UI"],
        versions: ["1.10"],
        countries: ["KE"],
        confirmedWithinYears: 2,
      },
    };
    expect(parseUrlState(formatUrlState(state))).toEqual(state);
  });

  it("omits defaults and ignores invalid values", () => {
    expect(formatUrlState({ colourBy: "type", filters: NO_FILTERS })).toBe("");
    const state = parseUrlState("?map=3/200/0&colour=rainbow&confirmed=-1");
    expect(state.view).toBeUndefined();
    expect(state.colourBy).toBe("type");
    expect(state.filters.confirmedWithinYears).toBeUndefined();
  });
});
