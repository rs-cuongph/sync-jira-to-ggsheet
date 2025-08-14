export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

export class RetryManager {
  private options: Required<RetryOptions>;

  constructor(options: RetryOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      baseDelay: options.baseDelay ?? 1000,
      maxDelay: options.maxDelay ?? 30000,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      shouldRetry: options.shouldRetry ?? this.defaultShouldRetry,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: any;
    let delay = this.options.baseDelay;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (
          attempt === this.options.maxRetries ||
          !this.options.shouldRetry(error)
        ) {
          throw error;
        }

        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await this.delay(delay);
        delay = Math.min(
          delay * this.options.backoffMultiplier,
          this.options.maxDelay
        );
      }
    }

    throw lastError;
  }

  private defaultShouldRetry(error: any): boolean {
    // Retry on 429 (rate limit) and 5xx errors
    if (error.code === 429) {
      return true;
    }

    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // Retry on network errors
    if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
      return true;
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
