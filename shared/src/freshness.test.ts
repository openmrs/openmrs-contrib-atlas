import { describe, expect, it } from "vitest";
import { addMonths, needsConfirming } from "./freshness.ts";

const NOW = new Date("2026-11-07T12:00:00.000Z");

describe("needsConfirming", () => {
  it("is true when never confirmed", () => {
    expect(needsConfirming("", NOW)).toBe(true);
    expect(needsConfirming(undefined, NOW)).toBe(true);
    expect(needsConfirming("not a date", NOW)).toBe(true);
  });

  it("is false just before 12 months", () => {
    expect(needsConfirming("2025-11-08T12:00:00.000Z", NOW)).toBe(false);
    expect(needsConfirming("2026-05-01", NOW)).toBe(false);
  });

  it("is true at exactly 12 months, as the first reminder is", () => {
    expect(needsConfirming("2025-11-07T12:00:00.000Z", NOW)).toBe(true);
  });

  it("counts calendar months from the end of a month", () => {
    // 31 January + 12 months is 31 January; a 29 February start lands on 28 February.
    expect(needsConfirming("2024-02-29T00:00:00.000Z", new Date("2025-02-27T23:59:59Z"))).toBe(
      false,
    );
    expect(needsConfirming("2024-02-29T00:00:00.000Z", new Date("2025-02-28T00:00:00Z"))).toBe(
      true,
    );
  });

  it("is true for a marker confirmed years ago", () => {
    expect(needsConfirming("2022-06-01", NOW)).toBe(true);
  });
});

describe("addMonths", () => {
  it("keeps the day, or the month's last day", () => {
    expect(addMonths("2025-01-31T10:00:00.000Z", 1).toISOString()).toBe("2025-02-28T10:00:00.000Z");
  });
});
