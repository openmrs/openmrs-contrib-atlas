import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/** Serves web/dev-data/ at /dev-data/ in the dev server only, so it never ships in a build. */
function devData(): Plugin {
  return {
    name: "atlas-dev-data",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/dev-data", async (req, res, next) => {
        try {
          const file = resolve(import.meta.dirname, "dev-data", `.${req.url ?? ""}`);
          const body = await readFile(file);
          res.setHeader("Content-Type", "application/json");
          res.end(body);
        } catch {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devData()],
  // MapLibre alone is ~300 KB gzipped; load time is measured on staging instead (task 9.4).
  build: { chunkSizeWarningLimit: 1600 },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-setup.ts"],
  },
});
