import { Storage } from "@google-cloud/storage";
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
          metadata: {
            contentType: file.contentType,
            cacheControl: file.name.startsWith("history/") ? "no-store" : PUBLIC_CACHE,
          },
        });
      }
    },
  };
}
