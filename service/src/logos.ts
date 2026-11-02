import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ApiError } from "./edits.ts";

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const FORMATS = ["png", "jpeg", "webp"];
const REASON = "Logos must be a PNG, JPEG or WebP image.";

export interface LogoStore {
  /** Stores a logo publicly and returns its URL. */
  saveLogo(name: string, body: Buffer): Promise<string>;
}

/**
 * The format comes from the file's contents, not its name. Re-encoding keeps only the picture,
 * dropping metadata and anything else hidden in the file. See specs/marker-editing, "Logo upload".
 */
export async function processLogo(input: Buffer): Promise<Buffer> {
  if (input.length > MAX_LOGO_BYTES) throw new ApiError(422, { error: "Logos can be up to 2 MB." });
  try {
    const image = sharp(input);
    const { format } = await image.metadata();
    if (!FORMATS.includes(format ?? "")) throw new ApiError(422, { error: REASON });
    return await image
      .rotate()
      .resize({ width: 300, height: 300, fit: "inside", withoutEnlargement: true })
      .webp()
      .toBuffer();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(422, { error: REASON });
  }
}

/** A fresh name each time, so a cached old logo can't linger under the same URL. */
export function logoName(): string {
  return `logos/${randomUUID()}.webp`;
}
