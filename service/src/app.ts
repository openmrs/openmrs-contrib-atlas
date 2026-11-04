import { Hono } from "hono";
import type { Accounts } from "./accounts.ts";
import { createApi, type ApiDeps } from "./api.ts";
import { identify, type AuthConfig, type IdTokenVerifier } from "./auth.ts";
import { MarkerEditor } from "./edits.ts";
import type { LinkSigner } from "./links.ts";
import type { Mailer } from "./mailer.ts";
import type { NoticeConfig } from "./notices.ts";
import { publish, type SheetStore, type SnapshotStore } from "./publish.ts";
import { WriteQueue } from "./queue.ts";
import { createReminderLinks } from "./reminder-links.ts";
import { runReminders } from "./reminders.ts";

export interface AppDeps {
  sheet: SheetStore;
  snapshots: SnapshotStore;
  auth: AuthConfig;
  verify?: IdTokenVerifier;
  now?: () => Date;
  /** The public site, for links in the feed and in email, e.g. https://atlas.openmrs.org. */
  siteUrl: string;
  /** Sign-in and editing; without them /api answers 503. See service/README.md. */
  editing?: Pick<ApiDeps, "store" | "verifyPerson" | "logos">;
  /**
   * Read-only OpenMRS account lookups. Given only to the signed-in API and the reminder job;
   * routes anyone can reach never receive it (specs/account-lookup).
   */
  accounts?: Accounts;
  /** Reminder emails and their links. Needs `editing` and `accounts`. */
  reminders?: { mailer: Mailer; signer: LinkSigner };
  /** The notice sent when a marker is added. */
  notices?: NoticeConfig;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const queue = new WriteQueue();
  const now = () => deps.now?.() ?? new Date();

  const publishAfterEdit = async (caller: string) => {
    const result = await queue.shared(() =>
      publish(deps.sheet, deps.snapshots, { force: false, now: now(), siteUrl: deps.siteUrl }),
    );
    console.log(JSON.stringify({ event: "publish", caller, ...result }));
    return result.status === "published";
  };

  // Not /healthz: Cloud Run reserves some paths ending in "z" and answers them itself.
  app.get("/health", (c) => c.json({ ok: true }));

  // ?force=true skips the safety check; only the sheet's admin menu (shared secret) may force.
  app.post("/publish", async (c) => {
    const caller = await identify(c.req.header("Authorization"), deps.auth, deps.verify);
    if (!caller) return c.json({ error: "unauthorized" }, 401);
    const force = c.req.query("force") === "true";
    if (force && caller !== "apps-script") return c.json({ error: "forbidden" }, 403);

    const run = () =>
      publish(deps.sheet, deps.snapshots, { force, now: now(), siteUrl: deps.siteUrl });
    const result = await (force ? queue.run(run) : queue.shared(run));
    console.log(JSON.stringify({ event: "publish", caller, force, ...result }));
    return c.json(result, result.status === "published" ? 200 : 409);
  });

  // The daily reminder job: Cloud Scheduler, or a signed-in admin (specs/reminder-emails).
  app.post("/reminders", async (c) => {
    const header = c.req.header("Authorization");
    const token = /^Bearer (.+)$/.exec(header ?? "")?.[1];
    const person = token && deps.editing ? await deps.editing.verifyPerson(token) : undefined;
    let caller: string | undefined = person?.admin ? `admin:${person.username}` : undefined;
    if (!caller && !person) {
      caller =
        (await identify(header, deps.auth, deps.verify)) === "scheduler" ? "scheduler" : undefined;
    }
    if (!caller) return c.json({ error: "unauthorized" }, person ? 403 : 401);
    if (!deps.editing || !deps.accounts || !deps.reminders) {
      return c.json({ error: "Reminders are not set up." }, 503);
    }
    const { store } = deps.editing;
    const { accounts } = deps;
    const { mailer, signer } = deps.reminders;
    const result = await queue.run(() =>
      runReminders({ store, accounts, mailer, signer, siteUrl: deps.siteUrl, now }),
    );
    console.log(JSON.stringify({ event: "reminders", caller, ...result }));
    return c.json(result);
  });

  if (deps.editing) {
    // Emailed links work without signing in, so they are mounted before /api and its sign-in
    // check, with an editor that has no account access.
    if (deps.reminders) {
      app.route(
        "/api/reminder",
        createReminderLinks({
          editor: new MarkerEditor(deps.editing.store, now),
          signer: deps.reminders.signer,
          queue,
          publish: () => publishAfterEdit("reminder-link"),
          now,
        }),
      );
    }
    app.route(
      "/api",
      createApi({
        ...deps.editing,
        queue,
        now,
        accounts: deps.accounts,
        notices: deps.notices,
        publish: () => publishAfterEdit("edit"),
      }),
    );
  } else {
    app.all("/api/*", (c) => c.json({ error: "Sign-in is not set up." }, 503));
  }

  return app;
}
