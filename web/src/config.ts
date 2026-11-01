import { DEFAULT_MAP_STYLE_URL } from "./mapStyle.ts";

const env = import.meta.env;

export const config = {
  /** Where atlas.json, markers.csv and markers.geojson are published. */
  dataBaseUrl: (env.VITE_DATA_BASE_URL as string | undefined) || "/dev-data",
  /** Snapshot file name under dataBaseUrl; dev can switch to live.json. */
  dataFile: (env.VITE_DATA_FILE as string | undefined) || "atlas.json",
  mapStyleUrl: (env.VITE_MAP_STYLE_URL as string | undefined) || DEFAULT_MAP_STYLE_URL,
  /** Google Analytics 4 measurement id; empty disables analytics. */
  gaId: (env.VITE_GA_ID as string | undefined) || "",
  /** Exposes the map on window for end-to-end tests. */
  e2e: env.VITE_E2E === "1",
};
