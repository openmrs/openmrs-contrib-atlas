import type { Person } from "@openmrs-atlas/shared";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  ApiError,
  MarkerEditor,
  parseChangeBody,
  type EditStore,
  type MarkerResult,
} from "./edits.ts";
import { AccountsUnavailable, type Accounts } from "./accounts.ts";
import { accountsUnavailable } from "./edits.ts";
import type { PersonVerifier } from "./keycloak.ts";
import { MAX_LOGO_BYTES, logoName, processLogo, type LogoStore } from "./logos.ts";
import { sendNotice, type NoticeConfig } from "./notices.ts";
import type { WriteQueue } from "./queue.ts";

export interface ApiDeps {
  store: EditStore;
  verifyPerson: PersonVerifier;
  logos: LogoStore;
  queue: WriteQueue;
  /** Runs a publish, reporting whether the public files were replaced. */
  publish: () => Promise<boolean>;
  now: () => Date;
  /** Read-only OpenMRS account lookups; without it, IDs are accepted unchecked. */
  accounts?: Accounts;
  /** Without it, no notices are sent. */
  notices?: NoticeConfig;
}

type Env = { Variables: { person: Person } };

const SMALL_BODY = 64 * 1024;
export const MIN_SEARCH = 3;
export const SEARCHES_PER_MINUTE = 30;

export function createApi(deps: ApiDeps) {
  const api = new Hono<Env>();
  const editor = new MarkerEditor(deps.store, deps.now, deps.accounts);
  const searches = new Map<string, number[]>();

  /** 30 account searches a minute per person, kept in memory on the single instance. */
  function allowSearch(username: string): boolean {
    const now = deps.now().getTime();
    const recent = (searches.get(username) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= SEARCHES_PER_MINUTE) {
      searches.set(username, recent);
      return false;
    }
    recent.push(now);
    searches.set(username, recent);
    return true;
  }

  function requireAccounts(): Accounts {
    if (!deps.accounts) {
      throw new ApiError(503, { error: "Looking up OpenMRS IDs is not set up." });
    }
    return deps.accounts;
  }

  async function fromKeycloak<T>(lookup: () => Promise<T>): Promise<T> {
    try {
      return await lookup();
    } catch (err) {
      if (err instanceof AccountsUnavailable) {
        console.error(JSON.stringify({ event: "accounts-unavailable", message: err.message }));
        throw accountsUnavailable();
      }
      throw err;
    }
  }

  api.onError((err, c) => {
    if (err instanceof ApiError) return c.json(err.body, err.status as ContentfulStatusCode);
    console.error(JSON.stringify({ event: "api-error", message: err.message }));
    return c.json({ error: "Something went wrong." }, 500);
  });

  // Responses can hold private data, so the CDN in front must never keep them.
  api.use(async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });

  api.use(async (c, next) => {
    const token = /^Bearer (.+)$/.exec(c.req.header("Authorization") ?? "")?.[1];
    const person = token ? await deps.verifyPerson(token) : undefined;
    if (!person) return c.json({ error: "Please sign in." }, 401);
    c.set("person", person);
    return next();
  });

  const small = bodyLimit({
    maxSize: SMALL_BODY,
    onError: (c) => c.json({ error: "That request is too large." }, 400),
  });

  /** One write through the queue, then a publish if public data changed. */
  async function write<T extends MarkerResult>(task: () => Promise<T>) {
    const result = await deps.queue.run(task);
    const { publish, ...body } = result;
    if (!publish) return { ...body, published: false };
    let published = false;
    try {
      published = await deps.publish();
    } catch (err) {
      // The change is safely in the sheet; the next publish picks it up.
      console.error(JSON.stringify({ event: "publish-failed", message: (err as Error).message }));
    }
    return { ...body, published };
  }

  async function jsonBody(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
    try {
      return await c.req.json();
    } catch {
      throw new ApiError(400, { error: "That request is not valid." });
    }
  }

  async function usernameFrom(c: { req: { json: () => Promise<unknown> } }): Promise<string> {
    const body = (await jsonBody(c)) as { username?: unknown } | null;
    if (typeof body?.username !== "string") {
      throw new ApiError(400, { error: "That request is not valid." });
    }
    return body.username;
  }

  api.get("/me", async (c) => c.json(await editor.me(c.get("person"))));

  // Called once by the site when a signed-in session starts (specs/marker-editing).
  api.post("/me/confirm-recent", async (c) => {
    const { publish, confirmed } = await deps.queue.run(() =>
      editor.confirmRecent(c.get("person")),
    );
    let published = false;
    if (publish) {
      try {
        published = await deps.publish();
      } catch (err) {
        // The change is safely in the sheet; the next publish picks it up.
        console.error(JSON.stringify({ event: "publish-failed", message: (err as Error).message }));
      }
    }
    return c.json({ confirmed, published });
  });

  api.put("/me/reminders", small, async (c) => {
    const body = (await jsonBody(c)) as { on?: unknown } | null;
    if (typeof body?.on !== "boolean")
      throw new ApiError(400, { error: "That request is not valid." });
    const on = body.on;
    return c.json(await deps.queue.run(() => editor.setReminders(c.get("person").username, on)));
  });

  // Account search and check: usernames and names only, never emails (specs/account-lookup).
  api.get("/accounts", async (c) => {
    const accounts = requireAccounts();
    const q = (c.req.query("q") ?? "").trim();
    if (q.length < MIN_SEARCH) {
      throw new ApiError(400, { error: `Type at least ${MIN_SEARCH} characters to search.` });
    }
    if (q.length > 100) throw new ApiError(400, { error: "That search is too long." });
    if (!allowSearch(c.get("person").username)) {
      throw new ApiError(429, { error: "Too many searches. Please wait a minute and try again." });
    }
    return c.json({ accounts: await fromKeycloak(() => accounts.search(q)) });
  });

  api.get("/accounts/:username", async (c) => {
    const accounts = requireAccounts();
    if (!allowSearch(c.get("person").username)) {
      throw new ApiError(429, { error: "Too many searches. Please wait a minute and try again." });
    }
    const account = await fromKeycloak(() => accounts.lookup(c.req.param("username")));
    if (!account?.enabled) throw new ApiError(404, { error: "That OpenMRS ID was not found." });
    return c.json({ username: account.username, name: account.name });
  });

  api.get("/markers/:id", async (c) =>
    c.json(await editor.read(c.get("person"), c.req.param("id"))),
  );

  api.post("/markers", small, async (c) => {
    const body = parseChangeBody(await jsonBody(c));
    const result = await write(() => editor.add(c.get("person"), body));
    if (deps.notices && result.marker) {
      // Not awaited: the person who added the marker never waits on Mandrill.
      void sendNotice(deps.notices, result.marker, c.get("person").username);
    }
    return c.json(result, 201);
  });

  api.patch("/markers/:id", small, async (c) => {
    const body = parseChangeBody(await jsonBody(c));
    return c.json(await write(() => editor.change(c.get("person"), c.req.param("id"), body)));
  });

  api.post("/markers/:id/confirm", async (c) =>
    c.json(await write(() => editor.confirm(c.get("person"), c.req.param("id")))),
  );

  api.post("/markers/:id/close", async (c) =>
    c.json(await write(() => editor.close(c.get("person"), c.req.param("id")))),
  );

  api.post("/markers/:id/reopen", async (c) =>
    c.json(await write(() => editor.reopen(c.get("person"), c.req.param("id")))),
  );

  api.delete("/markers/:id", async (c) =>
    c.json(await write(() => editor.remove(c.get("person"), c.req.param("id")))),
  );

  api.post("/markers/:id/editors", small, async (c) => {
    const username = await usernameFrom(c);
    return c.json(
      await write(() => editor.addEditor(c.get("person"), c.req.param("id"), username)),
    );
  });

  api.delete("/markers/:id/editors/:username", async (c) =>
    c.json(
      await write(() =>
        editor.removeEditor(c.get("person"), c.req.param("id"), c.req.param("username")),
      ),
    ),
  );

  api.post("/markers/:id/transfer", small, async (c) => {
    const username = await usernameFrom(c);
    return c.json(await write(() => editor.offer(c.get("person"), c.req.param("id"), username)));
  });

  api.delete("/markers/:id/transfer", async (c) => {
    await deps.queue.run(() => editor.cancelOffer(c.get("person"), c.req.param("id")));
    return c.json({ ok: true });
  });

  api.post("/markers/:id/transfer/accept", async (c) =>
    c.json(await write(() => editor.accept(c.get("person"), c.req.param("id")))),
  );

  api.post("/markers/:id/transfer/decline", async (c) => {
    await deps.queue.run(() => editor.decline(c.get("person"), c.req.param("id")));
    return c.json({ ok: true });
  });

  api.post(
    "/logos",
    bodyLimit({
      // Room for the form encoding around a file at the limit; the file itself is checked below.
      maxSize: MAX_LOGO_BYTES + SMALL_BODY,
      onError: (c) => c.json({ error: "Logos can be up to 2 MB." }, 422),
    }),
    async (c) => {
      const form = await c.req.formData().catch(() => undefined);
      const file = form?.get("logo");
      if (!(file instanceof File)) throw new ApiError(400, { error: "No logo was sent." });
      const logo = await processLogo(Buffer.from(await file.arrayBuffer()));
      return c.json({ url: await deps.logos.saveLogo(logoName(), logo) }, 201);
    },
  );

  return api;
}
