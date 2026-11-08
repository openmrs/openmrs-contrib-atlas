import { Storage } from "@google-cloud/storage";
import type { AtlasSnapshot } from "@openmrs-atlas/shared";
import { MANIFEST, WORLD, type CardManifest, type CardStore } from "./cards/refresh.ts";
import type { LogoStore } from "./logos.ts";
import type { PublicFile, SnapshotStore } from "./publish.ts";

/** Public snapshot files: cached at most 5 minutes (specs/snapshot-publishing). */
const PUBLIC_CACHE = "public, max-age=300";

/** The public bucket. `apiEndpoint` points at fake-gcs-server for local development. */
export function gcsSnapshotStore(bucketName: string, apiEndpoint?: string): SnapshotStore {
  const storage = new Storage(apiEndpoint ? { apiEndpoint, projectId: "local" } : {});
  const bucket = storage.bucket(bucketName);

  return {
    async currentCount() {
      try {
        const [body] = await bucket.file("atlas.json").download();
        return (JSON.parse(body.toString("utf8")) as { markers: unknown[] }).markers.length;
      } catch (err) {
        if ((err as { code?: number }).code === 404) return undefined;
        throw err;
      }
    },

    async write(files: PublicFile[]) {
      for (const file of files) {
        await bucket.file(file.name).save(file.body, {
          resumable: false,
          // Google Cloud Storage serves it plain to clients that don't accept gzip.
          gzip: true,
          metadata: {
            contentType: file.contentType,
            cacheControl: file.name.startsWith("history/") ? "no-store" : PUBLIC_CACHE,
          },
        });
      }
    },
  };
}

/** Uploaded logos, next to the logos from the migration. Names are unique, so cache for long. */
export function gcsLogoStore(bucketName: string, apiEndpoint?: string): LogoStore {
  const storage = new Storage(apiEndpoint ? { apiEndpoint, projectId: "local" } : {});
  const bucket = storage.bucket(bucketName);
  const base = apiEndpoint ?? "https://storage.googleapis.com";

  return {
    async saveLogo(name, body) {
      await bucket.file(name).save(body, {
        resumable: false,
        metadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000" },
      });
      return `${base}/${bucketName}/${name}`;
    },
  };
}

/** Social cards and the published snapshot they're drawn from (specs/social-cards). */
export function gcsCardStore(bucketName: string, apiEndpoint?: string): CardStore {
  const storage = new Storage(apiEndpoint ? { apiEndpoint, projectId: "local" } : {});
  const bucket = storage.bucket(bucketName);
  const base = apiEndpoint ?? "https://storage.googleapis.com";

  async function readJson<T>(name: string): Promise<T | undefined> {
    try {
      const [body] = await bucket.file(name).download();
      return JSON.parse(body.toString("utf8")) as T;
    } catch (err) {
      if ((err as { code?: number }).code === 404) return undefined;
      throw err;
    }
  }
  const png = (name: string, body: Buffer, cacheControl: string) =>
    bucket.file(name).save(body, {
      resumable: false,
      metadata: { contentType: "image/png", cacheControl },
    });

  return {
    readSnapshot: () => readJson<AtlasSnapshot>("atlas.json"),
    readManifest: () => readJson<CardManifest>(MANIFEST),
    async writeManifest(manifest) {
      await bucket.file(MANIFEST).save(JSON.stringify(manifest), {
        resumable: false,
        metadata: { contentType: "application/json", cacheControl: PUBLIC_CACHE },
      });
    },
    // Each card's name changes with its content, so it can be cached for good.
    writeCard: (name, body) => png(name, body, "public, max-age=31536000, immutable"),
    writeWorld: (body) => png(WORLD, body, "public, max-age=3600"),
    async list(prefix) {
      const [files] = await bucket.getFiles({ prefix });
      return files.map((f) => f.name);
    },
    async remove(names) {
      for (const name of names) await bucket.file(name).delete({ ignoreNotFound: true });
    },
    publicUrl: (name) => `${base}/${bucketName}/${name}`,
  };
}
