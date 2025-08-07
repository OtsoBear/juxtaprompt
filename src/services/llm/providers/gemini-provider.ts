// src/services/llm/providers/gemini-provider.ts
import { BaseLLMProvider, LLMProviderError } from '../base-llm-provider';
import type { LLMRequest, LLMStreamChunk, ValidationResult } from '@/types/llm';
import { validateGeminiResponse, type GeminiStreamChunk } from '@/schemas/llm-schemas';

/**
 * Google Gemini provider implementation with streaming support and validation
 */
export class GeminiProvider extends BaseLLMProvider {
  public readonly name = 'gemini' as const;

  /**
   * Send streaming request to Gemini API
   */
  public async* sendStreamingRequest(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    this.logRequest(request);

    const url = `${request.config.baseUrl}/models/${request.config.model}:streamGenerateContent`;
    const headers = this.createHeaders(request.config.apiKey);
    const body = this.createRequestBody(request);

    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      yield* this.processSSEStream(response, request.id);
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }
      
      const networkError = this.handleNetworkError(error);
      throw new LLMProviderError(networkError);
    }
  }

  /**
   * Get authentication headers for Gemini
   */
  protected getAuthHeaders(apiKey: string): Record<string, string> {
    // Gemini uses API key as query parameter, but we'll also include it in headers
    return {};
  }

  /**
   * Create request body for Gemini API
   */
  protected createRequestBody(request: LLMRequest): Record<string, unknown> {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    
    // Add system instruction if provided
    const systemInstruction = request.config.systemMessage.trim() 
      ? { parts: [{ text: request.config.systemMessage }] }
      : undefined;
    
    // Add user message
    contents.push({
      role: 'user',
      parts: [{ text: request.prompt }],
    });

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.config.temperature,
        maxOutputTokens: request.config.maxTokens,
        topP: request.config.topP,
      },
    };

    if (systemInstruction) {
      body['systemInstruction'] = systemInstruction;
    }

    return body;
  }

  /**
   * Parse streaming response chunk from Gemini
   */
  protected parseStreamChunk(data: string, requestId: string): LLMStreamChunk | null {
    try {
      const parsed = JSON.parse(data);
      const validation = this.validateStreamChunk(parsed);
      
      if (!validation.success) {
        console.warn('Invalid Gemini response format:', validation.error);
        return null;
      }

      const chunk = validation.data as GeminiStreamChunk;
      const candidate = chunk.candidates?.[0];
      
      if (!candidate) {
        return null;
      }

      const content = candidate.content?.parts?.[0]?.text || '';
      const isComplete = candidate.finishReason !== undefined;

      const streamChunk: LLMStreamChunk = {
        requestId,
        content,
        isComplete,
      };

      if (isComplete) {
        this.logResponse(streamChunk);
      }

      return streamChunk;
    } catch (error) {
      console.warn('Failed to parse Gemini stream chunk:', error);
      return null;
    }
  }

  /**
   * Validate streaming response chunk
   */
  protected validateStreamChunk(data: unknown): ValidationResult<GeminiStreamChunk> {
    return validateGeminiResponse(data);
  }

  /**
   * Process Server-Sent Events stream for Gemini
   */
  protected override async* processSSEStream(
    response: Response, 
    requestId: string
  ): AsyncIterable<LLMStreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new LLMProviderError(this.createError(
        'NO_RESPONSE_BODY',
        'No response body received from Gemini',
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
          const trimmedLine = line.trim();
          
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);
            
            // Skip empty data
            if (!data || data === '{}') {
              continue;
            }

            // Parse and yield chunk
            const chunk = this.parseStreamChunk(data, requestId);
            if (chunk) {
              yield chunk;
              
              // If this chunk indicates completion, stop processing
              if (chunk.isComplete) {
                return;
              }
            }
          }
        }
      }
    } catch (error) {
      const parseError = this.handleParsingError(error);
      throw new LLMProviderError(parseError);
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Make HTTP request with Gemini-specific URL parameters
   */
  protected override async makeRequest(
    url: string, 
    options: RequestInit, 
    timeout: number = this.defaultTimeout
  ): Promise<Response> {
    // Add API key as query parameter for Gemini
    const urlWithKey = new URL(url);
    
    // Extract API key from Authorization header if present
    const headers = options.headers as Record<string, string> || {};
    let apiKey = '';
    
    // Find API key in the request config (we need to extract it from the body)
    if (options.body && typeof options.body === 'string') {
      try {
        // We'll get the API key from the headers we set earlier
        // For Gemini, we need to add it as a query parameter
        const authHeader = headers['Authorization'];
        if (authHeader?.startsWith('Bearer ')) {
          apiKey = authHeader.slice(7);
        }
      } catch {
        // If we can't extract the API key, the request will fail with auth error
      }
    }
    
    if (apiKey) {
      urlWithKey.searchParams.set('key', apiKey);
      // Remove the Authorization header since Gemini uses query param
      delete headers['Authorization'];
    }

    return super.makeRequest(urlWithKey.toString(), {
      ...options,
      headers,
    }, timeout);
  }

  /**
   * Get authentication headers for Gemini (override to include Bearer for extraction)
   */
  protected override createHeaders(apiKey: string, additionalHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'Juxtaprompt/1.0.0',
      'Authorization': `Bearer ${apiKey}`, // Temporary for extraction
      ...additionalHeaders,
    };
  }

  /**
   * Handle Gemini-specific errors
   */
  protected override async handleHTTPError(response: Response): Promise<import('@/types/llm').LLMError> {
    let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`;
    let details: unknown;

    try {
      const errorBody = await response.text();
      if (errorBody) {
        try {
          const errorData = JSON.parse(errorBody);
          details = errorData;
          
          // Extract Gemini-specific error message
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          details = errorBody;
        }
      }
    } catch {
      // Use default message if we can't read the response
    }

    // Determine if error is retryable
    const retryable = response.status >= 500 || 
                     response.status === 429 || 
                     response.status === 408;

    return this.createError(
      `GEMINI_HTTP_${response.status}`,
      errorMessage,
      retryable,
      response.status,
      details
    );
  }

  /**
   * Validate Gemini-specific configuration
   */
  public override validateConfig(config: Partial<import('@/types/llm').LLMConfig>): ValidationResult<import('@/types/llm').LLMConfig> {
    // First run base validation
    const baseValidation = super.validateConfig(config);
    if (!baseValidation.success) {
      return baseValidation;
    }

    const validatedConfig = baseValidation.data;

    // Gemini-specific validations
    if (validatedConfig.provider !== 'gemini') {
      return {
        success: false,
        error: {
          code: 'INVALID_PROVIDER',
          message: 'Provider must be "gemini" for Gemini provider',
        },
      };
    }

    // Validate API key format (Gemini keys are typically longer and alphanumeric)
    if (validatedConfig.apiKey.length < 20) {
      return {
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Gemini API key appears to be too short',
        },
      };
    }

    // Validate model is supported
    const supportedModels = [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro',
    ];
    
    if (!supportedModels.includes(validatedConfig.model)) {
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_MODEL',
          message: `Model "${validatedConfig.model}" is not supported. Supported models: ${supportedModels.join(', ')}`,
        },
      };
    }

    // Validate base URL
    const validBaseUrls = [
      'https://generativelanguage.googleapis.com/v1beta',
      'https://generativelanguage.googleapis.com/v1beta/',
    ];
    
    const normalizedBaseUrl = validatedConfig.baseUrl.replace(/\/$/, '');
    if (!validBaseUrls.some(url => url.replace(/\/$/, '') === normalizedBaseUrl)) {
      console.warn(`Non-standard Gemini base URL: ${validatedConfig.baseUrl}`);
    }

    // Validate max tokens (Gemini has different limits)
    if (validatedConfig.maxTokens > 8192) {
      return {
        success: false,
        error: {
          code: 'INVALID_MAX_TOKENS',
          message: 'Gemini models support a maximum of 8192 output tokens',
        },
      };
    }

    return {
      success: true,
      data: validatedConfig,
    };
  }
}

// Export singleton instance
export const geminiProvider = new GeminiProvider();