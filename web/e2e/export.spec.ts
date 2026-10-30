import { readFile } from "node:fs/promises";
import { expect, mapIdle, test } from "./fixtures.ts";

/** Width and height from a PNG's IHDR chunk. */
function pngSize(png: Buffer) {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

test.describe("Public data downloads", () => {
  test("Scenario: Download CSV", async ({ page }) => {
    await page.goto("/");
    await mapIdle(page);
    await page.getByRole("button", { name: "Download" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download data (CSV)" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("openmrs-atlas-2026-11-01.csv");
    const csv = await readFile(await download.path(), "utf8");
    const lines = csv.trim().split(/\r?\n/);
    expect(lines).toHaveLength(9); // header + 8 markers
    for (const field of ["contact", "email", "owner", "editors"]) {
      expect(lines[0]).not.toContain(field);
    }
  });

  test("GeoJSON download", async ({ page }) => {
    await page.goto("/");
    await mapIdle(page);
    await page.getByRole("button", { name: "Download" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download data (GeoJSON)" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("openmrs-atlas-2026-11-01.geojson");
    const geojson = JSON.parse(await readFile(await download.path(), "utf8"));
    expect(geojson.features).toHaveLength(8);
  });
});

test.describe("Image download of the current view", () => {
  test("Scenario: 4x download", async ({ page }) => {
    await page.goto("/");
    await mapIdle(page);
    const size = await page.locator(".map").boundingBox();
    await page.getByRole("button", { name: "Download" }).click();
    await page.getByLabel(/^4x/).check();
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("button", { name: "Download image" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("openmrs-atlas-2026-11-01.png");
    const png = await readFile(await download.path());
    expect(pngSize(png)).toEqual({
      width: Math.round(size!.width) * 4,
      height: Math.round(size!.height) * 4,
    });
  });

  test("Scenario: Filters respected", async ({ page }) => {
    await page.goto("/?type=Clinical");
    await mapIdle(page);
    // The off-screen render is built from the live map's style and data, so it shows
    // exactly the filtered markers the visitor sees.
    const exported = await page.evaluate(() => {
      const source = window.atlasMap!.getStyle().sources.markers as {
        data: GeoJSON.FeatureCollection;
      };
      return source.data.features.length;
    });
    expect(exported).toBe(3);
    await page.getByRole("button", { name: "Download" }).click();
    await page.getByLabel(/^1x/).check();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download image" }).click(),
    ]);
    expect(pngSize(await readFile(await download.path())).width).toBeGreaterThan(0);
  });
});
