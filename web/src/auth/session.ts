import { config } from "../config.ts";

/**
 * Sign-in, without the OIDC library: that loads only when someone signs in or already has,
 * so the map's first load is unaffected. See specs/user-sign-in.
 *
 * The signed-in user lives in localStorage, shared by every Atlas tab and kept across visits;
 * what belongs to one sign-in under way (where to return to) stays in that tab's sessionStorage.
 */

export const signInEnabled = Boolean(config.keycloakIssuer && config.keycloakClientId);

const RETURN_KEY = "atlas.return";
/** "Keep me signed in on this device", remembered so a fresh sign-in asks for the same. */
const KEEP_KEY = "atlas.keep";
/** End-to-end tests only: the token of the signed-in test user, and who signs in next. */
const E2E_TOKEN = "atlas.e2e.token";
const E2E_ACCOUNT = "atlas.e2e.account";
/** End-to-end tests only: how the last sign-in was asked for, so tests can check it. */
const E2E_SIGN_IN = "atlas.e2e.sign-in";

const oidc = () => import("./oidc.ts");

function read(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function write(storage: Storage, key: string, value: string | undefined): void {
  try {
    if (value === undefined) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // Without storage there's nothing to remember it in.
  }
}

const USER_KEY = `oidc.user:${config.keycloakIssuer}:${config.keycloakClientId}`;
/** The key whose presence means someone is signed in, in this build. */
const SIGNED_IN_KEY = config.e2e ? E2E_TOKEN : USER_KEY;

/** End-to-end tests may seed the token in either storage; real sign-ins use localStorage. */
function e2eToken(): string | null {
  return read(sessionStorage, E2E_TOKEN) ?? read(localStorage, E2E_TOKEN);
}

export function hasSession(): boolean {
  if (config.e2e) return e2eToken() !== null;
  if (!signInEnabled) return false;
  return read(localStorage, USER_KEY) !== null;
}

function forgetStoredSession(): void {
  write(localStorage, SIGNED_IN_KEY, undefined);
  if (config.e2e) write(sessionStorage, E2E_TOKEN, undefined);
}

const endedListeners = new Set<() => void>();

/** Subscribes to the end of the session; returns how to unsubscribe. */
export function onSessionEnded(listener: () => void): () => void {
  endedListeners.add(listener);
  return () => endedListeners.delete(listener);
}

/** Forgets the session and tells the page. */
export function sessionEnded(): void {
  forgetStoredSession();
  endedListeners.forEach((listener) => listener());
}

/**
 * When the page opens with a sign-in stored from an earlier visit, renews it if need be, and
 * forgets it quietly if Keycloak has ended it: a lapse between visits isn't news (specs/
 * user-sign-in, "Signed in across tabs and visits"). A network failure keeps it.
 */
export async function clearLapsedSession(): Promise<void> {
  if (config.e2e || !hasSession()) return;
  try {
    const { accessToken, forgetUser } = await oidc();
    if ((await accessToken()) === undefined) await forgetUser();
  } catch {
    // Unreachable says nothing about the session; the first request will find out.
  }
}

/**
 * Calls `listener(signedIn)` when another tab signs in or out; returns how to stop. Browsers
 * send `storage` events only to the other tabs.
 */
export function onOtherTabSignIn(listener: (signedIn: boolean) => void): () => void {
  const handle = (e: StorageEvent) => {
    if (e.key === SIGNED_IN_KEY && e.storageArea === localStorage) listener(e.newValue !== null);
  };
  window.addEventListener("storage", handle);
  return () => window.removeEventListener("storage", handle);
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

export interface SignInOptions {
  /** The "Keep me signed in on this device" box; left out, the last choice stands. */
  keep?: boolean;
  /** Ask for the password even if Keycloak's session is alive, for a weighty action. */
  fresh?: boolean;
}

export async function signIn(returnTo: string, options: SignInOptions = {}): Promise<void> {
  if (options.keep !== undefined) write(localStorage, KEEP_KEY, options.keep ? "1" : undefined);
  const keep = read(localStorage, KEEP_KEY) === "1";
  const fresh = Boolean(options.fresh);
  if (config.e2e) {
    write(localStorage, E2E_TOKEN, localStorage.getItem(E2E_ACCOUNT) ?? "");
    write(sessionStorage, E2E_TOKEN, undefined);
    write(localStorage, E2E_SIGN_IN, JSON.stringify({ keep, fresh }));
    window.location.assign(returnTo);
    return;
  }
  sessionStorage.setItem(RETURN_KEY, returnTo);
  await (await oidc()).startSignIn({ keep, fresh });
}

export async function signOut(returnTo: string): Promise<void> {
  write(localStorage, KEEP_KEY, undefined);
  if (config.e2e) {
    forgetStoredSession();
    window.location.assign(returnTo);
    return;
  }
  sessionStorage.setItem(RETURN_KEY, returnTo);
  await (await oidc()).startSignOut();
}

/** The current access token, renewed if need be; undefined if the session has ended. */
export async function getToken(): Promise<string | undefined> {
  if (config.e2e) return e2eToken() ?? undefined;
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
