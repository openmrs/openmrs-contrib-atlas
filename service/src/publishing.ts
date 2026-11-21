/**
 * Publishes after a write that changed public data. The change is already safely in the sheet,
 * so a failed publish is logged and the request carries on: the next publish picks it up.
 */
export async function publishSafely(publish: () => Promise<boolean>): Promise<boolean> {
  try {
    return await publish();
  } catch (err) {
    console.error(JSON.stringify({ event: "publish-failed", message: (err as Error).message }));
    return false;
  }
}
