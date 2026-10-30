import { UNKNOWN, type AtlasSnapshot, type ColourBy, type PublicMarker } from "./types.ts";

export interface LegendEntry {
  value: string;
  colour: string;
}

const UNKNOWN_COLOUR = "#9AA0A6";

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

function valueOf(marker: PublicMarker, by: ColourBy): string {
  const value =
    by === "type"
      ? marker.type
      : by === "distribution"
        ? marker.distribution
        : marker.openmrs_version;
  return value ?? UNKNOWN;
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
  } else {
    const versions = snapshot.versions.map((v) => v.version);
    versions.forEach((v, i) => colours.set(v, ramp(i, versions.length)));
    colours.set("Other", "#5F6368");
  }
  colours.set(UNKNOWN, UNKNOWN_COLOUR);
  return colours;
}

export function colourOf(marker: PublicMarker, by: ColourBy, colours: Map<string, string>) {
  return colours.get(valueOf(marker, by)) ?? UNKNOWN_COLOUR;
}

/** Legend entries for values present among the markers, in palette order, Unknown last. */
export function legendEntries(
  markers: PublicMarker[],
  by: ColourBy,
  colours: Map<string, string>,
): LegendEntry[] {
  const present = new Set(markers.map((m) => valueOf(m, by)));
  const entries: LegendEntry[] = [];
  for (const [value, colour] of colours) {
    if (value !== UNKNOWN && present.has(value)) entries.push({ value, colour });
  }
  for (const value of present) {
    if (value !== UNKNOWN && !colours.has(value)) entries.push({ value, colour: UNKNOWN_COLOUR });
  }
  if (present.has(UNKNOWN)) entries.push({ value: UNKNOWN, colour: UNKNOWN_COLOUR });
  return entries;
}
