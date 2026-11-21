/**
 * Per-person limits that reset each UTC day (specs/marker-editing). Kept in memory: the service
 * runs as one instance, and a restart resetting the counts is accepted.
 */
export class DailyLimit {
  private counts = new Map<string, { day: string; count: number }>();
  readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  private today(username: string, now: Date) {
    const day = now.toISOString().slice(0, 10);
    const entry = this.counts.get(username);
    return entry && entry.day === day ? entry : { day, count: 0 };
  }

  /** Whether this person has used up today's allowance. */
  reached(username: string, now: Date): boolean {
    return this.today(username, now).count >= this.limit;
  }

  /** Counts one use, after it has succeeded. */
  record(username: string, now: Date): void {
    const entry = this.today(username, now);
    this.counts.set(username, { day: entry.day, count: entry.count + 1 });
  }
}

export const ADDS_PER_DAY = 5;
export const UPLOADS_PER_DAY = 20;
