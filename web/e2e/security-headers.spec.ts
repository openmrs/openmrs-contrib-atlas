import { expect, mapIdle, test } from "./fixtures.ts";

/** specs/deployment: The site is served with security headers. */

test.describe("The site is served with security headers", () => {
  test.use({ allowCspViolations: true });

  test("Scenario: Script from elsewhere", async ({ page, cspViolations }) => {
    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy"]).toContain("default-src 'self'");
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
    await mapIdle(page);
    const ran = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const script = document.createElement("script");
          script.src = "https://evil.example/steal.js";
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.head.appendChild(script);
        }),
    );
    expect(ran).toBe(false);
    await expect.poll(() => cspViolations.join("\n")).toContain("script-src");
    // An inline script is refused too.
    await page.evaluate(() => {
      const script = document.createElement("script");
      script.textContent = "window.__injected = true";
      document.head.appendChild(script);
    });
    expect(await page.evaluate(() => "__injected" in window)).toBe(false);
  });

  test("the reminder page keeps no-referrer under the same policy", async ({ page }) => {
    const response = await page.goto("/reminder");
    expect(response?.headers()["content-security-policy"]).toContain("object-src 'none'");
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  });
});
