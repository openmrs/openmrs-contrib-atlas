import { defineConfig } from "vitest/config";

// Unit tests only. Tests against a real Google Sheet live in *.sheet.test.ts
// and run with `npm run test:sheet` (see README).
export default defineConfig({
  test: {
    include: ["*/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.sheet.test.ts"],
    passWithNoTests: true,
  },
});
