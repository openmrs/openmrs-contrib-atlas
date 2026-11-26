import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { COMMON_HEADERS, pageHeaders } from "../../service/src/site.ts";

export const STATIC_DIR = resolve(import.meta.dirname, "static");
export const NOW = new Date("2026-11-01T00:00:00Z");

/**
 * The security headers the service sends with the site's pages (service/src/site.ts,
 * specs/deployment), for the e2e build's Keycloak, so every test runs under the real policy.
 */
const E2E_KEYCLOAK = "https://id.e2e.invalid/realms/openmrs";
const PAGE_HEADERS = { ...COMMON_HEADERS, ...pageHeaders("index.html", E2E_KEYCLOAK) };
const REMINDER_HEADERS = { ...COMMON_HEADERS, ...pageHeaders("reminder.html", E2E_KEYCLOAK) };
const isPage = (path: string) => path === "/" || path === "/index.html";
const isReminder = (path: string) => path === "/reminder" || path === "/reminder.html";

/**
 * Serves /e2e/* from e2e/static, fixes the clock, and applies the site's security headers, for
 * every test. A test fails if the Content-Security-Policy blocks anything, unless it sets
 * `allowCspViolations` to check the policy itself.
 */
export const test = base.extend<{ allowCspViolations: boolean; cspViolations: string[] }>({
  allowCspViolations: [false, { option: true }],
  cspViolations: [
    // Playwright requires an object pattern here, even for a fixture that depends on nothing.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use([]);
    },
    { scope: "test" },
  ],
  page: async ({ page, allowCspViolations, cspViolations }, use) => {
    await page.exposeFunction("__reportCsp", (violation: string) => {
      cspViolations.push(violation);
    });
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        const report = (window as unknown as { __reportCsp?: (v: string) => void }).__reportCsp;
        report?.(`${e.violatedDirective} blocked ${e.blockedURI || "inline"}`);
      });
    });
    await page.route(
      (url) =>
        url.origin === "http://localhost:4173" &&
        (isPage(url.pathname) || isReminder(url.pathname)),
      async (route) => {
        const response = await route.fetch();
        const path = new URL(route.request().url()).pathname;
        await route.fulfill({
          response,
          headers: {
            ...response.headers(),
            ...(isReminder(path) ? REMINDER_HEADERS : PAGE_HEADERS),
          },
        });
      },
    );
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
    if (!allowCspViolations)
      expect(cspViolations, "Content-Security-Policy violations").toEqual([]);
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
