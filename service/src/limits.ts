/**
 * Per-person limits that reset each UTC day (specs/marker-editing). Kept in memory: the service
 * runs as one instance, and a restart resetting the counts is accepted.
 *
 * A use is taken when a request arrives, with no await between the check and the count, so
 * requests sent at the same time can't all get in. A request that fails gives its use back.
 */
export class DailyLimit {
  private day = "";
  private counts = new Map<string, number>();
  readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  /** Today's counts; earlier days are dropped in one go when the UTC day changes. */
  private today(now: Date): Map<string, number> {
    const day = now.toISOString().slice(0, 10);
    if (day !== this.day) {
      this.day = day;
      this.counts = new Map();
    }
    return this.counts;
  }

  /** Counts one use if this person has any left today. False when the limit is reached. */
  take(username: string, now: Date): boolean {
    const counts = this.today(now);
    const used = counts.get(username) ?? 0;
    if (used >= this.limit) return false;
    counts.set(username, used + 1);
    return true;
  }

  /** Returns a use taken today by a request that failed. A use from an earlier day is already gone. */
  giveBack(username: string, now: Date): void {
    if (now.toISOString().slice(0, 10) !== this.day) return;
    const used = this.counts.get(username) ?? 0;
    if (used <= 1) this.counts.delete(username);
    else this.counts.set(username, used - 1);
  }

  /** How many people have counts today (for tests). */
  get people(): number {
    return this.counts.size;
  }
}

/**
 * Per-person limits over a sliding window, such as account searches a minute (specs/account-lookup).
 * Kept in memory, like DailyLimit. People who stop are dropped by a sweep that runs, at most once
 * a window, when a request arrives, so the map holds only people active in the last window or two.
 */
export class MinuteLimit {
  private times = new Map<string, number[]>();
  private sweptAt = 0;
  readonly limit: number;
  readonly windowMs: number;

  constructor(limit: number, windowMs = 60_000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Counts one use if this person has any left in the window. A refusal isn't counted. */
  take(username: string, now: Date): boolean {
    const t = now.getTime();
    if (t - this.sweptAt >= this.windowMs) {
      for (const [name, times] of this.times) {
        if (t - times[times.length - 1]! >= this.windowMs) this.times.delete(name);
      }
      this.sweptAt = t;
    }
    const recent = (this.times.get(username) ?? []).filter((x) => t - x < this.windowMs);
    if (recent.length >= this.limit) {
      this.times.set(username, recent);
      return false;
    }
    recent.push(t);
    this.times.set(username, recent);
    return true;
  }

  /** How many people are being tracked (for tests). */
  get people(): number {
    return this.times.size;
  }
}

export const ADDS_PER_DAY = 5;
export const UPLOADS_PER_DAY = 20;
