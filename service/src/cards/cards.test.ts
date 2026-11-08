import type { AtlasSnapshot, PublicMarker } from "@openmrs-atlas/shared";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardHash,
  cardSvg,
  cardText,
  renderPng,
  worldSvg,
} from "./card.ts";
import { mapPaths, project, wrapNear, type View } from "./map.ts";
import { cardFonts, drawable, textWidth, wrap } from "./text.ts";

const SITE = "https://atlas.example.org";
const marker = (fields: Partial<PublicMarker> = {}): PublicMarker => ({
  id: "m1",
  name: "Kampala Rollout",
  latitude: 0.3476,
  longitude: 32.5825,
  type: "Clinical",
  status: "active",
  country: "UG",
  site_count: 50,
  ...fields,
});

describe("text", () => {
  const { bold } = cardFonts();

  it("wraps to two lines and ends with an ellipsis when the name doesn't fit", () => {
    const lines = wrap(
      bold,
      "Kampala Rollout of the National Health Records Programme",
      60,
      520,
      2,
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith("…")).toBe(true);
    for (const line of lines) expect(textWidth(bold, line, 60)).toBeLessThanOrEqual(520);
  });

  it("keeps a short name on one line, and breaks a very long word", () => {
    expect(wrap(bold, "Short", 60, 520, 2)).toEqual(["Short"]);
    const lines = wrap(bold, "W".repeat(40), 60, 520, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith("…")).toBe(true);
  });

  it("keeps accented Latin and drops characters the font lacks", () => {
    expect(drawable(bold, "Clínica Nuevas Raíces")).toBe("Clínica Nuevas Raíces");
    expect(drawable(bold, "Clinic 中心  One")).toBe("Clinic One");
  });
});

describe("map", () => {
  const view: View = {
    lng: 179,
    lat: -17,
    cx: 600,
    cy: 315,
    world: 10800,
    width: 1200,
    height: 630,
  };

  it("projects the centre to the centre, and east to the right", () => {
    expect(project(view, 179, -17)).toEqual([600, 315]);
    expect(project(view, 180, -17)[0]).toBeGreaterThan(600);
  });

  it("takes longitudes across the antimeridian on the near side", () => {
    expect(wrapNear(-179, 179)).toBe(181);
    expect(project(view, -179, -17)[0]).toBeCloseTo(600 + (2 / 360) * 10800);
  });

  it("draws land on both sides of 180°, and picks out the marker's country", () => {
    const { land, home } = mapPaths(view, "50m", "FJ");
    expect(land.length).toBeGreaterThan(100);
    expect(home.length).toBeGreaterThan(0); // Fiji
  });

  it("picks out nothing for a marker with no country", () => {
    expect(mapPaths(view, "50m", undefined).home).toBe("");
  });
});

describe("Card content", () => {
  it("Scenario: A card", () => {
    expect(cardText(marker())).toEqual({
      name: ["Kampala Rollout"],
      meta: "Uganda · 50 sites",
      closed: false,
    });
  });

  it("Scenario: Long name", () => {
    const { name } = cardText(marker({ name: "A ".repeat(10) + "very long name ".repeat(6) }));
    expect(name).toHaveLength(2);
    expect(name[1]!.endsWith("…")).toBe(true);
  });

  it("Scenario: Closed site card", () => {
    expect(cardText(marker({ status: "closed" })).closed).toBe(true);
  });

  it("Scenario: At sea or near the antimeridian", () => {
    expect(cardText(marker({ country: undefined, site_count: undefined })).meta).toBe("");
    expect(() => cardSvg(marker({ longitude: 179.9, latitude: -17 }), SITE)).not.toThrow();
  });

  it("puts no marker text in the markup, so nothing in a name can be markup", () => {
    const svg = cardSvg(marker({ name: `<script>alert("x")</script> & Co` }), SITE);
    expect(svg).not.toContain("script");
    expect(svg).not.toContain("&");
    expect(svg).not.toMatch(/<text/);
  });

  it("renders a 1200 × 630 PNG", async () => {
    const png = await renderPng(cardSvg(marker({ status: "closed" }), SITE));
    const meta = await sharp(png).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["png", CARD_WIDTH, CARD_HEIGHT]);
  });
});

describe("World image", () => {
  it("renders every marker at 1200 × 630", async () => {
    const snapshot = {
      generated_at: "",
      types: [],
      distributions: [],
      versions: [],
      markers: [marker(), marker({ id: "m2", longitude: -77, latitude: -12, country: "PE" })],
    } as AtlasSnapshot;
    const svg = worldSvg(snapshot, SITE);
    expect(svg.match(/<circle/g)).toHaveLength(2);
    const meta = await sharp(await renderPng(svg)).metadata();
    expect([meta.width, meta.height]).toEqual([CARD_WIDTH, CARD_HEIGHT]);
  });
});

describe("cardHash", () => {
  const base = cardHash(marker());

  it("ignores fields the card doesn't show", () => {
    expect(
      cardHash(marker({ notes: "new", url: "https://x.org", logo_url: "https://x.org/l.png" })),
    ).toBe(base);
  });

  it.each([
    ["name", { name: "Kampala" }],
    ["country", { country: "KE" }],
    ["site count", { site_count: 51 }],
    ["status", { status: "closed" as const }],
    ["position", { latitude: 0.35 }],
  ])("changes with the %s", (_, fields) => {
    expect(cardHash(marker(fields))).not.toBe(base);
  });
});
