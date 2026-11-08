import type { AtlasSnapshot } from "@openmrs-atlas/shared";
import { cardHash, cardSvg, renderPng, worldSvg } from "./card.ts";

export const MANIFEST = "cards/manifest.json";
export const WORLD = "cards/world.png";
const CARD_PREFIX = "cards/";

/** Which card file belongs to each marker. Written after every card refresh. */
export interface CardManifest {
  markers: Record<string, { hash: string; file: string }>;
}

/** Cards and the published snapshot in the public bucket (specs/social-cards). */
export interface CardStore {
  /** The published atlas.json, or undefined if none is published. */
  readSnapshot(): Promise<AtlasSnapshot | undefined>;
  readManifest(): Promise<CardManifest | undefined>;
  writeManifest(manifest: CardManifest): Promise<void>;
  /** A card under a unique name: cached for a year. */
  writeCard(name: string, png: Buffer): Promise<void>;
  /** The world image, at a fixed name: cached for an hour. */
  writeWorld(png: Buffer): Promise<void>;
  list(prefix: string): Promise<string[]>;
  remove(names: string[]): Promise<void>;
  /** The public address of a file in the bucket. */
  publicUrl(name: string): string;
}

export interface CardOptions {
  siteUrl: string;
  /** How many marker cards to draw at most; the nightly publish passes Infinity. */
  limit: number;
  /** Delete card files the manifest no longer names (the nightly publish only). */
  sweep: boolean;
}

export interface CardResult {
  drawn: number;
  failed: number;
  /** Cards missing or out of date, left for a later publish. */
  pending: number;
  /** Markers no longer published whose cards left the manifest. */
  removed: number;
  deleted: number;
}

/**
 * Brings cards in line with a published snapshot: redraws changed cards first, then draws
 * missing ones, up to the limit; redraws the world image; writes the manifest.
 */
export async function refreshCards(
  snapshot: AtlasSnapshot,
  store: CardStore,
  options: CardOptions,
): Promise<CardResult> {
  const old = (await store.readManifest())?.markers ?? {};
  const published = new Set(snapshot.markers.map((m) => m.id));
  const markers: CardManifest["markers"] = {};
  for (const [id, entry] of Object.entries(old)) if (published.has(id)) markers[id] = entry;
  const removed = Object.keys(old).length - Object.keys(markers).length;

  const todo = snapshot.markers
    .map((m) => ({ marker: m, hash: cardHash(m) }))
    .filter(({ marker, hash }) => markers[marker.id]?.hash !== hash)
    // Changed cards before cards never drawn.
    .sort((a, b) => Number(Boolean(markers[b.marker.id])) - Number(Boolean(markers[a.marker.id])));

  let drawn = 0;
  let failed = 0;
  for (const { marker, hash } of todo.slice(0, options.limit)) {
    const file = `${CARD_PREFIX}${marker.id}-${hash}.png`;
    try {
      await store.writeCard(file, await renderPng(cardSvg(marker, options.siteUrl)));
      markers[marker.id] = { hash, file };
      drawn++;
    } catch (err) {
      failed++;
      console.error(
        JSON.stringify({ event: "card-failed", marker: marker.id, error: String(err) }),
      );
    }
  }

  await store.writeWorld(await renderPng(worldSvg(snapshot, options.siteUrl)));
  await store.writeManifest({ markers });

  let deleted = 0;
  if (options.sweep) {
    const keep = new Set([MANIFEST, WORLD, ...Object.values(markers).map((e) => e.file)]);
    const stale = (await store.list(CARD_PREFIX)).filter((name) => !keep.has(name));
    await store.remove(stale);
    deleted = stale.length;
  }

  return { drawn, failed, pending: todo.length - drawn, removed, deleted };
}
