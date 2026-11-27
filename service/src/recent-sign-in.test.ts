import { describe, expect, it } from "vitest";
import { ApiError, RECENT_SIGN_IN_MS, requireRecentSignIn } from "./edits/core.ts";

// specs/user-sign-in, "Weighty actions need a recent sign-in".
const NOW = new Date("2026-11-27T12:00:00Z");
const person = (minutesAgo?: number) => ({
  username: "jdoe",
  admin: false,
  ...(minutesAgo === undefined ? {} : { signedInAt: NOW.getTime() - minutesAgo * 60_000 }),
});

describe("requireRecentSignIn", () => {
  it("allows a sign-in 9 minutes ago, and exactly at the limit", () => {
    expect(() => requireRecentSignIn(person(9), NOW)).not.toThrow();
    const atLimit = { ...person(), signedInAt: NOW.getTime() - RECENT_SIGN_IN_MS };
    expect(() => requireRecentSignIn(atLimit, NOW)).not.toThrow();
  });

  it("asks for a sign-in again after 11 minutes, or with no sign-in time", () => {
    for (const who of [person(11), person()]) {
      let thrown: unknown;
      try {
        requireRecentSignIn(who, NOW);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(ApiError);
      expect((thrown as ApiError).status).toBe(401);
      expect((thrown as ApiError).body).toEqual({
        error: "Please sign in again to do this.",
        code: "sign-in-again",
      });
    }
  });
});
