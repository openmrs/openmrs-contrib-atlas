import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page, Route } from "@playwright/test";
import { STATIC_DIR, expect, ids, mapIdle, stat, test } from "./fixtures.ts";

/** specs/marker-editing and specs/map-view: distributions and versions not on their lists. */

const NOW = "2026-11-01T00:00:00.000Z";
/** 30 characters, the longest Other distribution the form allows. */
const LONGEST = "Ministry of Health Custom Bld.";

/** The e2e snapshot, with two markers whose distributions are Other values. */
async function withOtherValues(page: Page) {
  const snapshot = JSON.parse(await readFile(resolve(STATIC_DIR, "atlas.json"), "utf8")) as {
    markers: { id: string; distribution?: string; openmrs_version?: string }[];
  };
  for (const m of snapshot.markers) {
    if (m.id === ids.kampala) Object.assign(m, { distribution: LONGEST, openmrs_version: "2.4.2" });
    if (m.id === ids.makerere) m.distribution = "iSantePlus";
  }
  await page.route("**/e2e/atlas.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(snapshot) }),
  );
}

interface State {
  requests: { method: string; path: string; body: unknown }[];
}

/** The service, stubbed: the rules are tested in shared/ and service/src/api.test.ts. */
async function stubApi(page: Page): Promise<State> {
  const state: State = { requests: [] };
  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const method = request.method();
    const body = request.postData() ? JSON.parse(request.postData()!) : undefined;
    const json = (status: number, data: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/me/confirm-recent") return json(200, { confirmed: [], published: false });
    if (method !== "GET") state.requests.push({ method, path, body });
    if (path === "/me") {
      return json(200, { username: "jdoe", admin: false, markers: [], offers: [] });
    }
    if (path === "/markers" && method === "POST") {
      const fields = (body as { fields: Record<string, string> }).fields;
      return json(201, {
        id: "new-id",
        version: NOW,
        status: "active",
        marker: {
          id: "new-id",
          name: fields.name,
          latitude: 10,
          longitude: 20,
          country: "NG",
          type: fields.type,
          distribution: fields.distribution || undefined,
          openmrs_version: fields.openmrs_version || undefined,
          confirmed_at: NOW,
        },
        published: true,
      });
    }
    if (path === `/markers/${ids.kampala}` && method === "GET") {
      return json(200, {
        id: ids.kampala,
        role: "owner",
        version: "2020-01-01T00:00:00.000Z",
        status: "active",
        fields: {
          name: "Kampala Rollout",
          latitude: 0.3476,
          longitude: 32.5825,
          type: "Clinical",
          distribution: "AMPATH-Custom",
          openmrs_version: "Other",
        },
        problems: [],
        contact: { contact_name: "", contact_email: "" },
        owner: "jdoe",
        editors: [],
      });
    }
    return json(404, { error: "not stubbed" });
  });
  return state;
}

const signedIn = (page: Page) =>
  page.addInitScript(() => sessionStorage.setItem("atlas.e2e.token", "jdoe"));

test.describe("Distribution and version: a list plus Other", () => {
  test("Scenario: Pick lists, and Scenario: Choosing Other", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto("/?panel=add");
    const distribution = page.getByRole("combobox", { name: /^Distribution/ });
    await expect(distribution.locator("option", { hasText: "Bahmni" })).toHaveCount(1);
    const options = await distribution.locator("option").allTextContents();
    expect(options[0]).toBe("Not set");
    expect(options.at(-1)).toBe("Other…");
    expect(options).toContain("Bahmni");
    expect(
      (
        await page
          .getByRole("combobox", { name: /^OpenMRS version/ })
          .locator("option")
          .allTextContents()
      ).at(-1),
    ).toBe("Other…");

    await expect(page.getByLabel("Distribution name (optional)")).toHaveCount(0);
    await distribution.selectOption("Other");
    const name = page.getByLabel("Distribution name (optional)");
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute("maxlength", "30");
    await page.getByRole("combobox", { name: /^OpenMRS version/ }).selectOption("Other");
    await expect(page.getByLabel("Version (optional)")).toHaveAttribute("maxlength", "12");

    // Choosing a list value again hides the text field.
    await distribution.selectOption("Bahmni");
    await expect(page.getByLabel("Distribution name (optional)")).toHaveCount(0);
  });

  test("Scenario: Saving an Other value, and Scenario: Other left blank", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto("/?panel=add");
    await mapIdle(page);
    await page.getByLabel("Name (required)").fill("New Site");
    await page.getByLabel("Latitude").fill("10");
    await page.getByLabel("Longitude").fill("20");
    await page.getByLabel("Type (required)").selectOption("Clinical");
    await page.getByRole("combobox", { name: /^Distribution/ }).selectOption("Other");
    await page.getByLabel("Distribution name (optional)").fill("iSantePlus");
    await page.getByRole("combobox", { name: /^OpenMRS version/ }).selectOption("Other");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "New Site" })).toBeVisible();
    expect(state.requests[0]).toMatchObject({
      method: "POST",
      path: "/markers",
      body: { fields: { distribution: "iSantePlus", openmrs_version: "Other" } },
    });
    const details = page.getByRole("complementary", { name: "Details for New Site" });
    await expect(details).toContainText("iSantePlus");
  });

  test("Scenario: Editing a marker with an Other value", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(`/?panel=edit&marker=${ids.kampala}`);
    await expect(page.getByRole("combobox", { name: /^Distribution/ })).toHaveValue("Other");
    await expect(page.getByLabel("Distribution name (optional)")).toHaveValue("AMPATH-Custom");
    // The bare "Other" version opens as Other with an empty text field.
    await expect(page.getByRole("combobox", { name: /^OpenMRS version/ })).toHaveValue("Other");
    await expect(page.getByLabel("Version (optional)")).toHaveValue("");
  });
});

test.describe("Other values on the map", () => {
  test("Scenario: Other values in the legend", async ({ page }) => {
    await withOtherValues(page);
    await page.goto("/?colour=distribution");
    await mapIdle(page);
    const legend = page.getByRole("region", { name: "Legend" });
    await expect(legend.getByRole("listitem")).toContainText(["Other"]);
    await expect(legend).not.toContainText("iSantePlus");
    await expect(legend).not.toContainText(LONGEST);
  });

  test("Scenario: Filter by Other", async ({ page }) => {
    await withOtherValues(page);
    await page.goto("/?dist=Other");
    await mapIdle(page);
    await expect(stat(page, "implementations")).toHaveText("2");
  });

  test("Scenario: Other value in the details, with room for 30 characters at 375 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await withOtherValues(page);
    await page.goto(`/?marker=${ids.kampala}&map=6/0.3476/32.5825`);
    const details = page.getByRole("complementary", { name: /Details for/ });
    const value = details.locator("dd", { hasText: LONGEST });
    await expect(value).toBeVisible();
    // Phones' own fonts (SF, Roboto) set these 30 characters in about 220 px at 16 px. The test
    // checks the room the layout gives, not one font's metrics: CI's fallback font is wider.
    const width = await value.evaluate((el) => el.clientWidth);
    expect(width).toBeGreaterThanOrEqual(230);
    await expect(details.locator("dd", { hasText: "2.4.2" })).toBeVisible();
  });
});
