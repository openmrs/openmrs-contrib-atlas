import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { convertLogos, decodeStoredImage, toLogo } from "./logos.ts";

async function image(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: "#00463f" } })
    .png()
    .toBuffer();
}

const dataUrl = (bytes: Buffer, type = "image/png") =>
  Buffer.from(`data:${type};base64,${bytes.toString("base64")}`);

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

  it("reads the base64 data URLs that 2.0 stored", async () => {
    const meta = await sharp(await toLogo(dataUrl(await image(800, 400)))).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 300, height: 150 });
  });
});

describe("decodeStoredImage", () => {
  it("leaves raw image bytes alone", async () => {
    const png = await image(10, 10);
    expect(decodeStoredImage(png).equals(png)).toBe(true);
  });
});

describe("convertLogos", () => {
  it("reports an unreadable image and converts the rest", async () => {
    const { logos, unreadable } = await convertLogos([
      { id: "good", image: dataUrl(await image(10, 10)) },
      { id: "bad", image: Buffer.from("not an image") },
      { id: "none", image: null },
    ]);
    expect([...logos.keys()]).toEqual(["good"]);
    expect(unreadable.map((u) => u.id)).toEqual(["bad"]);
    expect(unreadable[0]?.reason).toBeTruthy();
  });
});
