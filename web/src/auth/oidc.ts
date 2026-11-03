import { ErrorTimeout, UserManager, WebStorageStateStore } from "oidc-client-ts";
import { config } from "../config.ts";

// Authorization Code with PKCE on a public client; there is no secret in the browser.
const manager = new UserManager({
  authority: config.keycloakIssuer,
  client_id: config.keycloakClientId,
  redirect_uri: `${window.location.origin}/`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  scope: "openid profile",
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  automaticSilentRenew: false,
  monitorSession: false,
});

export const startSignIn = () => manager.signinRedirect();
export const finishSignIn = () => manager.signinCallback();
export const startSignOut = () => manager.signoutRedirect();
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

/** When Keycloak will end the session, in ms; its refresh tokens are JWTs that say so. */
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
