// src/schemas/llm-schemas.ts
import { z } from 'zod';
import type { ValidationResult } from '@/types/llm';

// OpenAI Response Schema
export const OpenAIStreamChunkSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion.chunk'),
  created: z.number(),
  model: z.string(),
  choices: z.array(z.object({
    index: z.number(),
    delta: z.object({
      content: z.string().optional(),
      role: z.string().optional(),
    }),
    finish_reason: z.string().nullable(),
  })),
});

export const OpenAIErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string(),
    param: z.string().nullable().optional(),
    code: z.string().nullable().optional(),
  }),
});

// Anthropic Response Schema
export const AnthropicStreamChunkSchema = z.object({
  type: z.enum(['message_start', 'content_block_start', 'content_block_delta', 'content_block_stop', 'message_delta', 'message_stop']),
  message: z.object({
    id: z.string(),
    type: z.literal('message'),
    role: z.literal('assistant'),
    content: z.array(z.object({
      type: z.literal('text'),
      text: z.string(),
    })),
    model: z.string(),
    stop_reason: z.string().nullable().optional(),
    stop_sequence: z.string().nullable().optional(),
    usage: z.object({
      input_tokens: z.number(),
      output_tokens: z.number(),
    }).optional(),
  }).optional(),
  delta: z.object({
    type: z.literal('text_delta').optional(),
    text: z.string().optional(),
    stop_reason: z.string().nullable().optional(),
    stop_sequence: z.string().nullable().optional(),
  }).optional(),
  content_block: z.object({
    type: z.literal('text'),
    text: z.string(),
  }).optional(),
  index: z.number().optional(),
});

export const AnthropicErrorSchema = z.object({
  type: z.literal('error'),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }),
});

// Gemini Response Schema
export const GeminiStreamChunkSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({
      parts: z.array(z.object({
        text: z.string(),
      })),
      role: z.string(),
    }),
    finishReason: z.string().optional(),
    index: z.number(),
    safetyRatings: z.array(z.object({
      category: z.string(),
      probability: z.string(),
    })).optional(),
  })),
  promptFeedback: z.object({
    safetyRatings: z.array(z.object({
      category: z.string(),
      probability: z.string(),
    })),
  }).optional(),
});

export const GeminiErrorSchema = z.object({
  error: z.object({
    code: z.number(),
    message: z.string(),
    status: z.string(),
  }),
});

// LLM Configuration Schema
export const LLMConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini']),
  apiKey: z.string().min(1, 'API key is required'),
  baseUrl: z.string().url('Invalid base URL'),
  model: z.string().min(1, 'Model is required'),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().min(1).max(32000),
  topP: z.number().min(0).max(1),
  frequencyPenalty: z.number().min(-2).max(2),
  presencePenalty: z.number().min(-2).max(2),
  systemMessage: z.string(),
});

// URL State Schema
export const URLStateSchema = z.object({
  prompts: z.array(z.string()),
  config: z.object({
    provider: z.enum(['openai', 'anthropic', 'gemini']).optional(),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(32000).optional(),
    topP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    systemMessage: z.string().optional(),
  }),
  ui: z.object({
    gridColumns: z.number().min(1).max(20).optional(),
    gridRows: z.number().min(1).max(10).optional(),
    fontSize: z.number().min(8).max(16).optional(),
    maxHeight: z.number().min(2).max(20).optional(),
    autoSend: z.boolean().optional(),
    debounceMs: z.number().min(0).max(5000).optional(),
    showAdvancedSettings: z.boolean().optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    comparePinnedIds: z.array(z.string()).optional(),
    customBaseUrl: z.boolean().optional(),
    favorites: z.record(z.enum(['openai','anthropic','gemini']), z.array(z.string())).optional(),
  }),
});

// Storage Preference Schema
export const StoragePreferenceSchema = z.object({
  type: z.enum(['none', 'session', 'local']),
  acknowledgedRisks: z.boolean(),
});

// Validation helper functions
export function validateOpenAIResponse(data: unknown): ValidationResult<z.infer<typeof OpenAIStreamChunkSchema>> {
  const result = OpenAIStreamChunkSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid OpenAI response format',
      details: result.error.issues,
    },
  };
}

export function validateAnthropicResponse(data: unknown): ValidationResult<z.infer<typeof AnthropicStreamChunkSchema>> {
  const result = AnthropicStreamChunkSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid Anthropic response format',
      details: result.error.issues,
    },
  };
}

export function validateGeminiResponse(data: unknown): ValidationResult<z.infer<typeof GeminiStreamChunkSchema>> {
  const result = GeminiStreamChunkSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid Gemini response format',
      details: result.error.issues,
    },
  };
}

export function validateLLMConfig(data: unknown): ValidationResult<z.infer<typeof LLMConfigSchema>> {
  const result = LLMConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid LLM configuration',
      details: result.error.issues,
    },
  };
}

export function validateURLState(data: unknown): ValidationResult<z.infer<typeof URLStateSchema>> {
  const result = URLStateSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid URL state format',
      details: result.error.issues,
    },
  };
}

export function validateStoragePreference(data: unknown): ValidationResult<z.infer<typeof StoragePreferenceSchema>> {
  const result = StoragePreferenceSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid storage preference',
      details: result.error.issues,
    },
  };
}

// Export schema types
export type OpenAIStreamChunk = z.infer<typeof OpenAIStreamChunkSchema>;
export type AnthropicStreamChunk = z.infer<typeof AnthropicStreamChunkSchema>;
export type GeminiStreamChunk = z.infer<typeof GeminiStreamChunkSchema>;
export type ValidatedLLMConfig = z.infer<typeof LLMConfigSchema>;
export type ValidatedURLState = z.infer<typeof URLStateSchema>;
export type ValidatedStoragePreference = z.infer<typeof StoragePreferenceSchema>;
