export interface Place {
  name: string;
  latitude: number;
  longitude: number;
}

/** Place search through OpenStreetMap's Nominatim, only when someone asks for it. */
export async function searchPlaces(query: string): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "5" });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const results = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return results.map((r) => ({
    name: r.display_name,
    latitude: Number(r.lat),
    longitude: Number(r.lon),
  }));
}
