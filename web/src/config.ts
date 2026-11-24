import { DEFAULT_MAP_STYLE_URL } from "./mapStyle.ts";

const env = import.meta.env;

export const config = {
  /**
   * Where atlas.json, markers.csv and markers.geojson are published: the service serves them
   * at /data on the site's own origin. The dev server serves sample data at /dev-data.
   */
  dataBaseUrl: (env.VITE_DATA_BASE_URL as string | undefined) || (env.DEV ? "/dev-data" : "/data"),
  /** Snapshot file name under dataBaseUrl; dev can switch to live.json. */
  dataFile: (env.VITE_DATA_FILE as string | undefined) || "atlas.json",
  mapStyleUrl: (env.VITE_MAP_STYLE_URL as string | undefined) || DEFAULT_MAP_STYLE_URL,
  /** Google Analytics 4 measurement id; empty disables analytics. */
  gaId: (env.VITE_GA_ID as string | undefined) || "",
  /** The service's API, on the site's own origin. */
  apiBaseUrl: (env.VITE_API_BASE_URL as string | undefined) || "/api",
  /** Keycloak realm URL and client; without them, sign-in and editing stay hidden. */
  keycloakIssuer: (env.VITE_KEYCLOAK_ISSUER as string | undefined) || "",
  keycloakClientId: (env.VITE_KEYCLOAK_CLIENT_ID as string | undefined) || "",
  /** Exposes the map on window for end-to-end tests. */
  e2e: env.VITE_E2E === "1",
};
