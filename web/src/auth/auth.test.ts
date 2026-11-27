// specs/user-sign-in: signed in across tabs and visits, "Keep me signed in on this device", and
// signing out ending a kept sign-in. Keycloak's client library is replaced by a fake.
import { beforeEach, describe, expect, it, vi } from "vitest";

const ISSUER = "https://id.test/realms/openmrs";
const USER_KEY = `oidc.user:${ISSUER}:atlas`;

vi.mock("../config.ts", () => ({
  config: { keycloakIssuer: ISSUER, keycloakClientId: "atlas", e2e: false, apiBaseUrl: "/api" },
}));

const fake = vi.hoisted(() => ({
  settings: undefined as Record<string, unknown> | undefined,
  user: undefined as { expired: boolean; access_token: string; refresh_token?: string } | undefined,
  signinRedirect: vi.fn<(args?: unknown) => Promise<void>>(async () => {}),
  signinSilent: vi.fn(async (): Promise<{ access_token: string } | null> => null),
  signoutRedirect: vi.fn(async () => {}),
  revokeTokens: vi.fn<(types?: unknown) => Promise<void>>(async () => {}),
  removeUser: vi.fn(async () => {}),
}));

vi.mock("oidc-client-ts", () => {
  class ErrorTimeout extends Error {}
  class WebStorageStateStore {
    store: Storage;
    constructor({ store }: { store: Storage }) {
      this.store = store;
    }
  }
  class UserManager {
    constructor(settings: Record<string, unknown>) {
      fake.settings = settings;
    }
    getUser = async () => fake.user ?? null;
    signinRedirect = fake.signinRedirect;
    signinSilent = fake.signinSilent;
    signoutRedirect = fake.signoutRedirect;
    revokeTokens = fake.revokeTokens;
    removeUser = fake.removeUser;
  }
  return { ErrorTimeout, UserManager, WebStorageStateStore };
});

const oidc = await import("./oidc.ts");
const session = await import("./session.ts");

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fake.user = undefined;
  vi.clearAllMocks();
});

describe("Signed in across tabs and visits", () => {
  it("keeps the sign-in in localStorage, and a sign-in under way in the tab", () => {
    const store = (key: string) => (fake.settings?.[key] as { store: Storage }).store;
    expect(store("userStore")).toBe(window.localStorage);
    expect(store("stateStore")).toBe(window.sessionStorage);
  });

  it("finds a sign-in stored by another tab or an earlier visit", () => {
    expect(session.hasSession()).toBe(false);
    localStorage.setItem(USER_KEY, "{}");
    expect(session.hasSession()).toBe(true);
  });

  it("Scenario: Next visit after Keycloak's session has lapsed: forgotten without a notice", async () => {
    localStorage.setItem(USER_KEY, "{}");
    fake.user = { expired: true, access_token: "old", refresh_token: "r" };
    fake.signinSilent.mockRejectedValueOnce(new Error("invalid_grant"));
    const ended = vi.fn();
    const stop = session.onSessionEnded(ended);
    await session.clearLapsedSession();
    stop();
    expect(fake.removeUser).toHaveBeenCalled();
    expect(ended).not.toHaveBeenCalled();
  });

  it("renews a sign-in from an earlier visit, and keeps it when the network is down", async () => {
    localStorage.setItem(USER_KEY, "{}");
    fake.user = { expired: true, access_token: "old", refresh_token: "r" };
    fake.signinSilent.mockResolvedValueOnce({ access_token: "new" });
    await session.clearLapsedSession();
    expect(fake.removeUser).not.toHaveBeenCalled();

    fake.signinSilent.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await session.clearLapsedSession();
    expect(fake.removeUser).not.toHaveBeenCalled();
  });

  it("hears when another tab signs in or out", () => {
    const heard = vi.fn();
    const stop = session.onOtherTabSignIn(heard);
    const event = (newValue: string | null) =>
      window.dispatchEvent(
        new StorageEvent("storage", { key: USER_KEY, newValue, storageArea: localStorage }),
      );
    event("{}");
    event(null);
    window.dispatchEvent(
      new StorageEvent("storage", { key: "other", newValue: null, storageArea: localStorage }),
    );
    stop();
    event(null);
    expect(heard.mock.calls).toEqual([[true], [false]]);
  });
});

describe("Keep me signed in on this device", () => {
  it("asks Keycloak for an offline session only when kept, and remembers the choice", async () => {
    await session.signIn("/", { keep: false });
    expect(fake.signinRedirect).toHaveBeenLastCalledWith({});
    await session.signIn("/", { keep: true });
    expect(fake.signinRedirect).toHaveBeenLastCalledWith({
      scope: "openid profile offline_access",
    });
    // A later fresh sign-in asks for the same, and for the password.
    await session.signIn("/", { fresh: true });
    expect(fake.signinRedirect).toHaveBeenLastCalledWith({
      scope: "openid profile offline_access",
      max_age: 0,
    });
  });

  it("shows no end time for an offline token that doesn't say", async () => {
    localStorage.setItem(USER_KEY, "{}");
    const unsigned = (claims: object) => `x.${btoa(JSON.stringify(claims))}.y`;
    fake.user = { expired: false, access_token: "a", refresh_token: unsigned({ typ: "Offline" }) };
    expect(await oidc.sessionEndsAt()).toBeUndefined();
    fake.user.refresh_token = unsigned({ exp: 1_800_000_000 });
    expect(await oidc.sessionEndsAt()).toBe(1_800_000_000_000);
  });
});

describe("Signing out ends a kept sign-in", () => {
  it("revokes the refresh token before ending Keycloak's session, and forgets keep", async () => {
    localStorage.setItem("atlas.keep", "1");
    await session.signOut("/");
    expect(fake.revokeTokens).toHaveBeenCalledWith(["refresh_token"]);
    const revoked = fake.revokeTokens.mock.invocationCallOrder[0]!;
    expect(revoked).toBeLessThan(fake.signoutRedirect.mock.invocationCallOrder[0]!);
    expect(localStorage.getItem("atlas.keep")).toBeNull();
  });

  it("still signs out when Keycloak can't be told", async () => {
    fake.revokeTokens.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await session.signOut("/");
    expect(fake.signoutRedirect).toHaveBeenCalled();
  });
});
