import { countryName } from "./countries.ts";
import type { PublicMarker } from "./types.ts";

/** Lower-case, without accents, so "clinica" finds "Clínica". */
export function normalise(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Markers whose name, organisation or country name contains the query; name matches first. */
export function searchMarkers(markers: PublicMarker[], query: string, limit = 10): PublicMarker[] {
  const q = normalise(query.trim());
  if (q.length < 2) return [];
  const byName: PublicMarker[] = [];
  const byOther: PublicMarker[] = [];
  for (const m of markers) {
    if (normalise(m.name).includes(q)) byName.push(m);
    else if (
      normalise(m.organisation ?? "").includes(q) ||
      normalise(countryName(m.country)).includes(q)
    ) {
      byOther.push(m);
    }
  }
  return [...byName, ...byOther].slice(0, limit);
}
