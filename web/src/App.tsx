import type { Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DownloadPanel } from "./components/DownloadPanel.tsx";
import { FilterPanel } from "./components/FilterPanel.tsx";
import { Legend } from "./components/Legend.tsx";
import { MarkerDetails } from "./components/MarkerDetails.tsx";
import { SearchBox } from "./components/SearchBox.tsx";
import { StatsBar } from "./components/StatsBar.tsx";
import { config } from "./config.ts";
import { track } from "./lib/analytics.ts";
import { legendEntries, palette } from "./lib/colours.ts";
import { applyFilters, hasFilters } from "./lib/filters.ts";
import { computeStats } from "./lib/stats.ts";
import type { AtlasSnapshot, ColourBy, Filters, MapView, PublicMarker } from "./lib/types.ts";
import { formatUrlState, parseUrlState } from "./lib/urlState.ts";
import { AtlasMap, revealMarker } from "./map/AtlasMap.tsx";
import { toFeatures } from "./map/layers.ts";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; snapshot: AtlasSnapshot };

async function loadSnapshot(): Promise<Load> {
  try {
    const res = await fetch(`${config.dataBaseUrl}/${config.dataFile}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { state: "ready", snapshot: (await res.json()) as AtlasSnapshot };
  } catch {
    return { state: "error" };
  }
}

export function App() {
  const initial = useMemo(() => parseUrlState(window.location.search), []);
  const [now] = useState(() => new Date());
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [colourBy, setColourBy] = useState<ColourBy>(initial.colourBy);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [selectedId, setSelectedId] = useState<string | undefined>(initial.marker);
  const [view, setView] = useState<MapView | undefined>(initial.view);
  const [panel, setPanel] = useState<"filters" | "download">();
  const [notice, setNotice] = useState<string>();
  const mapRef = useRef<MapLibreMap | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);

  useEffect(() => {
    let current = true;
    void loadSnapshot().then((result) => current && setLoad(result));
    return () => {
      current = false;
    };
  }, []);

  const retry = () => {
    setLoad({ state: "loading" });
    void loadSnapshot().then(setLoad);
  };

  const snapshot = load.state === "ready" ? load.snapshot : undefined;
  const allMarkers = useMemo(() => snapshot?.markers ?? [], [snapshot]);
  const markers = useMemo(() => applyFilters(allMarkers, filters, now), [allMarkers, filters, now]);
  const colours = useMemo(
    () => (snapshot ? palette(snapshot, colourBy) : new Map<string, string>()),
    [snapshot, colourBy],
  );
  const features = useMemo(
    () => toFeatures(markers, colourBy, colours, now),
    [markers, colourBy, colours, now],
  );
  const legend = useMemo(
    () => legendEntries(markers, colourBy, colours),
    [markers, colourBy, colours],
  );
  const stats = useMemo(() => computeStats(markers, now), [markers, now]);
  const selected = allMarkers.find((m) => m.id === selectedId);
  const order = useMemo(
    () => ({
      types: snapshot?.types.map((t) => t.name) ?? [],
      distributions: snapshot?.distributions.map((d) => d.name) ?? [],
      versions: snapshot?.versions.map((v) => v.version) ?? [],
    }),
    [snapshot],
  );

  // Keep the address bar in step with what is on screen, so any view can be shared.
  useEffect(() => {
    const query = formatUrlState({ marker: selectedId, view, colourBy, filters });
    window.history.replaceState(null, "", `${window.location.pathname}${query}`);
  }, [selectedId, view, colourBy, filters]);

  const select = useCallback((marker: PublicMarker) => {
    setSelectedId(marker.id);
    setPanel(undefined);
    track("marker_open", { marker_id: marker.id });
    if (mapRef.current)
      void revealMarker(mapRef.current, marker.longitude, marker.latitude, marker.id);
  }, []);

  // A marker named in the URL (including Atlas 2.0 links) is opened once the map is ready.
  const onMapReady = useCallback(
    (map: MapLibreMap) => {
      mapRef.current = map;
      setMap(map);
      if (!initial.marker || !snapshot) return;
      const marker = snapshot.markers.find((m) => m.id === initial.marker);
      if (marker) {
        if (!initial.view) void revealMarker(map, marker.longitude, marker.latitude, marker.id);
      } else {
        setSelectedId(undefined);
        setNotice("That site was not found on the Atlas. It may have been removed.");
      }
    },
    [initial, snapshot],
  );

  const changeFilters = (next: Filters) => {
    setFilters(next);
    track("filter_change");
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <a href="/">OpenMRS Atlas</a>
        </h1>
        <SearchBox
          markers={allMarkers}
          onPick={(m) => {
            track("search");
            select(m);
          }}
        />
        <button
          type="button"
          className={hasFilters(filters) ? "primary" : "secondary"}
          aria-expanded={panel === "filters"}
          onClick={() => setPanel((p) => (p === "filters" ? undefined : "filters"))}
        >
          Filters{hasFilters(filters) ? " (on)" : ""}
        </button>
        <button
          type="button"
          className="secondary"
          aria-expanded={panel === "download"}
          disabled={!snapshot}
          onClick={() => setPanel((p) => (p === "download" ? undefined : "download"))}
        >
          Download
        </button>
      </header>

      <main className="stage">
        {load.state === "error" && (
          <div className="message" role="alert">
            <p>The Atlas data could not be loaded.</p>
            <button type="button" className="primary" onClick={retry}>
              Try again
            </button>
          </div>
        )}
        {load.state === "loading" && (
          <div className="message" role="status">
            Loading the Atlas…
          </div>
        )}
        {snapshot && (
          <>
            <AtlasMap
              features={features}
              initialView={initial.view}
              selectedId={selectedId}
              onSelect={(id) => {
                const marker = allMarkers.find((m) => m.id === id);
                if (marker) select(marker);
              }}
              onViewChange={setView}
              onReady={onMapReady}
            />
            <StatsBar stats={stats} />
            <Legend colourBy={colourBy} entries={legend} onColourByChange={setColourBy} />
          </>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button
              type="button"
              className="icon-button"
              aria-label="Dismiss"
              onClick={() => setNotice(undefined)}
            >
              ×
            </button>
          </div>
        )}
        {panel === "filters" && snapshot && (
          <FilterPanel
            markers={allMarkers}
            order={order}
            filters={filters}
            onChange={changeFilters}
            onClose={() => setPanel(undefined)}
          />
        )}
        {panel === "download" && snapshot && (
          <DownloadPanel map={map} legend={legend} onClose={() => setPanel(undefined)} />
        )}
        {selected && !panel && (
          <MarkerDetails marker={selected} onClose={() => setSelectedId(undefined)} />
        )}
      </main>
    </div>
  );
}
