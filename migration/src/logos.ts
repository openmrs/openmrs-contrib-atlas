import sharp from "sharp";

export const LOGO_MAX_SIDE = 300;

/** A 2.0 marker image as WebP no larger than 300 × 300, keeping its aspect ratio. */
export async function toLogo(image: Uint8Array): Promise<Buffer> {
  return sharp(image)
    .resize(LOGO_MAX_SIDE, LOGO_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
}
