/**
 * Google API Quota Monitor
 * Monitors quota usage and provides recovery strategies for quota exhaustion
 */

export interface QuotaStatus {
  isExhausted: boolean;
  estimatedResetTime?: Date;
  recommendedWaitTime: number;
  recoveryStrategy: 'wait' | 'reduce_batch_size' | 'increase_delays' | 'manual_intervention';
}

export interface QuotaRecoveryOptions {
  reduceBatchSize: boolean;
  increaseDelays: boolean;
  maxWaitTime: number; // in milliseconds
}

export class GoogleAPIQuotaMonitor {
  private quotaErrors: Array<{
    timestamp: Date;
    error: any;
    context: string;
  }> = [];
  
  private readonly maxQuotaErrors = 10; // Keep last 10 quota errors
  private readonly quotaResetWindow = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  /**
   * Record a quota error for monitoring
   */
  recordQuotaError(error: any, context: string = ''): void {
    const quotaError = {
      timestamp: new Date(),
      error,
      context
    };

    this.quotaErrors.push(quotaError);
    
    // Keep only the last maxQuotaErrors
    if (this.quotaErrors.length > this.maxQuotaErrors) {
      this.quotaErrors.shift();
    }

    console.log(`[QuotaMonitor] Quota error recorded:`, {
      context,
      timestamp: quotaError.timestamp.toISOString(),
      error: error.message || error,
      totalQuotaErrors: this.quotaErrors.length
    });
  }

  /**
   * Analyze quota status and provide recovery recommendations
   */
  analyzeQuotaStatus(): QuotaStatus {
    const recentQuotaErrors = this.quotaErrors.filter(
      error => Date.now() - error.timestamp.getTime() < this.quotaResetWindow
    );

    if (recentQuotaErrors.length === 0) {
      return {
        isExhausted: false,
        recommendedWaitTime: 0,
        recoveryStrategy: 'wait'
      };
    }

    // Check if we have multiple quota errors in a short time
    const recentErrors = recentQuotaErrors.filter(
      error => Date.now() - error.timestamp.getTime() < 60 * 60 * 1000 // Last hour
    );

    if (recentErrors.length >= 3) {
      // Multiple quota errors in short time - likely exhausted
      return {
        isExhausted: true,
        estimatedResetTime: this.estimateQuotaResetTime(),
        recommendedWaitTime: 30 * 60 * 1000, // 30 minutes
        recoveryStrategy: 'manual_intervention'
      };
    } else if (recentErrors.length >= 2) {
      // Moderate quota issues - reduce batch size and increase delays
      return {
        isExhausted: false,
        estimatedResetTime: this.estimateQuotaResetTime(),
        recommendedWaitTime: 15 * 60 * 1000, // 15 minutes
        recoveryStrategy: 'reduce_batch_size'
      };
    } else {
      // Single quota error - wait and retry
      return {
        isExhausted: false,
        estimatedResetTime: this.estimateQuotaResetTime(),
        recommendedWaitTime: 5 * 60 * 1000, // 5 minutes
        recoveryStrategy: 'wait'
      };
    }
  }

  /**
   * Get recommended configuration adjustments based on quota status
   */
  getRecommendedConfig(quotaStatus: QuotaStatus): {
    batchSize: number;
    delayMultiplier: number;
    retryMultiplier: number;
  } {
    switch (quotaStatus.recoveryStrategy) {
      case 'reduce_batch_size':
        return {
          batchSize: 25, // Reduce from 50 to 25
          delayMultiplier: 2, // Double delays
          retryMultiplier: 1.5 // Increase retry delays
        };
      
      case 'increase_delays':
        return {
          batchSize: 50, // Keep current batch size
          delayMultiplier: 3, // Triple delays
          retryMultiplier: 2 // Double retry delays
        };
      
      case 'manual_intervention':
        return {
          batchSize: 10, // Drastically reduce batch size
          delayMultiplier: 5, // 5x delays
          retryMultiplier: 3 // 3x retry delays
        };
      
      default:
        return {
          batchSize: 50, // Default batch size
          delayMultiplier: 1, // No delay increase
          retryMultiplier: 1 // No retry delay increase
        };
    }
  }

  /**
   * Estimate when quota will reset based on Google's typical reset schedule
   */
  private estimateQuotaResetTime(): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Start of next day
    
    // Google typically resets quotas at midnight PST (UTC-8)
    // Adjust to UTC
    tomorrow.setUTCHours(8, 0, 0, 0); // 8 AM UTC = midnight PST
    
    return tomorrow;
  }

  /**
   * Get quota monitoring statistics
   */
  getStats(): {
    totalQuotaErrors: number;
    recentQuotaErrors: number;
    lastQuotaError?: Date;
    estimatedResetTime?: Date;
  } {
    const recentQuotaErrors = this.quotaErrors.filter(
      error => Date.now() - error.timestamp.getTime() < this.quotaResetWindow
    );

    return {
      totalQuotaErrors: this.quotaErrors.length,
      recentQuotaErrors: recentQuotaErrors.length,
      lastQuotaError: this.quotaErrors.length > 0 ? this.quotaErrors[this.quotaErrors.length - 1].timestamp : undefined,
      estimatedResetTime: this.estimateQuotaResetTime()
    };
  }

  /**
   * Clear quota error history (useful for testing or after quota reset)
   */
  clearHistory(): void {
    this.quotaErrors = [];
    console.log('[QuotaMonitor] Quota error history cleared');
  }

  /**
   * Check if system should pause operations due to quota exhaustion
   */
  shouldPauseOperations(): boolean {
    const status = this.analyzeQuotaStatus();
    return status.recoveryStrategy === 'manual_intervention';
  }

  /**
   * Get recommended pause duration
   */
  getRecommendedPauseDuration(): number {
    const status = this.analyzeQuotaStatus();
    return status.recommendedWaitTime;
  }
}
