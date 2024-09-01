interface BackoffData {
  retryCount: number;
  lastRetryTimestamp: number;
}

export class BackoffController {
  private minDelay: number;
  private maxDelay: number;
  private backOffs: Map<string, BackoffData>;

  constructor(minDelay: number = 1000, maxDelay: number = 16000) {
    this.minDelay = minDelay;
    this.maxDelay = maxDelay;
    this.backOffs = new Map();
  }

  public nextDelay(key: string): number {
    const now = Date.now();
    let data = this.backOffs.get(key);

    if (!data) {
      data = { retryCount: 0, lastRetryTimestamp: now };
      this.backOffs.set(key, data);
    }

    if (now - data.lastRetryTimestamp > this.maxDelay) {
      data.retryCount = 0;
      return null;
    }

    const delay = Math.min(this.minDelay * 2 ** data.retryCount, this.maxDelay);
    data.retryCount++;
    data.lastRetryTimestamp = now;

    return delay + this.randomJitter();
  }

  public reset(key: string): void {
    this.backOffs.delete(key);
  }

  private randomJitter(): number {
    return Math.floor(Math.random() * 100);
  }
}
