import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AtlasSnapshot, PublicMarker } from "@openmrs-atlas/shared";
import sharp from "sharp";
import { mapPaths, pinPath, project, type Detail, type View } from "./map.ts";
import { cardFonts, textPath, textWidth, wrap } from "./text.ts";

/** Bump when the card's design changes, so the nightly publish redraws every card. */
export const CARD_VERSION = 1;
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const COLOURS = {
  water: "#9ebdff",
  land: "#f2efe9",
  border: "#c9c3b8",
  home: "#b9d6cf",
  accent: "#00463f",
  ink: "#1f2933",
  quiet: "#5f6b7a",
  closed: "#b42318",
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export function countryName(code: string | undefined): string {
  if (!code) return "";
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Changes only when something drawn on the card changes. */
export function cardHash(marker: PublicMarker): string {
  const drawn = [
    CARD_VERSION,
    marker.name,
    marker.country ?? "",
    marker.site_count ?? 1,
    marker.status,
    marker.latitude,
    marker.longitude,
  ];
  return createHash("sha256").update(JSON.stringify(drawn)).digest("hex").slice(0, 12);
}

let logo: string | undefined;
const logoHref = () =>
  (logo ??= `data:image/png;base64,${readFileSync(
    resolve(import.meta.dirname, "../../assets/openmrs-cross.png"),
  ).toString("base64")}`);

function brand(x: number, y: number): string {
  const { bold } = cardFonts();
  return [
    `<image href="${logoHref()}" x="${x}" y="${y - 40}" width="52" height="52"/>`,
    `<path fill="${COLOURS.accent}" d="${textPath(bold, "OpenMRS Atlas", x + 66, y, 36)}"/>`,
  ].join("");
}

function siteHost(siteUrl: string): string {
  try {
    return new URL(siteUrl).host;
  } catch {
    return siteUrl;
  }
}

function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">${body}</svg>`;
}

function mapLayer(view: View, detail: Detail, country?: string): string {
  const { land, home } = mapPaths(view, detail, country);
  return [
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${COLOURS.water}"/>`,
    `<path d="${land}" fill="${COLOURS.land}" stroke="${COLOURS.border}" stroke-width="1.2" stroke-linejoin="round"/>`,
    home
      ? `<path d="${home}" fill="${COLOURS.home}" stroke="${COLOURS.accent}" stroke-width="2"/>`
      : "",
  ].join("");
}

/** The words on a marker's card: the name in up to two lines, and the country and sites. */
export function cardText(marker: PublicMarker): { name: string[]; meta: string; closed: boolean } {
  const { regular, bold } = cardFonts();
  const sites = marker.site_count && marker.site_count > 1 ? `${marker.site_count} sites` : "";
  const meta = [countryName(marker.country), sites].filter(Boolean).join(" · ");
  return {
    name: wrap(bold, marker.name, 60, 520, 2),
    meta: meta ? (wrap(regular, meta, 34, 520, 1)[0] ?? "") : "",
    closed: marker.status === "closed",
  };
}

/** The card for one marker, as SVG. All text is drawn as paths, so no marker text is in markup. */
export function cardSvg(marker: PublicMarker, siteUrl: string): string {
  const { regular, bold } = cardFonts();
  const view: View = {
    lng: marker.longitude,
    lat: marker.latitude,
    cx: 860,
    cy: 360,
    world: (CARD_WIDTH * 360) / 40,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  };
  const [px, py] = project(view, marker.longitude, marker.latitude);

  const { name: nameLines, meta: metaLine } = cardText(marker);
  const meta = metaLine ? [metaLine] : [];
  const nameTop = 250 - (nameLines.length - 1) * 36;

  const parts = [
    mapLayer(view, "50m", marker.country),
    `<path d="${pinPath(px, py, 22)}" fill="${COLOURS.accent}" stroke="#ffffff" stroke-width="3"/>`,
    `<circle cx="${px}" cy="${py - 22 * 2.2}" r="8" fill="#ffffff"/>`,
    `<defs><linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.72" stop-color="#ffffff"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient></defs>`,
    `<rect width="780" height="${CARD_HEIGHT}" fill="url(#fade)"/>`,
    brand(64, 96),
    ...nameLines.map(
      (line, i) =>
        `<path fill="${COLOURS.ink}" d="${textPath(bold, line, 64, nameTop + i * 72, 60)}"/>`,
    ),
  ];
  const metaY = nameTop + (nameLines.length - 1) * 72 + 64;
  if (meta[0])
    parts.push(`<path fill="${COLOURS.quiet}" d="${textPath(regular, meta[0], 64, metaY, 34)}"/>`);
  if (marker.status === "closed") {
    const y = metaY + (meta[0] ? 60 : 0);
    const w = textWidth(bold, "Closed", 28) + 32;
    parts.push(
      `<rect x="64" y="${y - 32}" width="${w}" height="44" rx="22" fill="#ffffff" stroke="${COLOURS.closed}" stroke-width="2"/>`,
      `<path fill="${COLOURS.closed}" d="${textPath(bold, "Closed", 80, y, 28)}"/>`,
    );
  }
  parts.push(
    `<path fill="${COLOURS.quiet}" d="${textPath(regular, siteHost(siteUrl), 64, 568, 28)}"/>`,
  );
  return svg(parts.join(""));
}

/** Every published marker as a dot on a world map, with the counts. */
export function worldSvg(snapshot: AtlasSnapshot, siteUrl: string): string {
  const { regular } = cardFonts();
  const view: View = {
    lng: 15,
    lat: 22,
    cx: CARD_WIDTH / 2,
    cy: CARD_HEIGHT / 2,
    world: CARD_WIDTH,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  };
  const open = snapshot.markers.filter((m) => m.status !== "closed");
  const countries = new Set(open.map((m) => m.country).filter(Boolean)).size;
  const dots = snapshot.markers
    .map((m) => {
      const [x, y] = project(view, m.longitude, m.latitude);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/>`;
    })
    .join("");
  const counts = `${open.length.toLocaleString("en")} implementations in ${countries} countries`;
  const boxWidth =
    Math.max(textWidth(regular, counts, 28), textWidth(regular, siteHost(siteUrl), 24)) + 150;
  return svg(
    [
      mapLayer(view, "110m"),
      `<g fill="${COLOURS.accent}" fill-opacity="0.85" stroke="#ffffff" stroke-width="1.5">${dots}</g>`,
      `<rect x="32" y="32" width="${Math.min(boxWidth, 700)}" height="170" rx="16" fill="#ffffff" fill-opacity="0.94"/>`,
      brand(64, 96),
      `<path fill="${COLOURS.ink}" d="${textPath(regular, counts, 64, 146, 28)}"/>`,
      `<path fill="${COLOURS.quiet}" d="${textPath(regular, siteHost(siteUrl), 64, 182, 24)}"/>`,
    ].join(""),
  );
}

export async function renderPng(svgText: string): Promise<Buffer> {
  return sharp(Buffer.from(svgText)).png({ compressionLevel: 9 }).toBuffer();
}
