import type { Page } from "@playwright/test";
import { expect, ids, test } from "./fixtures.ts";

/** The page behind links in reminder emails. The service side is tested in service/src. */

const marker = {
  id: ids.kampala,
  name: "Kampala Rollout",
  organisation: "Example Org",
  status: "active",
  confirmed_at: "2024-06-15T00:00:00.000Z",
};

interface Stub {
  view: Record<string, unknown>;
  confirm?: { status: number; body: unknown };
  unsubscribe?: { status: number; body: unknown };
  requests: { path: string; token: unknown }[];
}

async function stubLinks(page: Page, stub: Omit<Stub, "requests">): Promise<Stub> {
  const state: Stub = { ...stub, requests: [] };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    state.requests.push({ path, token: request.postDataJSON()?.token });
    // Emailed links never carry a sign-in.
    expect(request.headers().authorization).toBeUndefined();
    const reply = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/reminder/view") return reply(200, state.view);
    if (path === "/api/reminder/confirm" && state.confirm) {
      return reply(state.confirm.status, state.confirm.body);
    }
    if (path === "/api/reminder/unsubscribe" && state.unsubscribe) {
      return reply(state.unsubscribe.status, state.unsubscribe.body);
    }
    return reply(404, { error: "not stubbed" });
  });
  return state;
}

test.describe('Emailed "still current" link', () => {
  test("Scenario: Link opened by a mail scanner: opening changes nothing", async ({ page }) => {
    const state = await stubLinks(page, {
      view: { purpose: "confirm", state: "ready", marker },
    });
    await page.goto("/reminder#token-abc");
    await expect(
      page.getByRole("heading", { name: "Is Kampala Rollout still current?" }),
    ).toBeVisible();
    await expect(page.getByText("Last confirmed June 2024.")).toBeVisible();
    expect(state.requests).toEqual([{ path: "/api/reminder/view", token: "token-abc" }]);
    // The map never loads on this page.
    expect(await page.evaluate(() => "atlasMap" in window)).toBe(false);
  });

  test("Scenario: Confirm from email, by keyboard", async ({ page }) => {
    const state = await stubLinks(page, {
      view: { purpose: "confirm", state: "ready", marker },
      confirm: { status: 200, body: { state: "done", confirmed_at: "2026-11-01T00:00:00.000Z" } },
    });
    await page.goto("/reminder#token-abc");
    const button = page.getByRole("button", { name: "Still current" });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
    await expect(page.getByText("as of 1 November 2026")).toBeVisible();
    await expect(page.getByRole("link", { name: "See it on the map" })).toHaveAttribute(
      "href",
      `/?marker=${ids.kampala}`,
    );
    await expect(page.getByRole("link", { name: "Share it" })).toHaveAttribute(
      "href",
      `/?marker=${ids.kampala}&share=1`,
    );
    expect(state.requests.map((r) => r.path)).toEqual([
      "/api/reminder/view",
      "/api/reminder/confirm",
    ]);
    expect(state.requests[1]!.token).toBe("token-abc");
  });

  test("Scenario: Link used twice", async ({ page }) => {
    await stubLinks(page, {
      view: {
        purpose: "confirm",
        state: "confirmed",
        marker: { ...marker, confirmed_at: "2026-10-30T09:00:00.000Z" },
      },
    });
    await page.goto("/reminder#token-abc");
    await expect(page.getByRole("heading", { name: "Already confirmed" })).toBeVisible();
    await expect(page.getByText("confirmed on 30 October 2026")).toBeVisible();
    await expect(page.getByRole("button", { name: "Still current" })).toHaveCount(0);
  });

  test("someone else confirms between opening and pressing", async ({ page }) => {
    await stubLinks(page, {
      view: { purpose: "confirm", state: "ready", marker },
      confirm: {
        status: 409,
        body: { state: "confirmed", confirmed_at: "2026-10-31T00:00:00.000Z" },
      },
    });
    await page.goto("/reminder#token-abc");
    await page.getByRole("button", { name: "Still current" }).click();
    await expect(page.getByText("confirmed on 31 October 2026")).toBeVisible();
  });

  test("Scenario: Expired link", async ({ page }) => {
    await stubLinks(page, { view: { purpose: "confirm", state: "expired", marker } });
    await page.goto("/reminder#token-abc");
    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open Kampala Rollout on the map" }),
    ).toHaveAttribute("href", `/?marker=${ids.kampala}`);
  });

  test("Scenario: Forged link, or one cut short", async ({ page }) => {
    await stubLinks(page, { view: { state: "invalid" } });
    await page.goto("/reminder#garbage");
    await expect(page.getByRole("heading", { name: "This link isn't valid" })).toBeVisible();
  });

  test("a link with no token says so without calling the service", async ({ page }) => {
    const state = await stubLinks(page, { view: { state: "invalid" } });
    await page.goto("/reminder");
    await expect(page.getByRole("heading", { name: "This link isn't valid" })).toBeVisible();
    expect(state.requests).toEqual([]);
  });

  test("Something has changed opens the marker on the map", async ({ page }) => {
    await stubLinks(page, { view: { purpose: "confirm", state: "ready", marker } });
    await page.goto("/reminder#token-abc");
    await expect(page.getByRole("link", { name: "Something has changed" })).toHaveAttribute(
      "href",
      `/?marker=${ids.kampala}`,
    );
  });
});

test.describe("Unsubscribe", () => {
  test("Scenario: Unsubscribe", async ({ page }) => {
    const state = await stubLinks(page, {
      view: { purpose: "unsubscribe", state: "ready", username: "jdoe" },
      unsubscribe: { status: 200, body: { state: "done" } },
    });
    await page.goto("/reminder#unsub-token");
    await expect(page.getByText("OpenMRS ID jdoe")).toBeVisible();
    expect(state.requests).toHaveLength(1);
    await page.getByRole("button", { name: "Unsubscribe" }).click();
    await expect(page.getByRole("heading", { name: "You're unsubscribed" })).toBeVisible();
    await expect(page.getByText("My markers")).toBeVisible();
    expect(state.requests.map((r) => r.path)).toEqual([
      "/api/reminder/view",
      "/api/reminder/unsubscribe",
    ]);
  });
});

test("works on a phone: no sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await stubLinks(page, { view: { purpose: "confirm", state: "ready", marker } });
  await page.goto("/reminder#token-abc");
  await expect(page.getByRole("button", { name: "Still current" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
