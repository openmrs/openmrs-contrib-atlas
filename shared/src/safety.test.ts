import { describe, expect, it } from "vitest";
import { checkPublishSafety } from "./safety.ts";

describe("checkPublishSafety", () => {
  it("Scenario: Rows accidentally deleted", () => {
    const result = checkPublishSafety(450, 250, false);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain("250 markers");
  });

  it("Scenario: Intentional large cleanup", () => {
    expect(checkPublishSafety(450, 300, true)).toEqual({ ok: true });
  });

  it("passes at exactly 80% and when growing", () => {
    expect(checkPublishSafety(450, 360, false)).toEqual({ ok: true });
    expect(checkPublishSafety(450, 500, false)).toEqual({ ok: true });
  });

  it("refuses just under 80%", () => {
    expect(checkPublishSafety(450, 359, false).ok).toBe(false);
  });

  it("passes the first publish, when nothing is published yet", () => {
    expect(checkPublishSafety(undefined, 5, false)).toEqual({ ok: true });
    expect(checkPublishSafety(0, 5, false)).toEqual({ ok: true });
  });
});
