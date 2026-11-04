import { ADMIN_GROUP } from "@openmrs-atlas/shared";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
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
  return new SignJWT({ azp: "atlas", preferred_username: "JDoe", ...claims })
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
