export class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastCallTime = 0;
  private minInterval: number;
  private batchSize: number;
  private batchDelay: number;

  constructor(
    minIntervalMs: number = 1000, // 1 second between batch API calls
    batchSize: number = 1000, // 1000 rows per batch
    batchDelay: number = 100 // 100ms between operations within batch
  ) {
    this.minInterval = minIntervalMs;
    this.batchSize = batchSize;
    this.batchDelay = batchDelay;
  }

  /**
   * Execute a single function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  /**
   * Execute multiple functions in batches with optimized rate limiting
   */
  async executeBatch<T>(
    functions: Array<() => Promise<T>>,
    options?: {
      batchSize?: number;
      parallelInBatch?: boolean;
    }
  ): Promise<T[]> {
    const batchSize = options?.batchSize ?? this.batchSize;
    const parallelInBatch = options?.parallelInBatch ?? false;
    const results: T[] = [];

    // Process functions in batches
    for (let i = 0; i < functions.length; i += batchSize) {
      const batch = functions.slice(i, i + batchSize);

      if (parallelInBatch) {
        // Execute batch in parallel with small delays
        const batchPromises = batch.map((fn, index) =>
          this.delay(index * this.batchDelay).then(() => fn())
        );
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } else {
        // Execute batch sequentially
        for (const fn of batch) {
          const result = await fn();
          results.push(result);
          await this.delay(this.batchDelay);
        }
      }

      // Rate limit between batches
      if (i + batchSize < functions.length) {
        await this.delay(this.minInterval);
      }
    }

    return results;
  }

  /**
   * Execute a batch operation with rate limiting
   */
  async executeBatchOperation<T>(
    batchFn: (items: any[]) => Promise<T>,
    items: any[],
    options?: { batchSize?: number }
  ): Promise<T[]> {
    const batchSize = options?.batchSize ?? this.batchSize;
    const results: T[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const result = await this.execute(() => batchFn(batch));
      results.push(result);

      // Rate limit between batches
      if (i + batchSize < items.length) {
        await this.delay(this.minInterval);
      }
    }

    return results;
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastCall = now - this.lastCallTime;

      if (timeSinceLastCall < this.minInterval) {
        await this.delay(this.minInterval - timeSinceLastCall);
      }

      const task = this.queue.shift();
      if (task) {
        this.lastCallTime = Date.now();
        await task();
      }
    }

    this.processing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
