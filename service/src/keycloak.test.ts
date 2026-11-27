import { ADMIN_GROUP } from "@openmrs-atlas/shared";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { describe, expect, it, vi } from "vitest";
import { keycloakVerifier } from "./keycloak.ts";

const issuer = "https://id.example/realms/openmrs";
const { publicKey, privateKey } = await generateKeyPair("RS256");
const other = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
const verify = keycloakVerifier({ issuer, clientId: "atlas" }, createLocalJWKSet({ keys: [jwk] }));

function sign(
  claims: Record<string, unknown>,
  options: { key?: typeof privateKey; iss?: string; exp?: string } = {},
) {
  return new SignJWT({ typ: "Bearer", azp: "atlas", preferred_username: "JDoe", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(options.iss ?? issuer)
    .setExpirationTime(options.exp ?? "5m")
    .sign(options.key ?? privateKey);
}

describe("Requests are checked by the service", () => {
  it("accepts a valid token, with the username in lower case", async () => {
    expect(await verify(await sign({}))).toEqual({ username: "jdoe", admin: false });
  });

  it("Scenario: Admin group", async () => {
    expect((await verify(await sign({ groups: [ADMIN_GROUP] })))?.admin).toBe(true);
    expect((await verify(await sign({ groups: ["/" + ADMIN_GROUP, "other"] })))?.admin).toBe(false);
  });

  it("Scenario: Token from another client", async () => {
    expect(await verify(await sign({ azp: "other-app" }))).toBeUndefined();
  });

  it("Scenario: ID token", async () => {
    // Keycloak marks ID tokens `typ: ID`; only access tokens (`typ: Bearer`) are accepted.
    expect(await verify(await sign({ typ: "ID" }))).toBeUndefined();
    expect(await verify(await sign({ typ: undefined }))).toBeUndefined();
  });

  it("rejects wrong signatures, issuers, expired tokens and garbage", async () => {
    expect(await verify(await sign({}, { key: other.privateKey }))).toBeUndefined();
    expect(await verify(await sign({}, { iss: "https://evil.example" }))).toBeUndefined();
    expect(await verify(await sign({}, { exp: "1 hour ago" }))).toBeUndefined();
    expect(await verify("not-a-token")).toBeUndefined();
  });

  it("keeps the person's own email from the token", async () => {
    expect(await verify(await sign({ email: "jdoe@example.org" }))).toEqual({
      username: "jdoe",
      admin: false,
      email: "jdoe@example.org",
    });
  });

  it("rejects a token with no username", async () => {
    expect(await verify(await sign({ preferred_username: "" }))).toBeUndefined();
  });
});

describe("Weighty actions need a recent sign-in: the sign-in time", () => {
  it("reads when the person signed in from `auth_time`", async () => {
    const person = await verify(await sign({ auth_time: 1_790_000_000 }));
    expect(person?.signedInAt).toBe(1_790_000_000_000);
  });

  it("leaves it out, and says so once, when the token has no `auth_time`", async () => {
    const fresh = keycloakVerifier(
      { issuer, clientId: "atlas" },
      createLocalJWKSet({ keys: [jwk] }),
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      expect((await fresh(await sign({})))?.signedInAt).toBeUndefined();
      expect((await fresh(await sign({ auth_time: 0 })))?.signedInAt).toBeUndefined();
      const lines = log.mock.calls.map((call) => String(call[0]));
      expect(lines).toEqual([JSON.stringify({ event: "auth-time-missing" })]);
    } finally {
      log.mockRestore();
    }
  });
});
