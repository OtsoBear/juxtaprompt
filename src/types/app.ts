// src/types/app.ts
import type { LLMConfig, LLMResponse, LLMProvider } from './llm';
import type { UIState } from './url-state';

export interface PromptItem {
  readonly id: string;
  readonly content: string;
  readonly title?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
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
  readonly ui: UIState;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export interface AppActions {
  addPrompt: (content: string, title?: string) => void;
  updatePrompt: (id: string, content: string, title?: string) => void;
  removePrompt: (id: string) => void;
  clearPrompts: () => void;
  setConfig: (config: LLMConfig) => void;
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
  readonly onPromptChange: (id: string, content: string) => void;
  readonly onPromptRemove: (id: string) => void;
  readonly onPromptAdd: () => void;
  readonly isLoading: boolean;
}

export interface SettingsPanelProps extends BaseComponentProps {
  readonly config: LLMConfig | null;
  readonly onConfigChange: (config: LLMConfig) => void;
  readonly uiState: UIState;
  readonly onUIStateChange: (updates: Partial<UIState>) => void;
}