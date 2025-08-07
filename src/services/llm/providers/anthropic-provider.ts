// src/services/llm/providers/anthropic-provider.ts
import { BaseLLMProvider, LLMProviderError } from '../base-llm-provider';
import type { LLMRequest, LLMStreamChunk, ValidationResult } from '@/types/llm';
import { validateAnthropicResponse, type AnthropicStreamChunk } from '@/schemas/llm-schemas';

/**
 * Anthropic provider implementation with streaming support and validation
 */
export class AnthropicProvider extends BaseLLMProvider {
  public readonly name = 'anthropic' as const;

  /**
   * Send streaming request to Anthropic API
   */
  public async* sendStreamingRequest(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    this.logRequest(request);

    const url = `${request.config.baseUrl}/v1/messages`;
    const headers = this.createHeaders(request.config.apiKey, {
      'anthropic-version': '2023-06-01',
    });
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
   * Get authentication headers for Anthropic
   */
  protected getAuthHeaders(apiKey: string): Record<string, string> {
    return {
      'x-api-key': apiKey,
    };
  }

  /**
   * Create request body for Anthropic API
   */
  protected createRequestBody(request: LLMRequest): Record<string, unknown> {
    const messages: Array<{ role: string; content: string }> = [];
    
    // Add user message
    messages.push({
      role: 'user',
      content: request.prompt,
    });

    const body: Record<string, unknown> = {
      model: request.config.model,
      messages,
      max_tokens: request.config.maxTokens,
      temperature: request.config.temperature,
      top_p: request.config.topP,
      stream: true,
    };

    // Add system message if provided
    if (request.config.systemMessage.trim()) {
      body['system'] = request.config.systemMessage;
    }

    return body;
  }

  /**
   * Parse streaming response chunk from Anthropic
   */
  protected parseStreamChunk(data: string, requestId: string): LLMStreamChunk | null {
    try {
      const parsed = JSON.parse(data);
      const validation = this.validateStreamChunk(parsed);
      
      if (!validation.success) {
        console.warn('Invalid Anthropic response format:', validation.error);
        return null;
      }

      const chunk = validation.data as AnthropicStreamChunk;
      
      // Handle different event types
      switch (chunk.type) {
        case 'message_start':
          return {
            requestId,
            content: '',
            isComplete: false,
          };

        case 'content_block_delta':
          if (chunk.delta?.text) {
            return {
              requestId,
              content: chunk.delta.text,
              isComplete: false,
            };
          }
          return null;

        case 'message_delta':
          if (chunk.delta?.stop_reason) {
            const streamChunk: LLMStreamChunk = {
              requestId,
              content: '',
              isComplete: true,
            };

            // Add token count if available
            if (chunk.message?.usage?.output_tokens) {
              return {
                ...streamChunk,
                tokenCount: chunk.message.usage.input_tokens + chunk.message.usage.output_tokens,
              };
            }

            this.logResponse(streamChunk);
            return streamChunk;
          }
          return null;

        case 'message_stop':
          const completionChunk: LLMStreamChunk = {
            requestId,
            content: '',
            isComplete: true,
          };
          
          this.logResponse(completionChunk);
          return completionChunk;

        default:
          return null;
      }
    } catch (error) {
      console.warn('Failed to parse Anthropic stream chunk:', error);
      return null;
    }
  }

  /**
   * Validate streaming response chunk
   */
  protected validateStreamChunk(data: unknown): ValidationResult<AnthropicStreamChunk> {
    return validateAnthropicResponse(data);
  }

  /**
   * Process Server-Sent Events stream for Anthropic
   */
  protected override async* processSSEStream(
    response: Response, 
    requestId: string
  ): AsyncIterable<LLMStreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new LLMProviderError(this.createError(
        'NO_RESPONSE_BODY',
        'No response body received from Anthropic',
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
            
            // Skip empty data or ping events
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
          } else if (trimmedLine.startsWith('event: ')) {
            // Handle event types if needed
            const eventType = trimmedLine.slice(7);
            if (eventType === 'message_stop') {
              yield {
                requestId,
                content: '',
                isComplete: true,
              };
              return;
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
   * Handle Anthropic-specific errors
   */
  protected override async handleHTTPError(response: Response): Promise<import('@/types/llm').LLMError> {
    let errorMessage = `Anthropic API error: ${response.status} ${response.statusText}`;
    let details: unknown;

    try {
      const errorBody = await response.text();
      if (errorBody) {
        try {
          const errorData = JSON.parse(errorBody);
          details = errorData;
          
          // Extract Anthropic-specific error message
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
      `ANTHROPIC_HTTP_${response.status}`,
      errorMessage,
      retryable,
      response.status,
      details
    );
  }

  /**
   * Validate Anthropic-specific configuration
   */
  public override validateConfig(config: Partial<import('@/types/llm').LLMConfig>): ValidationResult<import('@/types/llm').LLMConfig> {
    // First run base validation
    const baseValidation = super.validateConfig(config);
    if (!baseValidation.success) {
      return baseValidation;
    }

    const validatedConfig = baseValidation.data;

    // Anthropic-specific validations
    if (validatedConfig.provider !== 'anthropic') {
      return {
        success: false,
        error: {
          code: 'INVALID_PROVIDER',
          message: 'Provider must be "anthropic" for Anthropic provider',
        },
      };
    }

    // Validate API key format (Anthropic keys start with 'sk-ant-')
    if (!validatedConfig.apiKey.startsWith('sk-ant-')) {
      return {
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Anthropic API key must start with "sk-ant-"',
        },
      };
    }

    // Validate model is supported
    const supportedModels = [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
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
      'https://api.anthropic.com',
      'https://api.anthropic.com/',
    ];
    
    const normalizedBaseUrl = validatedConfig.baseUrl.replace(/\/$/, '');
    if (!validBaseUrls.some(url => url.replace(/\/$/, '') === normalizedBaseUrl)) {
      console.warn(`Non-standard Anthropic base URL: ${validatedConfig.baseUrl}`);
    }

    // Validate max tokens (Anthropic has different limits)
    if (validatedConfig.maxTokens > 8192) {
      return {
        success: false,
        error: {
          code: 'INVALID_MAX_TOKENS',
          message: 'Anthropic models support a maximum of 8192 tokens',
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
export const anthropicProvider = new AnthropicProvider();