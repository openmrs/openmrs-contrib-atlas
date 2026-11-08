import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import opentype, { type Font } from "opentype.js";

const FONT_DIR = resolve(import.meta.dirname, "../../assets/fonts");

function load(file: string): Font {
  const buf = readFileSync(resolve(FONT_DIR, file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

let fonts: { regular: Font; bold: Font } | undefined;

/** Noto Sans, bundled so cards look the same everywhere (no system fonts needed). */
export function cardFonts(): { regular: Font; bold: Font } {
  fonts ??= { regular: load("NotoSans-Regular.ttf"), bold: load("NotoSans-Bold.ttf") };
  return fonts;
}

/** The text with characters the font can't draw left out, and runs of spaces collapsed. */
export function drawable(font: Font, text: string): string {
  return [...text.normalize("NFC")]
    .filter((c) => c === " " || font.hasChar(c))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits text into at most `maxLines` lines no wider than `maxWidth`. When it doesn't fit, the
 * last line ends with an ellipsis. Words longer than a line are broken between characters.
 */
export function wrap(
  font: Font,
  text: string,
  size: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const width = (s: string) => font.getAdvanceWidth(s, size);
  const words = drawable(font, text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    const word = words[i]!;
    const candidate = line ? `${line} ${word}` : word;
    if (width(candidate) <= maxWidth) {
      line = candidate;
      i++;
    } else if (line) {
      lines.push(line);
      line = "";
    } else {
      // A single word wider than the line: take as many characters as fit.
      const chars = [...word];
      let n = chars.length;
      while (n > 1 && width(chars.slice(0, n).join("")) > maxWidth) n--;
      lines.push(chars.slice(0, n).join(""));
      words[i] = chars.slice(n).join("");
    }
  }
  // The loop only stops with a line pending once every word is placed.
  if (line) lines.push(line);
  if (i < words.length && lines.length > 0) {
    // More text than lines: end the last line with an ellipsis that fits.
    let last = lines[lines.length - 1]!;
    while (last && width(`${last}…`) > maxWidth) last = [...last].slice(0, -1).join("");
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

/** SVG path data for one line of text with its baseline at (x, y). */
export function textPath(font: Font, text: string, x: number, y: number, size: number): string {
  // Not Path.toPathData: its rounding turns some coordinates into "NaN" (opentype.js 2.0.0).
  const n = (v: number | undefined) => (v ?? 0).toFixed(1).replace(/\.0$/, "");
  return font
    .getPath(drawable(font, text), x, y, size)
    .commands.map((c) => {
      switch (c.type) {
        case "M":
        case "L":
          return `${c.type}${n(c.x)} ${n(c.y)}`;
        case "Q":
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case "C":
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        default:
          return "Z";
      }
    })
    .join("");
}

export function textWidth(font: Font, text: string, size: number): number {
  return font.getAdvanceWidth(drawable(font, text), size);
}
