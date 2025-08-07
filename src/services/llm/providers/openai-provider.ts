// src/services/llm/providers/openai-provider.ts
import { BaseLLMProvider, LLMProviderError } from '../base-llm-provider';
import type { LLMRequest, LLMStreamChunk, ValidationResult } from '@/types/llm';
import { validateOpenAIResponse, type OpenAIStreamChunk } from '@/schemas/llm-schemas';

/**
 * OpenAI provider implementation with streaming support and validation
 */
export class OpenAIProvider extends BaseLLMProvider {
  public readonly name = 'openai' as const;

  /**
   * Send streaming request to OpenAI API
   */
  public async* sendStreamingRequest(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    this.logRequest(request);

    const url = `${request.config.baseUrl}/chat/completions`;
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
   * Get authentication headers for OpenAI
   */
  protected getAuthHeaders(apiKey: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  /**
   * Create request body for OpenAI API
   */
  protected createRequestBody(request: LLMRequest): Record<string, unknown> {
    const messages: Array<{ role: string; content: string }> = [];
    
    // Add system message if provided
    if (request.config.systemMessage.trim()) {
      messages.push({
        role: 'system',
        content: request.config.systemMessage,
      });
    }
    
    // Add user message
    messages.push({
      role: 'user',
      content: request.prompt,
    });

    return {
      model: request.config.model,
      messages,
      temperature: request.config.temperature,
      max_tokens: request.config.maxTokens,
      top_p: request.config.topP,
      frequency_penalty: request.config.frequencyPenalty,
      presence_penalty: request.config.presencePenalty,
      stream: true,
    };
  }

  /**
   * Parse streaming response chunk from OpenAI
   */
  protected parseStreamChunk(data: string, requestId: string): LLMStreamChunk | null {
    try {
      const parsed = JSON.parse(data);
      const validation = this.validateStreamChunk(parsed);
      
      if (!validation.success) {
        console.warn('Invalid OpenAI response format:', validation.error);
        return null;
      }

      const chunk = validation.data as OpenAIStreamChunk;
      const choice = chunk.choices[0];
      
      if (!choice) {
        return null;
      }

      const content = choice.delta.content || '';
      const isComplete = choice.finish_reason !== null;

      const streamChunk: LLMStreamChunk = {
        requestId,
        content,
        isComplete,
        ...(isComplete && (parsed as any).usage?.total_tokens && {
          tokenCount: (parsed as any).usage.total_tokens
        }),
      };

      this.logResponse(streamChunk);
      return streamChunk;
    } catch (error) {
      console.warn('Failed to parse OpenAI stream chunk:', error);
      return null;
    }
  }

  /**
   * Validate streaming response chunk
   */
  protected validateStreamChunk(data: unknown): ValidationResult<OpenAIStreamChunk> {
    return validateOpenAIResponse(data);
  }

  /**
   * Process Server-Sent Events stream for OpenAI
   */
  protected override async* processSSEStream(
    response: Response, 
    requestId: string
  ): AsyncIterable<LLMStreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new LLMProviderError(this.createError(
        'NO_RESPONSE_BODY',
        'No response body received from OpenAI',
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
            
            // Check for stream end
            if (data === '[DONE]') {
              yield {
                requestId,
                content: '',
                isComplete: true,
              };
              return;
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
   * Handle OpenAI-specific errors
   */
  protected override async handleHTTPError(response: Response): Promise<import('@/types/llm').LLMError> {
    let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`;
    let details: unknown;

    try {
      const errorBody = await response.text();
      if (errorBody) {
        try {
          const errorData = JSON.parse(errorBody);
          details = errorData;
          
          // Extract OpenAI-specific error message
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
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
      `OPENAI_HTTP_${response.status}`,
      errorMessage,
      retryable,
      response.status,
      details
    );
  }

  /**
   * Validate OpenAI-specific configuration
   */
  public override validateConfig(config: Partial<import('@/types/llm').LLMConfig>): ValidationResult<import('@/types/llm').LLMConfig> {
    // First run base validation
    const baseValidation = super.validateConfig(config);
    if (!baseValidation.success) {
      return baseValidation;
    }

    const validatedConfig = baseValidation.data;

    // OpenAI-specific validations
    if (validatedConfig.provider !== 'openai') {
      return {
        success: false,
        error: {
          code: 'INVALID_PROVIDER',
          message: 'Provider must be "openai" for OpenAI provider',
        },
      };
    }

    // Validate API key format (OpenAI keys start with 'sk-')
    if (!validatedConfig.apiKey.startsWith('sk-')) {
      return {
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'OpenAI API key must start with "sk-"',
        },
      };
    }

    // Validate model is supported
    const supportedModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
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
      'https://api.openai.com/v1',
      'https://api.openai.com/v1/',
    ];
    
    const normalizedBaseUrl = validatedConfig.baseUrl.replace(/\/$/, '');
    if (!validBaseUrls.some(url => url.replace(/\/$/, '') === normalizedBaseUrl)) {
      console.warn(`Non-standard OpenAI base URL: ${validatedConfig.baseUrl}`);
    }

    return {
      success: true,
      data: validatedConfig,
    };
  }
}

// Export singleton instance
export const openaiProvider = new OpenAIProvider();