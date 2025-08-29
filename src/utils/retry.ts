import { GoogleAPIErrorHandler } from './ggsheet/google-api-error-handler.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
  jitter?: boolean;
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
      jitter: options.jitter ?? true,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: any;
    let delay = this.options.baseDelay;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        if (
          attempt === this.options.maxRetries ||
          !this.options.shouldRetry(error)
        ) {
          console.error(`[RetryManager] Final attempt ${attempt + 1} failed:`, {
            error: (error as any).message || error,
            status: (error as any).status,
            code: (error as any).code,
            attempt,
            maxRetries: this.options.maxRetries
          });
          throw error;
        }

        // Use Google API error handler for better delay calculation
        const errorStrategy = GoogleAPIErrorHandler.classifyError(error);
        if (errorStrategy.shouldRetry) {
          delay = GoogleAPIErrorHandler.calculateRetryDelay(
            errorStrategy.retryDelay,
            attempt + 1,
            errorStrategy.backoffMultiplier,
            this.options.maxDelay
          );
        } else {
          // Fall back to default exponential backoff
          delay = Math.min(
            delay * this.options.backoffMultiplier,
            this.options.maxDelay
          );
        }

        // Add jitter to prevent thundering herd
        const jitteredDelay = this.options.jitter 
          ? delay + Math.random() * delay * 0.1 
          : delay;

        console.log(`[RetryManager] Attempt ${attempt + 1} failed, retrying in ${Math.round(jitteredDelay)}ms...`, {
          error: (error as any).message || error,
          status: (error as any).status,
          code: (error as any).code,
          attempt,
          maxRetries: this.options.maxRetries,
          errorType: errorStrategy.isQuotaError ? 'QUOTA_ERROR' : 
                    errorStrategy.isRateLimitError ? 'RATE_LIMIT_ERROR' : 
                    errorStrategy.isTransientError ? 'TRANSIENT_ERROR' : 'UNKNOWN'
        });

        await this.delay(jitteredDelay);
      }
    }

    throw lastError;
  }

  private defaultShouldRetry(error: any): boolean {
    // Use Google API error handler for classification
    return GoogleAPIErrorHandler.isRecoverable(error);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
