import type {
  ExpressionSpecification,
  GeoJSONSourceSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";
import { colourOf } from "../lib/colours.ts";
import { opacityFor } from "../lib/freshness.ts";
import type { ColourBy, PublicMarker } from "../lib/types.ts";
import { HEAD_HEIGHT, SELECTED_PIN, dotPrefix, plainPrefix } from "./pins.ts";

export const SOURCE = "markers";
export const LAYERS = {
  clusters: "clusters",
  clusterCount: "cluster-count",
  markers: "markers",
  markerCount: "marker-count",
  selected: "selected",
} as const;

/** A fraction of a pixel: only markers that can't be told apart at this zoom are merged. */
const CLUSTER_RADIUS = 0.25;
const CLUSTER_COLOUR = "#3D4F6B";

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
    clusterRadius: CLUSTER_RADIUS,
    clusterMaxZoom: 14,
    // Clusters are labelled with total sites, not marker count (specs/map-view).
    clusterProperties: {
      sites: ["+", ["get", "sites"]],
      opacity_sum: ["+", ["get", "opacity"]],
    },
  };
}

const isMulti: ExpressionSpecification = [">", ["get", "sites"], 1];

const MULTI_SIZE = 1.35;
const markerSize: ExpressionSpecification = ["case", isMulti, MULTI_SIZE, 1];
/** A cluster fades to the average of its markers. */
const clusterOpacity: ExpressionSpecification = [
  "/",
  ["get", "opacity_sum"],
  ["get", "point_count"],
];

/** A value per cluster size: pins grow with the number of sites. */
const clusterStep = (value: (size: number) => unknown) =>
  [
    "step",
    ["get", "sites"],
    value(1.15),
    10,
    value(1.3),
    100,
    value(1.5),
    1000,
    value(1.7),
  ] as ExpressionSpecification;

/** Places a count in the head of a pin of the given size. */
const countOffset = (size: number, textSize: number): [number, number] => [
  0,
  -(HEAD_HEIGHT * size) / textSize,
];

const pinLayout = {
  "icon-anchor": "bottom",
  "icon-allow-overlap": true,
  "icon-ignore-placement": true,
} as const;
const countLayout = {
  "text-font": FONT,
  "text-allow-overlap": true,
  "text-ignore-placement": true,
} as const;

export const layerSpecs: SymbolLayerSpecification[] = [
  {
    id: LAYERS.clusters,
    type: "symbol",
    source: SOURCE,
    filter: ["has", "point_count"],
    layout: {
      ...pinLayout,
      "icon-image": `${plainPrefix}${CLUSTER_COLOUR}`,
      "icon-size": clusterStep((size) => size),
    },
    paint: { "icon-opacity": clusterOpacity },
  },
  {
    id: LAYERS.markers,
    type: "symbol",
    source: SOURCE,
    filter: ["!", ["has", "point_count"]],
    layout: {
      ...pinLayout,
      "icon-image": [
        "concat",
        ["case", isMulti, plainPrefix, dotPrefix],
        ["get", "colour"],
      ] as ExpressionSpecification,
      "icon-size": markerSize,
    },
    paint: { "icon-opacity": ["get", "opacity"] },
  },
  {
    id: LAYERS.clusterCount,
    type: "symbol",
    source: SOURCE,
    filter: ["has", "point_count"],
    layout: {
      ...countLayout,
      "text-field": ["to-string", ["get", "sites"]],
      "text-size": 12,
      "text-offset": clusterStep((size) => ["literal", countOffset(size, 12)]),
    },
    paint: { "text-color": "#FFFFFF", "text-opacity": clusterOpacity },
  },
  {
    id: LAYERS.markerCount,
    type: "symbol",
    source: SOURCE,
    filter: ["all", ["!", ["has", "point_count"]], isMulti],
    layout: {
      ...countLayout,
      "text-field": ["to-string", ["get", "sites"]],
      "text-size": 11,
      "text-offset": countOffset(MULTI_SIZE, 11),
    },
    paint: { "text-color": "#FFFFFF", "text-opacity": ["get", "opacity"] },
  },
  {
    id: LAYERS.selected,
    type: "symbol",
    source: SOURCE,
    filter: ["==", ["get", "id"], ""],
    layout: { ...pinLayout, "icon-image": SELECTED_PIN, "icon-size": markerSize },
  },
];
