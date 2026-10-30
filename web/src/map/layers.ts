import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  GeoJSONSourceSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";
import { colourOf } from "../lib/colours.ts";
import { opacityFor } from "../lib/freshness.ts";
import type { ColourBy, PublicMarker } from "../lib/types.ts";

export const SOURCE = "markers";
export const LAYERS = {
  clusters: "clusters",
  clusterCount: "cluster-count",
  markers: "markers",
  markerCount: "marker-count",
  selected: "selected",
} as const;

/** Present in both OpenFreeMap styles and the offline test style. */
const FONT = ["Noto Sans Bold"];

export function toFeatures(
  markers: PublicMarker[],
  colourBy: ColourBy,
  colours: Map<string, string>,
  now: Date,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: markers.map((m) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [m.longitude, m.latitude] },
      properties: {
        id: m.id,
        colour: colourOf(m, colourBy, colours),
        opacity: opacityFor(m, now),
        sites: m.site_count ?? 1,
      },
    })),
  };
}

export function sourceSpec(
  data: GeoJSON.FeatureCollection<GeoJSON.Point>,
): GeoJSONSourceSpecification {
  return {
    type: "geojson",
    data,
    cluster: true,
    clusterRadius: 40,
    clusterMaxZoom: 14,
    // Clusters are labelled with total sites, not marker count (specs/map-view).
    clusterProperties: { sites: ["+", ["get", "sites"]] },
  };
}

const isMulti: ExpressionSpecification = [">", ["get", "sites"], 1];

export const layerSpecs: (CircleLayerSpecification | SymbolLayerSpecification)[] = [
  {
    id: LAYERS.clusters,
    type: "circle",
    source: SOURCE,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#3D4F6B",
      "circle-opacity": 0.85,
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-width": 2,
      "circle-radius": ["step", ["get", "sites"], 14, 10, 18, 100, 23, 1000, 28],
    },
  },
  {
    id: LAYERS.clusterCount,
    type: "symbol",
    source: SOURCE,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["to-string", ["get", "sites"]],
      "text-font": FONT,
      "text-size": 12,
      "text-allow-overlap": true,
    },
    paint: { "text-color": "#FFFFFF" },
  },
  {
    id: LAYERS.markers,
    type: "circle",
    source: SOURCE,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": ["get", "colour"],
      "circle-opacity": ["get", "opacity"],
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-opacity": ["get", "opacity"],
      "circle-stroke-width": 1.5,
      "circle-radius": ["case", isMulti, 13, 7],
    },
  },
  {
    id: LAYERS.markerCount,
    type: "symbol",
    source: SOURCE,
    filter: ["all", ["!", ["has", "point_count"]], isMulti],
    layout: {
      "text-field": ["to-string", ["get", "sites"]],
      "text-font": FONT,
      "text-size": 11,
      "text-allow-overlap": true,
    },
    paint: { "text-color": "#FFFFFF", "text-opacity": ["get", "opacity"] },
  },
  {
    id: LAYERS.selected,
    type: "circle",
    source: SOURCE,
    filter: ["==", ["get", "id"], ""],
    paint: {
      "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-color": "#111111",
      "circle-stroke-width": 3,
      "circle-radius": ["case", isMulti, 17, 11],
    },
  },
];
