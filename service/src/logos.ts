import { randomUUID } from "node:crypto";
import type { Cell } from "@openmrs-atlas/shared";
import sharp from "sharp";
import { ApiError } from "./edits/index.ts";

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const FORMATS = ["png", "jpeg", "webp"];
const REASON = "Logos must be a PNG, JPEG or WebP image.";

/** Where uploaded and migrated logos live in the public bucket. */
export const LOGO_FOLDER = "logos/";

export interface StoredLogo {
  name: string;
  created: Date;
}

export interface LogoStore {
  /** The public bucket's address, ending in "/": a logo's URL is this plus its name. */
  publicPrefix: string;
  /** Stores a logo publicly and returns its URL. */
  saveLogo(name: string, body: Buffer): Promise<string>;
  /** Every file in the logo folder, for the nightly sweep (specs/marker-editing). */
  listLogos(): Promise<StoredLogo[]>;
  removeLogos(names: string[]): Promise<void>;
}

/** The address a marker's `logo_url` must start with, when set through the Atlas. */
export const logoPrefix = (store: Pick<LogoStore, "publicPrefix">) =>
  `${store.publicPrefix}${LOGO_FOLDER}`;

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
  return `${LOGO_FOLDER}${randomUUID()}.webp`;
}

/** How long an unused upload is kept: long enough for a form still open to be saved. */
export const UNUSED_LOGO_GRACE_MS = 86_400_000;

/**
 * Deletes logos no marker row uses, whatever its status, once they are more than a day old
 * (specs/marker-editing). `markers` is the tab's values, header row first.
 */
export async function sweepLogos(
  store: Pick<LogoStore, "publicPrefix" | "listLogos" | "removeLogos">,
  markers: Cell[][],
  now: Date,
): Promise<{ deleted: number }> {
  const [header = [], ...rows] = markers;
  const column = header.findIndex((h) => String(h ?? "").trim() === "logo_url");
  const used = new Set<string>();
  if (column >= 0) {
    for (const row of rows) {
      const url = String(row[column] ?? "").trim();
      if (url.startsWith(store.publicPrefix)) used.add(url.slice(store.publicPrefix.length));
    }
  }
  const unused = (await store.listLogos()).filter(
    (logo) => !used.has(logo.name) && now.getTime() - logo.created.getTime() > UNUSED_LOGO_GRACE_MS,
  );
  if (unused.length > 0) await store.removeLogos(unused.map((logo) => logo.name));
  return { deleted: unused.length };
}
