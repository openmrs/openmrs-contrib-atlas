import { ErrorTimeout, UserManager, WebStorageStateStore } from "oidc-client-ts";
import { config } from "../config.ts";

/** Scopes for a kept sign-in: Keycloak's offline session lasts until unused for 30 days. */
const KEPT_SCOPE = "openid profile offline_access";

// Authorization Code with PKCE on a public client; there is no secret in the browser.
const manager = new UserManager({
  authority: config.keycloakIssuer,
  client_id: config.keycloakClientId,
  redirect_uri: `${window.location.origin}/`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  scope: "openid profile",
  // The sign-in belongs to every Atlas tab and lasts across visits (specs/user-sign-in, "Signed
  // in across tabs and visits"). A sign-in under way belongs to the tab that started it.
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
  automaticSilentRenew: false,
  monitorSession: false,
});

export interface SignInOptions {
  /** "Keep me signed in on this device": ask Keycloak for an offline session. */
  keep?: boolean;
  /** Make Keycloak ask for the password, for a weighty action (specs/user-sign-in). */
  fresh?: boolean;
}

export const startSignIn = ({ keep = false, fresh = false }: SignInOptions = {}) =>
  manager.signinRedirect({
    ...(keep ? { scope: KEPT_SCOPE } : {}),
    ...(fresh ? { max_age: 0 } : {}),
  });

export const finishSignIn = () => manager.signinCallback();

/**
 * Ends a kept sign-in in Keycloak too, so this device can't renew it (specs/user-sign-in,
 * "Signing out ends a kept sign-in"), then ends the Keycloak session. Signing out goes ahead
 * even if Keycloak can't be told; an unused offline session lapses on its own.
 */
export async function startSignOut() {
  try {
    await manager.revokeTokens(["refresh_token"]);
  } catch {
    // Carry on signing out.
  }
  await manager.signoutRedirect();
}

export const finishSignOut = () => manager.signoutCallback();

let renewing: Promise<string | undefined> | undefined;

async function renew(): Promise<string | undefined> {
  try {
    return (await manager.signinSilent())?.access_token;
  } catch (err) {
    // No answer from Keycloak says nothing about the session; a refusal means it has ended.
    if (err instanceof TypeError || err instanceof ErrorTimeout) throw err;
    return undefined;
  }
}

export async function accessToken(): Promise<string | undefined> {
  const user = await manager.getUser();
  if (!user) return undefined;
  if (!user.expired) return user.access_token;
  renewing ??= renew().finally(() => {
    renewing = undefined;
  });
  return renewing;
}

/** Forgets the stored sign-in, without telling Keycloak. */
export const forgetUser = () => manager.removeUser();

/**
 * When Keycloak will end the session, in ms; its refresh tokens are JWTs that say so. A kept
 * sign-in's offline token may not say, and then there's no end time to show.
 */
export async function sessionEndsAt(): Promise<number | undefined> {
  const token = (await manager.getUser())?.refresh_token;
  try {
    const payload = token?.split(".")[1];
    if (!payload) return undefined;
    const { exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: unknown;
    };
    return typeof exp === "number" && exp > 0 ? exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}
