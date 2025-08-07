// src/services/llm/base-llm-provider.ts
import type {
  ILLMProvider,
  LLMRequest,
  LLMStreamChunk,
  LLMConfig,
  LLMError,
  ValidationResult,
  LLMProvider,
  ModelInfo,
  AvailableModelsResult
} from '@/types/llm';
import { validateLLMConfig } from '@/schemas/llm-schemas';

/**
 * Custom error class for LLM-related errors
 */
export class LLMProviderError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly statusCode?: number;
  public readonly details?: unknown;

  constructor(error: LLMError) {
    super(error.message);
    this.name = 'LLMProviderError';
    this.code = error.code;
    this.retryable = error.retryable;
    if (error.statusCode !== undefined) {
      this.statusCode = error.statusCode;
    }
    if (error.details !== undefined) {
      this.details = error.details;
    }
  }
}

/**
 * Abstract base class for LLM providers with common functionality
 */
export abstract class BaseLLMProvider implements ILLMProvider {
  public abstract readonly name: LLMProvider;
  
  protected readonly defaultTimeout = 30000; // 30 seconds
  protected readonly maxRetries = 3;
  
  // Model caching
  private modelCache: Map<string, { models: ModelInfo[]; timestamp: number }> = new Map();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Send streaming request to the LLM provider
   */
  public abstract sendStreamingRequest(request: LLMRequest): AsyncIterable<LLMStreamChunk>;

  /**
   * Get available models from the provider API
   */
  public async getAvailableModels(apiKey: string, baseUrl?: string): Promise<AvailableModelsResult> {
    const cacheKey = `${this.name}_${apiKey.slice(-8)}_${baseUrl || 'default'}`;
    const cached = this.modelCache.get(cacheKey);
    
    // Return cached result if still valid
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return {
        models: cached.models,
        cached: true,
        timestamp: cached.timestamp,
      };
    }

    try {
      const models = await this.fetchAvailableModels(apiKey, baseUrl);
      
      // Cache the result
      this.modelCache.set(cacheKey, {
        models,
        timestamp: Date.now(),
      });

      return {
        models,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      // If API call fails, return cached result if available, otherwise fallback to static models
      if (cached) {
        console.warn(`Failed to fetch models for ${this.name}, using cached result:`, error);
        return {
          models: cached.models,
          cached: true,
          timestamp: cached.timestamp,
        };
      }
      
      // Fallback to static models
      console.warn(`Failed to fetch models for ${this.name}, using fallback:`, error);
      return {
        models: this.getFallbackModels(),
        cached: false,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Fetch available models from the provider API (to be implemented by subclasses)
   */
  protected abstract fetchAvailableModels(apiKey: string, baseUrl?: string): Promise<ModelInfo[]>;

  /**
   * Get fallback models when API call fails (to be implemented by subclasses)
   */
  protected abstract getFallbackModels(): ModelInfo[];

  /**
   * Clear model cache
   */
  public clearModelCache(): void {
    this.modelCache.clear();
  }

  /**
   * Validate LLM configuration
   */
  public validateConfig(config: Partial<LLMConfig>): ValidationResult<LLMConfig> {
    return validateLLMConfig(config);
  }

  /**
   * Create a standardized LLM error
   */
  protected createError(
    code: string,
    message: string,
    retryable: boolean = false,
    statusCode?: number,
    details?: unknown
  ): LLMError {
    const error: LLMError = {
      code,
      message,
      retryable,
      ...(statusCode !== undefined && { statusCode }),
      ...(details !== undefined && { details }),
    };
    
    return error;
  }

  /**
   * Handle HTTP response errors
   */
  protected async handleHTTPError(response: Response): Promise<LLMError> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let details: unknown;

    try {
      const errorBody = await response.text();
      if (errorBody) {
        try {
          details = JSON.parse(errorBody);
          // Try to extract a more specific error message
          if (typeof details === 'object' && details !== null) {
            const errorObj = details as Record<string, unknown>;
            if (errorObj['error'] && typeof errorObj['error'] === 'object') {
              const error = errorObj['error'] as Record<string, unknown>;
              if (typeof error['message'] === 'string') {
                errorMessage = error['message'];
              }
            } else if (typeof errorObj['message'] === 'string') {
              errorMessage = errorObj['message'];
            }
          }
        } catch {
          // If JSON parsing fails, use the raw text as details
          details = errorBody;
        }
      }
    } catch {
      // If reading response body fails, use default message
    }

    const retryable = response.status >= 500 || response.status === 429;
    
    return this.createError(
      `HTTP_${response.status}`,
      errorMessage,
      retryable,
      response.status,
      details
    );
  }

  /**
   * Handle network errors
   */
  protected handleNetworkError(error: unknown): LLMError {
    const message = error instanceof Error ? error.message : 'Unknown network error';
    return this.createError('NETWORK_ERROR', message, true, undefined, error);
  }

  /**
   * Handle parsing errors
   */
  protected handleParsingError(error: unknown, data?: unknown): LLMError {
    const message = error instanceof Error ? error.message : 'Failed to parse response';
    return this.createError('PARSING_ERROR', message, false, undefined, { error, data });
  }

  /**
   * Create HTTP headers for API requests
   */
  protected createHeaders(apiKey: string, additionalHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'Juxtaprompt/1.0.0',
      ...additionalHeaders,
      ...this.getAuthHeaders(apiKey),
    };
  }

  /**
   * Get authentication headers (to be implemented by subclasses)
   */
  protected abstract getAuthHeaders(apiKey: string): Record<string, string>;

  /**
   * Create request body for the API call
   */
  protected abstract createRequestBody(request: LLMRequest): Record<string, unknown>;

  /**
   * Parse streaming response chunk
   */
  protected abstract parseStreamChunk(data: string, requestId: string): LLMStreamChunk | null;

  /**
   * Validate streaming response chunk
   */
  protected abstract validateStreamChunk(data: unknown): ValidationResult<unknown>;

  /**
   * Process Server-Sent Events stream
   */
  protected async* processSSEStream(
    response: Response, 
    requestId: string
  ): AsyncIterable<LLMStreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new LLMProviderError(this.createError(
        'NO_RESPONSE_BODY',
        'No response body received',
        false
      ));
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield {
                requestId,
                content: '',
                isComplete: true,
              };
              return;
            }

            try {
              const chunk = this.parseStreamChunk(data, requestId);
              if (chunk) {
                yield chunk;
              }
            } catch (parseError) {
              console.warn(`Failed to parse SSE data: ${data}`, parseError);
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Make HTTP request with error handling
   */
  protected async makeRequest(
    url: string, 
    options: RequestInit, 
    timeout: number = this.defaultTimeout
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await this.handleHTTPError(response);
        throw new LLMProviderError(error);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof LLMProviderError) {
        throw error;
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LLMProviderError(this.createError(
          'TIMEOUT_ERROR',
          `Request timed out after ${timeout}ms`,
          true
        ));
      }
      
      const networkError = this.handleNetworkError(error);
      throw new LLMProviderError(networkError);
    }
  }

  /**
   * Generate unique request ID
   */
  protected generateRequestId(): string {
    return `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log request for debugging (can be overridden)
   */
  protected logRequest(request: LLMRequest): void {
    // Only log in development mode (when not in production build)
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.log(`[${this.name}] Sending request:`, {
        id: request.id,
        prompt: request.prompt.substring(0, 100) + '...',
        model: request.config.model,
        timestamp: request.timestamp,
      });
    }
  }

  /**
   * Log response for debugging (can be overridden)
   */
  protected logResponse(chunk: LLMStreamChunk): void {
    // Only log in development mode (when not in production build)
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost' && chunk.isComplete) {
      console.log(`[${this.name}] Request completed:`, {
        requestId: chunk.requestId,
        tokenCount: chunk.tokenCount,
      });
    }
  }
}