import { LngLat, MercatorCoordinate } from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapView } from "../lib/types.ts";

const MAX_ZOOM = 1.5;
/** The width of the world, in pixels, at zoom 0. */
const WORLD_SIZE = 512;
/** Western North America to New Zealand, with room for the pins. */
const LONGITUDES = 320;
const CENTRE = { lat: 15, lng: 25 };
/** Latitudes 75°N to 45°S, as a share of the height of the Mercator world. */
const HEIGHT_SHARE = 0.46;

/** The first view: as close as the screen allows while still showing the populated world. */
export function worldView(width: number, height: number): MapView {
  const fitWidth = Math.log2(width / ((WORLD_SIZE * LONGITUDES) / 360));
  const fitHeight = Math.log2(height / (WORLD_SIZE * HEIGHT_SHARE));
  return { zoom: Math.min(MAX_ZOOM, fitWidth, fitHeight), ...CENTRE };
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
