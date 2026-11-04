import { describe, expect, it } from "vitest";
import { AccountsUnavailable, keycloakAccounts } from "./accounts.ts";

const issuer = "https://id.example/realms/openmrs";
const config = { issuer, clientId: "atlas-service", clientSecret: "client-secret" };

interface Call {
  url: string;
  init: RequestInit;
}

/** A Keycloak stand-in: a token endpoint and a users endpoint with fixed users. */
function fakeKeycloak(
  users: object[],
  options: { tokenStatus?: number; usersStatus?: number[]; down?: boolean } = {},
) {
  const calls: Call[] = [];
  const usersStatus = [...(options.usersStatus ?? [])];
  const fetchFn = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (options.down) throw new TypeError("fetch failed");
    if (url.endsWith("/protocol/openid-connect/token")) {
      return Response.json(
        { access_token: `token-${calls.length}`, expires_in: 300 },
        { status: options.tokenStatus ?? 200 },
      );
    }
    const status = usersStatus.shift() ?? 200;
    if (status !== 200) return new Response("", { status });
    const params = new URL(url).searchParams;
    const exact = params.get("username");
    const search = params.get("search");
    return Response.json(
      exact
        ? users.filter((u) => (u as { username: string }).username === exact)
        : users.filter((u) => JSON.stringify(u).toLowerCase().includes(search!.toLowerCase())),
    );
  }) as typeof fetch;
  return { calls, accounts: keycloakAccounts(config, fetchFn) };
}

const JDOE = {
  username: "jdoe",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.org",
  enabled: true,
};
const OLD = { username: "olduser", firstName: "Old", email: "old@example.org", enabled: false };

describe("Read-only service access to accounts", () => {
  it("gets a client-credentials token and reuses it until it nears expiry", async () => {
    const { calls, accounts } = fakeKeycloak([JDOE]);
    await accounts.check("jdoe");
    await accounts.check("jdoe");
    const tokenCalls = calls.filter((c) => c.url.endsWith("/token"));
    expect(tokenCalls).toHaveLength(1);
    const body = new URLSearchParams(String(tokenCalls[0]!.init.body));
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe("atlas-service");
    const userCalls = calls.filter((c) => c.url.includes("/admin/realms/openmrs/users?"));
    expect(userCalls).toHaveLength(2);
    expect((userCalls[0]!.init.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-1",
    );
  });

  it("only ever reads users", async () => {
    const { calls, accounts } = fakeKeycloak([JDOE]);
    await accounts.check("jdoe");
    await accounts.search("doe");
    await accounts.lookup("jdoe");
    for (const call of calls) {
      if (call.url.endsWith("/token")) continue;
      expect(call.init.method ?? "GET").toBe("GET");
      expect(new URL(call.url).pathname).toBe("/admin/realms/openmrs/users");
    }
  });

  it("renews the token once if Keycloak rejects it", async () => {
    const { accounts } = fakeKeycloak([JDOE], { usersStatus: [401] });
    expect(await accounts.check("jdoe")).toBe(true);
  });
});

describe("checking an OpenMRS ID", () => {
  it("finds an enabled account by exact username, ignoring case", async () => {
    const { accounts } = fakeKeycloak([JDOE, OLD]);
    expect(await accounts.check(" JDoe ")).toBe(true);
    expect(await accounts.check("jdo")).toBe(false);
  });

  it("treats a disabled account as not found", async () => {
    const { accounts } = fakeKeycloak([JDOE, OLD]);
    expect(await accounts.check("olduser")).toBe(false);
    expect(await accounts.lookup("olduser")).toMatchObject({ enabled: false });
  });

  it("returns the email for the reminder job", async () => {
    const { accounts } = fakeKeycloak([JDOE]);
    expect(await accounts.lookup("jdoe")).toEqual({
      username: "jdoe",
      name: "Jane Doe",
      email: "jane@example.org",
      enabled: true,
    });
  });
});

describe("Account search", () => {
  it("returns only username and name, leaving out disabled accounts", async () => {
    const { accounts } = fakeKeycloak([JDOE, OLD, { ...JDOE, username: "jdoe2" }]);
    const found = await accounts.search("o");
    expect(found).toEqual([
      { username: "jdoe", name: "Jane Doe" },
      { username: "jdoe2", name: "Jane Doe" },
    ]);
    expect(JSON.stringify(found)).not.toContain("@");
  });

  it("returns at most 10 accounts", async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ ...JDOE, username: `user${i}` }));
    const { accounts } = fakeKeycloak(many);
    expect(await accounts.search("user")).toHaveLength(10);
  });
});

describe("Keycloak unavailable", () => {
  it("throws AccountsUnavailable when Keycloak can't be reached or refuses the client", async () => {
    await expect(fakeKeycloak([], { down: true }).accounts.check("jdoe")).rejects.toThrow(
      AccountsUnavailable,
    );
    await expect(fakeKeycloak([], { tokenStatus: 401 }).accounts.check("jdoe")).rejects.toThrow(
      AccountsUnavailable,
    );
    await expect(
      fakeKeycloak([JDOE], { usersStatus: [403] }).accounts.search("doe"),
    ).rejects.toThrow(AccountsUnavailable);
  });
});
