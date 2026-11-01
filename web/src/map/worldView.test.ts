import { describe, expect, it } from "vitest";
import { worldView } from "./worldView.ts";

describe("worldView", () => {
  it.each([360, 1440, 1728, 3440])("fits one world across %i pixels", (width) => {
    expect(512 * 2 ** worldView(width).zoom).toBeCloseTo(width, 6);
  });
});
