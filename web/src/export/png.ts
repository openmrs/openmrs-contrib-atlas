import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { LegendEntry } from "../lib/colours.ts";
import { installPins } from "../map/pins.ts";

export type Scale = 1 | 2 | 4;

export interface ImageOptions {
  scale: Scale;
  /** Omitted or empty: no title. */
  title?: string;
  legend?: LegendEntry[];
  /** Printed when set. */
  date?: Date;
}

export class ExportTooLargeError extends Error {
  constructor() {
    super("This browser could not create an image that large. Try a smaller size.");
  }
}

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long" });

let maxSize: number | undefined;

/** The largest canvas side this device's WebGL can render (MAX_TEXTURE_SIZE). */
export function maxImageSide(): number {
  if (maxSize === undefined) {
    const gl = document.createElement("canvas").getContext("webgl2");
    maxSize = gl ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 4096;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return maxSize;
}

/**
 * Renders the current view off-screen at `scale` times the on-screen size, with the same
 * style, data, filters and camera, then adds title, legend, date and attribution.
 * See specs/map-export.
 */
export async function renderPng(map: MapLibreMap, options: ImageOptions): Promise<Blob> {
  const source = map.getContainer();
  const width = source.clientWidth;
  const height = source.clientHeight;
  const { scale } = options;
  const limit = maxImageSide();
  if (width * scale > limit || height * scale > limit) throw new ExportTooLargeError();

  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${width}px`,
    height: `${height}px`,
  });
  document.body.appendChild(container);

  let offscreen: MapLibreMap | undefined;
  try {
    offscreen = new maplibregl.Map({
      container,
      style: map.getStyle(),
      center: map.getCenter(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      pixelRatio: scale,
      // MapLibre caps the canvas at 4096 px by default; allow what this GPU supports.
      maxCanvasSize: [limit, limit],
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    installPins(offscreen);
    await offscreen.once("idle");

    const mapCanvas = offscreen.getCanvas();
    // MapLibre quietly lowers the pixel ratio when the GPU cannot draw that many pixels.
    if (mapCanvas.width < width * scale || mapCanvas.height < height * scale) {
      throw new ExportTooLargeError();
    }

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ExportTooLargeError();
    ctx.drawImage(mapCanvas, 0, 0);
    ctx.scale(scale, scale);
    drawOverlays(ctx, width, height, options, attributionText(map));

    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
    if (!blob) throw new ExportTooLargeError();
    return blob;
  } catch (err) {
    if (err instanceof ExportTooLargeError) throw err;
    if (err instanceof RangeError || /memory|allocat|size/i.test(String(err))) {
      throw new ExportTooLargeError();
    }
    throw err;
  } finally {
    offscreen?.remove();
    container.remove();
  }
}

/** The attribution shown on the live map, as plain text. */
function attributionText(map: MapLibreMap): string {
  const el = map.getContainer().querySelector(".maplibregl-ctrl-attrib-inner");
  const text = el?.textContent?.replace(/\s+/g, " ").trim();
  return text || "© OpenStreetMap contributors";
}

const INK = "#1f2933";
const QUIET = "#5f6b7a";
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.shadowColor = "rgba(16,24,40,0.15)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.restore();
}

/** Draws in CSS pixels; the context is already scaled. */
function drawOverlays(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: ImageOptions,
  attribution: string,
) {
  const title = options.title?.trim();
  if (title || options.date) {
    ctx.font = `600 22px ${FONT}`;
    const titleWidth = title ? ctx.measureText(title).width : 0;
    ctx.font = `14px ${FONT}`;
    const dateText = options.date ? dateFormat.format(options.date) : "";
    const dateWidth = dateText ? ctx.measureText(dateText).width : 0;
    const boxH = (title ? 30 : 0) + (dateText ? 22 : 0) + 16;
    panel(ctx, 16, 16, Math.max(titleWidth, dateWidth) + 32, boxH);
    let y = 16 + 8;
    if (title) {
      ctx.font = `600 22px ${FONT}`;
      ctx.fillStyle = INK;
      ctx.fillText(title, 32, y + 22);
      y += 30;
    }
    if (dateText) {
      ctx.font = `14px ${FONT}`;
      ctx.fillStyle = QUIET;
      ctx.fillText(dateText, 32, y + 16);
    }
  }

  if (options.legend && options.legend.length > 0) {
    ctx.font = `13px ${FONT}`;
    const rowH = 20;
    const textW = Math.max(...options.legend.map((e) => ctx.measureText(e.value).width));
    const boxW = textW + 52;
    const boxH = options.legend.length * rowH + 16;
    const x = 16;
    const y = height - boxH - 36;
    panel(ctx, x, y, boxW, boxH);
    options.legend.forEach((entry, i) => {
      const cy = y + 8 + i * rowH + rowH / 2;
      ctx.beginPath();
      ctx.arc(x + 20, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = entry.colour;
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillText(entry.value, x + 34, cy + 4.5);
    });
  }

  // Attribution is always included (specs/map-export, "Image options").
  ctx.font = `11px ${FONT}`;
  const attrW = ctx.measureText(attribution).width + 12;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(width - attrW, height - 18, attrW, 18);
  ctx.fillStyle = INK;
  ctx.fillText(attribution, width - attrW + 6, height - 5);
}
