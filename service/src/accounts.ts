import { normaliseUsername } from "@openmrs-atlas/shared";

/**
 * Read-only access to OpenMRS accounts through the Keycloak admin API, as the `atlas-service`
 * client (a service account holding only `view-users`). See specs/account-lookup.
 *
 * Only the signed-in API and the reminder job are given an `Accounts`; routes that anyone can
 * reach, such as emailed links and /publish, are built without one, so they cannot look up
 * accounts. Emails returned here must stay inside the service.
 */

export interface AccountSummary {
  username: string;
  name: string;
}

export interface Account extends AccountSummary {
  email?: string;
  enabled: boolean;
}

export interface Accounts {
  /** True if the OpenMRS ID exists and is enabled. */
  check(username: string): Promise<boolean>;
  /** Up to 10 enabled accounts matching part of a username or name. */
  search(text: string): Promise<AccountSummary[]>;
  /** The account with exactly this username, enabled or not; undefined if there is none. */
  lookup(username: string): Promise<Account | undefined>;
}

/** Keycloak could not be reached or refused the service's credentials. */
export class AccountsUnavailable extends Error {}

export interface KeycloakAccountsConfig {
  /** The realm URL, e.g. https://id-stg.openmrs.org/realms/openmrs */
  issuer: string;
  clientId: string;
  clientSecret: string;
}

export const SEARCH_LIMIT = 10;
const TIMEOUT_MS = 5000;
/** Renew the service token this long before Keycloak says it expires. */
const RENEW_EARLY_MS = 30_000;

interface KeycloakUser {
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  enabled?: boolean;
}

function toAccount(user: KeycloakUser): Account | undefined {
  if (!user.username) return undefined;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return {
    username: normaliseUsername(user.username),
    name,
    email: user.email || undefined,
    enabled: user.enabled !== false,
  };
}

export function keycloakAccounts(
  config: KeycloakAccountsConfig,
  fetchFn: typeof fetch = fetch,
): Accounts {
  const issuer = config.issuer.replace(/\/+$/, "");
  const adminBase = issuer.replace("/realms/", "/admin/realms/");
  let token: { value: string; expiresAt: number } | undefined;

  async function call(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      throw new AccountsUnavailable(`Keycloak unreachable: ${(err as Error).message}`);
    }
  }

  async function serviceToken(): Promise<string> {
    if (token && Date.now() < token.expiresAt) return token.value;
    const res = await call(`${issuer}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    if (!res.ok) throw new AccountsUnavailable(`Keycloak token request failed: ${res.status}`);
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new AccountsUnavailable("Keycloak returned no token");
    token = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 60) * 1000 - RENEW_EARLY_MS,
    };
    return token.value;
  }

  async function users(params: Record<string, string>): Promise<KeycloakUser[]> {
    const query = new URLSearchParams({ ...params, briefRepresentation: "true" });
    const url = `${adminBase}/users?${query}`;
    let res = await call(url, { headers: { Authorization: `Bearer ${await serviceToken()}` } });
    if (res.status === 401) {
      // The token was revoked or the realm restarted; one fresh token, then give up.
      token = undefined;
      res = await call(url, { headers: { Authorization: `Bearer ${await serviceToken()}` } });
    }
    if (!res.ok) throw new AccountsUnavailable(`Keycloak user query failed: ${res.status}`);
    const body: unknown = await res.json();
    return Array.isArray(body) ? (body as KeycloakUser[]) : [];
  }

  async function lookup(username: string): Promise<Account | undefined> {
    const wanted = normaliseUsername(username);
    if (!wanted) return undefined;
    const found = await users({ username: wanted, exact: "true" });
    return found.map(toAccount).find((a) => a?.username === wanted);
  }

  return {
    lookup,

    async check(username) {
      return (await lookup(username))?.enabled === true;
    },

    async search(text) {
      // Ask for a few more than shown, since disabled accounts are dropped.
      const found = await users({ search: text.trim(), max: String(SEARCH_LIMIT * 2) });
      return found
        .map(toAccount)
        .filter((a): a is Account => a !== undefined && a.enabled)
        .slice(0, SEARCH_LIMIT)
        .map(({ username, name }) => ({ username, name }));
    },
  };
}
