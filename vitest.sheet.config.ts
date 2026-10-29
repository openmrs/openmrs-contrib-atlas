import { defineConfig } from "vitest/config";

// Tests against a real Google Sheet. Opt-in: `TEST_SHEET_ID=... npm run test:sheet`.
// Not run in CI; see README, "Test sheet".
export default defineConfig({
  test: {
    include: ["*/src/**/*.sheet.test.ts"],
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});
