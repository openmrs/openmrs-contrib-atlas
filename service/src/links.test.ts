import { describe, expect, it } from "vitest";
import { CONFIRM_DAYS, UNSUBSCRIBE_DAYS, linkSigner } from "./links.ts";

const KEY = "k".repeat(43);
const signer = linkSigner(KEY);
const NOW = new Date("2026-11-03T14:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("signed reminder links", () => {
  it("round-trips a confirm link with marker, confirmed_at and username", () => {
    const token = signer.confirm("m1", "2024-01-01T00:00:00.000Z", "jdoe", NOW);
    expect(signer.check(token, days(1))).toEqual({
      ok: true,
      payload: {
        purpose: "confirm",
        marker: "m1",
        confirmedAt: "2024-01-01T00:00:00.000Z",
        username: "jdoe",
        expires: days(CONFIRM_DAYS).getTime(),
      },
    });
  });

  it("holds no email address and is safe in a URL fragment", () => {
    const token = signer.unsubscribe("jdoe", NOW);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token.split(".")[0]!, "base64url").toString()).not.toContain("@");
  });

  it("Scenario: Expired link, still saying which marker it was for", () => {
    const token = signer.confirm("m1", "2024-01-01T00:00:00.000Z", "jdoe", NOW);
    const check = signer.check(token, days(31));
    expect(check).toMatchObject({ ok: false, reason: "expired", payload: { marker: "m1" } });
  });

  it("keeps unsubscribe links working for a year", () => {
    const token = signer.unsubscribe("jdoe", NOW);
    expect(signer.check(token, days(UNSUBSCRIBE_DAYS - 1)).ok).toBe(true);
    expect(signer.check(token, days(UNSUBSCRIBE_DAYS + 1)).ok).toBe(false);
  });

  it("Scenario: Forged link", () => {
    const token = signer.confirm("m1", "2024-01-01T00:00:00.000Z", "jdoe", NOW);
    const [, signature] = token.split(".");
    const otherMarker = Buffer.from(
      JSON.stringify({
        purpose: "confirm",
        marker: "m2",
        confirmedAt: "2024-01-01T00:00:00.000Z",
        username: "jdoe",
        expires: days(30).getTime(),
      }),
    ).toString("base64url");
    const invalid = { ok: false, reason: "invalid" };
    expect(signer.check(`${otherMarker}.${signature}`, NOW)).toEqual(invalid);
    expect(linkSigner("x".repeat(43)).check(token, NOW)).toEqual(invalid);
    expect(signer.check(`${token}x`, NOW)).toEqual(invalid);
    for (const junk of [undefined, 42, "", "abc", "a.b.c", "x".repeat(3000)]) {
      expect(signer.check(junk, NOW)).toEqual(invalid);
    }
  });

  it("refuses a short signing key", () => {
    expect(() => linkSigner("short")).toThrow();
  });
});
