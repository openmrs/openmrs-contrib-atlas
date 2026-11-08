import type { PublicMarker } from "@openmrs-atlas/shared";
import { Hono } from "hono";
import { CARD_HEIGHT, CARD_WIDTH, countryName } from "./cards/card.ts";
import { WORLD, type CardManifest, type CardStore } from "./cards/refresh.ts";

/** Pages and the CDN in front of them may keep these for 5 minutes (specs/marker-permalinks). */
const PAGE_CACHE = "public, max-age=300, s-maxage=300";
/** How long the published snapshot and card manifest are kept in memory between reads. */
const MEMORY_MS = 60_000;

interface Published {
  markers: Map<string, PublicMarker>;
  cards: CardManifest["markers"];
}

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
/** A string safe to put inside an inline script. */
const scriptString = (s: string) => JSON.stringify(s).replace(/</g, "\\u003c");

/** "An OpenMRS implementation in Uganda with 50 sites." */
export function describeMarker(marker: PublicMarker): string {
  const country = countryName(marker.country);
  const sites =
    marker.site_count && marker.site_count > 1 ? ` with ${marker.site_count} sites` : "";
  const where = country ? ` in ${country}` : "";
  return marker.status === "closed"
    ? `A closed OpenMRS implementation${where}${sites}.`
    : `An OpenMRS implementation${where}${sites}.`;
}

function page(opts: { title: string; head: string; body: string; target: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(opts.title)}</title>
${opts.head}
</head>
<body>
${opts.body}
<script>location.replace(${scriptString(opts.target)})</script>
</body>
</html>
`;
}

/**
 * Public routes under /marker: permalink pages with link preview tags, and the card download.
 * They read only the published snapshot and card manifest, never the sheet.
 */
export function createPermalinks(deps: { cards: CardStore; siteUrl: string; now?: () => number }) {
  const app = new Hono();
  const now = deps.now ?? Date.now;
  const site = deps.siteUrl.replace(/\/$/, "");
  let cached: { at: number; value: Promise<Published> } | undefined;

  const published = (): Promise<Published> => {
    if (cached && now() - cached.at < MEMORY_MS) return cached.value;
    const value = Promise.all([deps.cards.readSnapshot(), deps.cards.readManifest()]).then(
      ([snapshot, manifest]) => ({
        markers: new Map((snapshot?.markers ?? []).map((m) => [m.id, m])),
        cards: manifest?.markers ?? {},
      }),
    );
    cached = { at: now(), value };
    // A failed read isn't kept, so the next request tries again.
    value.catch(() => (cached = undefined));
    return value;
  };

  const mapLink = (id: string) => `${site}/?marker=${encodeURIComponent(id)}`;

  app.get("/:id/card.png", async (c) => {
    const { markers, cards } = await published();
    const id = c.req.param("id");
    const card = markers.has(id) ? cards[id] : undefined;
    if (!card) return c.text("No card for that site.", 404);
    c.header("Cache-Control", PAGE_CACHE);
    return c.redirect(deps.cards.publicUrl(card.file), 302);
  });

  app.get("/:id", async (c) => {
    const { markers, cards } = await published();
    const id = c.req.param("id");
    const marker = markers.get(id);
    c.header("Cache-Control", PAGE_CACHE);
    if (!marker) {
      return c.html(
        page({
          title: "Site not found · OpenMRS Atlas",
          head: `<meta name="robots" content="noindex">`,
          body: `<p>That site is not on the OpenMRS Atlas. <a href="${escape(site)}/">Open the map</a>.</p>`,
          target: mapLink(id),
        }),
        404,
      );
    }
    const permalink = `${site}/marker/${encodeURIComponent(id)}`;
    const card = cards[id];
    const image = deps.cards.publicUrl(card ? card.file : WORLD);
    const description = describeMarker(marker);
    const tags: [string, string, string][] = [
      ["property", "og:type", "website"],
      ["property", "og:site_name", "OpenMRS Atlas"],
      ["property", "og:title", marker.name],
      ["property", "og:description", description],
      ["property", "og:url", permalink],
      ["property", "og:image", image],
      ["property", "og:image:width", String(CARD_WIDTH)],
      ["property", "og:image:height", String(CARD_HEIGHT)],
      ["property", "og:image:alt", `${marker.name} on the OpenMRS Atlas`],
      ["name", "twitter:card", "summary_large_image"],
      ["name", "twitter:title", marker.name],
      ["name", "twitter:description", description],
      ["name", "twitter:image", image],
      ["name", "description", description],
    ];
    return c.html(
      page({
        title: `${marker.name} · OpenMRS Atlas`,
        head: [
          `<link rel="canonical" href="${escape(permalink)}">`,
          ...tags.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escape(value)}">`),
        ].join("\n"),
        body: `<p><a href="${escape(mapLink(id))}">Open ${escape(marker.name)} on the OpenMRS Atlas</a></p>`,
        target: mapLink(id),
      }),
    );
  });

  return app;
}
