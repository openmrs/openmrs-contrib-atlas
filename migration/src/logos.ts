import sharp from "sharp";

export const LOGO_MAX_SIDE = 300;

const DATA_URL = /^data:[^,]*;base64,/;

/** The image bytes of a 2.0 `image` value, which 2.0 stored as base64 data URL text. */
export function decodeStoredImage(stored: Uint8Array): Buffer {
  const bytes = Buffer.from(stored);
  const prefix = DATA_URL.exec(bytes.toString("latin1", 0, 128))?.[0];
  return prefix ? Buffer.from(bytes.toString("latin1", prefix.length), "base64") : bytes;
}

/** A 2.0 marker image as WebP no larger than 300 × 300, keeping its aspect ratio. */
export async function toLogo(stored: Uint8Array): Promise<Buffer> {
  return sharp(decodeStoredImage(stored))
    .resize(LOGO_MAX_SIDE, LOGO_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
}

/** Converts every marker's image; one that can't be read is reported, not fatal. */
export async function convertLogos(markers: { id: string; image: Uint8Array | null }[]) {
  const logos = new Map<string, Buffer>();
  const unreadable: { id: string; reason: string }[] = [];
  for (const { id, image } of markers) {
    if (!image || image.length === 0) continue;
    try {
      logos.set(id, await toLogo(image));
    } catch (err) {
      unreadable.push({ id, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return { logos, unreadable };
}
