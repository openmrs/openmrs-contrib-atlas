import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";

export const STATIC_DIR = resolve(import.meta.dirname, "static");
export const NOW = new Date("2026-11-01T00:00:00Z");

/** Serves /e2e/* from e2e/static and fixes the clock, for every test. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(NOW);
    await page.route("**/e2e/**", async (route) => {
      const path = decodeURIComponent(
        new URL(route.request().url()).pathname.replace(/^\/e2e\//, ""),
      );
      try {
        await route.fulfill({ body: await readFile(resolve(STATIC_DIR, path)) });
      } catch {
        await route.fulfill({ status: 404 });
      }
    });
    await use(page);
  },
});

export { expect };

export const ids = {
  kampala: "e2e00000-0000-4000-8000-000000000001",
  makerere: "e2e00000-0000-4000-8000-000000000002",
  nairobi: "e2e00000-0000-4000-8000-000000000004",
};

/** Waits until the map has loaded its data and finished rendering. */
export async function mapIdle(page: Page) {
  await page.waitForFunction(
    () => window.atlasMap?.loaded() && window.atlasMap.getSource("markers"),
  );
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        const map = window.atlasMap!;
        if (!map.isMoving() && map.areTilesLoaded()) {
          map.once("idle", () => done());
          map.triggerRepaint();
        } else {
          map.once("idle", () => done());
        }
      }),
  );
}

export function stat(page: Page, label: string) {
  return page.locator(`[data-stat="${label}"] dd`);
}
