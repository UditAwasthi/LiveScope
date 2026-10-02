export type BreakerState = 'closed' | 'open' | 'half-open';

export class UnavailableError extends Error {
  readonly code = 'UNAVAILABLE';

  constructor(message = 'circuit open') {
    super(message);
    this.name = 'UnavailableError';
  }
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private state: BreakerState = 'closed';

  constructor(private readonly options: { failureThreshold: number; resetMs: number }) {}

  current(now = Date.now()): BreakerState {
    if (this.state === 'open' && now - this.openedAt >= this.options.resetMs) {
      this.state = 'half-open';
    }
    return this.state;
  }

  async exec<T>(fn: () => Promise<T>, now = Date.now()): Promise<T> {
    const state = this.current(now);
    if (state === 'open') throw new UnavailableError();
    try {
      const value = await fn();
      this.failures = 0;
      this.state = 'closed';
      return value;
    } catch (error) {
      this.failures += 1;
      if (this.failures >= this.options.failureThreshold || state === 'half-open') {
        this.state = 'open';
        this.openedAt = now;
      }
      throw error;
    }
  }
}
