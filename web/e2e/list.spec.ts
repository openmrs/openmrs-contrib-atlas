import type { Page } from "@playwright/test";
import { expect, mapIdle, test } from "./fixtures.ts";

const panel = (page: Page) => page.getByRole("complementary", { name: /List of implementations/ });
const heading = (page: Page) => panel(page).getByRole("heading");
const names = (page: Page) => panel(page).locator(".site-name");

async function openList(page: Page, url = "/") {
  await page.goto(url);
  await mapIdle(page);
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(panel(page)).toBeVisible();
}

test.describe("List of markers in view", () => {
  test("Scenario: Whole world", async ({ page }) => {
    await openList(page);
    await expect(heading(page)).toHaveText("8 implementations in view");
    await expect(names(page)).toHaveCount(8);
    await expect(names(page).first()).toHaveText("Boston Training Server");
  });

  test("Scenario: Zoomed in on a region", async ({ page }) => {
    await openList(page, "/?map=7/-1.29/36.82");
    await expect(heading(page)).toHaveText("1 implementation in view");
    await expect(names(page)).toHaveText(["Nairobi Teaching Hospital"]);
  });

  test("Scenario: Panning updates the list", async ({ page }) => {
    await openList(page, "/?map=7/-1.29/36.82");
    await page.evaluate(() => window.atlasMap!.jumpTo({ center: [32.58, 0.345], zoom: 9 }));
    await expect(names(page)).toHaveText([
      "Entebbe Road Health Centres",
      "Kampala Rollout",
      "Makerere Research Clinic",
    ]);
  });

  test("Scenario: Filters apply", async ({ page }) => {
    await openList(page);
    await page.getByRole("button", { name: "Filters" }).click();
    await page
      .getByRole("complementary", { name: "Filters" })
      .getByRole("checkbox", { name: "Research" })
      .check();
    await page.getByRole("button", { name: "List", exact: true }).click();
    await expect(heading(page)).toHaveText("2 implementations in view");
    await expect(names(page)).toHaveText(["Makerere Research Clinic", "Nairobi Teaching Hospital"]);
  });

  test("Scenario: Nothing in view", async ({ page }) => {
    await openList(page, "/?map=6/-40/-20");
    await expect(heading(page)).toHaveText("0 implementations in view");
    await expect(panel(page)).toContainText("Zoom out or move the map");
  });

  test("Escape closes it", async ({ page }) => {
    await openList(page);
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
  });
});

test.describe("Sorting the list", () => {
  test("Scenario: Sort by sites, and Copied list", async ({ page }) => {
    await openList(page);
    await panel(page).getByLabel("Sort by").selectOption("sites");
    await expect(names(page).nth(0)).toHaveText("Kampala Rollout");
    await expect(names(page).nth(1)).toHaveText("Entebbe Road Health Centres");
    await expect(page).toHaveURL(/panel=list&sort=sites/);

    // Opening the copied address afresh restores the sorted list.
    await page.goto(new URL(page.url()).search);
    await mapIdle(page);
    await expect(panel(page).getByLabel("Sort by")).toHaveValue("sites");
    await expect(names(page).first()).toHaveText("Kampala Rollout");
  });

  test("Scenario: Sort by last confirmed", async ({ page }) => {
    await openList(page);
    await panel(page).getByLabel("Sort by").selectOption("confirmed");
    await expect(names(page).first()).toHaveText("Boston Training Server");
    await expect(names(page).last()).toHaveText("Kathmandu Development Lab");
  });
});

test.describe("Opening a marker from the list, and Back to the list", () => {
  const entry = (page: Page, name: string) =>
    panel(page).getByRole("button", { name: new RegExp(`^${name}`) });
  const details = (page: Page) => page.getByRole("complementary", { name: /Details for/ });

  test("Scenario: Open from the list, then Back with the control", async ({ page }) => {
    await openList(page);
    await panel(page).getByLabel("Sort by").selectOption("country");
    await entry(page, "Nairobi Teaching Hospital").click();
    await expect(details(page)).toHaveAccessibleName("Details for Nairobi Teaching Hospital");
    await expect(page).toHaveURL(/marker=/);
    await details(page).getByRole("button", { name: "Back to the list" }).click();
    await expect(panel(page).getByLabel("Sort by")).toHaveValue("country");
    await expect(entry(page, "Nairobi Teaching Hospital")).toBeFocused();
  });

  test("Scenario: Back with Backspace", async ({ page }) => {
    await openList(page);
    await entry(page, "Boston Training Server").click();
    await expect(details(page)).toBeVisible();
    await page.keyboard.press("Backspace");
    await expect(entry(page, "Boston Training Server")).toBeFocused();
  });

  test("Scenario: Keyboard-only visitor", async ({ page }) => {
    await page.goto("/");
    await mapIdle(page);
    await page.getByRole("button", { name: "List", exact: true }).focus();
    await page.keyboard.press("Enter");
    await entry(page, "Boston Training Server").focus();
    await page.keyboard.press("Enter");
    await expect(details(page)).toHaveAccessibleName("Details for Boston Training Server");
  });

  test("Scenario: Opened from search", async ({ page }) => {
    await page.goto("/");
    await mapIdle(page);
    await page.getByRole("combobox", { name: /Search sites/ }).fill("Nairobi");
    await page.getByRole("option", { name: /Nairobi/ }).click();
    await expect(details(page)).toBeVisible();
    await expect(details(page).getByRole("button", { name: /^Back to/ })).toHaveCount(0);
    await page.keyboard.press("Backspace");
    await expect(details(page)).toBeVisible();
  });
});

test.describe("Works on phones", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("Scenario: Phone visitor opens the list", async ({ page }) => {
    await page.goto("/");
    await mapIdle(page);
    await page.getByRole("button", { name: "List", exact: true }).tap();
    await expect(panel(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
    await panel(page)
      .getByRole("button", { name: /^Kampala Rollout/ })
      .tap();
    await expect(page.getByRole("complementary", { name: /Details for Kampala/ })).toBeVisible();
  });
});
