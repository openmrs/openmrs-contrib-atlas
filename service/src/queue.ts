/**
 * Runs sheet writes and publishes one at a time, so they can't overwrite one another.
 * The service runs as a single Cloud Run instance, so one queue in memory is enough.
 */
export class WriteQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private waiting: Promise<unknown> | undefined;

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    this.tail = result.catch(() => undefined);
    return result;
  }

  /** Like run, but callers who arrive before the task starts share its one run. */
  shared<T>(task: () => Promise<T>): Promise<T> {
    if (this.waiting) return this.waiting as Promise<T>;
    const result = this.run(() => {
      this.waiting = undefined;
      return task();
    });
    this.waiting = result;
    return result;
  }
}
