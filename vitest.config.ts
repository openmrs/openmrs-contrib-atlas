import { defineConfig } from "vitest/config";

// Unit tests only. Tests against a real Google Sheet live in *.sheet.test.ts
// and run with `npm run test:sheet` (see README).
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "node",
          include: ["{shared,service,migration,apps-script}/src/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/*.sheet.test.ts"],
        },
      },
      "web/vite.config.ts",
    ],
  },
});
