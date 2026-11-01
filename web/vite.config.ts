import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { DEFAULT_COUNT_FONT_URL, DEFAULT_MAP_STYLE_URL } from "./src/mapStyle.ts";

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

/** Fetches the data and map style alongside the code, not after it, in published builds. */
function preloads(): Plugin {
  let env: Record<string, string> = {};
  return {
    name: "atlas-preloads",
    apply: "build",
    configResolved(config) {
      env = config.env as Record<string, string>;
    },
    transformIndexHtml() {
      const data = env.VITE_DATA_BASE_URL;
      const urls = [
        ...(data ? [`${data}/${env.VITE_DATA_FILE || "atlas.json"}`] : []),
        ...(env.VITE_MAP_STYLE_URL
          ? [env.VITE_MAP_STYLE_URL]
          : [DEFAULT_MAP_STYLE_URL, DEFAULT_COUNT_FONT_URL]),
      ];
      return urls.map((href) => ({
        tag: "link",
        attrs: { rel: "preload", as: "fetch", href, crossorigin: "anonymous" },
        injectTo: "head" as const,
      }));
    },
  };
}

export default defineConfig({
  plugins: [react(), devData(), preloads()],
  // MapLibre alone is ~300 KB gzipped; load time is measured on staging instead (task 9.4).
  build: { chunkSizeWarningLimit: 1600 },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-setup.ts"],
  },
});
