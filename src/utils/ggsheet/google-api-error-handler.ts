/**
 * Google API Error Handler
 * Provides utilities for handling Google API errors, especially quota and rate limit errors
 */

export interface GoogleAPIError {
  status?: number;
  code?: number;
  message?: string;
  details?: any;
}

export interface ErrorRecoveryStrategy {
  shouldRetry: boolean;
  retryDelay: number;
  backoffMultiplier: number;
  maxRetries: number;
  isQuotaError: boolean;
  isRateLimitError: boolean;
  isTransientError: boolean;
}

/**
 * Classifies Google API errors and provides recovery strategies
 */
export class GoogleAPIErrorHandler {
  /**
   * Classify an error and determine recovery strategy
   */
  static classifyError(error: any): ErrorRecoveryStrategy {
    const status = error.status || error.code;
    const message = (error.message || '').toLowerCase();
    
    // Check for quota errors (most critical)
    const isQuotaError = status === 429 || 
                        message.includes('quota') || 
                        message.includes('resource exhausted');
    
    // Check for rate limit errors
    const isRateLimitError = status === 429 || 
                            message.includes('rate limit') || 
                            message.includes('too many requests');
    
    // Check for transient errors
    const isTransientError = status >= 500 && status < 600 ||
                            message.includes('temporary') ||
                            message.includes('service unavailable') ||
                            message.includes('internal error') ||
                            message.includes('timeout');
    
    // Determine retry strategy based on error type
    let shouldRetry = false;
    let retryDelay = 1000;
    let backoffMultiplier = 2;
    let maxRetries = 3;
    
    if (isQuotaError) {
      shouldRetry = true;
      retryDelay = 5000; // Start with 5 seconds for quota errors
      backoffMultiplier = 3; // More aggressive backoff
      maxRetries = 5; // More retries for quota errors
    } else if (isRateLimitError) {
      shouldRetry = true;
      retryDelay = 2000; // Start with 2 seconds for rate limits
      backoffMultiplier = 2;
      maxRetries = 4;
    } else if (isTransientError) {
      shouldRetry = true;
      retryDelay = 1000;
      backoffMultiplier = 2;
      maxRetries = 3;
    }
    
    return {
      shouldRetry,
      retryDelay,
      backoffMultiplier,
      maxRetries,
      isQuotaError,
      isRateLimitError,
      isTransientError
    };
  }
  
  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  static calculateRetryDelay(
    baseDelay: number, 
    attempt: number, 
    backoffMultiplier: number,
    maxDelay: number = 60000
  ): number {
    const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    return Math.min(exponentialDelay + jitter, maxDelay);
  }
  
  /**
   * Log error details for debugging
   */
  static logError(error: any, context: string = ''): void {
    const strategy = this.classifyError(error);
    const prefix = context ? `[${context}]` : '[GoogleAPIErrorHandler]';
    
    console.error(`${prefix} Google API Error:`, {
      status: error.status,
      code: error.code,
      message: error.message,
      isQuotaError: strategy.isQuotaError,
      isRateLimitError: strategy.isRateLimitError,
      isTransientError: strategy.isTransientError,
      shouldRetry: strategy.shouldRetry,
      retryDelay: strategy.retryDelay,
      maxRetries: strategy.maxRetries
    });
    
    if (strategy.isQuotaError) {
      console.warn(`${prefix} QUOTA ERROR DETECTED - This may require manual intervention or waiting for quota reset`);
    }
  }
  
  /**
   * Check if error is recoverable
   */
  static isRecoverable(error: any): boolean {
    const strategy = this.classifyError(error);
    return strategy.shouldRetry;
  }
  
  /**
   * Get recommended wait time before retry
   */
  static getRecommendedWaitTime(error: any, attempt: number = 1): number {
    const strategy = this.classifyError(error);
    if (!strategy.shouldRetry) return 0;
    
    return this.calculateRetryDelay(
      strategy.retryDelay,
      attempt,
      strategy.backoffMultiplier
    );
  }
}
