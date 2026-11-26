import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import type { AtlasSnapshot } from "@openmrs-atlas/shared";
import { MANIFEST, WORLD, type CardManifest, type CardStore } from "./cards/refresh.ts";
import { LOGO_FOLDER, type LogoStore } from "./logos.ts";
import type { PublicFile, SnapshotStore } from "./publish.ts";

/**
 * Every file the service writes lives in one data folder (`DATA_DIR`, `/atlas_data` in the
 * image), mounted from a volume the host backs up (specs/deployment). Names are the ones the
 * Cloud Storage bucket used, so copying a bucket into the folder gives a working Atlas.
 */
export const HISTORY_FOLDER = "history/";

/** History copies older than this are deleted by the nightly publish (specs/snapshot-publishing). */
export const HISTORY_DAYS = 90;

const isMissing = (err: unknown) => (err as { code?: string }).code === "ENOENT";

/** A file's path inside `root`, refusing names that would escape it. */
function pathIn(root: string, name: string): string {
  const path = resolve(root, name);
  if (path !== root && !path.startsWith(root + sep)) throw new Error(`bad file name: ${name}`);
  return path;
}

/**
 * Writes to a temporary file beside the target, then renames it into place, so a reader gets
 * the old file or the new one whole, never part of either (specs/snapshot-publishing).
 */
async function writeWhole(root: string, name: string, body: string | Buffer): Promise<void> {
  const path = pathIn(root, name);
  await mkdir(dirname(path), { recursive: true });
  const temp = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temp, body);
    await rename(temp, path);
  } catch (err) {
    await rm(temp, { force: true });
    throw err;
  }
}

async function readJson<T>(root: string, name: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(pathIn(root, name), "utf8")) as T;
  } catch (err) {
    if (isMissing(err)) return undefined;
    throw err;
  }
}

/** Every file whose name starts with `prefix` (a folder ending in "/"), skipping temporary files. */
async function listFiles(root: string, prefix: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(pathIn(root, prefix), { recursive: true, withFileTypes: true });
  } catch (err) {
    if (isMissing(err)) return [];
    throw err;
  }
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith("."))
    .map((e) => relative(root, join(e.parentPath, e.name)).split(sep).join("/"))
    .sort();
}

async function removeFiles(root: string, names: string[]): Promise<void> {
  for (const name of names) await rm(pathIn(root, name), { force: true });
}

/** When a history copy was published, from its name: `history/atlas-2026-11-23T03-00-00-000Z.json`. */
export function historyDate(name: string): Date | undefined {
  const m = /^history\/atlas-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.json$/.exec(
    name,
  );
  if (!m) return undefined;
  const date = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export interface FolderStores {
  snapshots: SnapshotStore;
  cards: CardStore;
  logos: LogoStore;
}

/**
 * The published files, social cards and logos, in `dir`. `siteUrl` is the public site: the
 * service serves the folder's public files under `<siteUrl>/data/`.
 */
export function folderStores(dir: string, siteUrl: string): FolderStores {
  const root = resolve(dir);
  const publicPrefix = `${siteUrl.replace(/\/$/, "")}/data/`;

  const snapshots: SnapshotStore = {
    async currentCount() {
      const snapshot = await readJson<{ markers: unknown[] }>(root, "atlas.json");
      return snapshot?.markers.length;
    },
    // The files don't refer to one another, so they are written together.
    async write(files: PublicFile[]) {
      await Promise.all(files.map((file) => writeWhole(root, file.name, file.body)));
    },
    async pruneHistory(before: Date) {
      const old = (await listFiles(root, HISTORY_FOLDER)).filter((name) => {
        const date = historyDate(name);
        return date !== undefined && date < before;
      });
      await removeFiles(root, old);
      return old.length;
    },
  };

  const logos: LogoStore = {
    publicPrefix,
    async saveLogo(name, body) {
      await writeWhole(root, name, body);
      return `${publicPrefix}${name}`;
    },
    async listLogos() {
      const names = await listFiles(root, LOGO_FOLDER);
      return Promise.all(
        names.map(async (name) => ({ name, created: (await stat(pathIn(root, name))).mtime })),
      );
    },
    removeLogos: (names) => removeFiles(root, names),
  };

  const cards: CardStore = {
    readSnapshot: () => readJson<AtlasSnapshot>(root, "atlas.json"),
    readManifest: () => readJson<CardManifest>(root, MANIFEST),
    writeManifest: (manifest) => writeWhole(root, MANIFEST, JSON.stringify(manifest)),
    writeCard: (name, body) => writeWhole(root, name, body),
    writeWorld: (body) => writeWhole(root, WORLD, body),
    list: (prefix) => listFiles(root, prefix),
    remove: (names) => removeFiles(root, names),
    publicUrl: (name) => `${publicPrefix}${name}`,
  };

  return { snapshots, cards, logos };
}
