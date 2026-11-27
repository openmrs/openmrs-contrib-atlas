import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page, Route } from "@playwright/test";
import { STATIC_DIR, expect, ids, mapIdle, preparePage, stat, test } from "./fixtures.ts";

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
  /** What POST /me/confirm-recent answers, and how often it and GET /me were called. */
  recentConfirmed: string[];
  confirmRecentCalls: number;
  meReads: number;
  /** While set, marker reads and every write wait for it before answering. */
  hold?: Promise<void>;
  /** The name the service holds, if the map shows an older one. */
  sheetName?: string;
}

/** Holds the stubbed service's answers until the test releases them. */
function gate(state: State) {
  let release!: () => void;
  state.hold = new Promise((r) => (release = r));
  return () => {
    state.hold = undefined;
    release();
  };
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
    recentConfirmed: [],
    confirmRecentCalls: 0,
    meReads: 0,
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
    if (path === "/me/confirm-recent" && method === "POST") {
      // Sent by every signed-in page load; kept out of `requests`, which the tests inspect.
      state.confirmRecentCalls++;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ confirmed: state.recentConfirmed, published: true }),
      });
    }
    if (state.hold && (method !== "GET" || path.startsWith("/markers/"))) await state.hold;
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

    if (path === "/me") {
      state.meReads++;
      return json(200, state.me);
    }
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
            name: state.sheetName ?? "Kampala Rollout",
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
    // Stored trimmed and lower-case, as the service does.
    const named = (body as { username?: string } | undefined)?.username?.trim().toLowerCase();
    if (path.endsWith("/editors") && method === "POST" && named === "jdoe") {
      return json(422, {
        error: "That person already owns this marker.",
        errors: [{ field: "username", reason: "That person already owns this marker." }],
      });
    }
    if (named && !ACCOUNTS.some((a) => a.username === named)) {
      return json(422, {
        error: "Please check the OpenMRS ID.",
        errors: [{ field: "username", reason: `The OpenMRS ID "${named}" was not found.` }],
      });
    }
    if (path.endsWith("/editors") && method === "POST") {
      state.editors = [...state.editors, named!];
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

/**
 * Types an OpenMRS ID and leaves the box, as a keyboard user would, so the suggestions close
 * rather than cover the button below.
 */
async function typeId(page: Page, label: string, text: string, exact = false) {
  const box = page.getByLabel(label, { exact });
  await box.fill(text);
  await box.blur();
  await expect(page.getByRole("listbox", { name: "Matching OpenMRS IDs" })).toHaveCount(0);
}

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
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
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

  test("Cancel at the bottom of a scrolled form shows the question in view", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Notes").fill("Unsaved");
    const cancel = page.getByRole("button", { name: "Cancel" });
    await cancel.scrollIntoViewIfNeeded();
    await cancel.click();
    const dialog = page.getByRole("alertdialog", { name: "Discard your changes?" });
    await expect(dialog).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByRole("button", { name: "Keep editing" })).toBeFocused();
    // The form doesn't jump: where the person was stays in view.
    await expect(cancel).toBeInViewport();
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Notes")).toHaveValue("Unsaved");
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

test.describe("Still current", () => {
  test("Scenario: Confirming a faded marker", async ({ page }) => {
    const state = await stubApi(page);
    await kampalaWith(page, { confirmed_at: "2022-01-01T00:00:00.000Z" });
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Still current" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");
    expect(state.requests[0]).toMatchObject({
      method: "POST",
      path: `/markers/${ids.kampala}/confirm`,
    });
  });

  test("Scenario: Recently confirmed marker", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala); // Kampala was confirmed ten months ago.
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Still current" })).toHaveCount(0);
  });
});

test.describe("Signing in keeps recent markers current", () => {
  test("a signed-in page load asks once, and reloads My markers when something changed", async ({
    page,
  }) => {
    const state = await stubApi(page, { recentConfirmed: [ids.kampala] });
    await signedIn(page);
    await page.goto("/?panel=mine");
    await expect(page.getByRole("complementary", { name: "My markers" })).toBeVisible();
    await expect.poll(() => state.meReads).toBe(2);
    expect(state.confirmRecentCalls).toBe(1);
  });

  test("nothing confirmed: My markers isn't reloaded", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto("/?panel=mine");
    await expect.poll(() => state.confirmRecentCalls).toBe(1);
    expect(state.meReads).toBe(1);
  });

  test("visitors never ask", async ({ page }) => {
    const state = await stubApi(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(state.confirmRecentCalls).toBe(0);
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

/** Serves the map's data with these fields changed on Kampala. */
async function kampalaWith(page: Page, fields: Record<string, unknown>) {
  await page.route("**/e2e/atlas.json", async (route) => {
    const snapshot = JSON.parse(await readFile(resolve(STATIC_DIR, "atlas.json"), "utf8")) as {
      markers: Record<string, unknown>[];
    };
    for (const marker of snapshot.markers) {
      if (marker.id === ids.kampala) Object.assign(marker, fields);
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(snapshot) });
  });
}

/** Serves the map's data with Kampala closed. */
async function kampalaClosed(page: Page, siteCount?: number) {
  await kampalaWith(page, { status: "closed", ...(siteCount ? { site_count: siteCount } : {}) });
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
    await expect(stat(page, "implementations")).toHaveText("8");
    // Reopening restarts the clock, so "Still current" isn't offered again.
    await expect(page.getByRole("button", { name: "Still current" })).toHaveCount(0);
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
      expect(boxes.length).toBe(5);
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
    await typeId(page, "Add an editor by OpenMRS ID", "bob");
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
    await typeId(page, "New owner's OpenMRS ID", "carol");
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

  // specs/account-lookup, "Suggestions in OpenMRS ID fields": the phone rule for the top bar's
  // search results once pinned these to the top of the screen, off-screen behind an iPhone's
  // keyboard.
  test("Scenario: On a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubApi(page);
    await signedIn(page);
    await page.goto(`/?panel=edit&marker=${ids.kampala}`);
    const field = page.getByRole("combobox", { name: "Add an editor by OpenMRS ID" });
    await field.scrollIntoViewIfNeeded();
    await field.pressSequentially("smit");
    const list = page.getByRole("listbox", { name: "Matching OpenMRS IDs" });
    await expect(list.getByRole("option")).toHaveText(["asmithAl Smith", "carolCarol Smithers"]);
    const fieldBox = (await field.boundingBox())!;
    const listBox = (await list.boundingBox())!;
    expect(Math.abs(listBox.y - (fieldBox.y + fieldBox.height))).toBeLessThanOrEqual(8);
    expect(listBox.x).toBeCloseTo(fieldBox.x, 0);
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
    await panel.getByRole("button", { name: "Kampala Rollout", exact: true }).click();
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

  test("Scenario: Back to the list", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto("/?panel=mine");
    const panel = page.getByRole("complementary", { name: "My markers" });
    await panel.getByRole("button", { name: "Kampala Rollout", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Kampala Rollout" })).toBeFocused();
    await page.getByRole("button", { name: "Back to My markers" }).click();
    await expect(panel.getByRole("button", { name: "Kampala Rollout", exact: true })).toBeFocused();

    // And with Backspace (Delete on a Mac).
    await panel.getByRole("button", { name: "Kampala Rollout", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Kampala Rollout" })).toBeFocused();
    await page.keyboard.press("Backspace");
    await expect(panel.getByRole("button", { name: "Kampala Rollout", exact: true })).toBeFocused();
  });

  test("Scenario: Opened from the map", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await expect(page.getByRole("heading", { name: "Kampala Rollout" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to My markers" })).toHaveCount(0);
    await page.keyboard.press("Backspace");
    await expect(page.getByRole("heading", { name: "Kampala Rollout" })).toBeVisible();
  });

  test("Scenario: Update an old marker", async ({ page }) => {
    const state = await stubApi(page); // Kampala was last confirmed in 2020.
    await signedIn(page);
    await page.goto("/?panel=mine");
    const panel = page.getByRole("complementary", { name: "My markers" });
    const update = panel.getByRole("button", { name: "Mark Kampala Rollout still current" });
    await expect(update).toBeVisible();
    state.me = {
      ...state.me,
      markers: [{ ...(state.me.markers as object[])[0], confirmed_at: "2026-11-01T00:00:00.000Z" }],
    };
    await update.click();
    await expect(page.getByRole("status")).toContainText("Saved");
    expect(state.requests[0]).toMatchObject({
      method: "POST",
      path: `/markers/${ids.kampala}/confirm`,
    });
    await expect(panel.getByText("Last confirmed November 2026.")).toBeVisible();
    await expect(panel.getByRole("button", { name: /still current/ })).toHaveCount(0);
  });

  test("Scenario: Recent marker", async ({ page }) => {
    await stubApi(page, {
      me: {
        username: "jdoe",
        admin: false,
        markers: [
          {
            id: ids.kampala,
            name: "Kampala Rollout",
            role: "owner",
            status: "active",
            confirmed_at: "2026-09-01T00:00:00.000Z",
          },
        ],
        offers: [],
      },
    });
    await signedIn(page);
    await page.goto("/?panel=mine");
    const panel = page.getByRole("complementary", { name: "My markers" });
    await expect(panel.getByText("Last confirmed September 2026.")).toBeVisible();
    await expect(panel.getByRole("button", { name: /still current/ })).toHaveCount(0);
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
    await typeId(page, "Owner", "carol", true);
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

test.describe("Prompt to share after adding or confirming", () => {
  const notice = (page: Page) => page.locator(".notice");

  test("Scenario: After adding a marker", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.route("**/marker/*/card.png", (route) => route.fulfill({ status: 404 }));
    await page.goto("/?panel=add");
    await page.getByLabel("Name (required)").fill("New Site");
    await page.getByLabel("Latitude").fill("10");
    await page.getByLabel("Longitude").fill("20");
    await page.getByLabel("Type (required)").selectOption("Clinical");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(notice(page)).toContainText("within 10 minutes");
    await notice(page).getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("dialog", { name: "Share New Site" })).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
  });

  test("Scenario: Not published yet", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.route("**/api/markers", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "new-id",
          version: NOW,
          status: "active",
          marker: { id: "new-id", name: "New Site", latitude: 10, longitude: 20, type: "Clinical" },
          published: false,
        }),
      });
    });
    await page.goto("/?panel=add");
    await page.getByLabel("Name (required)").fill("New Site");
    await page.getByLabel("Latitude").fill("10");
    await page.getByLabel("Longitude").fill("20");
    await page.getByLabel("Type (required)").selectOption("Clinical");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(notice(page)).toContainText("after the next publish");
    await expect(notice(page).getByRole("button", { name: "Share" })).toHaveCount(0);
  });

  test("Scenario: Ordinary edit", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(notice(page)).toContainText("Saved");
    await expect(notice(page).getByRole("button", { name: "Share" })).toHaveCount(0);
  });

  test("after Still current", async ({ page }) => {
    await stubApi(page);
    await kampalaWith(page, { confirmed_at: "2022-01-01T00:00:00.000Z" });
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Still current" }).click();
    await notice(page).getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("dialog", { name: /^Share / })).toBeVisible();
  });

  test('Scenario: After "Update" in My markers', async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto("/?panel=mine");
    await mapIdle(page);
    await page.getByRole("button", { name: "Mark Kampala Rollout still current" }).click();
    await notice(page).getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("dialog", { name: /^Share / })).toBeVisible();
    await expect(page.getByRole("heading", { name: "My markers" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "My markers" })).toBeVisible();
  });
});

test.describe("Changes show while they're saved", () => {
  test("Scenario: Adding", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    const sharing = page.getByRole("region", { name: "Sharing" });
    await expect(sharing.getByRole("button", { name: "Remove asmith" })).toBeVisible();
    const release = gate(state);
    await typeId(page, "Add an editor by OpenMRS ID", "Bob");
    await page.getByRole("button", { name: "Add editor" }).click();
    await expect(sharing.getByRole("listitem").filter({ hasText: "bob" })).toContainText("Adding…");
    await expect(page.getByRole("button", { name: "Adding…" })).toBeDisabled();
    release();
    await expect(sharing.getByRole("button", { name: "Remove bob" })).toBeVisible();
    await expect(sharing.getByText("Adding…")).toHaveCount(0);
  });

  test("Scenario: Removing", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("button", { name: "Remove asmith" })).toBeVisible();
    const release = gate(state);
    await page.getByRole("button", { name: "Remove asmith" }).click();
    await expect(page.getByRole("button", { name: "Remove asmith" })).toHaveCount(0);
    release();
    await expect.poll(() => state.editors).toEqual([]);
    await expect(page.getByRole("button", { name: "Remove asmith" })).toHaveCount(0);
  });

  test("Scenario: Unknown OpenMRS ID", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    const box = page.getByLabel("Add an editor by OpenMRS ID");
    await expect(box).toBeEnabled();
    const release = gate(state);
    await box.fill("asmiht");
    await page.getByRole("button", { name: "Add editor" }).click();
    await expect(page.getByText("Adding…").first()).toBeVisible();
    release();
    await expect(page.getByRole("alert")).toContainText("asmiht");
    await expect(page.getByText("Adding…")).toHaveCount(0);
    await expect(box).toHaveValue("asmiht");
  });

  test("Scenario: Owner added as editor, with the error under the box", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    const box = page.getByLabel("Add an editor by OpenMRS ID");
    await box.fill("jdoe");
    await page.getByRole("button", { name: "Add editor" }).click();
    const error = page.getByRole("alert").filter({ hasText: "already owns this marker" });
    await expect(error).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove jdoe" })).toHaveCount(0);
    // Between the box and its button, where it's in view.
    const [boxAt, errorAt, buttonAt] = await Promise.all([
      box.boundingBox(),
      error.boundingBox(),
      page.getByRole("button", { name: "Add editor" }).boundingBox(),
    ]);
    expect(errorAt!.y).toBeGreaterThan(boxAt!.y);
    expect(errorAt!.y).toBeLessThan(buttonAt!.y);
  });

  test("a transfer error shows under the new owner's box", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    const box = page.getByLabel("New owner's OpenMRS ID");
    await box.fill("nobody");
    await page.getByRole("button", { name: "Offer ownership" }).click();
    const error = page.getByRole("alert").filter({ hasText: "nobody" });
    await expect(error).toBeVisible();
    const [boxAt, errorAt, buttonAt] = await Promise.all([
      box.boundingBox(),
      error.boundingBox(),
      page.getByRole("button", { name: "Offer ownership" }).boundingBox(),
    ]);
    expect(errorAt!.y).toBeGreaterThan(boxAt!.y);
    expect(errorAt!.y).toBeLessThan(buttonAt!.y);
  });

  test("Scenario: Removal fails", async ({ page }) => {
    await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.route("**/api/markers/*/editors/*", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
    );
    await page.getByRole("button", { name: "Remove asmith" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove asmith" })).toBeVisible();
  });

  test("Scenario: Save in progress", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    const form = page.getByRole("complementary", { name: "Edit marker" });
    await page.getByLabel("Name (required)").fill("Renamed Rollout");
    const release = gate(state);
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await expect(form.getByRole("status")).toContainText("Saving your changes");
    await expect(page.getByLabel("Name (required)")).toBeDisabled();
    await expect(form.getByRole("button", { name: "Cancel" })).toBeDisabled();
    release();
    await expect(form).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Renamed Rollout" })).toBeVisible();
  });

  test("Scenario: Save refused", async ({ page }) => {
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
    await expect(page.getByLabel("Website")).toBeEnabled();
    await expect(page.getByLabel("Website")).toHaveValue("https://typed.example");
    await expect(page.getByLabel("Website")).toHaveAttribute("aria-invalid", "true");
  });

  test("Scenario: Opening", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await page.goto(openKampala);
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    const release = gate(state);
    await page.getByRole("button", { name: "Edit" }).click();
    const form = page.getByRole("complementary", { name: "Edit marker" });
    await expect(page.getByLabel("Name (required)")).toHaveValue("Kampala Rollout");
    await expect(page.getByLabel("Name (required)")).toBeDisabled();
    await expect(form.getByRole("status")).toContainText("Loading the rest");
    await expect(form.getByRole("button", { name: "Save" })).toBeDisabled();
    await expect(page.getByLabel("Contact name")).toHaveCount(0);
    release();
    await expect(page.getByLabel("Name (required)")).toBeEnabled();
    await expect(page.getByLabel("Contact name")).toBeVisible();
    await expect(form.getByText("Loading the rest")).toHaveCount(0);
  });

  test("Scenario: The map is behind", async ({ page }) => {
    const state = await stubApi(page, { sheetName: "Kampala Rollout (renamed)" });
    await signedIn(page);
    await page.goto(openKampala);
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    const release = gate(state);
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByLabel("Name (required)")).toHaveValue("Kampala Rollout");
    release();
    await expect(page.getByLabel("Name (required)")).toHaveValue("Kampala Rollout (renamed)");
    await expect(page.getByLabel("Name (required)")).toBeEnabled();
  });

  test("Scenario: Marker not on the map", async ({ page }) => {
    const hiddenMe = {
      username: "asmith",
      admin: false,
      markers: [
        {
          id: "hidden-id",
          name: "Hidden Clinic",
          role: "owner",
          status: "hidden",
          confirmed_at: "",
        },
      ],
      offers: [],
    };
    const state = await stubApi(page, { me: hiddenMe });
    await signedIn(page, "asmith");
    await page.goto("/?panel=mine");
    const release = gate(state);
    await page.getByRole("button", { name: "Hidden Clinic" }).click();
    const form = page.getByRole("complementary", { name: "Edit marker" });
    await expect(form.getByRole("status")).toHaveText("Loading…");
    await expect(page.getByLabel("Name (required)")).toHaveCount(0);
    release();
  });
});

// specs/user-sign-in: signed in across tabs and visits, keeping a sign-in, and signing in again
// for weighty actions. In e2e builds a sign-in writes the test token to localStorage, and records
// how it was asked for under `atlas.e2e.sign-in`.
test.describe("Staying signed in", () => {
  const asJdoe = (page: Page) =>
    page.addInitScript(() => localStorage.setItem("atlas.e2e.account", "jdoe"));
  const signInThroughThePanel = async (page: Page, keep = false) => {
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    if (keep) await page.getByLabel("Keep me signed in on this device").check();
    await page.getByRole("button", { name: "Sign in with OpenMRS ID" }).click();
    await expect(page.getByRole("button", { name: "jdoe" })).toBeVisible();
  };
  const lastSignIn = (page: Page) =>
    page.evaluate(() => JSON.parse(localStorage.getItem("atlas.e2e.sign-in") ?? "null"));

  test("Scenario: New tab", async ({ page, context }) => {
    await stubApi(page);
    await asJdoe(page);
    await page.goto(openKampala);
    await signInThroughThePanel(page);
    const other = await context.newPage();
    await preparePage(other);
    await stubApi(other);
    await other.goto("/");
    await expect(other.getByRole("button", { name: "jdoe" })).toBeVisible();
  });

  test("Scenario: Signing out in another tab", async ({ page, context }) => {
    await stubApi(page);
    await asJdoe(page);
    await page.goto(openKampala);
    await signInThroughThePanel(page);
    const other = await context.newPage();
    await preparePage(other);
    await stubApi(other);
    await other.goto(openKampala);
    await expect(other.getByRole("button", { name: "Edit" })).toBeVisible();
    // Signing in opened My markers, where Sign out is.
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(other.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(other.getByRole("button", { name: "Edit" })).toHaveCount(0);
  });

  test("Scenario: Keep me signed in is off by default", async ({ page }) => {
    await stubApi(page);
    await asJdoe(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const keep = page.getByLabel("Keep me signed in on this device");
    await expect(keep).not.toBeChecked();
    await expect(page.getByText("Only on a device you don't share.")).toBeVisible();
    await page.getByRole("button", { name: "Sign in with OpenMRS ID" }).click();
    await expect(page.getByRole("button", { name: "jdoe" })).toBeVisible();
    expect(await lastSignIn(page)).toEqual({ keep: false, fresh: false });
  });

  test("ticking Keep me signed in asks for a kept sign-in, and signing out forgets it", async ({
    page,
  }) => {
    await stubApi(page);
    await asJdoe(page);
    await page.goto("/");
    await signInThroughThePanel(page, true);
    expect(await lastSignIn(page)).toEqual({ keep: true, fresh: false });
    expect(await page.evaluate(() => localStorage.getItem("atlas.keep"))).toBe("1");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("atlas.keep"))).toBeNull();
  });

  const signInAgain = { error: "Please sign in again to do this.", code: "sign-in-again" };

  test("Scenario: Offering a transfer on a long sign-in", async ({ page }) => {
    const state = await stubApi(page);
    await signedIn(page);
    await asJdoe(page);
    let asked = false;
    await page.route("**/api/markers/*/transfer", (route) => {
      if (route.request().method() !== "POST" || asked) return route.fallback();
      asked = true;
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify(signInAgain),
      });
    });
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("New owner's OpenMRS ID").fill("asmith");
    await page.getByRole("button", { name: "Offer ownership" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "For your safety" })).toBeVisible();
    // Scenario: Sign-in again is not a lapsed session.
    await expect(page.getByRole("button", { name: "jdoe" })).toBeVisible();
    await expect(page.getByText("session has ended")).toHaveCount(0);

    await page.getByRole("button", { name: "Sign in again" }).click();
    await expect(page).toHaveURL(/panel=edit/);
    expect(await lastSignIn(page)).toMatchObject({ fresh: true });
    await expect(page.getByLabel("New owner's OpenMRS ID")).toHaveValue("asmith");
    await page.getByRole("button", { name: "Offer ownership" }).click();
    await expect(page.getByText("Waiting for asmith to accept")).toBeVisible();
    expect(state.requests.filter((r) => r.path.endsWith("/transfer"))).toHaveLength(1);
  });

  test("Scenario: Admin edits someone else's marker", async ({ page }) => {
    const state = await stubApi(page, {
      role: "admin",
      me: { username: "root", admin: true, markers: [], offers: [] },
    });
    state.nextPatch = { status: 401, body: signInAgain };
    await signedIn(page, "root");
    await page.addInitScript(() => localStorage.setItem("atlas.e2e.account", "root"));
    await page.goto(openKampala);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Notes").fill("Checked by an admin");
    const save = page.getByRole("button", { name: "Save" });
    await save.scrollIntoViewIfNeeded();
    await save.click();
    // In view however far down the form is, like "Discard your changes?".
    const prompt = page.getByRole("alert").filter({ hasText: "For your safety" });
    await expect(prompt).toBeInViewport({ ratio: 1 });
    await expect(prompt.getByRole("button", { name: "Sign in again" })).toBeFocused();
    await expect(save).toBeInViewport();
    await expect(page.getByRole("button", { name: "root" })).toBeVisible();
    await page.getByRole("button", { name: "Sign in again" }).click();
    await expect(page).toHaveURL(/panel=edit/);
    expect(await lastSignIn(page)).toMatchObject({ fresh: true });
    await expect(page.getByLabel("Notes")).toHaveValue("Checked by an admin");
  });
});
