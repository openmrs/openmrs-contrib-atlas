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
import type { PersonVerifier } from "./keycloak.ts";
import { MAX_LOGO_BYTES, logoName, processLogo, type LogoStore } from "./logos.ts";
import type { WriteQueue } from "./queue.ts";

export interface ApiDeps {
  store: EditStore;
  verifyPerson: PersonVerifier;
  logos: LogoStore;
  queue: WriteQueue;
  /** Runs a publish, reporting whether the public files were replaced. */
  publish: () => Promise<boolean>;
  now: () => Date;
}

type Env = { Variables: { person: Person } };

const SMALL_BODY = 64 * 1024;

export function createApi(deps: ApiDeps) {
  const api = new Hono<Env>();
  const editor = new MarkerEditor(deps.store, deps.now);

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

  api.get("/markers/:id", async (c) =>
    c.json(await editor.read(c.get("person"), c.req.param("id"))),
  );

  api.post("/markers", small, async (c) => {
    const body = parseChangeBody(await jsonBody(c));
    return c.json(await write(() => editor.add(c.get("person"), body)), 201);
  });

  api.patch("/markers/:id", small, async (c) => {
    const body = parseChangeBody(await jsonBody(c));
    return c.json(await write(() => editor.change(c.get("person"), c.req.param("id"), body)));
  });

  api.post("/markers/:id/confirm", async (c) =>
    c.json(await write(() => editor.confirm(c.get("person"), c.req.param("id")))),
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
