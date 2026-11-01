import { LngLat, MercatorCoordinate } from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapView } from "../lib/types.ts";

/** The width of the world, in pixels, at zoom 0. */
const WORLD_SIZE = 512;
const CENTRE = { lat: 15, lng: 0 };

/** The first view: one copy of the world, exactly as wide as the map. */
export function worldView(width: number): MapView {
  return { zoom: Math.log2(width / WORLD_SIZE), ...CENTRE };
}

/**
 * MapLibre normally won't zoom out past the point where the world fills the map's height, which
 * cuts off the sides on a tall phone. This allows it, down to `minZoom`, holding the map still
 * vertically while the world is shorter than the map.
 */
export function allowWorldView(map: MapLibreMap, minZoom: number): void {
  map.setTransformConstrain((center, requested) => {
    const zoom = Math.max(requested, minZoom);
    const worldHeight = WORLD_SIZE * 2 ** zoom;
    const margin = map.getContainer().clientHeight / 2 / worldHeight;
    if (margin > 0.5) {
      return { center: new LngLat(center.lng, CENTRE.lat).wrap(), zoom };
    }
    // Otherwise, as MapLibre does by default: don't scroll past the top or bottom of the world.
    const { x, y } = MercatorCoordinate.fromLngLat(center);
    const clamped = Math.min(Math.max(y, margin), 1 - margin);
    return { center: new MercatorCoordinate(x, clamped).toLngLat().wrap(), zoom };
  });
}
