import { Hono } from "hono";
import { identify, type AuthConfig, type IdTokenVerifier } from "./auth.ts";
import { publish, type SheetStore, type SnapshotStore } from "./publish.ts";

export interface AppDeps {
  sheet: SheetStore;
  snapshots: SnapshotStore;
  auth: AuthConfig;
  verify?: IdTokenVerifier;
  now?: () => Date;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();

  // Not /healthz: Cloud Run reserves some paths ending in "z" and answers them itself.
  app.get("/health", (c) => c.json({ ok: true }));

  // ?force=true skips the safety check; only the sheet's admin menu (shared secret) may force.
  app.post("/publish", async (c) => {
    const caller = await identify(c.req.header("Authorization"), deps.auth, deps.verify);
    if (!caller) return c.json({ error: "unauthorized" }, 401);
    const force = c.req.query("force") === "true";
    if (force && caller !== "apps-script") return c.json({ error: "forbidden" }, 403);

    const result = await publish(deps.sheet, deps.snapshots, {
      force,
      now: deps.now?.() ?? new Date(),
    });
    console.log(JSON.stringify({ event: "publish", caller, force, ...result }));
    return c.json(result, result.status === "published" ? 200 : 409);
  });

  return app;
}
