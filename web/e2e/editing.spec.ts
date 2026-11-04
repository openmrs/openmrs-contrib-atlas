import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page, Route } from "@playwright/test";
import { STATIC_DIR, expect, ids, mapIdle, stat, test } from "./fixtures.ts";

const NOW = "2026-11-01T00:00:00.000Z";

interface State {
  version: string;
  role: string;
  editors: string[];
  offer_to?: string;
  requests: { method: string; path: string; body: unknown }[];
  /** Status and body for the next PATCH. */
  nextPatch?: { status: number; body: unknown };
  /** The session has ended by the time a form loads. */
  expireMarkerReads?: boolean;
  me: Record<string, unknown>;
}

const kampala = {
  id: ids.kampala,
  name: "Kampala Rollout",
  latitude: 0.3476,
  longitude: 32.5825,
  country: "UG",
  type: "Clinical",
  confirmed_at: NOW,
};

/** Accounts the stubbed service knows: usernames and names only, as the real one returns. */
const ACCOUNTS = [
  { username: "asmith", name: "Al Smith" },
  { username: "bob", name: "Bob Jones" },
  { username: "carol", name: "Carol Smithers" },
];

/** The service, stubbed: permissions and sheet writes are tested in service/src/api.test.ts. */
async function stubApi(page: Page, overrides: Partial<State> = {}): Promise<State> {
  const state: State = {
    version: "2020-01-01T00:00:00.000Z",
    role: "owner",
    editors: ["asmith"],
    requests: [],
    me: {
      username: "jdoe",
      admin: false,
      markers: [
        {
          id: ids.kampala,
          name: "Kampala Rollout",
          role: "owner",
          status: "active",
          confirmed_at: "2020-01-01T00:00:00.000Z",
        },
      ],
      offers: [],
    },
    ...overrides,
  };
  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const method = request.method();
    const body = request.postData() ? safeJson(request.postData()!) : undefined;
    if (method !== "GET") state.requests.push({ method, path, body });
    const json = (status: number, data: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    const saved = (extra: object = {}) =>
      json(200, {
        version: NOW,
        status: "active",
        marker: { ...kampala, name: "Renamed Rollout" },
        published: true,
        ...extra,
      });

    if (path === "/me") return json(200, state.me);
    if (path === "/me/reminders" && method === "PUT") {
      return json(200, { reminders: (body as { on: boolean }).on });
    }
    if (path === "/accounts") {
      const q = (new URL(request.url()).searchParams.get("q") ?? "").toLowerCase();
      return json(200, {
        accounts: ACCOUNTS.filter((a) => `${a.username} ${a.name}`.toLowerCase().includes(q)),
      });
    }
    if (path === "/logos") return json(201, { url: "/e2e/logo.png" });
    if (path === "/markers" && method === "POST") {
      return json(201, {
        id: "new-id",
        version: NOW,
        status: "active",
        marker: {
          id: "new-id",
          name: "New Site",
          latitude: 10,
          longitude: 20,
          country: "NG",
          type: "Clinical",
          confirmed_at: NOW,
        },
        published: true,
      });
    }
    if (path === `/markers/${ids.kampala}`) {
      if (method === "GET") {
        if (state.expireMarkerReads) return json(401, { error: "Please sign in." });
        return json(200, {
          id: ids.kampala,
          role: state.role,
          version: state.version,
          status: "active",
          fields: {
            name: "Kampala Rollout",
            latitude: 0.3476,
            longitude: 32.5825,
            type: "Clinical",
          },
          problems: [],
          ...(state.role === "editor"
            ? {}
            : {
                contact: { contact_name: "", contact_email: "" },
                owner: "jdoe",
                editors: state.editors,
                offer_to: state.offer_to,
              }),
        });
      }
      if (method === "PATCH") {
        if (state.nextPatch) {
          const { status, body: patchBody } = state.nextPatch;
          state.nextPatch = undefined;
          return json(status, patchBody);
        }
        return saved();
      }
      if (method === "DELETE") return saved({ marker: null, status: "deleted" });
    }
    if (path.endsWith("/confirm")) return saved({ marker: kampala });
    if (path.endsWith("/close")) {
      return saved({ marker: { ...kampala, status: "closed" }, status: "closed" });
    }
    if (path.endsWith("/reopen")) return saved({ marker: kampala });
    const named = (body as { username?: string } | undefined)?.username;
    if (named && !ACCOUNTS.some((a) => a.username === named)) {
      return json(422, {
        error: "Please check the OpenMRS ID.",
        errors: [{ field: "username", reason: `The OpenMRS ID "${named}" was not found.` }],
      });
    }
    if (path.endsWith("/editors") && method === "POST") {
      state.editors = [...state.editors, (body as { username: string }).username];
      return saved({ marker: kampala, editors: state.editors });
    }
    if (path.includes("/editors/") && method === "DELETE") {
      state.editors = state.editors.filter((e) => !path.endsWith(`/${e}`));
      return saved({ marker: kampala, editors: state.editors });
    }
    if (path.endsWith("/transfer") && method === "POST") {
      state.offer_to = (body as { username: string }).username;
      return saved({ marker: kampala, offer_to: state.offer_to });
    }
    if (path.endsWith("/transfer") && method === "DELETE") {
      state.offer_to = undefined;
      return json(200, { ok: true });
    }
    if (path.endsWith("/transfer/accept")) return saved({ marker: kampala });
    if (path.endsWith("/transfer/decline")) return json(200, { ok: true });
    return json(404, { error: "not stubbed" });
  });
  return state;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Starts the page already signed in as a test user. */
async function signedIn(page: Page, token = "jdoe") {
  await page.addInitScript((value) => {
    sessionStorage.setItem("atlas.e2e.token", value);
  }, token);
}

const openKampala = `/?marker=${ids.kampala}&map=6/0.3476/32.5825`;

test.describe("Sign in with OpenMRS Keycloak", () => {
  test("Scenario: Signing in from a shared view", async ({ page }) => {
    await stubApi(page);
    await page.addInitScript(() => localStorage.setItem("atlas.e2e.account", "jdoe"));
    await page.goto("/?type=Clinical&map=4/0.3/32.5");
    await mapIdle(page);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Sign in to add or update your site" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign in with OpenMRS ID" }).click();
    await expect(page.getByRole("button", { name: "jdoe" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "My markers" })).toBeVisible();
    await expect(page).toHaveURL(/type=Clinical/);
    await expect(page).toHaveURL(/map=4\.00\/0\.3000\/32\.5000/);
  });

  test("Scenario: Signing out", async ({ page }) => {
    await stubApi(page);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("atlas.e2e.started")) {
        sessionStorage.setItem("atlas.e2e.started", "1");
        sessionStorage.setItem("atlas.e2e.token", "jdoe");
      }
    });
    await page.goto(openKampala);
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await page.getByRole("button", { name: "jdoe" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`marker=${ids.kampala}`));
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  });

  test("Scenario: Keycloak is down", async ({ page }) => {
    await signedIn(page);
    await page.route("**/api/**", (route) => route.fulfill({ status: 503, body: "{}" }));
    await page.goto("/");
    await mapIdle(page);
    await expect(stat(page, "implementations")).toHaveText("8");
    await expect(page.getByRole("status")).toContainText("Sign-in is unavailable");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("visitors never call the service", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/**", (route) => {
      calls++;
      return route.abort();
    });
    await page.goto("/");
    await mapIdle(page);
    expect(calls).toBe(0);
  });
});

test.describe("Add a marker", () => {
  test("Scenario: Not signed in", async ({ page }) => {
    await stubApi(page);
    await page.addInitScript(() => localStorage.setItem("atlas.e2e.account", "jdoe"));
    await page.goto("/");
    await mapIdle(page);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "Sign in with OpenMRS ID" }).click();
    await page.getByRole("button", { name: "Add a site" }).click();
    await expect(page.getByRole("complementary", { name: "Add a site" })).toBeVisible();
  });

  test("Scenario: Choosing a place by search", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.route("https://nominatim.openstreetmap.org/**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([{ display_name: "Eldoret, Kenya", lat: "0.5143", lon: "35.2698" }]),
      }),
    );
    await page.goto("/?panel=mine");
    await mapIdle(page);
    await page.getByRole("button", { name: "Add a site" }).click();
    await page.getByLabel("Find a place").fill("Eldoret");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: "Eldoret, Kenya" }).click();
    await expect(page.getByLabel("Latitude")).toHaveValue("0.51430");
    await expect(page.getByLabel("Longitude")).toHaveValue("35.26980");
    await expect(page.locator(".maplibregl-marker")).toHaveCount(1);
  });

  test("Scenario: Choosing a place on the map", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto("/?panel=mine");
    await mapIdle(page);
    await page.getByRole("button", { name: "Add a site" }).click();
    await expect(page.getByLabel("Latitude")).toHaveValue("");
    await page.mouse.click(300, 400);
    await expect(page.getByLabel("Latitude")).not.toHaveValue("");
    await expect(page.locator(".maplibregl-marker")).toHaveCount(1);
  });

  test("Scenario: Only required fields", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto("/?panel=mine");
    await mapIdle(page);
    await page.getByRole("button", { name: "Add a site" }).click();
    await page.getByLabel("Name (required)").fill("New Site");
    await page.getByLabel("Latitude").fill("10");
    await page.getByLabel("Longitude").fill("20");
    await page.getByLabel("Type (required)").selectOption("Clinical");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "New Site" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("within 10 minutes");
    await expect(stat(page, "implementations")).toHaveText("9");
    expect(state.requests[0]).toMatchObject({
      method: "POST",
      path: "/markers",
      body: { fields: { name: "New Site", latitude: "10", type: "Clinical" } },
    });
  });

  test("Scenario: Pick lists", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto("/?panel=add");
    const version = page.getByLabel("OpenMRS version");
    await expect(version.locator("option", { hasText: "Other" })).toHaveCount(1);
    await expect(
      page.getByLabel("Type (required)").locator("option", { hasText: "Research" }),
    ).toHaveCount(1);
    await expect(page.getByText("never published")).toBeVisible();
  });
});

test.describe("Edit a marker", () => {
  test("Scenario: Owner fixes a website", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Website").fill("https://new.example");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Renamed Rollout" })).toBeVisible();
    expect(state.requests[0]).toMatchObject({
      method: "PATCH",
      body: { version: state.version, fields: { url: "https://new.example" } },
    });
  });

  test("Scenario: After saving", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Renamed Rollout" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Others will see this within 10 minutes");
  });

  test("Scenario: No edit control without permission", async ({ page }) => {
    await stubApi(page, {
      me: { username: "other", admin: false, markers: [], offers: [] },
    });
    await signedIn(page, "other");
    await page.goto(openKampala);
    await expect(page.getByRole("heading", { name: "Kampala Rollout" })).toBeVisible();
    await expect(page.getByRole("button", { name: "other" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Still current" })).toHaveCount(0);
  });

  test("Scenario: Invalid website", async ({ page }) => {
    const state = await stubApi(page);
    state.nextPatch = {
      status: 422,
      body: {
        error: "Please check the form.",
        errors: [{ field: "url", reason: "url must be an http or https URL" }],
      },
    };
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Website").fill("https://typed.example");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Website must be an http or https URL")).toBeVisible();
    await expect(page.getByLabel("Website")).toHaveValue("https://typed.example");
  });

  test("Scenario: Two people edit one marker", async ({ page }) => {
    const state = await stubApi(page);
    state.nextPatch = { status: 409, body: { error: "Changed." } };
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Notes").fill("My careful notes");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("alert")).toContainText("changed this marker");
    await expect(page.getByLabel("Notes")).toHaveValue("My careful notes");
    await page.getByRole("button", { name: "Load the latest version" }).click();
    await expect(page.getByLabel("Notes")).toHaveValue("");
  });

  test("Scenario: Session expires while editing", async ({ page }) => {
    const state = await stubApi(page);
    state.nextPatch = { status: 401, body: { error: "Please sign in." } };
    await signedIn(page);
    await page.addInitScript(() => localStorage.setItem("atlas.e2e.account", "jdoe"));
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Notes").fill("Do not lose me");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByRole("button", { name: "Sign in again" }).click();
    await expect(page.getByLabel("Notes")).toHaveValue("Do not lose me");
    await expect(page).toHaveURL(/panel=edit/);
  });

  test("Scenario: Escape with unsaved changes", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Notes").fill("Unsaved");
    await page.keyboard.press("Escape");
    const dialog = page.getByRole("alertdialog", { name: "Discard your changes?" });
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel("Notes")).toHaveValue("Unsaved");
    await dialog.getByRole("button", { name: "Discard" }).click();
    await expect(page.getByRole("heading", { name: "Kampala Rollout" })).toBeVisible();
  });

  test("Escape with no changes closes the form at once", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByLabel("Website")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Kampala Rollout" })).toBeVisible();
  });

  test("Forms work on phones: no sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await stubApi(page);
    await signedIn(page);
    await page.goto(`/?panel=edit&marker=${ids.kampala}`);
    await expect(page.getByLabel("Website")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
    const form = page.getByRole("complementary", { name: "Edit marker" });
    const panelOverflow = await form.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(panelOverflow).toBe(false);
  });
});

test("Still current: Scenario: Confirming a faded marker", async ({ page }) => {
  const state = await stubApi(page);
  await signedIn(page);
  await page.goto(openKampala);
  await page.getByRole("button", { name: "Still current" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  expect(state.requests[0]).toMatchObject({
    method: "POST",
    path: `/markers/${ids.kampala}/confirm`,
  });
});

test.describe("Delete a marker", () => {
  test("Scenario: Owner deletes", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await expect(page.getByRole("heading", { name: "Kampala Rollout" })).toHaveCount(0);
    await expect(stat(page, "implementations")).toHaveText("7");
    expect(state.requests[0]).toMatchObject({ method: "DELETE" });
  });

  test("Scenario: Confirmation declined", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Kampala Rollout" })).toBeVisible();
    expect(state.requests).toEqual([]);
  });

  test("editors see no delete button", async ({ page }) => {
    await stubApi(page, {
      role: "editor",
      me: {
        username: "asmith",
        admin: false,
        markers: [
          {
            id: ids.kampala,
            name: "Kampala Rollout",
            role: "editor",
            status: "active",
            confirmed_at: NOW,
          },
        ],
        offers: [],
      },
    });
    await signedIn(page, "asmith");
    await page.goto(openKampala);
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "More actions" })).toHaveCount(0);
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByLabel("Website")).toBeVisible();
    await expect(page.getByLabel("Contact email")).toHaveCount(0);
    await expect(page.getByText("Add an editor")).toHaveCount(0);
  });
});

/** Serves the map's data with Kampala closed. */
async function kampalaClosed(page: Page, siteCount?: number) {
  await page.route("**/e2e/atlas.json", async (route) => {
    const snapshot = JSON.parse(await readFile(resolve(STATIC_DIR, "atlas.json"), "utf8")) as {
      markers: Record<string, unknown>[];
    };
    for (const marker of snapshot.markers) {
      if (marker.id === ids.kampala) {
        marker.status = "closed";
        if (siteCount) marker.site_count = siteCount;
      }
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(snapshot) });
  });
}

test.describe("Close and reopen a site", () => {
  test("Scenario: Owner closes a site", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await mapIdle(page);
    await expect(stat(page, "implementations")).toHaveText("8");
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Close site" }).click();
    const details = page.getByRole("complementary", { name: /Details for/ });
    await expect(details.getByText("Closed", { exact: true })).toBeVisible();
    await expect(stat(page, "implementations")).toHaveText("7");
    expect(state.requests[0]).toMatchObject({
      method: "POST",
      path: `/markers/${ids.kampala}/close`,
    });
    await expect(page.getByRole("button", { name: "Still current" })).toHaveCount(0);
  });

  test("Scenario: Owner reopens a site", async ({ page }) => {
    await kampalaClosed(page);
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await expect(stat(page, "implementations")).toHaveText("7");
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Reopen site" }).click();
    await expect(page.getByRole("button", { name: "Still current" })).toBeVisible();
    await expect(stat(page, "implementations")).toHaveText("8");
    expect(state.requests[0]?.path).toBe(`/markers/${ids.kampala}/reopen`);
  });

  test("the menu works by keyboard, and Escape leaves the marker open", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    const trigger = page.getByRole("button", { name: "More actions" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Close site" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("heading", { name: "Kampala Rollout" })).toBeVisible();
  });
});

test.describe("Closed sites on the map", () => {
  test("Scenario: Closed site with many sites", async ({ page }) => {
    await kampalaClosed(page, 50);
    await page.goto("/?map=14/0.3476/32.5825");
    await mapIdle(page);
    const properties = await page.evaluate(
      (id) =>
        window.atlasMap!.querySourceFeatures("markers").find((f) => f.properties.id === id)
          ?.properties,
      ids.kampala,
    );
    expect(properties).toMatchObject({ closed: true, sites: 50, colour: "#B8BDC4" });
    await expect(page.locator(".legend")).toContainText("Closed");
  });

  test("Scenario: Hide closed sites", async ({ page }) => {
    await kampalaClosed(page);
    await page.goto("/");
    await mapIdle(page);
    await page.getByRole("button", { name: "Filters" }).click();
    await page.getByLabel("Show closed sites").uncheck();
    await expect(page).toHaveURL(/closed=hide/);
    await expect(page.getByRole("button", { name: "Filters (on)" })).toBeVisible();
    await expect(page.locator(".legend")).not.toContainText("Closed");
  });

  test("Scenario: Closed site in search results", async ({ page }) => {
    await kampalaClosed(page);
    await page.goto("/");
    await mapIdle(page);
    await page.getByRole("combobox", { name: /Search sites/ }).fill("Kampala Rollout");
    await expect(page.getByRole("option", { name: /Kampala Rollout/ })).toContainText("Closed");
  });
});

test.describe("The page shows when a session has ended", () => {
  test("Scenario: Returning after a while", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await page.evaluate(() => {
      sessionStorage.removeItem("atlas.e2e.token");
      window.dispatchEvent(new Event("focus"));
    });
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("session has ended");
  });

  test("Scenario: Opening a form after the session has ended", async ({ page }) => {
    const state = await stubApi(page);
    state.expireMarkerReads = true;
    await signedIn(page);
    await page.goto(openKampala);
    await mapIdle(page);
    await page.getByRole("button", { name: "Edit" }).click();
    const form = page.getByRole("complementary", { name: "Edit marker" });
    await expect(form.getByRole("button", { name: "Sign in again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(page.getByLabel("Name (required)")).toHaveCount(0);
    await page.mouse.click(300, 400);
    await expect(page.locator(".maplibregl-marker")).toHaveCount(0);
  });

  test("Scenario: Session ends with the form open", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Notes").fill("Do not lose me");
    await page.evaluate(() => {
      sessionStorage.removeItem("atlas.e2e.token");
      window.dispatchEvent(new Event("focus"));
    });
    await expect(page.getByRole("button", { name: "Sign in again" })).toBeVisible();
    await expect(page.getByLabel("Notes")).toHaveValue("Do not lose me");
  });
});

test.describe("Top bar and labels", () => {
  for (const name of ["visitor", "signed in"]) {
    test(`Scenario: Top bar on a phone (${name})`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await stubApi(page);
      if (name === "signed in") await signedIn(page);
      await page.goto("/");
      await mapIdle(page);
      const bar = page.locator(".topbar");
      const boxes = await bar
        .locator("h1, .search, > button")
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
      expect(boxes.length).toBe(4);
      const barBox = await bar.boundingBox();
      for (const box of boxes) {
        expect(box.top).toBeGreaterThanOrEqual(barBox!.y);
        expect(box.bottom).toBeLessThanOrEqual(barBox!.y + barBox!.height);
        expect(box.right).toBeLessThanOrEqual(360);
      }
      expect(barBox!.height).toBeLessThan(56);
    });
  }

  test("Scenario: Latitude and longitude labels", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto("/?panel=add");
    const latitude = await page.getByLabel("Latitude").boundingBox();
    const longitude = await page.getByLabel("Longitude").boundingBox();
    expect(latitude!.y).toBe(longitude!.y);
    await expect(page.getByText("Location (required)")).toBeVisible();
  });
});

test.describe("Manage editors and transfer", () => {
  test("Scenario: Add and remove an editor", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto(`/?panel=edit&marker=${ids.kampala}`);
    await page.getByLabel("Add an editor by OpenMRS ID").fill("bob");
    await page.getByRole("button", { name: "Add editor" }).click();
    await expect(page.getByRole("button", { name: "Remove bob" })).toBeVisible();
    await page.getByRole("button", { name: "Remove asmith" }).click();
    await expect(page.getByRole("button", { name: "Remove asmith" })).toHaveCount(0);
    expect(state.requests.map((r) => r.method)).toEqual(["POST", "DELETE"]);
  });

  test("Scenario: Offer made, then cancelled", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(`/?panel=edit&marker=${ids.kampala}`);
    await page.getByLabel("New owner's OpenMRS ID").fill("carol");
    await page.getByRole("button", { name: "Offer ownership" }).click();
    await expect(page.getByText("Waiting for carol to accept")).toBeVisible();
    await page.getByRole("button", { name: "Cancel offer" }).click();
    await expect(page.getByLabel("New owner's OpenMRS ID")).toBeVisible();
  });
});

test.describe("Account picker", () => {
  test("Scenario: Find a colleague, by keyboard", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto(`/?panel=edit&marker=${ids.kampala}`);
    const field = page.getByRole("combobox", { name: "Add an editor by OpenMRS ID" });
    await field.fill("sm");
    await page.waitForTimeout(400);
    await expect(page.getByRole("listbox", { name: "Matching OpenMRS IDs" })).toHaveCount(0);
    await field.fill("smit");
    const options = page.getByRole("listbox", { name: "Matching OpenMRS IDs" }).getByRole("option");
    await expect(options).toHaveText(["asmithAl Smith", "carolCarol Smithers"]);
    await field.press("ArrowDown");
    await field.press("Enter");
    await expect(field).toHaveValue("carol");
    await page.getByRole("button", { name: "Add editor" }).click();
    await expect(page.getByRole("button", { name: "Remove carol" })).toBeVisible();
    expect(state.requests[0]?.body).toEqual({ username: "carol" });
    const searches = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .filter((n) => n.includes("/api/accounts")),
    );
    expect(searches.every((n) => new URL(n).searchParams.get("q")!.length >= 3)).toBe(true);
  });

  test("Scenario: Unknown OpenMRS ID", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(`/?panel=edit&marker=${ids.kampala}`);
    await page.getByLabel("Add an editor by OpenMRS ID").fill("asmiht");
    await page.getByRole("button", { name: "Add editor" }).click();
    await expect(page.getByRole("alert")).toHaveText('The OpenMRS ID "asmiht" was not found.');
    await expect(page.getByRole("button", { name: "Remove asmiht" })).toHaveCount(0);
  });

  test("Scenario: Offer to an unknown OpenMRS ID", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(`/?panel=edit&marker=${ids.kampala}`);
    await page.getByLabel("New owner's OpenMRS ID").fill("nobody");
    await page.getByRole("button", { name: "Offer ownership" }).click();
    await expect(page.getByRole("alert")).toContainText("was not found");
    await expect(page.getByText("Waiting for nobody")).toHaveCount(0);
  });
});

test.describe("My markers", () => {
  const offerMe = {
    username: "asmith",
    admin: false,
    markers: [
      {
        id: ids.kampala,
        name: "Kampala Rollout",
        role: "editor",
        status: "active",
        confirmed_at: "2025-06-01T00:00:00.000Z",
      },
      {
        id: "hidden-id",
        name: "Hidden Clinic",
        role: "owner",
        status: "closed",
        confirmed_at: "",
        problems: ["unknown type: Hospital"],
      },
    ],
    offers: [
      {
        marker_id: ids.nairobi,
        name: "Nairobi",
        from: "jdoe",
        expires_at: "2026-12-01T00:00:00.000Z",
      },
    ],
  };

  test("Scenario: Owner and editor", async ({ page }) => {
    await stubApi(page, { me: offerMe });
    await signedIn(page, "asmith");
    await page.goto("/?panel=mine");
    const panel = page.getByRole("complementary", { name: "My markers" });
    await expect(panel.getByText("Editor. Last confirmed June 2025.")).toBeVisible();
    await expect(panel.getByText("Owner, closed.")).toBeVisible();
    await expect(panel.getByText("Needs fixing: unknown type: Hospital")).toBeVisible();
    await panel.getByRole("button", { name: "Kampala Rollout" }).click();
    await expect(page.getByRole("heading", { name: "Kampala Rollout" })).toBeVisible();
  });

  test("Scenario: Pending offer", async ({ page }) => {
    const state = await stubApi(page, { me: offerMe });
    await signedIn(page, "asmith");
    await page.goto("/");
    await page.getByRole("button", { name: "asmith (1 waiting)" }).click();
    await page.getByRole("button", { name: "Accept" }).click();
    await expect
      .poll(() => state.requests[0]?.path)
      .toBe(`/markers/${ids.nairobi}/transfer/accept`);
  });

  test("Scenario: Reminder setting", async ({ page }) => {
    const state = await stubApi(page, {
      me: { ...offerMe, email: "al@example.org", reminders: false },
    });
    await signedIn(page, "asmith");
    await page.goto("/?panel=mine");
    const panel = page.getByRole("complementary", { name: "My markers" });
    await expect(panel.getByText("Reminders go to al@example.org")).toBeVisible();
    const box = panel.getByRole("checkbox", { name: "Email me when my markers need confirming" });
    await expect(box).not.toBeChecked();
    await box.check();
    await expect(box).toBeChecked();
    expect(state.requests).toEqual([{ method: "PUT", path: "/me/reminders", body: { on: true } }]);
  });

  test("Hidden markers open straight in the form", async ({ page }) => {
    await stubApi(page, { me: offerMe });
    await signedIn(page, "asmith");
    await page.goto("/?panel=mine");
    await page.getByRole("button", { name: "Hidden Clinic" }).click();
    await expect(page.getByRole("complementary", { name: "Edit marker" })).toBeVisible();
  });
});

test.describe("Admin", () => {
  test("Scenario: Admin can set owner and status, on any marker", async ({ page }) => {
    const state = await stubApi(page, {
      role: "admin",
      me: { username: "root", admin: true, markers: [], offers: [] },
    });
    await signedIn(page, "root");
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Owner", { exact: true }).fill("carol");
    await page.getByLabel("Status").selectOption("hidden");
    await page.getByRole("button", { name: "Save" }).click();
    await expect
      .poll(() => state.requests[0]?.body)
      .toMatchObject({
        owner: "carol",
        status: "hidden",
      });
  });
});
