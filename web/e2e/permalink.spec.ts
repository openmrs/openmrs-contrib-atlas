import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AtlasSnapshot } from "@openmrs-atlas/shared";
import { createPermalinks } from "../../service/src/permalinks.ts";
import { STATIC_DIR, expect, ids, test } from "./fixtures.ts";

// The service's permalink page, served where Firebase Hosting would send /marker/**.
test("Marker permalinks: Scenario: Opening a permalink", async ({ page, baseURL }) => {
  const snapshot = JSON.parse(
    await readFile(resolve(STATIC_DIR, "atlas.json"), "utf8"),
  ) as AtlasSnapshot;
  const permalinks = createPermalinks({
    siteUrl: baseURL!,
    cards: {
      readSnapshot: async () => snapshot,
      readManifest: async () => ({ markers: {} }),
      writeManifest: async () => {},
      writeCard: async () => {},
      writeWorld: async () => {},
      list: async () => [],
      remove: async () => {},
      publicUrl: (name) => `https://storage.example.org/bucket/${name}`,
    },
  });
  await page.route("**/marker/**", async (route) => {
    // Mounted at /marker in the service, as in app.ts.
    const path = new URL(route.request().url()).pathname.replace(/^\/marker/, "");
    const res = await permalinks.request(path);
    await route.fulfill({
      status: res.status,
      contentType: "text/html",
      body: await res.text(),
    });
  });

  await page.goto(`/marker/${ids.nairobi}`);
  await expect(page).toHaveURL(new RegExp(`/\\?marker=${ids.nairobi}`));
  await expect(
    page.getByRole("complementary", { name: "Details for Nairobi Teaching Hospital" }),
  ).toBeVisible();
});
