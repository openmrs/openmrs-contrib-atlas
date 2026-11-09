import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BADGE_HEIGHT, BADGE_THEMES, BADGE_WIDTH, badgeFile, badgeSvg } from "./badge.ts";

const committed = (file: string) =>
  readFileSync(resolve(import.meta.dirname, "../../../web/public/badges", file), "utf8");

describe("Badge files", () => {
  it.each(BADGE_THEMES)("the committed %s badge matches the generator", (theme) => {
    // Out of date? Run `npm run badges -w service` and commit the result.
    expect(committed(badgeFile(theme))).toBe(badgeSvg(theme));
  });

  it.each(BADGE_THEMES)("Scenario: Badge on another website (%s loads nothing else)", (theme) => {
    const svg = badgeSvg(theme);
    expect(svg).toContain(`width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}"`);
    expect(svg).not.toMatch(/<text|<script|<foreignObject|\bon\w+=|@import|url\(/i);
    // The only reference is the inlined logo.
    const refs = [...svg.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatch(/^data:image\/png;base64,/);
    expect(svg).toContain("On the OpenMRS Atlas");
  });

  it("the two badges differ only in colour", () => {
    const shapes = (svg: string) =>
      svg.replace(/#[0-9a-f]{6}|<rect[^>]*>|fill-opacity="[^"]*"/g, "");
    expect(shapes(badgeSvg("dark"))).toBe(shapes(badgeSvg("light")));
  });
});
