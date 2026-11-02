import { Hono } from "hono";
import { identify, type AuthConfig, type IdTokenVerifier } from "./auth.ts";
import { WriteQueue } from "./queue.ts";
import { createApi, type ApiDeps } from "./api.ts";
import { publish, type SheetStore, type SnapshotStore } from "./publish.ts";

export interface AppDeps {
  sheet: SheetStore;
  snapshots: SnapshotStore;
  auth: AuthConfig;
  verify?: IdTokenVerifier;
  now?: () => Date;
  /** Sign-in and editing; without them /api answers 503. See service/README.md. */
  editing?: Pick<ApiDeps, "store" | "verifyPerson" | "logos">;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const queue = new WriteQueue();
  const now = () => deps.now?.() ?? new Date();

  // Not /healthz: Cloud Run reserves some paths ending in "z" and answers them itself.
  app.get("/health", (c) => c.json({ ok: true }));

  // ?force=true skips the safety check; only the sheet's admin menu (shared secret) may force.
  app.post("/publish", async (c) => {
    const caller = await identify(c.req.header("Authorization"), deps.auth, deps.verify);
    if (!caller) return c.json({ error: "unauthorized" }, 401);
    const force = c.req.query("force") === "true";
    if (force && caller !== "apps-script") return c.json({ error: "forbidden" }, 403);

    const run = () => publish(deps.sheet, deps.snapshots, { force, now: now() });
    const result = await (force ? queue.run(run) : queue.shared(run));
    console.log(JSON.stringify({ event: "publish", caller, force, ...result }));
    return c.json(result, result.status === "published" ? 200 : 409);
  });

  if (deps.editing) {
    app.route(
      "/api",
      createApi({
        ...deps.editing,
        queue,
        now,
        publish: async () => {
          const result = await queue.shared(() =>
            publish(deps.sheet, deps.snapshots, { force: false, now: now() }),
          );
          console.log(JSON.stringify({ event: "publish", caller: "edit", ...result }));
          return result.status === "published";
        },
      }),
    );
  } else {
    app.all("/api/*", (c) => c.json({ error: "Sign-in is not set up." }, 503));
  }

  return app;
}
