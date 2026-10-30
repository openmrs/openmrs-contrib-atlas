/** `openmrs-atlas-YYYY-MM-DD.<ext>` in the visitor's local date (specs/map-export). */
export function datedFileName(ext: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `openmrs-atlas-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${ext}`;
}

/** Saves a blob under the given name. */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Downloads a published data file under a dated name. Fetching first is needed because
 * browsers ignore the download attribute for files on another origin (the data bucket).
 */
export async function downloadDataFile(url: string, ext: "csv" | "geojson"): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  saveBlob(await res.blob(), datedFileName(ext));
}
