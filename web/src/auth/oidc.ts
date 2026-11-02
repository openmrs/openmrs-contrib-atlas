import { UserManager, WebStorageStateStore } from "oidc-client-ts";
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

export async function accessToken(): Promise<string | undefined> {
  const user = await manager.getUser();
  if (!user) return undefined;
  if (!user.expired) return user.access_token;
  try {
    return (await manager.signinSilent())?.access_token;
  } catch {
    return undefined;
  }
}
