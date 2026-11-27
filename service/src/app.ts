import { Hono } from "hono";
import { routePath } from "hono/route";
import type { Accounts } from "./accounts.ts";
import { createApi, type ApiDeps } from "./api.ts";
import { identify, type AuthConfig, type Caller } from "./auth.ts";
import { ApiError, MarkerEditor, requireRecentSignIn } from "./edits/index.ts";
import type { LinkSigner } from "./links.ts";
import type { Mailer } from "./mailer.ts";
import type { NoticeConfig } from "./notices.ts";
import type { CardStore } from "./cards/refresh.ts";
import { publish, type SheetStore, type SnapshotStore } from "./publish.ts";
import { WriteQueue } from "./queue.ts";
import { createPermalinks } from "./permalinks.ts";
import { createReminderLinks } from "./reminder-links.ts";
import { runReminders } from "./reminders.ts";
import { mountSite, useSiteHeaders, type SiteConfig } from "./site.ts";
import { HISTORY_DAYS } from "./storage.ts";
import { timed, timedStore, withTiming } from "./timing.ts";

export interface AppDeps {
  sheet: SheetStore;
  snapshots: SnapshotStore;
  /** Social cards and the permalink pages that show them; without it, neither runs. */
  cards?: CardStore;
  auth: AuthConfig;
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
  /** The map site and the data folder, served by this service (specs/deployment). */
  site?: SiteConfig;
  /** What /health reports: the environment the image was built for, and its commit. */
  about?: { environment?: string; commit?: string };
}

/** Cards drawn by a publish that isn't the nightly one (specs/social-cards). */
export const EDIT_CARD_LIMIT = 10;

export function createApp(input: AppDeps) {
  const deps = timedDeps(input);
  const app = new Hono();
  useSiteHeaders(app);
  const queue = new WriteQueue();
  let remindersRunning = false;
  const now = () => deps.now?.() ?? new Date();

  // The nightly run draws every card and clears old files; other publishes draw a few at most.
  const cards = (nightly: boolean) =>
    deps.cards &&
    (nightly
      ? { store: deps.cards, limit: Infinity, sweep: true }
      : { store: deps.cards, limit: EDIT_CARD_LIMIT, sweep: false });

  // Every publish checks the logo sweep; only the scheduler's nightly run deletes.
  const logos = (sweep: boolean) => deps.editing?.logos && { store: deps.editing.logos, sweep };

  // Only the nightly run prunes history (specs/snapshot-publishing).
  const historyCutoff = () => ({ before: new Date(now().getTime() - HISTORY_DAYS * 86_400_000) });

  // Each publish logs where its time went, in its own scope (specs/snapshot-publishing).
  const timedPublish = (caller: string, run: () => ReturnType<typeof publish>) =>
    timed("publish", () =>
      withTiming(run, (timings, { result }) =>
        console.log(
          JSON.stringify({
            event: "publish-timing",
            caller,
            result: result?.status ?? "failed",
            ...timings,
          }),
        ),
      ),
    );

  const publishAfterEdit = async (caller: string) => {
    const result = await queue.shared(() =>
      timedPublish(caller, () =>
        publish(deps.sheet, deps.snapshots, {
          force: false,
          now: now(),
          siteUrl: deps.siteUrl,
          cards: cards(false),
          logos: logos(false),
        }),
      ),
    );
    console.log(JSON.stringify({ event: "publish", caller, ...result }));
    return result.status === "published";
  };

  app.get("/health", (c) => c.json({ ok: true, ...deps.about }));

  // Public permalink pages (specs/marker-permalinks).
  if (deps.cards)
    app.route("/marker", createPermalinks({ cards: deps.cards, siteUrl: deps.siteUrl }));

  // A publish from the sheet (forced or not) or the nightly job. Only the nightly one draws
  // every card, sweeps logos and prunes history.
  const runPublish = async (caller: Caller, force: boolean) => {
    const nightly = caller === "scheduler";
    const run = () =>
      timedPublish(caller, () =>
        publish(deps.sheet, deps.snapshots, {
          force,
          now: now(),
          siteUrl: deps.siteUrl,
          cards: cards(nightly),
          logos: logos(nightly),
          history: nightly ? historyCutoff() : undefined,
        }),
      );
    const result = await (force ? queue.run(run) : queue.shared(run));
    console.log(JSON.stringify({ event: "publish", caller, force, ...result }));
    return result;
  };

  // ?force=true skips the safety check; only the sheet's admin menu (shared secret) may force.
  app.post("/publish", async (c) => {
    const caller = identify(c.req.header("Authorization"), deps.auth);
    if (!caller) return c.json({ error: "unauthorized" }, 401);
    const result = await runPublish(caller, c.req.query("force") === "true");
    return c.json(result, result.status === "published" ? 200 : 409);
  });

  // The daily reminder job, started by the service's own timer or a signed-in admin
  // (specs/reminder-emails). One run at a time: the job holds the write queue only for sheet
  // work, so a second run started meanwhile could otherwise send the same reminders.
  const runReminderJob = async (caller: string) => {
    if (!deps.editing || !deps.accounts || !deps.reminders) return { status: "off" } as const;
    if (remindersRunning) return { status: "running" } as const;
    remindersRunning = true;
    try {
      const result = await runReminders({
        store: deps.editing.store,
        accounts: deps.accounts,
        mailer: deps.reminders.mailer,
        signer: deps.reminders.signer,
        queue,
        siteUrl: deps.siteUrl,
        now,
      });
      console.log(JSON.stringify({ event: "reminders", caller, ...result }));
      return { status: "done", result } as const;
    } finally {
      remindersRunning = false;
    }
  };

  app.post("/reminders", async (c) => {
    const token = /^Bearer (.+)$/.exec(c.req.header("Authorization") ?? "")?.[1];
    const person = token && deps.editing ? await deps.editing.verifyPerson(token) : undefined;
    if (!person) return c.json({ error: "unauthorized" }, 401);
    if (!person.admin) return c.json({ error: "forbidden" }, 403);
    // An admin-only action: a recent sign-in, as for the API's (specs/user-sign-in).
    try {
      requireRecentSignIn(person, now());
    } catch (err) {
      if (err instanceof ApiError) return c.json(err.body, 401);
      throw err;
    }
    const job = await runReminderJob(`admin:${person.username}`);
    if (job.status === "off") return c.json({ error: "Reminders are not set up." }, 503);
    if (job.status === "running") {
      return c.json({ error: "The reminder job is already running." }, 409);
    }
    return c.json(job.result);
  });

  // One line per API request: where its time went, by route pattern, never the path, which can
  // hold a username (specs/marker-editing).
  app.use("/api/*", (c, next) =>
    withTiming(next, (timings) =>
      console.log(
        JSON.stringify({
          event: "timing",
          route: `${c.req.method} ${routePath(c, -1)}`,
          status: c.res.status,
          ...timings,
        }),
      ),
    ),
  );

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

  // Last, so the site's catch-all never shadows the routes above.
  if (deps.site) mountSite(app, deps.site);

  /** The daily jobs, for the service's own timer (scheduler.ts) and tests. */
  const jobs = {
    nightlyPublish: () => runPublish("scheduler", false),
    reminders: () => runReminderJob("scheduler"),
  };
  return Object.assign(app, { jobs });
}

/** The same dependencies, with each sheet, file and account call timed (service/README.md). */
function timedDeps(deps: AppDeps): AppDeps {
  const { editing } = deps;
  return {
    ...deps,
    sheet: timedStore("sheet", deps.sheet),
    snapshots: timedStore("files", deps.snapshots),
    cards: deps.cards && timedStore("cards", deps.cards),
    accounts: deps.accounts && timedStore("accounts", deps.accounts),
    editing: editing && {
      store: timedStore("sheet", editing.store),
      logos: timedStore("logos", editing.logos),
      verifyPerson: (token) => timed("auth.verify", () => editing.verifyPerson(token)),
    },
  };
}
