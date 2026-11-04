import { toRawRows, text } from "./rows.ts";
import { COLUMNS, type Cell } from "./schema.ts";
import type { AtlasSnapshot, PublicMarker } from "./snapshot.ts";
import { toIsoDate } from "./validate.ts";

/**
 * The public RSS feed at /rss, built from the change log and the published snapshot.
 * See openspec specs/change-feed. Only each change's time, marker and kind are read from the
 * log; who made it and which fields changed never reach the output.
 */

/** How many log rows to consider, and how many items to publish. */
export const FEED_SOURCE_ROWS = 500;
export const FEED_ITEMS = 50;

/** Fields whose changes are not news: nothing public changed. */
const PRIVATE_FIELDS = new Set(["owner", "editors", "contact_name", "contact_email"]);

type Kind = "add" | "update" | "confirm" | "close" | "reopen";

const TITLES: Record<Kind, (name: string) => string> = {
  add: (name) => `${name} joins the Atlas`,
  update: (name) => `${name} entry updated`,
  confirm: (name) => `${name} confirmed as still current`,
  close: (name) => `${name} has closed`,
  reopen: (name) => `${name} has reopened`,
};

interface FeedEvent {
  kind: Kind;
  markerId: string;
  at: Date;
}

/** The kind of a logged change for the feed, or undefined if it isn't news. */
function kindOf(action: string, fields: Cell): Kind | undefined {
  switch (action) {
    case "add":
      return "add";
    case "confirm":
      return "confirm";
    case "close":
      return "close";
    case "reopen":
      return "reopen";
    case "edit": {
      const names = fieldNames(fields);
      // Saving the form unchanged restarts the clock, which is a confirmation.
      if (names.length === 0) return "confirm";
      return names.every((n) => PRIVATE_FIELDS.has(n)) ? undefined : "update";
    }
    default:
      // Transfers, offers and deletions are not published.
      return undefined;
  }
}

/** Field names from a log row's `fields` cell: strings, or `{ field, from, to }` objects. */
function fieldNames(cell: Cell): string[] {
  try {
    const parsed: unknown = JSON.parse(text(cell) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((f: unknown) => (typeof f === "string" ? f : (f as { field?: unknown } | null)?.field))
      .filter((f): f is string => typeof f === "string");
  } catch {
    // An unreadable entry is treated as a public change rather than dropped silently.
    return ["unknown"];
  }
}

function events(changes: Cell[][]): FeedEvent[] {
  if (changes.length === 0) return [];
  const rows = toRawRows(
    [changes[0]!, ...changes.slice(1).slice(-FEED_SOURCE_ROWS)],
    COLUMNS.changes,
  );
  const out: FeedEvent[] = [];
  for (const { cells } of rows) {
    const kind = kindOf(text(cells.action), cells.fields);
    const at = new Date(toIsoDate(cells.timestamp) ?? "");
    const markerId = text(cells.marker_id);
    if (kind && markerId && !Number.isNaN(at.getTime())) out.push({ kind, markerId, at });
  }
  return out;
}

/** Characters XML 1.0 can't hold at all are dropped; the rest are escaped. */
function xml(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
  );
}

function summary(marker: PublicMarker): string {
  const parts = [marker.organisation, marker.type, marker.country];
  if (marker.site_count && marker.site_count > 1) parts.push(`${marker.site_count} sites`);
  if (marker.status === "closed") parts.push("Closed");
  return parts.filter(Boolean).join(" · ");
}

/** RSS 2.0 for the newest published-marker events. `siteUrl` has no trailing slash. */
export function toRss(snapshot: AtlasSnapshot, changes: Cell[][], siteUrl: string): string {
  const site = siteUrl.replace(/\/+$/, "");
  const markers = new Map(snapshot.markers.map((m) => [m.id, m]));
  const items = events(changes)
    .filter((e) => markers.has(e.markerId))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, FEED_ITEMS)
    .map((e) => {
      const marker = markers.get(e.markerId)!;
      const link = `${site}/?marker=${encodeURIComponent(marker.id)}`;
      return [
        "    <item>",
        `      <title>${xml(TITLES[e.kind](marker.name))}</title>`,
        `      <link>${xml(link)}</link>`,
        `      <guid isPermaLink="false">${xml(`${marker.id}/${e.kind}/${e.at.toISOString()}`)}</guid>`,
        `      <pubDate>${e.at.toUTCString()}</pubDate>`,
        `      <description>${xml(summary(marker))}</description>`,
        "    </item>",
      ].join("\n");
    });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>OpenMRS Atlas</title>",
    `    <link>${xml(site)}/</link>`,
    "    <description>New and updated OpenMRS implementations on the OpenMRS Atlas</description>",
    "    <language>en</language>",
    `    <lastBuildDate>${new Date(snapshot.generated_at).toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${xml(site)}/rss" rel="self" type="application/rss+xml"/>`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
