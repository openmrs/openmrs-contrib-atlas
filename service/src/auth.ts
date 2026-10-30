import { timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";

export type Caller = "apps-script" | "scheduler";

export interface AuthConfig {
  /** Shared with the sheet's Apps Script (Script Properties). */
  publishSecret: string;
  /** The service account Cloud Scheduler uses for its OIDC token. */
  schedulerEmail: string;
  /** The audience Cloud Scheduler puts in its token: this service's URL. */
  audience: string;
}

/** Verifies a Google-signed ID token; returns its email if valid. Injectable for tests. */
export type IdTokenVerifier = (token: string, audience: string) => Promise<string | undefined>;

const google = new OAuth2Client();

export const verifyGoogleIdToken: IdTokenVerifier = async (token, audience) => {
  try {
    const ticket = await google.verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload();
    return payload?.email_verified ? payload.email : undefined;
  } catch {
    return undefined;
  }
};

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Who is calling, from an `Authorization: Bearer <token>` header: the Apps Script (shared
 * secret) or Cloud Scheduler (Google OIDC token for the scheduler account). Anyone else is
 * undefined. See specs/snapshot-publishing, "Publish endpoint is protected".
 */
export async function identify(
  header: string | undefined,
  config: AuthConfig,
  verify: IdTokenVerifier = verifyGoogleIdToken,
): Promise<Caller | undefined> {
  const token = /^Bearer (.+)$/.exec(header ?? "")?.[1];
  if (!token) return undefined;
  if (config.publishSecret && sameSecret(token, config.publishSecret)) return "apps-script";
  const email = await verify(token, config.audience);
  return email && email === config.schedulerEmail ? "scheduler" : undefined;
}
