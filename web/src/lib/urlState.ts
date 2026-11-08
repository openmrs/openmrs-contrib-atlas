import type { ListSort } from "./list.ts";
import { NO_FILTERS, type ColourBy, type Filters, type MapView } from "./types.ts";

/**
 * Everything a shared link restores. Query parameters:
 *   marker=<id>           selected marker (also the Atlas 2.0 link form)
 *   map=<zoom>/<lat>/<lng>
 *   colour=distribution|version   (type is the default and is omitted)
 *   type=, dist=, version=, country=   repeated once per selected value
 *   confirmed=<years>
 *   closed=hide
 *   panel=list            the list of markers in view, open to anyone
 *   panel=mine|add|edit   a signed-in panel; edit applies to the marker above
 *   sort=country|sites|confirmed   the list's sort (name is the default and is omitted)
 */
export type SignedInPanel = "mine" | "add" | "edit";
const SIGNED_IN_PANELS: SignedInPanel[] = ["mine", "add", "edit"];
export type UrlPanel = SignedInPanel | "list";
const PANELS: UrlPanel[] = [...SIGNED_IN_PANELS, "list"];
const SORTS: ListSort[] = ["name", "country", "sites", "confirmed"];

export interface UrlState {
  marker?: string;
  panel?: UrlPanel;
  /** Kept only while the list is open. */
  sort?: ListSort;
  view?: MapView;
  colourBy: ColourBy;
  filters: Filters;
}

const COLOUR_BY: ColourBy[] = ["type", "distribution", "version"];

export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const state: UrlState = { colourBy: "type", filters: { ...NO_FILTERS } };

  const marker = params.get("marker");
  if (marker) state.marker = marker;

  const panel = params.get("panel") as UrlPanel | null;
  if (panel && PANELS.includes(panel)) state.panel = panel;
  const sort = params.get("sort") as ListSort | null;
  if (state.panel === "list" && sort && sort !== "name" && SORTS.includes(sort)) state.sort = sort;

  const [zoom, lat, lng] = (params.get("map") ?? "").split("/").map(Number);
  if (
    [zoom, lat, lng].every((n) => n !== undefined && Number.isFinite(n)) &&
    Math.abs(lat!) <= 90 &&
    Math.abs(lng!) <= 180
  ) {
    state.view = { zoom: zoom!, lat: lat!, lng: lng! };
  }

  const colour = params.get("colour") as ColourBy | null;
  if (colour && COLOUR_BY.includes(colour)) state.colourBy = colour;

  state.filters = {
    types: params.getAll("type"),
    distributions: params.getAll("dist"),
    versions: params.getAll("version"),
    countries: params.getAll("country"),
  };
  const years = Number(params.get("confirmed"));
  if (params.has("confirmed") && years > 0) state.filters.confirmedWithinYears = years;

  if (params.get("closed") === "hide") state.filters.hideClosed = true;

  return state;
}

export function formatUrlState(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.marker) params.set("marker", state.marker);
  if (state.view) {
    const { zoom, lat, lng } = state.view;
    params.set("map", `${zoom.toFixed(2)}/${lat.toFixed(4)}/${lng.toFixed(4)}`);
  }
  if (state.colourBy !== "type") params.set("colour", state.colourBy);
  const { filters } = state;
  filters.types.forEach((v) => params.append("type", v));
  filters.distributions.forEach((v) => params.append("dist", v));
  filters.versions.forEach((v) => params.append("version", v));
  filters.countries.forEach((v) => params.append("country", v));
  if (filters.confirmedWithinYears !== undefined) {
    params.set("confirmed", String(filters.confirmedWithinYears));
  }
  if (filters.hideClosed) params.set("closed", "hide");
  if (state.panel) params.set("panel", state.panel);
  if (state.panel === "list" && state.sort && state.sort !== "name") params.set("sort", state.sort);
  // "/" is legal in a query string; leaving it unescaped keeps map=5/-1.3/36.8 readable.
  const query = params.toString().replace(/%2F/g, "/");
  return query ? `?${query}` : "";
}
