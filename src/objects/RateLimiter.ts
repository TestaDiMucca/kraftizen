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
  setLimitForKey = (key: string, options: RateLimitOptions): void => {
    this.limits.set(key, options);
  };

  resetKey = (key: RateLimiterKeys | string) => {
    delete this.counts[key];
  };

  /** Check if the request can go through */
  tryCall = (key: RateLimiterKeys | string, id?: string): boolean => {
    const options = this.limits.get(key) || this.defaultOptions;
    const now = Date.now();
    const record = this.counts.get(id ? `${key}-${id}` : key);

    if (!record || now - record.lastReset > options.windowMs) {
      this.counts.set(key, { count: 1, lastReset: now });
      return true;
    } else if (record.count < options.max) {
      record.count++;
      return true;
    }

    return false;
  };
}

export enum RateLimiterKeys {
  checkChests = 'checkChests',
  unarmedGuard = 'unarmedGuard',
  findBed = 'findBed',
  demandHelp = 'demandHelp',
  findSeeds = 'findSeeds',
}

/** Global limiter */
export default new RateLimiter({
  windowMs: 1000 * 60 /* once a min */,
  max: 1,
});

export const getRateLimiter = () => {
  const rateLimiter = new RateLimiter({
    windowMs: 1000 * 60 /* once a min */,
    max: 1,
  });

  /* Apply defaults */
  rateLimiter.setLimitForKey('checkChests', {
    max: 1,
    windowMs: 1000 * 60 * 5,
  });

  rateLimiter.setLimitForKey(RateLimiterKeys.findSeeds, {
    max: 1,
    windowMs: 1000 * 60 * 10,
  });

  rateLimiter.setLimitForKey('unarmedGuard', {
    max: 1,
    windowMs: 1000 * 60 * 30,
  });

  rateLimiter.setLimitForKey('findBed', {
    max: 1,
    windowMs: 1000 * 60 * 60 * 10,
  });

  rateLimiter.setLimitForKey('demandHelp', {
    max: 1,
    windowMs: 1000 * 30,
  });

  return rateLimiter;
};
