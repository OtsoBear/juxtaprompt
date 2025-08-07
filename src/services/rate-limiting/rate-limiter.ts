// src/services/rate-limiting/rate-limiter.ts
import type { RateLimitConfig, RateLimitState } from '@/types/app';
import { DEFAULT_RATE_LIMIT_CONFIG } from '@/types/app';

/**
 * Rate limiter with exponential backoff for LLM API requests
 * Prevents overwhelming APIs and handles rate limit responses gracefully
 */
export class RateLimiter {
  private state: RateLimitState;
  private readonly config: RateLimitConfig;
  private resetTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
    this.state = {
      requestCount: 0,
      lastResetTime: Date.now(),
      activeRequests: 0,
      backoffUntil: 0,
    };
  }

  /**
   * Check if a request can be made immediately
   */
  public canMakeRequest(): boolean {
    this.resetIfNeeded();
    
    // Check if we're in backoff period
    if (this.isInBackoff()) {
      return false;
    }
    
    // Check concurrent request limit
    if (this.state.activeRequests >= this.config.maxConcurrentRequests) {
      return false;
    }
    
    // Check rate limit
    if (this.state.requestCount >= this.config.maxRequestsPerMinute) {
      return false;
    }
    
    return true;
  }

  /**
   * Wait until a request can be made (with timeout)
   */
  public async waitForAvailability(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (!this.canMakeRequest()) {
      if (Date.now() - startTime > timeoutMs) {
        return false; // Timeout reached
      }
      
      // Calculate wait time
      const waitTime = this.calculateWaitTime();
      await this.sleep(Math.min(waitTime, 1000)); // Max 1 second per check
    }
    
    return true;
  }

  /**
   * Acquire a request slot (call before making request)
   */
  public acquireRequest(): boolean {
    if (!this.canMakeRequest()) {
      return false;
    }
    
    this.state = {
      ...this.state,
      requestCount: this.state.requestCount + 1,
      activeRequests: this.state.activeRequests + 1,
    };
    
    return true;
  }

  /**
   * Release a request slot (call after request completes)
   */
  public releaseRequest(): void {
    if (this.state.activeRequests > 0) {
      this.state = {
        ...this.state,
        activeRequests: this.state.activeRequests - 1,
      };
    }
  }

  /**
   * Handle rate limit response from API (triggers backoff)
   */
  public handleRateLimitResponse(retryAfterSeconds?: number): void {
    const backoffMs = retryAfterSeconds
      ? retryAfterSeconds * 1000
      : this.calculateBackoffTime();
    
    this.state = {
      ...this.state,
      backoffUntil: Date.now() + backoffMs,
    };
    
    console.warn(`Rate limited. Backing off for ${backoffMs}ms`);
  }

  /**
   * Handle successful request (resets backoff)
   */
  public handleSuccessfulRequest(): void {
    // Reset backoff on successful request
    this.state = {
      ...this.state,
      backoffUntil: 0,
    };
  }

  /**
   * Get current rate limiter statistics
   */
  public getStats(): {
    requestCount: number;
    activeRequests: number;
    isInBackoff: boolean;
    backoffTimeRemaining: number;
    timeUntilReset: number;
    canMakeRequest: boolean;
  } {
    this.resetIfNeeded();
    
    return {
      requestCount: this.state.requestCount,
      activeRequests: this.state.activeRequests,
      isInBackoff: this.isInBackoff(),
      backoffTimeRemaining: Math.max(0, this.state.backoffUntil - Date.now()),
      timeUntilReset: Math.max(0, (this.state.lastResetTime + 60000) - Date.now()),
      canMakeRequest: this.canMakeRequest(),
    };
  }

  /**
   * Reset rate limiter state
   */
  public reset(): void {
    this.state = {
      requestCount: 0,
      lastResetTime: Date.now(),
      activeRequests: 0,
      backoffUntil: 0,
    };
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Update rate limiter configuration
   */
  public updateConfig(newConfig: Partial<RateLimitConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Get current configuration
   */
  public getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  // Private helper methods

  private isInBackoff(): boolean {
    return Date.now() < this.state.backoffUntil;
  }

  private resetIfNeeded(): void {
    const now = Date.now();
    const timeSinceReset = now - this.state.lastResetTime;
    
    // Reset every minute
    if (timeSinceReset >= 60000) {
      this.state = {
        ...this.state,
        requestCount: 0,
        lastResetTime: now,
      };
      
      // Schedule next reset
      if (this.resetTimer) {
        clearTimeout(this.resetTimer);
      }
      
      this.resetTimer = setTimeout(() => {
        this.resetIfNeeded();
      }, 60000);
    }
  }

  private calculateWaitTime(): number {
    if (this.isInBackoff()) {
      return this.state.backoffUntil - Date.now();
    }
    
    // If we're at the rate limit, wait until reset
    if (this.state.requestCount >= this.config.maxRequestsPerMinute) {
      return (this.state.lastResetTime + 60000) - Date.now();
    }
    
    // If we're at concurrent limit, wait a short time
    if (this.state.activeRequests >= this.config.maxConcurrentRequests) {
      return 100; // 100ms
    }
    
    return 0;
  }

  private calculateBackoffTime(): number {
    // Exponential backoff: start at 1 second, double each time, max at config limit
    const baseBackoff = 1000; // 1 second
    const backoffMultiplier = Math.pow(this.config.backoffMultiplier, this.state.requestCount);
    const backoffTime = baseBackoff * backoffMultiplier;
    
    return Math.min(backoffTime, this.config.maxBackoffMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }
}

/**
 * Provider-specific rate limiters with different configurations
 */
export class ProviderRateLimiters {
  private limiters = new Map<string, RateLimiter>();

  /**
   * Get or create rate limiter for a provider
   */
  public getLimiter(provider: string, config?: Partial<RateLimitConfig>): RateLimiter {
    if (!this.limiters.has(provider)) {
      // Provider-specific configurations
      const providerConfigs: Record<string, Partial<RateLimitConfig>> = {
        openai: {
          maxRequestsPerMinute: 60,
          maxConcurrentRequests: 5,
        },
        anthropic: {
          maxRequestsPerMinute: 50,
          maxConcurrentRequests: 3,
        },
        gemini: {
          maxRequestsPerMinute: 60,
          maxConcurrentRequests: 4,
        },
      };

      const providerConfig = {
        ...providerConfigs[provider],
        ...config,
      };

      this.limiters.set(provider, new RateLimiter(providerConfig));
    }

    return this.limiters.get(provider)!;
  }

  /**
   * Get statistics for all providers
   */
  public getAllStats(): Record<string, ReturnType<RateLimiter['getStats']>> {
    const stats: Record<string, ReturnType<RateLimiter['getStats']>> = {};
    
    for (const [provider, limiter] of this.limiters) {
      stats[provider] = limiter.getStats();
    }
    
    return stats;
  }

  /**
   * Reset all rate limiters
   */
  public resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }

  /**
   * Cleanup all rate limiters
   */
  public dispose(): void {
    for (const limiter of this.limiters.values()) {
      limiter.dispose();
    }
    this.limiters.clear();
  }
}

// Export singleton instance
export const providerRateLimiters = new ProviderRateLimiters();