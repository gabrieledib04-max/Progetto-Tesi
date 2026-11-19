/**
 * Token Bucket Rate Limiter
 * Ensures outgoing requests to Ticketmaster stay strictly within 5 req/s.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity = 5,
    private readonly refillRatePerSecond = 5
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    const addedTokens = elapsedSeconds * this.refillRatePerSecond;

    if (addedTokens > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + addedTokens);
      this.lastRefill = now;
    }
  }

  async acquireToken(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait until at least 1 token is available
    const waitTimeMs = Math.ceil(((1 - this.tokens) / this.refillRatePerSecond) * 1000);
    await new Promise((resolve) => setTimeout(resolve, Math.max(50, waitTimeMs)));
    return this.acquireToken();
  }
}

export const ticketmasterRateLimiter = new TokenBucket(5, 5);
