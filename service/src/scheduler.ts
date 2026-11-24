/**
 * The service's own daily jobs, in place of an outside scheduler (specs/deployment, "Scheduled
 * jobs run in the service"). There is one service container, so each job runs once a day. If
 * the container is down when a job is due, that day's run is missed; the nightly publish puts
 * right anything missed the next night.
 */
export interface DailyJob {
  name: string;
  /** The hour it runs, in UTC, on the hour. */
  hourUtc: number;
  run: () => Promise<unknown>;
}

export interface Clock {
  now: () => Date;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (timer: unknown) => void;
}

const realClock: Clock = {
  now: () => new Date(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
};

/** The next time after `now` that the clock reads `hourUtc`:00 UTC. */
export function nextRun(now: Date, hourUtc: number): Date {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc),
  );
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/**
 * Runs each job every day at its hour. A job still running when it is next due is skipped that
 * time, so two runs of one job never overlap. Returns a function that stops every timer.
 */
export function startScheduler(jobs: DailyJob[], clock: Clock = realClock): () => void {
  const timers = new Map<string, unknown>();
  const running = new Set<string>();
  let stopped = false;

  const schedule = (job: DailyJob) => {
    if (stopped) return;
    const at = nextRun(clock.now(), job.hourUtc);
    const ms = at.getTime() - clock.now().getTime();
    timers.set(
      job.name,
      clock.setTimer(() => void fire(job), ms),
    );
    console.log(JSON.stringify({ event: "job-scheduled", job: job.name, at: at.toISOString() }));
  };

  const fire = async (job: DailyJob) => {
    // Schedule the next run first, so a job that hangs can't stop tomorrow's.
    schedule(job);
    if (running.has(job.name)) {
      console.warn(JSON.stringify({ event: "job-skipped", job: job.name, reason: "running" }));
      return;
    }
    running.add(job.name);
    try {
      await job.run();
    } catch (err) {
      console.error(JSON.stringify({ event: "job-failed", job: job.name, error: String(err) }));
    } finally {
      running.delete(job.name);
    }
  };

  for (const job of jobs) schedule(job);
  return () => {
    stopped = true;
    for (const timer of timers.values()) clock.clearTimer(timer);
    timers.clear();
  };
}

/** Whether `SCHEDULED_JOBS` turns the jobs off (local development). */
export function jobsOff(setting: string | undefined): boolean {
  return ["off", "false", "0", "no"].includes((setting ?? "").trim().toLowerCase());
}
