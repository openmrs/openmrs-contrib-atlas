import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { STATIC_DIR, expect, ids, mapIdle, stat, test } from "./fixtures.ts";

test.describe("Map loads quickly with all markers", () => {
  test("Scenario: First visit", async ({ page }) => {
    await page.goto("/");
    await mapIdle(page);
    await expect(stat(page, "implementations")).toHaveText("8");
    await expect(stat(page, "sites")).toHaveText("59");
    await expect(stat(page, "countries")).toHaveText("6");
    await expect(stat(page, "confirmed in the last 2 years")).toHaveText("5");
  });

  test("Scenario: Snapshot unavailable", async ({ page }) => {
    let fail = true;
    await page.route("**/e2e/atlas.json", async (route) => {
      if (fail) return route.fulfill({ status: 503 });
      return route.fulfill({ body: await readFile(resolve(STATIC_DIR, "atlas.json")) });
    });
    await page.goto("/");
    await expect(page.getByRole("alert")).toContainText("could not be loaded");
    fail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(stat(page, "implementations")).toHaveText("8");
  });
});

test("Map attribution: Scenario: Attribution visible", async ({ page }) => {
  await page.goto("/");
  await mapIdle(page);
  const attribution = page.locator(".maplibregl-ctrl-attrib");
  await expect(attribution).toContainText("OpenStreetMap");
  await expect(attribution).toContainText("OpenFreeMap");
});

test.describe("Site counts and clusters", () => {
  test("Scenario: Cluster total", async ({ page }) => {
    // Zoomed to Kampala, the 50-site, single-site and 3-site markers form one cluster.
    await page.goto("/?map=7/0.345/32.58");
    await mapIdle(page);
    const clusters = await page.evaluate(() =>
      window
        .atlasMap!.queryRenderedFeatures({ layers: ["clusters"] })
        .map((f) => f.properties.sites),
    );
    expect(clusters).toEqual([54]);
  });

  test("Scenario: Fifty-site implementation", async ({ page }) => {
    await page.goto(`/?map=13/0.3476/32.5825`);
    await mapIdle(page);
    const labelled = await page.evaluate(() =>
      window
        .atlasMap!.queryRenderedFeatures({ layers: ["marker-count"] })
        .map((f) => f.properties.sites),
    );
    expect(labelled).toContain(50);
    expect(labelled).not.toContain(1);
  });

  test("selecting a cluster zooms in", async ({ page }) => {
    await page.goto("/?map=7/0.345/32.58");
    await mapIdle(page);
    const before = await page.evaluate(() => window.atlasMap!.getZoom());
    const point = await page.evaluate(() => {
      const f = window.atlasMap!.queryRenderedFeatures({ layers: ["clusters"] })[0]!;
      const p = window.atlasMap!.project(
        (f.geometry as GeoJSON.Point).coordinates as [number, number],
      );
      return { x: p.x, y: p.y };
    });
    await page.locator(".map canvas").click({ position: point });
    await expect
      .poll(() => page.evaluate(() => window.atlasMap!.getZoom()))
      .toBeGreaterThan(before);
  });
});

test("Colour by attribute: Scenario: Switch to distribution", async ({ page }) => {
  await page.goto("/");
  await mapIdle(page);
  const legend = page.getByRole("region", { name: "Legend" });
  await expect(legend.getByRole("listitem")).toHaveText([
    "Clinical",
    "Research",
    "Development",
    "Evaluation",
    "Other",
  ]);
  await legend.getByRole("combobox").selectOption("distribution");
  await expect(legend.getByRole("listitem").last()).toHaveText("Unknown");
  await expect(legend.getByRole("listitem")).toContainText(["Bahmni"]);
  await expect(page).toHaveURL(/colour=distribution/);
});

test.describe("Search", () => {
  test("Keyboard access: Scenario: Keyboard-only visitor", async ({ page }) => {
    await page.goto("/");
    await mapIdle(page);
    await page.keyboard.press("Tab"); // site title link
    await page.keyboard.press("Tab"); // search
    await expect(page.getByRole("combobox", { name: /Search sites/ })).toBeFocused();
    await page.keyboard.type("Uganda");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    const heading = page.getByRole("heading", { name: "Makerere Research Clinic" });
    await expect(heading).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`marker=${ids.makerere}`));
    await page.keyboard.press("Escape");
    await expect(heading).toBeHidden();
  });

  test("selecting a result reveals the marker out of its cluster", async ({ page }) => {
    await page.goto("/");
    await mapIdle(page);
    await page.getByRole("combobox", { name: /Search sites/ }).fill("Kampala");
    await page.getByRole("option", { name: /Kampala Rollout/ }).click();
    await expect(page.getByRole("heading", { name: "Kampala Rollout" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          (id) =>
            window
              .atlasMap!.queryRenderedFeatures({ layers: ["markers"] })
              .some((f) => f.properties.id === id),
          ids.kampala,
        ),
      )
      .toBe(true);
  });
});

test.describe("Filters", () => {
  test("Scenario: Hide old markers on request, then Clear filters", async ({ page }) => {
    await page.goto("/");
    await mapIdle(page);
    await page.getByRole("button", { name: "Filters" }).click();
    const panel = page.getByRole("complementary", { name: "Filters" });
    await panel.getByLabel("Confirmed within").selectOption("2");
    await expect(stat(page, "implementations")).toHaveText("5");
    await expect(page).toHaveURL(/confirmed=2/);
    await panel.getByRole("button", { name: "Clear filters" }).click();
    await expect(stat(page, "implementations")).toHaveText("8");
  });

  test("type and country filters apply to stats and legend", async ({ page }) => {
    await page.goto("/");
    await mapIdle(page);
    await page.getByRole("button", { name: "Filters" }).click();
    const panel = page.getByRole("complementary", { name: "Filters" });
    await panel.getByRole("checkbox", { name: "Clinical" }).check();
    await expect(stat(page, "implementations")).toHaveText("3");
    await expect(stat(page, "sites")).toHaveText("54");
    await panel.getByRole("checkbox", { name: "Uganda" }).check();
    await expect(stat(page, "implementations")).toHaveText("2");
    await expect(page.getByRole("region", { name: "Legend" }).getByRole("listitem")).toHaveText([
      "Clinical",
    ]);
  });
});

test.describe("Shareable URLs", () => {
  test("Scenario: Legacy marker link", async ({ page }) => {
    await page.goto(`/?marker=${ids.nairobi}`);
    await expect(page.getByRole("heading", { name: "Nairobi Teaching Hospital" })).toBeVisible();
    await mapIdle(page);
    await expect
      .poll(() => page.evaluate(() => window.atlasMap!.getCenter().lat))
      .toBeCloseTo(-1.29, 0);
  });

  test("Scenario: Unknown marker link", async ({ page }) => {
    await page.goto("/?marker=00000000-0000-4000-8000-00000000dead");
    await mapIdle(page);
    await expect(page.getByRole("status")).toContainText("not found");
    await expect(stat(page, "implementations")).toHaveText("8");
    await expect(page).not.toHaveURL(/marker=/);
  });

  test("Scenario: Copied view", async ({ page, browser }) => {
    await page.goto("/");
    await mapIdle(page);
    await page.getByRole("button", { name: "Filters" }).click();
    const panel = page.getByRole("complementary", { name: "Filters" });
    await panel.getByRole("checkbox", { name: "Research" }).check();
    await panel.getByRole("checkbox", { name: "Kenya", exact: true }).check();
    await page
      .getByRole("region", { name: "Legend" })
      .getByRole("combobox")
      .selectOption("distribution");
    await page.evaluate(() => window.atlasMap!.jumpTo({ center: [36.8, -1.3], zoom: 6 }));
    await expect(page).toHaveURL(/map=6\.00\//);
    const copied = page.url();

    const other = await browser.newPage();
    await other.clock.setFixedTime(new Date("2026-11-01T00:00:00Z"));
    await other.route("**/e2e/**", async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/e2e\//, "");
      await route.fulfill({ body: await readFile(resolve(STATIC_DIR, decodeURIComponent(path))) });
    });
    await other.goto(copied);
    await expect(stat(other, "implementations")).toHaveText("1");
    await expect(other.getByRole("region", { name: "Legend" }).getByRole("combobox")).toHaveValue(
      "distribution",
    );
    await expect
      .poll(() => other.evaluate(() => Math.round(window.atlasMap?.getZoom() ?? 0)))
      .toBe(6);
    await other.close();
  });
});

test.describe("Works on phones", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("Scenario: Phone visitor", async ({ page }) => {
    await page.goto("/");
    await mapIdle(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
    await page.getByRole("combobox", { name: /Search sites/ }).tap();
    await page.keyboard.type("Nairobi");
    await page.getByRole("option", { name: /Nairobi/ }).tap();
    const details = page.getByRole("complementary", { name: /Details for Nairobi/ });
    await expect(details).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
    await details.getByRole("button", { name: "Close details" }).tap();
    await page.getByRole("button", { name: "Filters" }).tap();
    await expect(page.getByRole("complementary", { name: "Filters" })).toBeVisible();
  });
});

test("Usage analytics: Scenario: Staging without analytics", async ({ page }) => {
  const analytics: string[] = [];
  page.on("request", (r) => {
    if (/googletagmanager|google-analytics/.test(r.url())) analytics.push(r.url());
  });
  await page.goto("/");
  await mapIdle(page);
  await page.getByRole("combobox", { name: /Search sites/ }).fill("Nairobi");
  await page.getByRole("option", { name: /Nairobi/ }).click();
  expect(analytics).toEqual([]);
});
