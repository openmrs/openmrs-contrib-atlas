import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useRef } from "react";
import { config } from "../config.ts";
import type { MapView } from "../lib/types.ts";
import { LAYERS, SOURCE, layerSpecs, sourceSpec } from "./layers.ts";
import { installPins } from "./pins.ts";
import { allowWorldView, worldView } from "./worldView.ts";

interface Props {
  features: GeoJSON.FeatureCollection<GeoJSON.Point>;
  initialView?: MapView;
  selectedId?: string;
  onSelect: (id: string) => void;
  onViewChange: (view: MapView) => void;
  onReady?: (map: MapLibreMap) => void;
}

// MapLibre 6 loads its worker from a separate file; ship it as an asset and say where it is.
maplibregl.setWorkerUrl(workerUrl);

declare global {
  interface Window {
    atlasMap?: MapLibreMap;
  }
}

export function AtlasMap({
  features,
  initialView,
  selectedId,
  onSelect,
  onViewChange,
  onReady,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loaded = useRef(false);
  // Latest props for handlers registered once.
  const latest = useRef({ features, selectedId, onSelect, onViewChange });
  useEffect(() => {
    latest.current = { features, selectedId, onSelect, onViewChange };
  });

  useEffect(() => {
    const view = initialView ?? worldView(container.current!.clientWidth);
    const map = new maplibregl.Map({
      container: container.current!,
      style: config.mapStyleUrl,
      center: [view.lng, view.lat],
      zoom: view.zoom,
      attributionControl: { compact: false },
      canvasContextAttributes: { preserveDrawingBuffer: false },
      dragRotate: false,
      pitchWithRotate: false,
    });
    allowWorldView(map, Math.min(view.zoom, 0));
    map.jumpTo({ center: [view.lng, view.lat], zoom: view.zoom });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    installPins(map);
    mapRef.current = map;
    if (config.e2e) window.atlasMap = map;

    // Not "load", which waits for every base map tile: pins can be drawn long before those arrive.
    map.once("style.load", () => {
      map.addSource(SOURCE, sourceSpec(latest.current.features));
      for (const layer of layerSpecs) map.addLayer(layer);
      loaded.current = true;
      highlight(map, latest.current.selectedId);
      onReady?.(map);
    });

    // Pins overlap, so act only on the one on top.
    map.on("click", async (e) => {
      const feature = map.queryRenderedFeatures(e.point, {
        layers: [LAYERS.clusters, LAYERS.markers],
      })[0];
      if (!feature) return;
      if (feature.layer.id === LAYERS.markers) {
        const id = feature.properties.id as string | undefined;
        if (id) latest.current.onSelect(id);
        return;
      }
      const source = map.getSource<GeoJSONSource>(SOURCE)!;
      const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id as number);
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      map.easeTo({ center: [lng, lat], zoom });
    });
    for (const layer of [LAYERS.clusters, LAYERS.markers]) {
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }
    map.on("moveend", () => {
      const c = map.getCenter();
      latest.current.onViewChange({ zoom: map.getZoom(), lat: c.lat, lng: c.lng });
    });

    return () => {
      loaded.current = false;
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loaded.current) map.getSource<GeoJSONSource>(SOURCE)?.setData(features);
  }, [features]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loaded.current) highlight(map, selectedId);
  }, [selectedId]);

  return (
    <div ref={container} className="map" role="region" aria-label="World map of OpenMRS sites" />
  );
}

function highlight(map: MapLibreMap, id: string | undefined) {
  map.setFilter(LAYERS.selected, ["==", ["get", "id"], id ?? ""]);
}

/**
 * Moves the map to a marker and zooms through any clusters until the marker itself shows.
 */
export async function revealMarker(map: MapLibreMap, lng: number, lat: number, id: string) {
  // Keep the marker clear of the details panel: on the right on wide screens, a bottom sheet on phones.
  const wide = window.innerWidth > 600;
  const padding = wide
    ? { right: 360, left: 0, top: 0, bottom: 0 }
    : { bottom: window.innerHeight * 0.6, top: 0, left: 0, right: 0 };
  map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 4), duration: 600, padding });
  for (let attempt = 0; attempt < 6; attempt++) {
    await map.once("idle");
    const point = map.project([lng, lat]);
    const box: [[number, number], [number, number]] = [
      [point.x - 2, point.y - 2],
      [point.x + 2, point.y + 2],
    ];
    const visible = map
      .queryRenderedFeatures(box, { layers: [LAYERS.markers] })
      .some((f) => f.properties.id === id);
    if (visible) return;
    const cluster = map.queryRenderedFeatures(box, { layers: [LAYERS.clusters] })[0];
    const source = map.getSource<GeoJSONSource>(SOURCE);
    const zoom = cluster
      ? await source!.getClusterExpansionZoom(cluster.properties.cluster_id as number)
      : map.getZoom() + 2;
    map.easeTo({ center: [lng, lat], zoom, duration: 400, padding });
  }
}
