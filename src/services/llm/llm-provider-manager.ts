// src/services/llm/llm-provider-manager.ts
import type {
  ILLMProvider,
  LLMProvider,
  LLMRequest,
  LLMStreamChunk,
  LLMConfig,
  ValidationResult,
  AvailableModelsResult
} from '@/types/llm';
import { LLMProviderError } from './base-llm-provider';

/**
 * Manager class for handling multiple LLM providers
 */
export class LLMProviderManager {
  private readonly providers = new Map<LLMProvider, ILLMProvider>();
  private readonly activeRequests = new Map<string, AbortController>();

  /**
   * Register an LLM provider
   */
  public registerProvider(provider: ILLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Get a registered provider
   */
  public getProvider(name: LLMProvider): ILLMProvider | null {
    return this.providers.get(name) ?? null;
  }

  /**
   * Get all registered provider names
   */
  public getRegisteredProviders(): LLMProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered
   */
  public hasProvider(name: LLMProvider): boolean {
    return this.providers.has(name);
  }

  /**
   * Send streaming request using the specified provider
   */
  public async* sendStreamingRequest(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const provider = this.getProvider(request.config.provider);
    if (!provider) {
      throw new LLMProviderError({
        code: 'PROVIDER_NOT_FOUND',
        message: `Provider '${request.config.provider}' is not registered`,
        retryable: false,
      });
    }

    // Validate configuration
    const validation = provider.validateConfig(request.config);
    if (!validation.success) {
      throw new LLMProviderError({
        code: 'INVALID_CONFIG',
        message: `Invalid configuration: ${validation.error.message}`,
        retryable: false,
        details: validation.error.details,
      });
    }

    // Create abort controller for this request
    const controller = new AbortController();
    this.activeRequests.set(request.id, controller);

    try {
      // Send the request
      for await (const chunk of provider.sendStreamingRequest(request)) {
        // Check if request was cancelled
        if (controller.signal.aborted) {
          yield {
            requestId: request.id,
            content: '',
            isComplete: true,
          };
          return;
        }

        yield chunk;
      }
    } finally {
      // Clean up
      this.activeRequests.delete(request.id);
    }
  }

  /**
   * Cancel an active request
   */
  public cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all active requests
   */
  public cancelAllRequests(): void {
    for (const controller of this.activeRequests.values()) {
      controller.abort();
    }
    this.activeRequests.clear();
  }

  /**
   * Get the number of active requests
   */
  public getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Get active request IDs
   */
  public getActiveRequestIds(): string[] {
    return Array.from(this.activeRequests.keys());
  }

  /**
   * Get available models for a specific provider
   */
  public async getAvailableModels(
    providerName: LLMProvider,
    apiKey: string,
    baseUrl?: string
  ): Promise<AvailableModelsResult> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new LLMProviderError({
        code: 'PROVIDER_NOT_FOUND',
        message: `Provider '${providerName}' is not registered`,
        retryable: false,
      });
    }

    return provider.getAvailableModels(apiKey, baseUrl);
  }

  /**
   * Clear model cache for a specific provider
   */
  public clearModelCache(providerName: LLMProvider): void {
    const provider = this.getProvider(providerName);
    if (provider && 'clearModelCache' in provider) {
      (provider as any).clearModelCache();
    }
  }

  /**
   * Clear model cache for all providers
   */
  public clearAllModelCaches(): void {
    for (const provider of this.providers.values()) {
      if ('clearModelCache' in provider) {
        (provider as any).clearModelCache();
      }
    }
  }

  /**
   * Validate configuration for a specific provider
   */
  public validateConfig(providerName: LLMProvider, config: Partial<LLMConfig>): ValidationResult<LLMConfig> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_NOT_FOUND',
          message: `Provider '${providerName}' is not registered`,
        },
      };
    }

    return provider.validateConfig(config);
  }

  /**
   * Create a request object with validation
   */
  public createRequest(
    prompt: string, 
    config: LLMConfig, 
    id?: string
  ): ValidationResult<LLMRequest> {
    // Validate the configuration
    const validation = this.validateConfig(config.provider, config);
    if (!validation.success) {
      return validation as ValidationResult<LLMRequest>;
    }

    const request: LLMRequest = {
      id: id ?? this.generateRequestId(config.provider),
      prompt,
      config: validation.data,
      timestamp: Date.now(),
    };

    return {
      success: true,
      data: request,
    };
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(provider: LLMProvider): string {
    return `${provider}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get provider statistics
   */
  public getProviderStats(): Record<LLMProvider, {
    registered: boolean;
    activeRequests: number;
  }> {
    const stats: Record<string, { registered: boolean; activeRequests: number }> = {};
    
    // Initialize all known providers
    const allProviders: LLMProvider[] = ['openai', 'anthropic', 'gemini'];
    for (const provider of allProviders) {
      stats[provider] = {
        registered: this.hasProvider(provider),
        activeRequests: 0,
      };
    }

    // Count active requests per provider
    for (const requestId of this.activeRequests.keys()) {
      const provider = requestId.split('_')[0] as LLMProvider;
      if (stats[provider]) {
        stats[provider].activeRequests++;
      }
    }

    return stats as Record<LLMProvider, { registered: boolean; activeRequests: number }>;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.cancelAllRequests();
    this.providers.clear();
  }
}

// Export singleton instance
export const llmProviderManager = new LLMProviderManager();