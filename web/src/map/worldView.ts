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
