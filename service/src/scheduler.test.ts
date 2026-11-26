import { afterEach, describe, expect, it, vi } from "vitest";
import { jobsOff, nextRun, startScheduler, type Clock } from "./scheduler.ts";

/** A clock the test moves by hand; timers fire when it passes them. */
function fakeClock(start: string) {
  let now = new Date(start).getTime();
  let timers: { at: number; fn: () => void; id: number }[] = [];
  let next = 0;
  const clock: Clock = {
    now: () => new Date(now),
    setTimer: (fn, ms) => {
      const id = ++next;
      timers.push({ at: now + ms, fn, id });
      return id;
    },
    clearTimer: (id) => {
      timers = timers.filter((t) => t.id !== id);
    },
  };
  /** Moves the clock to `to`, firing every timer due on the way, in order. */
  async function advance(to: string) {
    const end = new Date(to).getTime();
    for (;;) {
      const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers = timers.filter((t) => t !== due);
      now = due.at;
      due.fn();
      await Promise.resolve();
    }
    now = end;
  }
  return { clock, advance, pending: () => timers.map((t) => new Date(t.at).toISOString()) };
}

afterEach(() => vi.restoreAllMocks());

describe("nextRun", () => {
  it("is later today when the hour hasn't come yet, else tomorrow", () => {
    expect(nextRun(new Date("2026-11-23T01:30:00Z"), 3)).toEqual(new Date("2026-11-23T03:00:00Z"));
    expect(nextRun(new Date("2026-11-23T03:00:00Z"), 3)).toEqual(new Date("2026-11-24T03:00:00Z"));
    expect(nextRun(new Date("2026-11-23T22:00:00Z"), 3)).toEqual(new Date("2026-11-24T03:00:00Z"));
  });

  it("crosses month and year ends", () => {
    expect(nextRun(new Date("2026-12-31T15:00:00Z"), 14)).toEqual(new Date("2027-01-01T14:00:00Z"));
  });
});

describe("Scheduled jobs run in the service (specs/deployment)", () => {
  it("Scenario: Nightly run", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { clock, advance } = fakeClock("2026-11-23T01:00:00Z");
    const publish = vi.fn(async () => undefined);
    const reminders = vi.fn(async () => undefined);
    startScheduler(
      [
        { name: "nightly-publish", hourUtc: 3, run: publish },
        { name: "reminders", hourUtc: 14, run: reminders },
      ],
      clock,
    );
    await advance("2026-11-23T02:59:59Z");
    expect(publish).not.toHaveBeenCalled();
    await advance("2026-11-23T03:00:00Z");
    expect(publish).toHaveBeenCalledTimes(1);
    expect(reminders).not.toHaveBeenCalled();
    await advance("2026-11-25T12:00:00Z");
    expect(publish).toHaveBeenCalledTimes(3);
    expect(reminders).toHaveBeenCalledTimes(2);
  });

  it("never runs two copies of a job: one still running is skipped", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { clock, advance } = fakeClock("2026-11-23T02:00:00Z");
    let finish: () => void = () => {};
    const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    startScheduler([{ name: "nightly-publish", hourUtc: 3, run }], clock);
    await advance("2026-11-24T03:00:00Z");
    expect(run).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("job-skipped"));
    finish();
    await Promise.resolve();
    await advance("2026-11-25T03:00:00Z");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("keeps running after a job fails", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { clock, advance } = fakeClock("2026-11-23T02:00:00Z");
    const run = vi.fn(async () => {
      throw new Error("sheet down");
    });
    startScheduler([{ name: "nightly-publish", hourUtc: 3, run }], clock);
    await advance("2026-11-23T03:00:00Z");
    await Promise.resolve();
    await advance("2026-11-24T03:00:00Z");
    expect(run).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("job-failed"));
  });

  it("stops every timer", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { clock, advance, pending } = fakeClock("2026-11-23T02:00:00Z");
    const run = vi.fn(async () => undefined);
    const stop = startScheduler([{ name: "nightly-publish", hourUtc: 3, run }], clock);
    stop();
    expect(pending()).toEqual([]);
    await advance("2026-11-24T03:00:00Z");
    expect(run).not.toHaveBeenCalled();
  });

  it("Scenario: Jobs turned off", () => {
    expect(jobsOff("off")).toBe(true);
    expect(jobsOff(" OFF ")).toBe(true);
    expect(jobsOff("false")).toBe(true);
    expect(jobsOff(undefined)).toBe(false);
    expect(jobsOff("")).toBe(false);
    expect(jobsOff("on")).toBe(false);
  });
});
