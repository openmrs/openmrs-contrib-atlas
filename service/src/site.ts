import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { Context, Hono } from "hono";
import { compress } from "hono/compress";

/**
 * The map site, the published files and the logos, all served by the service on the site's own
 * origin, with the site's security and caching headers (specs/deployment).
 */
export interface SiteConfig {
  /** The built map site (`web/dist`). Without it, only the data files are served. */
  webDir?: string;
  /** The data folder the publish writes to (see storage.ts). */
  dataDir: string;
  /** The environment's Keycloak issuer: its origin is the only sign-in host the policy allows. */
  keycloakIssuer?: string;
}

/**
 * Content types by extension. Anything missing goes out as application/octet-stream, which
 * nosniff makes browsers refuse as a script or style, so every type the site's build emits must
 * be here (site.test.ts checks web/public and Vite's output types). Only files with a type here
 * are cached for good; anything else is cached for an hour at most.
 */
export const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  // MapLibre's worker is a module file; without its type the map draws no tiles or markers.
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".geojson": "application/geo+json",
  ".csv": "text/csv; charset=utf-8",
  ".xml": "application/rss+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export const CACHE = {
  /** Vite's hashed bundles. */
  immutable: "public, max-age=31536000, immutable",
  /** The pages that load them, so a deploy shows at once. */
  page: "no-cache",
  /** Published files: visitors see a publish within 10 minutes (specs/snapshot-publishing). */
  published: "public, max-age=300",
  /** Logos have unique names (specs/marker-editing). */
  logo: "public, max-age=31536000",
  /** The world card keeps its name and changes now and then (specs/social-cards). */
  world: "public, max-age=3600",
  /** Icons, badges and anything else in the site. */
  other: "public, max-age=3600",
} as const;

/** The published files the service serves under /data/ (specs/snapshot-publishing). */
const PUBLISHED = new Set(["atlas.json", "markers.csv", "markers.geojson", "rss.xml"]);
/** One file name, with no folders and no leading dot. */
const SAFE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

/**
 * The Content-Security-Policy for the map and reminder pages. Only the origins the site uses:
 * itself, OpenFreeMap, Nominatim, the environment's Keycloak and Google Analytics.
 */
export function contentSecurityPolicy(keycloakIssuer?: string): string {
  const keycloak = keycloakIssuer ? new URL(keycloakIssuer).origin : undefined;
  const analytics = "https://*.google-analytics.com https://*.googletagmanager.com";
  return [
    "default-src 'self'",
    "script-src 'self' https://www.googletagmanager.com",
    "style-src 'self'",
    `img-src 'self' data: ${analytics}`,
    "font-src 'self'",
    [
      "connect-src 'self' https://tiles.openfreemap.org https://nominatim.openstreetmap.org",
      keycloak,
      "https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
    ]
      .filter(Boolean)
      .join(" "),
    "worker-src 'self'",
    `frame-src ${keycloak ?? "'none'"}`,
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/** Sent with every response. */
export const COMMON_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
} as const;

/** The headers for the site's two pages (the e2e tests run under these too). */
export function pageHeaders(
  page: "index.html" | "reminder.html",
  keycloakIssuer?: string,
): Record<string, string> {
  return {
    "Cache-Control": CACHE.page,
    "Content-Security-Policy": contentSecurityPolicy(keycloakIssuer),
    // Reminder links carry a token in the address: never send it anywhere (specs/reminder-emails).
    "Referrer-Policy": page === "reminder.html" ? "no-referrer" : "strict-origin-when-cross-origin",
  };
}

/** Which data file a /data/ path names, or undefined if it isn't one visitors may fetch. */
export function dataFile(path: string): string | undefined {
  if (PUBLISHED.has(path)) return path;
  const [folder, name, ...rest] = path.split("/");
  if (rest.length > 0 || !name || !SAFE_NAME.test(name)) return undefined;
  return folder === "logos" || folder === "cards" ? `${folder}/${name}` : undefined;
}

function dataCache(name: string): string {
  if (name.startsWith("logos/")) return CACHE.logo;
  if (name === "cards/world.png") return CACHE.world;
  if (name === "cards/manifest.json") return CACHE.published;
  if (name.startsWith("cards/")) return CACHE.immutable;
  return CACHE.published;
}

/** A file's path under `root`, or undefined if the name would leave it. */
function under(root: string, name: string): string | undefined {
  const path = resolve(root, name);
  return path.startsWith(root + sep) ? path : undefined;
}

/** Sends a file, or undefined if there isn't one. Answers 304 when the browser's copy is current. */
async function sendFile(
  c: Context,
  path: string,
  headers: Record<string, string>,
): Promise<Response | undefined> {
  let info;
  try {
    info = await stat(path);
  } catch {
    return undefined;
  }
  if (!info.isFile()) return undefined;
  const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const all = {
    "Content-Type": TYPES[extname(path).toLowerCase()] ?? "application/octet-stream",
    ETag: etag,
    "Last-Modified": info.mtime.toUTCString(),
    ...headers,
  };
  if (c.req.header("If-None-Match") === etag) return c.body(null, 304, all);
  try {
    return c.body(await readFile(path), 200, all);
  } catch {
    // Removed between the stat and the read, by a publish or the sweep.
    return undefined;
  }
}

/**
 * The headers every response gets, and compression. Registered before any route, since Hono
 * runs middleware only for routes added after it.
 */
export function useSiteHeaders(app: Hono): void {
  app.use("*", async (c, next) => {
    await next();
    for (const [name, value] of Object.entries(COMMON_HEADERS)) c.header(name, value);
  });
  app.use("*", compress());
}

/** The data folder's routes, then the map site for every other path. Registered last. */
export function mountSite(app: Hono, config: SiteConfig): void {
  const dataDir = resolve(config.dataDir);
  const webDir = config.webDir && resolve(config.webDir);

  const notFound = (c: Context) => c.text("Not found", 404, { "Cache-Control": "no-cache" });

  const data = async (c: Context, name: string | undefined) => {
    const path = name && under(dataDir, name);
    const sent = path && (await sendFile(c, path, { "Cache-Control": dataCache(name) }));
    return sent || notFound(c);
  };
  app.get("/rss", (c) => data(c, "rss.xml"));
  app.get("/data/*", (c) => data(c, dataFile(c.req.path.slice("/data/".length))));

  if (!webDir) return;
  const pages: Record<string, Record<string, string>> = {
    "index.html": pageHeaders("index.html", config.keycloakIssuer),
    "reminder.html": pageHeaders("reminder.html", config.keycloakIssuer),
  };
  app.get("*", async (c) => {
    let name: string;
    try {
      name = decodeURIComponent(c.req.path).replace(/^\/+/, "");
    } catch {
      return notFound(c);
    }
    // Clean URLs: /reminder, not /reminder.html. Links in sent emails rely on them.
    if (name.endsWith(".html")) {
      const clean = name === "index.html" ? "/" : `/${name.slice(0, -".html".length)}`;
      return c.redirect(clean + (new URL(c.req.url).search || ""), 301);
    }
    if (name.split("/").some((part) => part.startsWith("."))) return notFound(c);
    const file = name === "" ? "index.html" : extname(name) ? name : `${name}.html`;
    const path = under(webDir, file);
    // Hashed bundles are kept for good, but only with a known type: a wrong type cached for a
    // year can't be fixed by a deploy (specs/deployment).
    const forGood = file.startsWith("assets/") && extname(file).toLowerCase() in TYPES;
    const headers =
      pages[file] ??
      ({ "Cache-Control": forGood ? CACHE.immutable : CACHE.other } as Record<string, string>);
    const sent = path && (await sendFile(c, path, headers));
    return sent || notFound(c);
  });
}
