import { describe, expect, it } from "vitest";
import { parseServiceAccountKey, sheetsClient } from "./sheets.ts";

const KEY = {
  type: "service_account",
  client_email: "atlas-service@project.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----\n",
};

describe("Google service account key (specs/deployment)", () => {
  it("reads the JSON key as is, or base64-encoded, to the same credentials", () => {
    const raw = JSON.stringify(KEY);
    const base64 = Buffer.from(raw).toString("base64");
    expect(parseServiceAccountKey(raw)).toEqual(KEY);
    expect(parseServiceAccountKey(`  ${base64}\n`)).toEqual(KEY);
  });

  it("refuses a bad value without repeating it", () => {
    for (const value of ["not a key at all", JSON.stringify({ client_email: "x@y" })]) {
      let message = "";
      try {
        parseServiceAccountKey(value);
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toMatch(/GOOGLE_SERVICE_ACCOUNT_KEY/);
      expect(message).not.toContain(value);
    }
  });

  it("fails when the client is made, so a bad key stops start-up", () => {
    expect(() => sheetsClient("{broken")).toThrow(/GOOGLE_SERVICE_ACCOUNT_KEY/);
    expect(() => sheetsClient(JSON.stringify(KEY))).not.toThrow();
    expect(() => sheetsClient(undefined)).not.toThrow();
  });
});
