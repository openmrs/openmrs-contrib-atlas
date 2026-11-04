import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { MarkerEditor } from "./edits.ts";
import type { LinkSigner } from "./links.ts";
import type { WriteQueue } from "./queue.ts";

/**
 * The routes behind "Still current" and "Unsubscribe" links in reminder emails. Anyone with a
 * link can use them, without signing in, so they are mounted ahead of the sign-in check and
 * are given a MarkerEditor with no account access: nothing here can look up an OpenMRS
 * account. Opening a link only views; a change needs a POST from the page's button.
 * See specs/reminder-emails and specs/account-lookup.
 */
export interface ReminderLinkDeps {
  /** Must be constructed without `Accounts`. */
  editor: MarkerEditor;
  signer: LinkSigner;
  queue: WriteQueue;
  publish: () => Promise<boolean>;
  now: () => Date;
}

export function createReminderLinks(deps: ReminderLinkDeps) {
  const links = new Hono();

  links.use(async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });
  links.use(bodyLimit({ maxSize: 4096, onError: (c) => c.json({ state: "invalid" }, 400) }));

  async function tokenFrom(c: { req: { json: () => Promise<unknown> } }) {
    const body = (await c.req.json().catch(() => null)) as { token?: unknown } | null;
    return deps.signer.check(body?.token, deps.now());
  }

  links.post("/view", async (c) => {
    const check = await tokenFrom(c);
    if (!check.ok && check.reason === "invalid") return c.json({ state: "invalid" }, 400);
    const { payload } = check;
    if (payload.purpose === "unsubscribe") {
      return c.json({
        purpose: "unsubscribe",
        state: check.ok ? "ready" : "expired",
        username: payload.username,
      });
    }
    const marker = await deps.editor.viewForLink(payload.marker);
    if (!marker) return c.json({ purpose: "confirm", state: "gone" });
    let state = check.ok ? "ready" : "expired";
    if (check.ok && marker.status !== "active") state = "inactive";
    else if (check.ok && marker.confirmed_at !== payload.confirmedAt) state = "confirmed";
    return c.json({ purpose: "confirm", state, marker });
  });

  links.post("/confirm", async (c) => {
    const check = await tokenFrom(c);
    if (!check.ok && check.reason === "invalid") return c.json({ state: "invalid" }, 400);
    const { payload } = check;
    if (payload.purpose !== "confirm") return c.json({ state: "invalid" }, 400);
    if (!check.ok) return c.json({ state: "expired", marker: { id: payload.marker } }, 410);
    const outcome = await deps.queue.run(() =>
      deps.editor.confirmFromLink(payload.marker, payload.confirmedAt, payload.username),
    );
    if (!outcome.ok) {
      return c.json({ state: outcome.reason, confirmed_at: outcome.confirmed_at }, 409);
    }
    try {
      await deps.publish();
    } catch (err) {
      // The confirmation is safely in the sheet; the next publish picks it up.
      console.error(JSON.stringify({ event: "publish-failed", message: (err as Error).message }));
    }
    return c.json({ state: "done", confirmed_at: outcome.result.marker?.confirmed_at ?? "" });
  });

  links.post("/unsubscribe", async (c) => {
    const check = await tokenFrom(c);
    if (!check.ok && check.reason === "invalid") return c.json({ state: "invalid" }, 400);
    const { payload } = check;
    if (payload.purpose !== "unsubscribe") return c.json({ state: "invalid" }, 400);
    if (!check.ok) return c.json({ state: "expired" }, 410);
    await deps.queue.run(() => deps.editor.setReminders(payload.username, false));
    console.log(JSON.stringify({ event: "unsubscribed", via: "link" }));
    return c.json({ state: "done" });
  });

  return links;
}
