import { describe, expect, it } from "vitest";
import { timed, timedStore, withTiming, type Timings } from "./timing.ts";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function collect(fn: () => Promise<unknown>): Promise<Timings> {
  let out: Timings | undefined;
  await withTiming(fn, (t) => (out = t)).catch(() => undefined);
  return out!;
}

describe("timing", () => {
  it("sums parallel calls with a count", async () => {
    const t = await collect(() =>
      Promise.all([
        timed("a", () => pause(20)),
        timed("a", () => pause(20)),
        timed("b", () => pause(5)),
      ]),
    );
    expect(t.steps.a!.n).toBe(2);
    expect(t.steps.a!.ms).toBeGreaterThanOrEqual(36);
    expect(t.steps.b!.n).toBe(1);
    // Parallel steps add up to more than the wall time.
    expect(t.steps.a!.ms).toBeGreaterThan(t.total_ms);
  });

  it("keeps a nested scope's steps out of the outer one", async () => {
    let inner: Timings | undefined;
    const outer = await collect(() =>
      timed("publish", () =>
        withTiming(
          () => timed("sheet.read", () => pause(5)),
          (t) => (inner = t),
        ),
      ),
    );
    expect(Object.keys(outer.steps)).toEqual(["publish"]);
    expect(Object.keys(inner!.steps)).toEqual(["sheet.read"]);
  });

  it("records nothing outside a scope", async () => {
    await expect(timed("a", async () => 7)).resolves.toBe(7);
  });

  it("reports when the work throws, and rethrows", async () => {
    let report: Timings | undefined;
    await expect(
      withTiming(
        () => timed("a", () => Promise.reject(new Error("boom"))),
        (t) => (report = t),
      ),
    ).rejects.toThrow("boom");
    expect(report!.steps.a!.n).toBe(1);
  });

  it("times a store's methods and never records arguments or results", async () => {
    const store = timedStore("sheet", {
      prefix: "kept",
      async find(email: string) {
        return `${email}-secret`;
      },
      plain: () => "sync",
    });
    expect(store.prefix).toBe("kept");
    expect(store.plain()).toBe("sync");
    const t = await collect(() => store.find("someone@example.org"));
    expect(t.steps["sheet.find"]!.n).toBe(1);
    expect(JSON.stringify(t)).not.toMatch(/example|secret/);
  });
});
