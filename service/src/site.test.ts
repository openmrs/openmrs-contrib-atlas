import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { CACHE, contentSecurityPolicy, dataFile, TYPES } from "./site.ts";
import { FakeBucket, FakeSheet } from "./testing.ts";

let root: string;
let app: ReturnType<typeof createApp>;

const STAGING_KEYCLOAK = "https://id-stg.openmrs.org/realms/openmrs";
const PRODUCTION_KEYCLOAK = "https://id.openmrs.org/realms/openmrs";

async function put(path: string, body: string) {
  await mkdir(join(root, path, ".."), { recursive: true });
  await writeFile(join(root, path), body);
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "atlas-site-"));
  await put("web/index.html", "<!doctype html><title>Atlas</title>");
  await put("web/reminder.html", "<!doctype html><title>Reminder</title>");
  await put("web/assets/main-abc123.js", "console.log('atlas');".repeat(100));
  await put("web/assets/maplibre-gl-worker-abc123.mjs", "self.onmessage = () => {};");
  await put("web/assets/thing-abc123.xyz", "a type the service doesn't know");
  await put("web/favicon-32.png", "png");
  await put("web/.hidden", "secret");
  await put("data/atlas.json", JSON.stringify({ markers: [] }));
  await put("data/markers.csv", "id\n");
  await put("data/markers.geojson", "{}");
  await put("data/rss.xml", "<rss/>");
  await put("data/history/atlas-2026-11-23T03-00-00-000Z.json", "{}");
  await put("data/logos/a.webp", "webp");
  await put("data/cards/m1-abc.png", "png");
  await put("data/cards/world.png", "png");
  await put("data/secret.txt", "not public");
  app = createApp({
    sheet: new FakeSheet(),
    snapshots: new FakeBucket(),
    auth: { publishSecret: "s" },
    siteUrl: "https://atlas.example.org",
    site: {
      webDir: join(root, "web"),
      dataDir: join(root, "data"),
      keycloakIssuer: STAGING_KEYCLOAK,
    },
    about: { environment: "staging", commit: "abc1234" },
  });
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const get = (path: string, headers: Record<string, string> = {}) => app.request(path, { headers });

describe("published files (specs/deployment, One container serves the Atlas)", () => {
  it.each([
    ["/data/atlas.json", "application/json"],
    ["/data/markers.csv", "text/csv; charset=utf-8"],
    ["/data/markers.geojson", "application/geo+json"],
    ["/rss", "application/rss+xml; charset=utf-8"],
  ])("%s is served directly, with short caching", async (path, type) => {
    const res = await get(path);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(type);
    expect(res.headers.get("Cache-Control")).toBe(CACHE.published);
  });

  it("serves logos for a year, cards for good and the world card for an hour", async () => {
    expect((await get("/data/logos/a.webp")).headers.get("Cache-Control")).toBe(CACHE.logo);
    expect((await get("/data/cards/m1-abc.png")).headers.get("Cache-Control")).toBe(
      CACHE.immutable,
    );
    expect((await get("/data/cards/world.png")).headers.get("Cache-Control")).toBe(CACHE.world);
    expect((await get("/data/logos/a.webp")).headers.get("Content-Type")).toBe("image/webp");
  });

  it.each([
    "/data/history/atlas-2026-11-23T03-00-00-000Z.json",
    "/data/secret.txt",
    "/data/../secret.txt",
    "/data/%2e%2e/secret.txt",
    "/data/..%2fsecret.txt",
    "/data/logos/../secret.txt",
    "/data/logos/.a.webp.tmp",
    "/data/logos/missing.webp",
  ])("%s is not served", async (path) => {
    expect((await get(path)).status).toBe(404);
  });

  it("answers 304 when the browser's copy is current", async () => {
    const first = await get("/data/atlas.json");
    const etag = first.headers.get("ETag")!;
    expect((await get("/data/atlas.json", { "If-None-Match": etag })).status).toBe(304);
  });

  it("names only the published files and single logo or card files", () => {
    expect(dataFile("atlas.json")).toBe("atlas.json");
    expect(dataFile("logos/a.webp")).toBe("logos/a.webp");
    expect(dataFile("history/x.json")).toBeUndefined();
    expect(dataFile("logos/x/y.webp")).toBeUndefined();
    expect(dataFile("logos/..")).toBeUndefined();
  });
});

describe("the map site", () => {
  it("serves the map at / with the security headers (specs/deployment)", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>Atlas</title>");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Content-Security-Policy")).toBe(
      contentSecurityPolicy(STAGING_KEYCLOAK),
    );
  });

  it("serves the reminder page at a clean URL, sending no referrer", async () => {
    const res = await get("/reminder?t=abc");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Reminder");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'self'");
  });

  it("redirects .html addresses to clean ones, keeping the query", async () => {
    const res = await get("/reminder.html?t=abc");
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/reminder?t=abc");
    expect((await get("/index.html")).headers.get("Location")).toBe("/");
  });

  it("caches hashed bundles for good and other files for an hour", async () => {
    expect((await get("/assets/main-abc123.js")).headers.get("Cache-Control")).toBe(
      CACHE.immutable,
    );
    expect((await get("/favicon-32.png")).headers.get("Cache-Control")).toBe(CACHE.other);
  });

  it("serves module scripts, such as MapLibre's worker, as JavaScript", async () => {
    const res = await get("/assets/maplibre-gl-worker-abc123.mjs");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe(CACHE.immutable);
  });

  // specs/deployment, "Only files of a known type are cached for good": a missing type once
  // kept Safari on a broken MapLibre worker for good.
  it("caches a file of unknown type for an hour at most, even under /assets/", async () => {
    const res = await get("/assets/thing-abc123.xyz");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(res.headers.get("Cache-Control")).toBe(CACHE.other);
  });

  it("knows the content type of every file the site's build can emit", async () => {
    // Vite's output (scripts, module workers, styles, fonts, images) plus everything in
    // web/public, which Vite copies as is. A missing type goes out as octet-stream, and nosniff
    // makes the browser refuse it.
    const publicDir = fileURLToPath(new URL("../../web/public/", import.meta.url));
    const publicFiles = await readdir(publicDir, { recursive: true, withFileTypes: true });
    const extensions = new Set([".html", ".js", ".mjs", ".css", ".woff", ".woff2", ".svg", ".png"]);
    for (const file of publicFiles) if (file.isFile()) extensions.add(extname(file.name));
    const missing = [...extensions].filter((ext) => !(ext.toLowerCase() in TYPES));
    expect(missing).toEqual([]);
  });

  it("compresses text for clients that accept it", async () => {
    const res = await get("/assets/main-abc123.js", { "Accept-Encoding": "gzip" });
    expect(res.headers.get("Content-Encoding")).toBe("gzip");
  });

  it("hides dot files and answers 404 for unknown paths", async () => {
    expect((await get("/.hidden")).status).toBe(404);
    expect((await get("/nothing-here")).status).toBe(404);
  });

  it("sends nosniff and the permissions policy on every response, the API's too", async () => {
    for (const path of ["/", "/data/atlas.json", "/health", "/api/markers"]) {
      const res = await get(path);
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Permissions-Policy")).toContain("geolocation=()");
    }
  });

  it("leaves the API and health routes to the service", async () => {
    expect(await (await get("/health")).json()).toEqual({
      ok: true,
      environment: "staging",
      commit: "abc1234",
    });
    expect((await get("/api/markers")).status).toBe(503);
  });
});

describe("Content-Security-Policy (specs/deployment)", () => {
  const staging = contentSecurityPolicy(STAGING_KEYCLOAK);
  const production = contentSecurityPolicy(PRODUCTION_KEYCLOAK);

  it("allows only the origins the site uses, with no inline code", () => {
    expect(staging).toContain("default-src 'self'");
    expect(staging).toContain("frame-ancestors 'self'");
    expect(staging).toContain("object-src 'none'");
    expect(staging).toContain("form-action 'self'");
    expect(staging).toContain("frame-src https://id-stg.openmrs.org");
    expect(staging).toContain("https://tiles.openfreemap.org");
    expect(staging).toContain("https://nominatim.openstreetmap.org");
    expect(staging).not.toContain("storage.googleapis.com");
    expect(staging).not.toContain("unsafe-inline");
    expect(staging).not.toContain("unsafe-eval");
  });

  it("differs between environments only in the Keycloak host", () => {
    expect(production.replaceAll("https://id.openmrs.org", "KEYCLOAK")).toBe(
      staging.replaceAll("https://id-stg.openmrs.org", "KEYCLOAK"),
    );
    expect(production).not.toContain("id-stg");
  });
});
