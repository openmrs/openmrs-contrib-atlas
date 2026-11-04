import { ADMIN_GROUP, normaliseUsername, type Person } from "@openmrs-atlas/shared";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/** Who a Keycloak token belongs to, or undefined if it isn't valid. Injectable for tests. */
export type PersonVerifier = (token: string) => Promise<Person | undefined>;

export interface KeycloakConfig {
  issuer: string;
  clientId: string;
}

/**
 * Checks signature, issuer and expiry, and that the token was issued to the Atlas client.
 * Keycloak access tokens say `aud: account` by default, so `azp` is what names the client.
 * See specs/user-sign-in, "Requests are checked by the service".
 */
export function keycloakVerifier(config: KeycloakConfig, keys?: JWTVerifyGetKey): PersonVerifier {
  const jwks =
    keys ?? createRemoteJWKSet(new URL(`${config.issuer}/protocol/openid-connect/certs`));
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer: config.issuer });
      if (payload.azp !== config.clientId) return undefined;
      const username = payload.preferred_username;
      if (typeof username !== "string" || !username) return undefined;
      const groups = Array.isArray(payload.groups) ? payload.groups : [];
      const person: Person = {
        username: normaliseUsername(username),
        admin: groups.includes(ADMIN_GROUP),
      };
      // The `email` scope puts it in the token; it is only ever shown back to this person.
      if (typeof payload.email === "string" && payload.email) person.email = payload.email;
      return person;
    } catch {
      return undefined;
    }
  };
}
