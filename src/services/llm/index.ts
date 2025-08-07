// src/services/llm/index.ts
export * from './base-llm-provider';
export * from './llm-provider-manager';
export * from './providers';

// Register all providers
import { llmProviderManager } from './llm-provider-manager';
import { openaiProvider } from './providers/openai-provider';
import { anthropicProvider } from './providers/anthropic-provider';
import { geminiProvider } from './providers/gemini-provider';

// Register providers with the manager
llmProviderManager.registerProvider(openaiProvider);
llmProviderManager.registerProvider(anthropicProvider);
llmProviderManager.registerProvider(geminiProvider);