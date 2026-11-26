import { timingSafeEqual } from "node:crypto";

/**
 * Who started a publish: the sheet's Apps Script (shared secret) or the service's own nightly
 * job (scheduler.ts), which never comes over HTTP.
 */
export type Caller = "apps-script" | "scheduler";

export interface AuthConfig {
  /** Shared with the sheet's Apps Script (Script Properties). */
  publishSecret: string;
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Whether an `Authorization: Bearer <token>` header carries the Apps Script's shared secret.
 * See specs/snapshot-publishing, "Publish endpoint is protected".
 */
export function identify(
  header: string | undefined,
  config: AuthConfig,
): "apps-script" | undefined {
  const token = /^Bearer (.+)$/.exec(header ?? "")?.[1];
  if (!token) return undefined;
  return config.publishSecret && sameSecret(token, config.publishSecret)
    ? "apps-script"
    : undefined;
}
