import { describe, expect, it } from "vitest";
import { worldView } from "./worldView.ts";

describe("worldView", () => {
  it("keeps the usual zoom on a large screen", () => {
    expect(worldView(1920, 1000).zoom).toBe(1.5);
  });

  it("zooms out to fit the width of a phone", () => {
    expect(worldView(360, 600).zoom).toBeCloseTo(-0.34, 2);
  });

  it("zooms out to fit the height of a phone on its side", () => {
    expect(worldView(800, 300).zoom).toBeCloseTo(0.35, 2);
  });
});
