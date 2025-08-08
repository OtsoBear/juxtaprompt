// src/services/llm/providers/openai-provider.ts
import { BaseLLMProvider, LLMProviderError } from '../base-llm-provider';
import type { LLMRequest, LLMStreamChunk, ValidationResult, ModelInfo } from '@/types/llm';
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

      // Define interface for OpenAI response with usage
      interface OpenAIResponseWithUsage {
        usage?: {
          total_tokens: number;
        };
      }

      const streamChunk: LLMStreamChunk = {
        requestId,
        content,
        isComplete,
        ...(isComplete && (parsed as OpenAIResponseWithUsage).usage?.total_tokens ? {
          tokenCount: (parsed as OpenAIResponseWithUsage).usage!.total_tokens
        } : {}),
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
   * Fetch available models from OpenAI API
   */
  protected async fetchAvailableModels(apiKey: string, baseUrl?: string): Promise<ModelInfo[]> {
    const url = `${baseUrl || 'https://api.openai.com/v1'}/models`;
    const headers = this.createHeaders(apiKey);

    try {
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers,
      });

      const data = await response.json();
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format from OpenAI models API');
      }

      // Define interface for OpenAI model response
      interface OpenAIModel {
        id: string;
        object: string;
        created?: number;
        owned_by?: string;
      }

      // Filter and map OpenAI models to our ModelInfo format
      const models: ModelInfo[] = data.data
        .filter((model: OpenAIModel) => {
          // Only include chat completion models
          return model.id && (
            model.id.startsWith('gpt-') ||
            model.id.includes('chat') ||
            model.id.includes('turbo')
          );
        })
        .map((model: OpenAIModel) => ({
          id: model.id,
          name: model.id,
          description: this.getModelDescription(model.id),
          contextLength: this.getModelContextLength(model.id),
          maxOutputTokens: this.getModelMaxOutputTokens(model.id),
          pricing: this.getModelPricing(model.id),
        }))
        .sort((a: ModelInfo, b: ModelInfo) => {
          // Sort by preference: gpt-4o models first, then gpt-4, then gpt-3.5
          const getModelPriority = (id: string) => {
            if (id.includes('gpt-4o')) return 1;
            if (id.includes('gpt-4')) return 2;
            if (id.includes('gpt-3.5')) return 3;
            return 4;
          };
          return getModelPriority(a.id) - getModelPriority(b.id);
        });

      return models;
    } catch (error) {
      console.error('Failed to fetch OpenAI models:', error);
      throw error;
    }
  }

  /**
   * Get fallback models when API call fails
   */
  protected getFallbackModels(): ModelInfo[] {
    return [
      {
        id: 'gpt-5',
        name: 'GPT-5',
        description: 'Next generation flagship model',
        contextLength: 200000,
        maxOutputTokens: 8192,
        pricing: { input: 10.0, output: 30.0 },
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Most advanced multimodal model',
        contextLength: 128000,
        maxOutputTokens: 4096,
        pricing: { input: 5.0, output: 15.0 },
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Affordable and intelligent small model',
        contextLength: 128000,
        maxOutputTokens: 16384,
        pricing: { input: 0.15, output: 0.6 },
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Previous generation flagship model',
        contextLength: 128000,
        maxOutputTokens: 4096,
        pricing: { input: 10.0, output: 30.0 },
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        description: 'Original GPT-4 model',
        contextLength: 8192,
        maxOutputTokens: 4096,
        pricing: { input: 30.0, output: 60.0 },
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and affordable model',
        contextLength: 16385,
        maxOutputTokens: 4096,
        pricing: { input: 0.5, output: 1.5 },
      },
    ];
  }

  /**
   * Get model description
   */
  private getModelDescription(modelId: string): string {
    const descriptions: Record<string, string> = {
      'gpt-5': 'Next generation flagship model',
      'gpt-4o': 'Most advanced multimodal model',
      'gpt-4o-mini': 'Affordable and intelligent small model',
      'gpt-4-turbo': 'Previous generation flagship model',
      'gpt-4': 'Original GPT-4 model',
      'gpt-3.5-turbo': 'Fast and affordable model',
    };
    return descriptions[modelId] || 'OpenAI language model';
  }

  /**
   * Get model context length
   */
  private getModelContextLength(modelId: string): number {
    const contextLengths: Record<string, number> = {
      'gpt-5': 200000,
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 16385,
    };
    return contextLengths[modelId] || 4096;
  }

  /**
   * Get model max output tokens
   */
  private getModelMaxOutputTokens(modelId: string): number {
    const maxOutputTokens: Record<string, number> = {
      'gpt-5': 8192,
      'gpt-4o': 4096,
      'gpt-4o-mini': 16384,
      'gpt-4-turbo': 4096,
      'gpt-4': 4096,
      'gpt-3.5-turbo': 4096,
    };
    return maxOutputTokens[modelId] || 4096;
  }

  /**
   * Get model pricing (per 1M tokens)
   */
  private getModelPricing(modelId: string): { input: number; output: number } {
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-5': { input: 10.0, output: 30.0 },
      'gpt-4o': { input: 5.0, output: 15.0 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'gpt-4-turbo': { input: 10.0, output: 30.0 },
      'gpt-4': { input: 30.0, output: 60.0 },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    };
    return pricing[modelId] || { input: 1.0, output: 2.0 };
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

    // Allow any model - let OpenAI API handle validation
    // This enables support for new models like gpt-5 without code changes

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