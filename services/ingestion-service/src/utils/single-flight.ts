/**
 * Single-Flight Request Coalescer
 * Coalesces concurrent calls for the same key into a single promise execution.
 */
export class SingleFlight<T> {
  private inFlight = new Map<string, Promise<T>>();

  async do(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        return await fn();
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }
}
