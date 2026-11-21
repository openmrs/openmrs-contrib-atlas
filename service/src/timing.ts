import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Where a request's time goes, for the `timing` and `publish-timing` log lines.
 * Only fixed step names, times and counts are kept: never arguments or results, so no email,
 * username or sheet data can reach the logs (specs/account-lookup).
 */
export interface Timings {
  total_ms: number;
  /** Time and number of calls for each step. Steps that ran together add up to more than the total. */
  steps: Record<string, { ms: number; n: number }>;
}

type Steps = Timings["steps"];
const current = new AsyncLocalStorage<Steps>();

/**
 * Runs `fn` with its own collector, nested in any outer one, and reports its timings when it
 * finishes, whether or not it throws.
 */
export async function withTiming<T>(
  fn: () => Promise<T>,
  report: (timings: Timings, outcome: { result?: T; error?: unknown }) => void,
): Promise<T> {
  const steps: Steps = {};
  const start = performance.now();
  const done = () => ({ total_ms: Math.round(performance.now() - start), steps });
  let result: T;
  try {
    result = await current.run(steps, fn);
  } catch (error) {
    report(done(), { error });
    throw error;
  }
  report(done(), { result });
  return result;
}

/** Adds the time `work` takes under `name` in the current collector, if there is one. */
export async function timed<T>(name: string, work: () => Promise<T>): Promise<T> {
  const steps = current.getStore();
  if (!steps) return work();
  const start = performance.now();
  try {
    return await work();
  } finally {
    const step = (steps[name] ??= { ms: 0, n: 0 });
    step.ms += Math.round(performance.now() - start);
    step.n++;
  }
}

/**
 * The same store, with each async method timed as `<prefix>.<method>`. Other properties pass
 * through unchanged.
 */
export function timedStore<S extends object>(prefix: string, store: S): S {
  return new Proxy(store, {
    get(target, key, receiver) {
      const value: unknown = Reflect.get(target, key, receiver);
      if (typeof value !== "function" || typeof key !== "string") return value;
      return (...args: unknown[]) => {
        const out: unknown = (value as (...a: unknown[]) => unknown).apply(target, args);
        if (!(out instanceof Promise)) return out;
        return timed(`${prefix}.${key}`, () => out);
      };
    },
  });
}
