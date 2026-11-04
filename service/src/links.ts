import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed tokens for links in reminder emails. See specs/reminder-emails and design.md.
 *
 * A token is `base64url(payload).base64url(HMAC-SHA256(payload))`. A confirm token names the
 * marker and the `confirmed_at` it was sent for, so it stops working once the marker is
 * confirmed by any means; no state is stored. Tokens hold usernames, never email addresses,
 * and travel in the URL fragment so they stay out of request logs.
 */

export const CONFIRM_DAYS = 30;
export const UNSUBSCRIBE_DAYS = 365;
const MS_PER_DAY = 86_400_000;

export type LinkPayload =
  | { purpose: "confirm"; marker: string; confirmedAt: string; username: string; expires: number }
  | { purpose: "unsubscribe"; username: string; expires: number };

export type LinkCheck =
  | { ok: true; payload: LinkPayload }
  /** Signed by us but out of date: the page can still say which marker it was for. */
  | { ok: false; reason: "expired"; payload: LinkPayload }
  | { ok: false; reason: "invalid" };

export interface LinkSigner {
  confirm(marker: string, confirmedAt: string, username: string, now: Date): string;
  unsubscribe(username: string, now: Date): string;
  check(token: unknown, now: Date): LinkCheck;
}

const encode = (value: Buffer | string) => Buffer.from(value).toString("base64url");

export function linkSigner(key: string): LinkSigner {
  if (key.trim().length < 32) throw new Error("LINK_SIGNING_KEY must be at least 32 characters");
  const secret = key.trim();
  const mac = (data: string) => createHmac("sha256", secret).update(data).digest();

  function sign(payload: LinkPayload): string {
    const body = encode(JSON.stringify(payload));
    return `${body}.${encode(mac(body))}`;
  }

  return {
    confirm(marker, confirmedAt, username, now) {
      return sign({
        purpose: "confirm",
        marker,
        confirmedAt,
        username,
        expires: now.getTime() + CONFIRM_DAYS * MS_PER_DAY,
      });
    },

    unsubscribe(username, now) {
      return sign({
        purpose: "unsubscribe",
        username,
        expires: now.getTime() + UNSUBSCRIBE_DAYS * MS_PER_DAY,
      });
    },

    check(token, now) {
      const invalid = { ok: false, reason: "invalid" } as const;
      if (typeof token !== "string" || token.length > 2000) return invalid;
      const [body, signature, ...rest] = token.split(".");
      if (!body || !signature || rest.length > 0) return invalid;
      const expected = mac(body);
      const given = Buffer.from(signature, "base64url");
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return invalid;
      let payload: LinkPayload;
      try {
        payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LinkPayload;
      } catch {
        return invalid;
      }
      const wellFormed =
        typeof payload.username === "string" &&
        typeof payload.expires === "number" &&
        (payload.purpose === "unsubscribe" ||
          (payload.purpose === "confirm" &&
            typeof payload.marker === "string" &&
            typeof payload.confirmedAt === "string"));
      if (!wellFormed) return invalid;
      if (now.getTime() > payload.expires) return { ok: false, reason: "expired", payload };
      return { ok: true, payload };
    },
  };
}
