import type { Page, Route } from "@playwright/test";
import { expect, ids, test } from "./fixtures.ts";

/** specs/marker-claims, with the service stubbed (rules are tested in service/src/claims.test.ts). */

const NOW = "2026-11-01T00:00:00.000Z";
const makerere = {
  id: ids.makerere,
  name: "Makerere Research Clinic",
  latitude: 0.3349,
  longitude: 32.5677,
  country: "UG",
  type: "Research",
  confirmed_at: NOW,
};

interface State {
  me: {
    username: string;
    admin: boolean;
    markers: unknown[];
    offers: unknown[];
    claimable: string[];
    claims: { id: string; marker_id: string; name: string; created_at: string }[];
    review?: {
      id: string;
      marker_id: string;
      name: string;
      username: string;
      message: string;
      created_at: string;
    }[];
  };
  requests: { method: string; path: string; body: unknown }[];
}

async function stubApi(page: Page, admin = false): Promise<State> {
  const state: State = {
    me: {
      username: admin ? "root" : "bjones",
      admin,
      markers: [],
      offers: [],
      claimable: admin ? [] : [ids.makerere],
      claims: [],
      ...(admin
        ? {
            review: [
              {
                id: "c1",
                marker_id: ids.makerere,
                name: makerere.name,
                username: "bjones",
                message: "I run the EMR at Makerere",
                created_at: NOW,
              },
            ],
          }
        : {}),
    },
    requests: [],
  };
  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const method = request.method();
    const body = request.postData() ? JSON.parse(request.postData()!) : undefined;
    const json = (status: number, data: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/me/confirm-recent") return json(200, { confirmed: [], published: false });
    if (method !== "GET") state.requests.push({ method, path, body });
    if (path === "/me") return json(200, state.me);
    const claims = `/markers/${ids.makerere}/claims`;
    if (path === claims && method === "POST") {
      state.me.claimable = [];
      state.me.claims = [
        { id: "c9", marker_id: ids.makerere, name: makerere.name, created_at: NOW },
      ];
      return json(201, { claim: { id: "c9", marker_id: ids.makerere } });
    }
    if (path === `${claims}/c9` && method === "DELETE") {
      state.me.claims = [];
      state.me.claimable = [ids.makerere];
      return json(200, { ok: true });
    }
    if (path === `${claims}/c1/approve`) {
      state.me.review = [];
      return json(200, { version: NOW, status: "active", marker: makerere, published: true });
    }
    if (path === `${claims}/c1/decline`) {
      state.me.review = [];
      return json(200, { ok: true });
    }
    return json(404, { error: "not stubbed" });
  });
  return state;
}

const signedIn = (page: Page, token: string) =>
  page.addInitScript((value) => sessionStorage.setItem("atlas.e2e.token", value), token);

const openMakerere = `/?marker=${ids.makerere}&map=8/0.3349/32.5677`;
const details = (page: Page) =>
  page.getByRole("complementary", { name: "Details for Makerere Research Clinic" });

test.describe("Claiming a marker with no owner", () => {
  test("Scenario: Visitor sees the sign-in hint", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("atlas.e2e.account", "bjones"));
    await stubApi(page);
    await page.goto(openMakerere);
    await expect(details(page)).toContainText("Is this your site?");
    await details(page).getByRole("button", { name: "Sign in to update or claim it." }).click();
    // Back on the same marker, signed in, with the claim offered.
    await expect(page).toHaveURL(new RegExp(`marker=${ids.makerere}`));
    await expect(details(page).getByRole("button", { name: "Claim this site" })).toBeVisible();
    await expect(details(page)).not.toContainText("Is this your site?");
  });

  test("Scenario: Claiming an orphan, then withdrawing", async ({ page }) => {
    await signedIn(page, "bjones");
    const state = await stubApi(page);
    await page.goto(openMakerere);
    await details(page).getByRole("button", { name: "Claim this site" }).click();
    await page.getByLabel("How are you connected to this site?").fill("I run the EMR at Makerere");
    await page.getByRole("button", { name: "Send claim" }).click();
    await expect(details(page).getByRole("status")).toHaveText(
      "Your claim is waiting for an admin.",
    );
    expect(state.requests).toContainEqual({
      method: "POST",
      path: `/markers/${ids.makerere}/claims`,
      body: { message: "I run the EMR at Makerere" },
    });

    // My markers lists it, with Withdraw.
    await page.getByRole("button", { name: "bjones" }).click();
    const mine = page.getByRole("complementary", { name: "My markers" });
    await expect(mine.getByRole("heading", { name: "Your claims" })).toBeVisible();
    await mine
      .getByRole("button", { name: "Withdraw your claim for Makerere Research Clinic" })
      .click();
    await expect(mine.getByRole("heading", { name: "Your claims" })).toHaveCount(0);
    expect(state.requests.at(-1)).toMatchObject({
      method: "DELETE",
      path: `/markers/${ids.makerere}/claims/c9`,
    });
  });

  test("Scenario: Marker with an owner offers no claim", async ({ page }) => {
    await signedIn(page, "bjones");
    await stubApi(page);
    await page.goto(`/?marker=${ids.kampala}&map=8/0.3476/32.5825`);
    await expect(page.getByRole("complementary", { name: /Details for/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Claim this site" })).toHaveCount(0);
    await expect(page.getByText("Is this your site?")).toHaveCount(0);
  });
});

test.describe("Admins review claims", () => {
  test("Scenario: Approving from My markers and the details", async ({ page }) => {
    await signedIn(page, "root");
    const state = await stubApi(page, true);
    await page.goto("/?panel=mine");
    const mine = page.getByRole("complementary", { name: "My markers" });
    await expect(mine.getByRole("region", { name: "Claims to review" })).toContainText(
      "Claimed by bjones.",
    );
    await mine.getByRole("button", { name: "Makerere Research Clinic" }).click();
    await expect(details(page)).toContainText("I run the EMR at Makerere");
    await details(page).getByRole("button", { name: "Approve bjones's claim" }).click();
    await expect(page.locator(".notice")).toContainText("Saved");
    await expect(details(page).getByRole("heading", { name: "A claim to review" })).toHaveCount(0);
    expect(state.requests.at(-1)).toMatchObject({
      method: "POST",
      path: `/markers/${ids.makerere}/claims/c1/approve`,
    });
  });

  test("Scenario: Declined with a reason", async ({ page }) => {
    await signedIn(page, "root");
    const state = await stubApi(page, true);
    await page.goto(openMakerere);
    await details(page).getByRole("button", { name: "Decline bjones's claim" }).click();
    await page.getByLabel("Reason (optional, sent to bjones)").fill("Ask your country lead");
    await page.getByRole("button", { name: "Decline claim" }).click();
    await expect(details(page).getByRole("heading", { name: "A claim to review" })).toHaveCount(0);
    expect(state.requests.at(-1)).toEqual({
      method: "POST",
      path: `/markers/${ids.makerere}/claims/c1/decline`,
      body: { reason: "Ask your country lead" },
    });
  });
});

test.describe("On a phone", () => {
  test.use({ viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true });

  test("the claim form fits without scrolling sideways", async ({ page }) => {
    await signedIn(page, "bjones");
    await stubApi(page);
    await page.goto(openMakerere);
    await details(page).getByRole("button", { name: "Claim this site" }).click();
    const field = page.getByLabel("How are you connected to this site?");
    await expect(field).toBeVisible();
    for (const target of [field, page.getByRole("button", { name: "Send claim" })]) {
      const box = (await target.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
    }
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });
});
