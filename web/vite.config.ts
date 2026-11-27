import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { DEFAULT_COUNT_FONT_URL, DEFAULT_MAP_STYLE_URL } from "./src/mapStyle.ts";
import { previewTags } from "./src/previewTags.ts";

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
    transformIndexHtml(_html, ctx) {
      // Builds read the data from the service, on the site's own origin (src/config.ts).
      const data = env.VITE_DATA_BASE_URL || "/data";
      const urls = [
        `${data}/${env.VITE_DATA_FILE || "atlas.json"}`,
        ...(env.VITE_MAP_STYLE_URL
          ? [env.VITE_MAP_STYLE_URL]
          : [DEFAULT_MAP_STYLE_URL, DEFAULT_COUNT_FONT_URL]),
      ];
      const preload = urls.map((href) => ({
        tag: "link",
        attrs: { rel: "preload", as: "fetch", href, crossorigin: "anonymous" },
        injectTo: "head" as const,
      }));
      // Link previews for the home page; reminder.html has nothing to preview.
      const previews = ctx.filename.endsWith("index.html")
        ? previewTags(env.VITE_SITE_URL, data).map((t) => ({ ...t, injectTo: "head" as const }))
        : [];
      return [...preload, ...previews];
    },
  };
}

/**
 * Removes the source-map pointer MapLibre's worker ends with, since its .map isn't published:
 * otherwise developer tools ask for it and get a 404 (openspec small-fixes-for-4-1). The asset's
 * hashed name is fixed by now, and only a comment changes.
 */
function noWorkerSourceMap(): Plugin {
  return {
    name: "atlas-no-worker-source-map",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== "asset" || !file.fileName.endsWith(".mjs")) continue;
        const source =
          typeof file.source === "string" ? file.source : new TextDecoder().decode(file.source);
        file.source = source.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, "\n");
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), devData(), preloads(), noWorkerSourceMap()],
  // MapLibre alone is ~300 KB gzipped; load time is measured on staging instead (task 9.4).
  build: {
    chunkSizeWarningLimit: 1600,
    // The page behind links in reminder emails is separate, so it never loads the map. It must
    // not import styles.css: shared CSS is split out and then loses to MapLibre's.
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        reminder: resolve(import.meta.dirname, "reminder.html"),
      },
    },
  },
  // The service, run locally (see service/README.md), which serves these paths in production.
  server: {
    proxy: Object.fromEntries(
      ["/api", "/data", "/rss", "/marker"].map((path) => [path, "http://localhost:8080"]),
    ),
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-setup.ts"],
  },
});
