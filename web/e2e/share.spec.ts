import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { expect, ids, mapIdle, test } from "./fixtures.ts";

const openKampala = `/?marker=${ids.kampala}&map=6/0.3476/32.5825`;
const PNG = resolve(import.meta.dirname, "../public/openmrs-cross.png");

/** Stands in for the service's card redirect, which Firebase Hosting would send to Cloud Run. */
async function stubCards(page: Page, status = 200) {
  const requests: string[] = [];
  await page.route("**/marker/*/card.png", async (route) => {
    requests.push(new URL(route.request().url()).pathname);
    if (status !== 200) return route.fulfill({ status });
    await route.fulfill({ contentType: "image/png", body: await readFile(PNG) });
  });
  return requests;
}

const dialog = (page: Page) => page.getByRole("dialog", { name: "Share Kampala Rollout" });

test.describe("Share dialog", () => {
  test("Scenario: Visitor shares a site (copy link, LinkedIn, badge)", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await stubCards(page);
    const external: string[] = [];
    page.on("request", (r) => {
      if (/linkedin|facebook|x\.com|twitter|wa\.me|whatsapp/.test(new URL(r.url()).host)) {
        external.push(r.url());
      }
    });
    await page.goto(openKampala);
    await mapIdle(page);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByAltText("Kampala Rollout on the OpenMRS Atlas")).toBeVisible();

    const permalink = `${baseURL}/marker/${ids.kampala}`;
    await dialog(page).getByRole("button", { name: "Copy link" }).click();
    await expect(dialog(page).getByRole("status")).toHaveText("Link copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(permalink);

    await expect(dialog(page).getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
      "href",
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(permalink)}`,
    );

    // The badges are served by the site itself.
    for (const theme of ["light", "dark"]) {
      const res = await page.request.get(`/badges/on-the-atlas-${theme}.svg`);
      expect(res.status()).toBe(200);
      expect(await res.text()).toContain("On the OpenMRS Atlas");
    }
    await dialog(page).getByText("Dark", { exact: true }).click();
    await dialog(page).getByRole("button", { name: "Copy code" }).click();
    await expect(dialog(page).getByRole("status")).toHaveText("Code copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `<a href="${permalink}"><img src="${baseURL}/badges/on-the-atlas-dark.svg" alt="On the OpenMRS Atlas" width="200" height="44"></a>`,
    );
    expect(external).toEqual([]);
  });

  test("Scenario: Downloading a card", async ({ page }) => {
    const requests = await stubCards(page);
    await page.goto(openKampala);
    await mapIdle(page);
    await page.getByRole("button", { name: "Share" }).click();
    const download = page.waitForEvent("download");
    await dialog(page).getByRole("button", { name: "Download image" }).click();
    expect((await download).suggestedFilename()).toBe("kampala-rollout-openmrs-atlas.png");
    expect(requests).toContain(`/marker/${ids.kampala}/card.png`);
  });

  test("Scenario: Card not drawn yet", async ({ page }) => {
    await stubCards(page, 404);
    await page.goto(openKampala);
    await mapIdle(page);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(dialog(page).getByRole("img", { name: /on the OpenMRS Atlas$/ })).toHaveCount(0);
    await dialog(page).getByRole("button", { name: "Download image" }).click();
    await expect(dialog(page).getByRole("alert")).toHaveText(
      "The image isn't ready yet. Try again in a few minutes.",
    );
  });

  test("Scenario: Closing the dialog", async ({ page }) => {
    await stubCards(page);
    await page.goto(openKampala);
    await mapIdle(page);
    const share = page.getByRole("button", { name: "Share" });
    await share.click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: /Details for Kampala/ })).toBeVisible();
    await expect(share).toBeFocused();
  });
});

test.describe("Share after confirming by email", () => {
  test("Scenario: Confirmed from an email (and a copied address doesn't reopen it)", async ({
    page,
  }) => {
    await stubCards(page);
    await page.goto(`/?marker=${ids.kampala}&share=1`);
    await mapIdle(page);
    await expect(dialog(page)).toBeVisible();
    await expect(page.getByRole("complementary", { name: /Details for Kampala/ })).toBeVisible();
    await expect(page).not.toHaveURL(/share=/);
    await expect(page).toHaveURL(new RegExp(`marker=${ids.kampala}`));
  });

  test("an unknown marker opens no dialog", async ({ page }) => {
    await page.goto("/?marker=nope&share=1");
    await mapIdle(page);
    await expect(page.getByRole("status")).toContainText("not found");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("Share dialog on phones", () => {
  test.use({ viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true });

  test("Scenario: On a phone", async ({ page }) => {
    await stubCards(page);
    await page.goto(openKampala);
    await mapIdle(page);
    await page.getByRole("button", { name: "Share" }).tap();
    await expect(dialog(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );
    const box = (await dialog(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    await dialog(page).getByRole("button", { name: "Download image" }).scrollIntoViewIfNeeded();
    await expect(dialog(page).getByRole("button", { name: "Download image" })).toBeInViewport();
  });
});
