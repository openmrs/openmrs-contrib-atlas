import { describe, expect, it } from "vitest";
import { WriteQueue } from "./queue.ts";

const tick = () => new Promise((done) => setTimeout(done, 1));

describe("WriteQueue (Writes are serialised)", () => {
  it("runs tasks one at a time, in order", async () => {
    const queue = new WriteQueue();
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`${name} start`);
      await tick();
      log.push(`${name} end`);
    };
    await Promise.all([queue.run(task("a")), queue.run(task("b"))]);
    expect(log).toEqual(["a start", "a end", "b start", "b end"]);
  });

  it("keeps going after a task fails", async () => {
    const queue = new WriteQueue();
    await expect(queue.run(() => Promise.reject(new Error("no")))).rejects.toThrow("no");
    expect(await queue.run(async () => 1)).toBe(1);
  });

  it("shares one run among callers waiting for it to start, not after it starts", async () => {
    const queue = new WriteQueue();
    let runs = 0;
    const publish = async () => {
      await tick();
      return ++runs;
    };
    let release = () => {};
    const blocker = queue.run(() => new Promise<void>((done) => (release = done)));
    const first = queue.shared(publish);
    const second = queue.shared(publish);
    await tick();
    release();
    await blocker;
    expect(await first).toBe(1);
    expect(await second).toBe(1);
    expect(await queue.shared(publish)).toBe(2);
  });
});
