interface RateLimitOptions {
  /** Time window, in ms */
  windowMs: number;
  /** Allowed calls during each window */
  max: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitOptions>();
  private counts = new Map<string, { count: number; lastReset: number }>();

  constructor(private defaultOptions: RateLimitOptions) {}

  /** Set custom limit for a specific key */
  setLimitForKey(key: string, options: RateLimitOptions): void {
    this.limits.set(key, options);
  }

  /** Check if the request can go through */
  tryCall(key: string, id?: string): boolean {
    const options = this.limits.get(key) || this.defaultOptions;
    const now = Date.now();
    const record = this.counts.get(`${key}-${id}`);

    if (!record || now - record.lastReset > options.windowMs) {
      this.counts.set(key, { count: 1, lastReset: now });
      return true;
    } else if (record.count < options.max) {
      record.count++;
      return true;
    }

    return false;
  }
}

export default new RateLimiter({
  windowMs: 1000 * 60 /* once a min */,
  max: 1,
});
