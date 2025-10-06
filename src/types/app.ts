// src/types/app.ts
import type { LLMConfig, LLMResponse } from './llm';
import type { UIState } from './url-state';

export interface PromptItem {
  readonly id: string;
  readonly content: string;
  readonly title?: string;
  readonly systemMessage?: string;
  readonly variables?: Record<string, string>;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface PromptSettings {
  readonly sharedSystemMessage: boolean;
  readonly sharedUserPrompt: boolean;
  readonly globalSystemMessage: string;
  readonly globalUserPrompt: string;
  readonly globalVariables: Record<string, string>;
}

export interface ResponseItem {
  readonly id: string;
  readonly promptId: string;
  readonly response: LLMResponse;
  readonly createdAt: number;
}

export interface AppState {
  readonly prompts: ReadonlyArray<PromptItem>;
  readonly responses: ReadonlyArray<ResponseItem>;
  readonly config: LLMConfig | null;
  readonly promptSettings: PromptSettings;
  readonly ui: UIState;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export interface AppActions {
  addPrompt: (content: string, title?: string, systemMessage?: string, variables?: Record<string, string>) => void;
  updatePrompt: (id: string, updates: Partial<Omit<PromptItem, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  duplicatePrompt: (id: string) => void;
  removePrompt: (id: string) => void;
  clearPrompts: () => void;
  setConfig: (config: LLMConfig) => void;
  updatePromptSettings: (updates: Partial<PromptSettings>) => void;
  updateUIState: (updates: Partial<UIState>) => void;
  sendPrompts: () => Promise<void>;
  clearResponses: () => void;
  setError: (error: string | null) => void;
}

export interface AppContext extends AppState {
  actions: AppActions;
}

// Rate limiting types
export interface RateLimitConfig {
  readonly maxRequestsPerMinute: number;
  readonly maxConcurrentRequests: number;
  readonly backoffMultiplier: number;
  readonly maxBackoffMs: number;
  readonly retryAttempts: number;
}

export interface RateLimitState {
  readonly requestCount: number;
  readonly lastResetTime: number;
  readonly activeRequests: number;
  readonly backoffUntil: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequestsPerMinute: 60,
  maxConcurrentRequests: 5,
  backoffMultiplier: 2,
  maxBackoffMs: 30000,
  retryAttempts: 3,
} as const;

// Component prop types
export interface BaseComponentProps {
  readonly className?: string;
  readonly children?: React.ReactNode;
}

export interface PromptGridProps extends BaseComponentProps {
  readonly prompts: ReadonlyArray<PromptItem>;
  readonly responses: ReadonlyArray<ResponseItem>;
  readonly promptSettings: PromptSettings;
  readonly onPromptChange: (id: string, updates: Partial<Omit<PromptItem, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  readonly onPromptRemove: (id: string) => void;
  readonly onPromptAdd: (content?: string, title?: string, systemMessage?: string, variables?: Record<string, string>) => void;
  readonly onPromptDuplicate: (id: string) => void;
  readonly onPromptSettingsChange: (updates: Partial<PromptSettings>) => void;
  readonly onSendSinglePrompt?: (id: string) => void;
  readonly isLoading: boolean;
  readonly config?: LLMConfig | null;
  readonly uiState?: UIState;
  readonly onUIStateChange: (updates: Partial<UIState>) => void;
}

export interface SettingsPanelProps extends BaseComponentProps {
  readonly config: LLMConfig | null;
  readonly onConfigChange: (config: LLMConfig) => void;
  readonly promptSettings: PromptSettings;
  readonly onPromptSettingsChange: (updates: Partial<PromptSettings>) => void;
  readonly uiState: UIState;
  readonly onUIStateChange: (updates: Partial<UIState>) => void;
}

export const DEFAULT_PROMPT_SETTINGS: PromptSettings = {
  sharedSystemMessage: true,
  sharedUserPrompt: false,
  globalSystemMessage: '',
  globalUserPrompt: '',
  globalVariables: {},
} as const;
