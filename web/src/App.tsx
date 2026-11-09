import type { Map as MapLibreMap } from "maplibre-gl";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signIn, signInEnabled, signOut } from "./auth/session.ts";
import { useSession } from "./auth/useSession.ts";
import { DownloadPanel } from "./components/DownloadPanel.tsx";
import { FilterPanel } from "./components/FilterPanel.tsx";
import { DownloadIcon, FilterIcon, ListIcon, PersonIcon } from "./components/Icons.tsx";
import { Legend } from "./components/Legend.tsx";
import { MarkerActions } from "./components/MarkerActions.tsx";
import { ClaimPanel } from "./components/ClaimPanel.tsx";
import { MarkerDetails } from "./components/MarkerDetails.tsx";
import { SearchBox } from "./components/SearchBox.tsx";
import { ShareDialog } from "./components/ShareDialog.tsx";
import { SignInPanel } from "./components/SignInPanel.tsx";
import { SiteList } from "./components/SiteList.tsx";
import { StatsBar } from "./components/StatsBar.tsx";
import { config } from "./config.ts";
import { track } from "./lib/analytics.ts";
import { savedNotice, type MarkerResult } from "./lib/api.ts";
import { legendEntries, palette } from "./lib/colours.ts";
import { applyFilters, hasFilters } from "./lib/filters.ts";
import { inView, sortMarkers, type Bounds, type ListSort } from "./lib/list.ts";
import type { ShareSource } from "./lib/share.ts";
import { computeStats } from "./lib/stats.ts";
import type { AtlasSnapshot, ColourBy, Filters, MapView, PublicMarker } from "./lib/types.ts";
import { formatUrlState, parseUrlState, type SignedInPanel } from "./lib/urlState.ts";
import { AtlasMap, revealMarker } from "./map/AtlasMap.tsx";
import { toFeatures } from "./map/layers.ts";

// Loaded only by people who open them, so the map's first load stays small.
const MarkerForm = lazy(() =>
  import("./components/MarkerForm.tsx").then((m) => ({ default: m.MarkerForm })),
);
const MyMarkers = lazy(() =>
  import("./components/MyMarkers.tsx").then((m) => ({ default: m.MyMarkers })),
);

type Panel = "filters" | "download" | "sign-in" | "list" | SignedInPanel;

/** Lists a marker can be opened from, which "<" and Backspace return to. */
type ListPanel = "mine" | "list";

/** A message at the top of the map; `share` offers to share that marker (specs/marker-sharing). */
type Notice = { text: string; share?: string };

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

export function App({ signInError }: { signInError?: string }) {
  const initial = useMemo(() => parseUrlState(window.location.search), []);
  const [now] = useState(() => new Date());
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [colourBy, setColourBy] = useState<ColourBy>(initial.colourBy);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [selectedId, setSelectedId] = useState<string | undefined>(initial.marker);
  const [view, setView] = useState<MapView | undefined>(initial.view);
  const [openPanel, setPanel] = useState<Panel | undefined>(initial.panel);
  const [notice, setNoticeState] = useState<Notice | undefined>(
    signInError ? { text: signInError } : undefined,
  );
  const setNotice = useCallback(
    (text: string | undefined) => setNoticeState(text ? { text } : undefined),
    [],
  );
  const [shareFor, setShareFor] = useState<{ id: string; source: ShareSource }>();
  // The marker opened from My markers or the list, which can go back there; and the entry to
  // return to.
  const [cameFrom, setCameFrom] = useState<{ panel: ListPanel; id: string }>();
  const [backFocus, setBackFocus] = useState<string>();
  const [bounds, setBounds] = useState<Bounds>();
  const [sort, setSort] = useState<ListSort>(initial.sort ?? "name");
  // Saved changes, shown at once: the published files catch up within minutes.
  const [saved, setSaved] = useState<ReadonlyMap<string, PublicMarker | null>>(new Map());
  const onSessionEnded = useCallback(
    () => setNotice("Your session has ended. Sign in again to make changes."),
    [setNotice],
  );
  const { session, refresh } = useSession(onSessionEnded);
  const me = session.status === "signed-in" ? session.me : undefined;
  // A form left open when the session ended stays, so what was typed can be kept.
  const endedAdmin = session.status === "anonymous" ? session.wasAdmin : undefined;
  const keepsForm = (openPanel === "add" || openPanel === "edit") && endedAdmin !== undefined;
  // A signed-in panel in a link means nothing to someone who isn't signed in.
  const signedInPanel = openPanel === "mine" || openPanel === "add" || openPanel === "edit";
  const panel =
    signedInPanel && session.status === "anonymous" && !keepsForm ? undefined : openPanel;
  const formOpen = panel === "add" || panel === "edit";
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
  const allMarkers = useMemo(() => {
    const published = snapshot?.markers ?? [];
    if (saved.size === 0) return published;
    const updated = published.flatMap((m) => {
      const change = saved.get(m.id);
      if (change === undefined) return [m];
      return change === null ? [] : [change];
    });
    const known = new Set(published.map((m) => m.id));
    for (const [id, marker] of saved) if (marker && !known.has(id)) updated.push(marker);
    return updated;
  }, [snapshot, saved]);
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
  const listed = useMemo(
    () =>
      panel === "list" && bounds
        ? sortMarkers(
            markers.filter((m) => inView(m, bounds)),
            sort,
          )
        : [],
    [panel, markers, bounds, sort],
  );
  const selected = allMarkers.find((m) => m.id === selectedId);
  const shareMarker = shareFor && allMarkers.find((m) => m.id === shareFor.id);
  const closeShare = useCallback(() => setShareFor(undefined), []);
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
    const query = formatUrlState({
      marker: selectedId,
      view,
      colourBy,
      filters,
      panel:
        panel === "mine" || panel === "add" || panel === "edit" || panel === "list"
          ? panel
          : undefined,
      sort,
    });
    window.history.replaceState(null, "", `${window.location.pathname}${query}`);
  }, [selectedId, view, colourBy, filters, panel, sort]);

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
      // A marker being edited may not be on the public map at all.
      if (!initial.marker || !snapshot || initial.panel === "edit") return;
      const marker = snapshot.markers.find((m) => m.id === initial.marker);
      if (marker) {
        if (!initial.view) void revealMarker(map, marker.longitude, marker.latitude, marker.id);
        // From the reminder page's "Share it".
        if (initial.share) setShareFor({ id: marker.id, source: "email" });
      } else {
        setSelectedId(undefined);
        setNotice("That site was not found on the Atlas. It may have been removed.");
      }
    },
    [initial, snapshot, setNotice],
  );

  const startSignIn = (panelAfter?: SignedInPanel) => {
    const query = formatUrlState({
      marker: selectedId,
      view,
      colourBy,
      filters,
      panel: panelAfter,
    });
    signIn(`${window.location.pathname}${query}`).catch(() =>
      setNotice("Sign-in is unavailable right now. The map still works."),
    );
  };

  const startSignOut = () => {
    const query = formatUrlState({ marker: selectedId, view, colourBy, filters });
    signOut(`${window.location.pathname}${query}`).catch(() =>
      setNotice("Signing out didn't work. Please try again."),
    );
  };

  /**
   * Shows a saved change on this person's map straight away. With `prompt` (after adding or
   * confirming), the notice offers to share the marker once it is published and public.
   */
  const applyResult = useCallback(
    (id: string, result: MarkerResult, prompt = false) => {
      setSaved((current) => new Map(current).set(id, result.marker));
      const shareable =
        prompt && result.published && result.marker !== null && result.marker.status !== "closed";
      setNoticeState({ text: savedNotice(result.published), share: shareable ? id : undefined });
      void refresh();
    },
    [refresh],
  );

  const roleOnSelected =
    me && selectedId
      ? me.admin
        ? ("admin" as const)
        : me.markers.find((m) => m.id === selectedId)?.role
      : undefined;

  const openMine = (id: string) => {
    const marker = allMarkers.find((m) => m.id === id);
    if (marker) {
      select(marker);
      setCameFrom({ panel: "mine", id });
      setBackFocus(undefined);
    } else {
      // Hidden and invalid markers aren't on the map; they open straight in the form.
      setSelectedId(id);
      setPanel("edit");
    }
  };

  const openFromList = (marker: PublicMarker) => {
    select(marker);
    setCameFrom({ panel: "list", id: marker.id });
    setBackFocus(undefined);
  };

  const goBack = useCallback(() => {
    if (!cameFrom) return;
    setBackFocus(cameFrom.id);
    setCameFrom(undefined);
    setSelectedId(undefined);
    setPanel(cameFrom.panel);
  }, [cameFrom]);

  // My markers needs a session; the list doesn't.
  const canGoBack =
    selected && cameFrom?.id === selected.id && (cameFrom.panel === "list" || Boolean(me));

  const closePanel = () => {
    setBackFocus(undefined);
    setPanel(undefined);
  };

  const changeFilters = (next: Filters) => {
    setFilters(next);
    track("filter_change");
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <a href="/">
            <img className="logo" src="/openmrs-cross.png" alt="" width="28" height="28" />
            <span className="wordmark">
              OpenMRS <span>Atlas</span>
            </span>
          </a>
        </h1>
        <SearchBox
          markers={allMarkers}
          onPick={(m) => {
            if (formOpen) return;
            track("search");
            select(m);
          }}
        >
          <button
            type="button"
            className="search-filter"
            aria-label={hasFilters(filters) ? "Filters (on)" : "Filters"}
            title="Filters"
            aria-expanded={panel === "filters"}
            disabled={formOpen}
            onClick={() => setPanel((p) => (p === "filters" ? undefined : "filters"))}
          >
            <FilterIcon />
            {hasFilters(filters) && <span className="dot" />}
          </button>
        </SearchBox>
        <button
          type="button"
          className="secondary tool"
          aria-label="List"
          title="List"
          aria-expanded={panel === "list"}
          disabled={!snapshot || formOpen}
          onClick={() => {
            if (panel !== "list") track("list_open");
            setBackFocus(undefined);
            setPanel((p) => (p === "list" ? undefined : "list"));
          }}
        >
          <ListIcon />
        </button>
        <button
          type="button"
          className="secondary tool"
          aria-label="Download"
          title="Download"
          aria-expanded={panel === "download"}
          disabled={!snapshot || formOpen}
          onClick={() => setPanel((p) => (p === "download" ? undefined : "download"))}
        >
          <DownloadIcon />
        </button>
        {signInEnabled &&
          (me ? (
            <button
              type="button"
              className="secondary tool account"
              title={me.username}
              aria-expanded={panel === "mine"}
              disabled={formOpen}
              onClick={() => setPanel((p) => (p === "mine" ? undefined : "mine"))}
            >
              <PersonIcon />
              <span className="account-name">
                {me.username}
                {me.offers.length > 0 ? ` (${me.offers.length} waiting)` : ""}
              </span>
              {me.offers.length > 0 && <span className="dot" />}
            </button>
          ) : (
            <button
              type="button"
              className="secondary sign-in"
              aria-expanded={panel === "sign-in"}
              disabled={formOpen || session.status === "loading"}
              onClick={() => setPanel((p) => (p === "sign-in" ? undefined : "sign-in"))}
            >
              <PersonIcon />
              <span className="sign-in-label">Sign in</span>
            </button>
          ))}
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
                // While a form is open, clicking the map places its pin instead.
                if (formOpen) return;
                const marker = allMarkers.find((m) => m.id === id);
                if (marker) select(marker);
              }}
              onViewChange={setView}
              onBoundsChange={setBounds}
              onReady={onMapReady}
            />
            <StatsBar stats={stats} />
            <Legend colourBy={colourBy} entries={legend} onColourByChange={setColourBy} />
          </>
        )}
        {(notice || (session.status === "anonymous" && session.error)) && (
          <div className="notice" role="status">
            {notice?.text ?? (session.status === "anonymous" ? session.error : undefined)}
            {notice?.share && (
              <button
                type="button"
                className="secondary share-prompt"
                onClick={() => {
                  setShareFor({ id: notice.share!, source: "prompt" });
                  setNoticeState(undefined);
                }}
              >
                Share
              </button>
            )}
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
        {panel === "list" && snapshot && (
          <SiteList
            markers={listed}
            sort={sort}
            onSortChange={setSort}
            onOpen={openFromList}
            onClose={closePanel}
            focusId={backFocus}
          />
        )}
        {panel === "sign-in" && (
          <SignInPanel onSignIn={() => startSignIn("mine")} onClose={() => setPanel(undefined)} />
        )}
        {selected && !panel && (
          <MarkerDetails
            marker={selected}
            onClose={() => setSelectedId(undefined)}
            onBack={canGoBack ? goBack : undefined}
            backLabel={cameFrom?.panel === "list" ? "Back to the list" : "Back to My markers"}
            onShare={() => setShareFor({ id: selected.id, source: "details" })}
          >
            {roleOnSelected && (
              <MarkerActions
                key={selected.id}
                markerId={selected.id}
                canManage={roleOnSelected !== "editor"}
                closed={selected.status === "closed"}
                confirmedAt={selected.confirmed_at}
                onEdit={() => setPanel("edit")}
                onResult={(result, prompt) => {
                  applyResult(selected.id, result, prompt);
                  if (!result.marker) setSelectedId(undefined);
                }}
              />
            )}
            {me && (
              <ClaimPanel
                key={`claim-${selected.id}`}
                markerId={selected.id}
                claimable={me.claimable?.includes(selected.id) ?? false}
                mine={me.claims?.find((c) => c.marker_id === selected.id)}
                review={me.review?.filter((c) => c.marker_id === selected.id) ?? []}
                onChanged={() => void refresh()}
                onApproved={(result) => applyResult(selected.id, result)}
              />
            )}
            {session.status === "anonymous" && signInEnabled && (
              <p className="hint claim-hint">
                Is this your site?{" "}
                <button type="button" className="link" onClick={() => startSignIn()}>
                  Sign in to update or claim it.
                </button>
              </p>
            )}
          </MarkerDetails>
        )}
        <Suspense
          fallback={
            <div className="panel" role="status">
              Loading…
            </div>
          }
        >
          {panel === "mine" && me && (
            <MyMarkers
              me={me}
              onOpen={openMine}
              onResult={applyResult}
              onChanged={() => void refresh()}
              onAdd={() => setPanel("add")}
              onSignOut={startSignOut}
              onClose={closePanel}
              focusId={backFocus}
            />
          )}
          {formOpen && (me || keepsForm) && snapshot && (
            <MarkerForm
              key={panel === "edit" ? selectedId : "add"}
              markerId={panel === "edit" ? selectedId : undefined}
              snapshot={snapshot}
              admin={me ? me.admin : Boolean(endedAdmin)}
              sessionEnded={!me}
              map={map}
              onSaved={(result, id) => {
                // Adding, not editing, offers to share.
                applyResult(id, result, panel === "add");
                setPanel(undefined);
                setSelectedId(result.marker ? id : undefined);
                if (result.marker && mapRef.current) {
                  void revealMarker(
                    mapRef.current,
                    result.marker.longitude,
                    result.marker.latitude,
                    id,
                  );
                }
              }}
              onChanged={(result, id) => applyResult(id, result)}
              onClose={() => {
                setPanel(undefined);
                if (selectedId && !allMarkers.some((m) => m.id === selectedId)) {
                  setSelectedId(undefined);
                }
              }}
              onSignIn={() => startSignIn(panel === "edit" ? "edit" : "add")}
            />
          )}
        </Suspense>
        {shareMarker && shareFor && (
          <ShareDialog
            key={shareMarker.id}
            marker={shareMarker}
            source={shareFor.source}
            onClose={closeShare}
          />
        )}
      </main>
    </div>
  );
}
