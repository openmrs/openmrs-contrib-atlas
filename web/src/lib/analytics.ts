import { config } from "../config.ts";

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

/** Loads Google Analytics only when a measurement id is configured (specs/map-view, "Usage analytics"). */
export function initAnalytics(gaId = config.gaId): void {
  if (!gaId || window.gtag) return;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // gtag.js expects the arguments object itself.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", gaId);
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
  document.head.appendChild(script);
}

export type AtlasEvent = "search" | "filter_change" | "marker_open" | "download";

export function track(event: AtlasEvent, params: Record<string, string | number> = {}): void {
  window.gtag?.("event", event, params);
}
