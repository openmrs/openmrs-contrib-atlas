import { config } from "../config.ts";

/**
 * Sign-in, without the OIDC library: that loads only when someone signs in or already has,
 * so the map's first load is unaffected. See specs/user-sign-in.
 */

export const signInEnabled = Boolean(config.keycloakIssuer && config.keycloakClientId);

const RETURN_KEY = "atlas.return";
/** End-to-end tests only: the token of the signed-in test user, and who signs in next. */
const E2E_TOKEN = "atlas.e2e.token";
const E2E_ACCOUNT = "atlas.e2e.account";

const oidc = () => import("./oidc.ts");

function read(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

const USER_KEY = `oidc.user:${config.keycloakIssuer}:${config.keycloakClientId}`;

export function hasSession(): boolean {
  if (config.e2e) return read(sessionStorage, E2E_TOKEN) !== null;
  if (!signInEnabled) return false;
  return read(sessionStorage, USER_KEY) !== null;
}

const endedListeners = new Set<() => void>();

/** Subscribes to the end of the session; returns how to unsubscribe. */
export function onSessionEnded(listener: () => void): () => void {
  endedListeners.add(listener);
  return () => endedListeners.delete(listener);
}

/** Forgets the session and tells the page. */
export function sessionEnded(): void {
  try {
    sessionStorage.removeItem(config.e2e ? E2E_TOKEN : USER_KEY);
  } catch {
    // Without storage there was no stored session to forget.
  }
  endedListeners.forEach((listener) => listener());
}

/** Keycloak has just sent the browser back here after signing in or out. */
export function isAuthReturn(search: string): boolean {
  return signInEnabled && !config.e2e && new URLSearchParams(search).has("state");
}

/** Finishes a return from Keycloak and restores the view. Returns a message if it failed. */
export async function completeAuthReturn(): Promise<string | undefined> {
  const params = new URLSearchParams(window.location.search);
  let failure: string | undefined;
  try {
    const { finishSignIn, finishSignOut } = await oidc();
    if (params.has("code") || params.has("error")) await finishSignIn();
    else await finishSignOut();
  } catch {
    failure = "Sign-in didn't complete. You can keep using the map, or try again.";
  }
  const back = read(sessionStorage, RETURN_KEY) ?? "/";
  sessionStorage.removeItem(RETURN_KEY);
  window.history.replaceState(null, "", back);
  return failure;
}

export async function signIn(returnTo: string): Promise<void> {
  if (config.e2e) {
    sessionStorage.setItem(E2E_TOKEN, localStorage.getItem(E2E_ACCOUNT) ?? "");
    window.location.assign(returnTo);
    return;
  }
  sessionStorage.setItem(RETURN_KEY, returnTo);
  await (await oidc()).startSignIn();
}

export async function signOut(returnTo: string): Promise<void> {
  if (config.e2e) {
    sessionStorage.removeItem(E2E_TOKEN);
    window.location.assign(returnTo);
    return;
  }
  sessionStorage.setItem(RETURN_KEY, returnTo);
  await (await oidc()).startSignOut();
}

/** The current access token, renewed if need be; undefined if the session has ended. */
export async function getToken(): Promise<string | undefined> {
  if (config.e2e) return read(sessionStorage, E2E_TOKEN) ?? undefined;
  if (!hasSession()) return undefined;
  return (await oidc()).accessToken();
}

/** Ends the session here if it has lapsed. A network failure proves nothing, so it is ignored. */
export async function checkSession(): Promise<void> {
  try {
    if ((await getToken()) === undefined) sessionEnded();
  } catch {
    // The next request will find out.
  }
}

export async function sessionEndsAt(): Promise<number | undefined> {
  if (config.e2e || !hasSession()) return undefined;
  return (await oidc()).sessionEndsAt();
}
