// src/types/llm.ts
export const LLM_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;
export type LLMProvider = typeof LLM_PROVIDERS[number];

export interface LLMConfig {
  readonly provider: LLMProvider;
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly topP: number;
  readonly frequencyPenalty: number;
  readonly presencePenalty: number;
  readonly systemMessage: string;
}

export interface LLMRequest {
  readonly id: string;
  readonly prompt: string;
  readonly config: LLMConfig;
  readonly timestamp: number;
}

export interface LLMStreamChunk {
  readonly requestId: string;
  readonly content: string;
  readonly isComplete: boolean;
  readonly tokenCount?: number;
}

export interface ResponseMetadata {
  readonly tokenCount?: number;
  readonly model: string;
  readonly provider: LLMProvider;
  readonly timestamp: number;
  readonly duration?: number;
}

export interface LLMError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly statusCode?: number;
  readonly details?: unknown;
}

export interface LLMResponse {
  readonly requestId: string;
  readonly content: string;
  readonly isComplete: boolean;
  readonly isStreaming: boolean;
  readonly error?: LLMError;
  readonly metadata: ResponseMetadata;
}

// Provider-specific model configurations
export const PROVIDER_MODELS: Record<LLMProvider, ReadonlyArray<string>> = {
  openai: [
    'gpt-5',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ],
  anthropic: [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ],
  gemini: [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.0-pro',
  ],
} as const;

// Default configurations for each provider
export const DEFAULT_PROVIDER_CONFIGS: Record<LLMProvider, Omit<LLMConfig, 'apiKey'>> = {
  openai: {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    systemMessage: '',
  },
  anthropic: {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    systemMessage: '',
  },
  gemini: {
    provider: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-1.5-flash',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    systemMessage: '',
  },
} as const;

// Model information interface
export interface ModelInfo {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly contextLength?: number;
  readonly maxOutputTokens?: number;
  readonly pricing?: {
    input: number; // per 1M tokens
    output: number; // per 1M tokens
  };
}

// Available models result
export interface AvailableModelsResult {
  readonly models: ReadonlyArray<ModelInfo>;
  readonly cached: boolean;
  readonly timestamp: number;
}

// LLM Provider interface
export interface ILLMProvider {
  readonly name: LLMProvider;
  sendStreamingRequest(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  validateConfig(config: Partial<LLMConfig>): ValidationResult<LLMConfig>;
  getAvailableModels(apiKey: string, baseUrl?: string): Promise<AvailableModelsResult>;
}

export type ValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};