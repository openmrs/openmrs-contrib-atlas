import type { Map as MapLibreMap } from "maplibre-gl";
import { useState } from "react";
import { config } from "../config.ts";
import { datedFileName, downloadDataFile, saveBlob } from "../export/download.ts";
import { ExportTooLargeError, maxImageSide, renderPng, type Scale } from "../export/png.ts";
import { track } from "../lib/analytics.ts";
import type { LegendEntry } from "../lib/colours.ts";

interface Props {
  map: MapLibreMap | null;
  legend: LegendEntry[];
  onClose: () => void;
  /** For tests: replace the image renderer and the device's size limit. */
  render?: typeof renderPng;
  maxSide?: () => number;
}

export function DownloadPanel({
  map,
  legend,
  onClose,
  render = renderPng,
  maxSide = maxImageSide,
}: Props) {
  const [scale, setScale] = useState<Scale>(2);
  const [showTitle, setShowTitle] = useState(true);
  const [title, setTitle] = useState("OpenMRS Atlas");
  const [showLegend, setShowLegend] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const width = map?.getContainer().clientWidth ?? 0;
  const height = map?.getContainer().clientHeight ?? 0;
  const [limit] = useState(maxSide);
  const fits = (s: Scale) => width * s <= limit && height * s <= limit;

  async function downloadImage() {
    if (!map) return;
    setBusy(true);
    setError(undefined);
    try {
      const blob = await render(map, {
        scale,
        title: showTitle ? title : undefined,
        legend: showLegend ? legend : undefined,
        date: showDate ? new Date() : undefined,
      });
      saveBlob(blob, datedFileName("png"));
      track("download", { format: "png", scale });
    } catch (err) {
      setError(
        err instanceof ExportTooLargeError ? err.message : "The image could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function downloadData(ext: "csv" | "geojson") {
    setError(undefined);
    try {
      await downloadDataFile(`${config.dataBaseUrl}/markers.${ext}`, ext);
      track("download", { format: ext });
    } catch {
      setError("The data file could not be downloaded.");
    }
  }

  return (
    <aside className="panel download-panel" aria-label="Download">
      <div className="panel-header">
        <h2>Download</h2>
        <button type="button" className="icon-button" aria-label="Close download" onClick={onClose}>
          ×
        </button>
      </div>

      <fieldset>
        <legend>Image of this view (PNG)</legend>
        {([1, 2, 4] as Scale[]).map((s) => (
          <label key={s}>
            <input
              type="radio"
              name="scale"
              checked={scale === s}
              disabled={!fits(s)}
              onChange={() => setScale(s)}
            />
            {s}x ({width * s} × {height * s} px){fits(s) ? "" : " – too large for this device"}
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={showTitle}
            onChange={(e) => setShowTitle(e.target.checked)}
          />
          Title
        </label>
        {showTitle && (
          <input
            type="text"
            aria-label="Title text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
        <label>
          <input
            type="checkbox"
            checked={showLegend}
            onChange={(e) => setShowLegend(e.target.checked)}
          />
          Legend
        </label>
        <label>
          <input
            type="checkbox"
            checked={showDate}
            onChange={(e) => setShowDate(e.target.checked)}
          />
          Date
        </label>
        <p className="hint">Map attribution is always included.</p>
        <button
          type="button"
          className="primary"
          disabled={busy || !map}
          onClick={() => void downloadImage()}
        >
          {busy ? "Creating image…" : "Download image"}
        </button>
      </fieldset>

      <fieldset>
        <legend>All published data</legend>
        <p className="hint">Every site on the Atlas, without contact details.</p>
        <div className="button-row">
          <button type="button" className="secondary" onClick={() => void downloadData("csv")}>
            Download data (CSV)
          </button>
          <button type="button" className="secondary" onClick={() => void downloadData("geojson")}>
            Download data (GeoJSON)
          </button>
        </div>
      </fieldset>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </aside>
  );
}
