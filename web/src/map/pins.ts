import type { Map as MapLibreMap } from "maplibre-gl";

/** Pin size in CSS pixels; the tip is at the bottom centre, on the marker's position. */
const WIDTH = 24;
const HEIGHT = 32;
/** Drawn at 4x so pins stay sharp in a 4x PNG export. */
const RATIO = 4;
const HEAD_RADIUS = 10.5;
const HEAD_Y = 12;
/** How far above the tip the centre of the head is, for placing a count in it. */
export const HEAD_HEIGHT = HEIGHT - HEAD_Y;

const DOT = "pin-dot-";
const PLAIN = "pin-plain-";
export const SELECTED_PIN = "pin-selected";
export const dotPrefix = DOT;
export const plainPrefix = PLAIN;

function drawPin(fill: string | null, stroke: string, strokeWidth: number, dot: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * RATIO;
  canvas.height = HEIGHT * RATIO;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(RATIO, RATIO);
  const cx = WIDTH / 2;
  const r = HEAD_RADIUS;
  ctx.beginPath();
  ctx.moveTo(cx, HEIGHT - 1);
  ctx.bezierCurveTo(cx - 3, HEIGHT - 8, cx - r, HEAD_Y + 7, cx - r, HEAD_Y);
  ctx.arc(cx, HEAD_Y, r, Math.PI, 0);
  ctx.bezierCurveTo(cx + r, HEAD_Y + 7, cx + 3, HEIGHT - 8, cx, HEIGHT - 1);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  if (dot) {
    ctx.beginPath();
    ctx.arc(cx, HEAD_Y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function pinFor(id: string) {
  if (id === SELECTED_PIN) return drawPin(null, "#111111", 2.5, false);
  if (id.startsWith(DOT)) return drawPin(id.slice(DOT.length), "#FFFFFF", 1.5, true);
  if (id.startsWith(PLAIN)) return drawPin(id.slice(PLAIN.length), "#FFFFFF", 1.5, false);
  return null;
}

/**
 * Draws pins as the style asks for them. Runtime images aren't part of `getStyle()`, so every
 * map that shows markers calls this, including the off-screen map behind PNG export.
 */
export function installPins(map: MapLibreMap) {
  map.setMissingStyleImageResolver((id) => {
    const image = pinFor(id);
    if (image && !map.hasImage(id)) map.addImage(id, image, { pixelRatio: RATIO });
  });
}
