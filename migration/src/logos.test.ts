import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { toLogo } from "./logos.ts";

async function image(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: "#00463f" } })
    .png()
    .toBuffer();
}

describe("toLogo (Logos carried over)", () => {
  it("Scenario: Large image", async () => {
    const logo = await toLogo(await image(800, 400));
    const meta = await sharp(logo).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 300, height: 150 });
  });

  it("does not enlarge small images", async () => {
    const meta = await sharp(await toLogo(await image(120, 80))).metadata();
    expect(meta).toMatchObject({ width: 120, height: 80 });
  });
});
