import { OTHER } from "@openmrs-atlas/shared/lookups";
import { UNKNOWN, type AtlasSnapshot, type ColourBy, type PublicMarker } from "./types.ts";

export interface LegendEntry {
  value: string;
  colour: string;
}

const UNKNOWN_COLOUR = "#9AA0A6";
/** Every distribution or version not on its list. */
const OTHER_COLOUR = "#5F6368";
/** Lighter than Unknown, so a closed site recedes. */
const CLOSED_COLOUR = "#B8BDC4";
export const CLOSED = "Closed";

/** Distinct colours for distributions, in lookup order. */
const CATEGORICAL = [
  "#1F77B4",
  "#FF7F0E",
  "#2CA02C",
  "#D62728",
  "#9467BD",
  "#8C564B",
  "#E377C2",
  "#17BECF",
  "#BCBD22",
  "#393B79",
  "#AD494A",
  "#637939",
];

/**
 * The legend value a marker belongs to. The palette holds every value on the lists, so a
 * distribution or version it has no colour for is an Other value (specs/map-view).
 */
function valueOf(marker: PublicMarker, by: ColourBy, colours: Map<string, string>): string {
  if (by === "type") return marker.type ?? UNKNOWN;
  const value = by === "distribution" ? marker.distribution : marker.openmrs_version;
  if (!value) return UNKNOWN;
  return colours.has(value) && value !== UNKNOWN ? value : OTHER;
}

/** A blue-to-orange ramp so versions read old to new. */
function ramp(i: number, n: number): string {
  const t = n <= 1 ? 1 : i / (n - 1);
  const hue = 220 - t * 190;
  return `hsl(${Math.round(hue)}, 70%, 45%)`;
}

/** Colour for every possible value of the attribute, from the snapshot's lookups. */
export function palette(snapshot: AtlasSnapshot, by: ColourBy): Map<string, string> {
  const colours = new Map<string, string>();
  if (by === "type") {
    for (const t of snapshot.types) colours.set(t.name, t.colour);
  } else if (by === "distribution") {
    snapshot.distributions.forEach((d, i) =>
      colours.set(d.name, CATEGORICAL[i % CATEGORICAL.length]!),
    );
    colours.set(OTHER, OTHER_COLOUR);
  } else {
    const versions = snapshot.versions.map((v) => v.version);
    versions.forEach((v, i) => colours.set(v, ramp(i, versions.length)));
    colours.set(OTHER, OTHER_COLOUR);
  }
  colours.set(UNKNOWN, UNKNOWN_COLOUR);
  return colours;
}

export function colourOf(marker: PublicMarker, by: ColourBy, colours: Map<string, string>) {
  if (marker.status === "closed") return CLOSED_COLOUR;
  return colours.get(valueOf(marker, by, colours)) ?? UNKNOWN_COLOUR;
}

/** Legend entries for values present among the markers, in palette order: Other, then Unknown, last. */
export function legendEntries(
  markers: PublicMarker[],
  by: ColourBy,
  colours: Map<string, string>,
): LegendEntry[] {
  const open = markers.filter((m) => m.status !== "closed");
  const present = new Set(open.map((m) => valueOf(m, by, colours)));
  const entries: LegendEntry[] = [];
  for (const [value, colour] of colours) {
    if (value !== UNKNOWN && present.has(value)) entries.push({ value, colour });
  }
  // A type missing from the palette (the sheet changed under an open page) still gets an entry.
  for (const value of present) {
    if (value !== UNKNOWN && !colours.has(value)) entries.push({ value, colour: UNKNOWN_COLOUR });
  }
  if (present.has(UNKNOWN)) entries.push({ value: UNKNOWN, colour: UNKNOWN_COLOUR });
  if (open.length < markers.length) entries.push({ value: CLOSED, colour: CLOSED_COLOUR });
  return entries;
}
