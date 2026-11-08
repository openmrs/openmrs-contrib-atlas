import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { iso1N3Code } from "@rapideditor/country-coder";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

/** A Web Mercator view: `lng`/`lat` is drawn at (`cx`, `cy`), and 360° of longitude spans `world` px. */
export interface View {
  lng: number;
  lat: number;
  cx: number;
  cy: number;
  world: number;
  width: number;
  height: number;
}

export type Detail = "50m" | "110m";

/** A ring with longitudes unwrapped to run continuously, and its longitude range. */
interface Ring {
  lngs: number[];
  lats: number[];
  min: number;
  max: number;
}
interface Country {
  id: string | undefined;
  rings: Ring[];
}

const MAX_LAT = 85;

const mercatorY = (lat: number) => {
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI);
};

/** The same longitude, moved by whole turns to lie within 180° of `ref`. */
export function wrapNear(lng: number, ref: number): number {
  return ref + ((((lng - ref + 180) % 360) + 360) % 360) - 180;
}

/** Pixel position of a point, with its longitude taken within 180° of the view's centre. */
export function project(view: View, lng: number, lat: number): [number, number] {
  return [
    view.cx + ((wrapNear(lng, view.lng) - view.lng) / 360) * view.world,
    view.cy - (mercatorY(lat) - mercatorY(view.lat)) * view.world,
  ];
}

// Natural Earth country shapes (public domain), from the world-atlas package.
const cache = new Map<Detail, Country[]>();
function countries(detail: Detail): Country[] {
  let list = cache.get(detail);
  if (list) return list;
  const require = createRequire(import.meta.url);
  const file = require.resolve(`world-atlas/countries-${detail}.json`);
  const topology = JSON.parse(readFileSync(file, "utf8")) as Topology<{
    countries: GeometryCollection;
  }>;
  const collection = feature(topology, topology.objects.countries);
  list = collection.features.map((f) => {
    const g = f.geometry;
    const polygons =
      g?.type === "Polygon" ? [g.coordinates] : g?.type === "MultiPolygon" ? g.coordinates : [];
    const rings = polygons.flat().flatMap((ring): Ring[] => {
      if (ring.length < 3) return [];
      const lngs: number[] = [];
      let prev = ring[0]![0]!;
      for (const point of ring) {
        prev = wrapNear(point[0]!, prev);
        lngs.push(prev);
      }
      return [
        { lngs, lats: ring.map((p) => p[1]!), min: Math.min(...lngs), max: Math.max(...lngs) },
      ];
    });
    return { id: f.id === undefined ? undefined : String(f.id), rings };
  });
  cache.set(detail, list);
  return list;
}

/** SVG path data for rings, drawn once for each copy of the world that reaches the view. */
function ringPaths(view: View, rings: Ring[]): string {
  const halfSpan = (180 * view.width) / view.world + 1;
  const top = mercatorY(view.lat) + view.cy / view.world + 0.01;
  const bottom = mercatorY(view.lat) - (view.height - view.cy) / view.world - 0.01;
  const parts: string[] = [];
  for (const ring of rings) {
    for (const shift of [-720, -360, 0, 360, 720]) {
      if (ring.max + shift < view.lng - halfSpan || ring.min + shift > view.lng + halfSpan)
        continue;
      const ys = ring.lats.map(mercatorY);
      if (Math.max(...ys) < bottom || Math.min(...ys) > top) continue;
      const points = ring.lngs.map((lng, i) => {
        const x = view.cx + ((lng + shift - view.lng) / 360) * view.world;
        const y = view.cy - (ys[i]! - mercatorY(view.lat)) * view.world;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      parts.push(`M${points.join("L")}Z`);
    }
  }
  return parts.join("");
}

/** Land, and the country with ISO 3166-1 alpha-2 code `country` (if any), as SVG path data. */
export function mapPaths(
  view: View,
  detail: Detail,
  country?: string,
): { land: string; home: string } {
  const list = countries(detail);
  const homeId = country ? (iso1N3Code(country) ?? undefined) : undefined;
  return {
    land: ringPaths(
      view,
      list.flatMap((c) => c.rings),
    ),
    home: homeId
      ? ringPaths(
          view,
          list.filter((c) => c.id === homeId).flatMap((c) => c.rings),
        )
      : "",
  };
}

/** A teardrop pin with its tip at (x, y), like the pins on the map. */
export function pinPath(x: number, y: number, r: number): string {
  const top = y - r * 2.2;
  return [
    `M${x},${y}`,
    `C${x - r * 0.4},${y - r * 0.8} ${x - r},${top + r * 0.9} ${x - r},${top}`,
    `A${r},${r} 0 1 1 ${x + r},${top}`,
    `C${x + r},${top + r * 0.9} ${x + r * 0.4},${y - r * 0.8} ${x},${y}Z`,
  ].join("");
}
