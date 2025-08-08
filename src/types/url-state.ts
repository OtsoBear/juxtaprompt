import type { LLMProvider } from './llm';
// src/types/url-state.ts

export interface UIState {
  readonly gridColumns: number;
  readonly gridRows: number;
  readonly fontSize: number;
  readonly maxHeight: number;
  readonly autoSend: boolean;
  readonly debounceMs: number;
  readonly showAdvancedSettings: boolean;
  readonly theme: 'light' | 'dark' | 'system';
  readonly comparePinnedIds: ReadonlyArray<string>;
  readonly customBaseUrl: boolean;
  readonly favorites: Readonly<Record<LLMProvider, ReadonlyArray<string>>>;
}

export interface URLState {
  readonly prompts: ReadonlyArray<string>;
  readonly config: {
    readonly provider?: 'openai' | 'anthropic' | 'gemini' | undefined;
    readonly model?: string | undefined;
    readonly temperature?: number | undefined;
    readonly maxTokens?: number | undefined;
    readonly topP?: number | undefined;
    readonly frequencyPenalty?: number | undefined;
    readonly presencePenalty?: number | undefined;
    readonly systemMessage?: string | undefined;
  };
  readonly ui: {
    readonly gridColumns?: number | undefined;
    readonly gridRows?: number | undefined;
    readonly fontSize?: number | undefined;
    readonly maxHeight?: number | undefined;
    readonly autoSend?: boolean | undefined;
    readonly debounceMs?: number | undefined;
    readonly showAdvancedSettings?: boolean | undefined;
    readonly theme?: 'light' | 'dark' | 'system' | undefined;
    readonly comparePinnedIds?: ReadonlyArray<string> | undefined;
    readonly customBaseUrl?: boolean | undefined;
    readonly favorites?: Readonly<Record<LLMProvider, ReadonlyArray<string>>> | undefined;
  };
}

export interface URLStateService {
  saveStateToURL(state: URLState): void;
  loadStateFromURL(): URLState | null;
  clearURLState(): void;
  getShareableURL(state: URLState): string;
}

export interface URLStateManager extends URLStateService {
  readonly maxURLLength: number;
  compressState(state: URLState): string;
  decompressState(compressed: string): URLState;
  validateState(state: unknown): URLState | null;
}

 // Default UI state
export const DEFAULT_UI_STATE: UIState = {
  gridColumns: 4,
  gridRows: 2,
  fontSize: 12,
  maxHeight: 6,
  autoSend: false,
  debounceMs: 1000,
  showAdvancedSettings: false,
  theme: 'system',
  comparePinnedIds: [],
  customBaseUrl: false,
  favorites: {
    openai: [],
    anthropic: [],
    gemini: [],
  },
} as const;

// URL state compression settings
export const URL_STATE_CONFIG = {
  maxURLLength: 2000,
  compressionLevel: 6,
  parameterName: 'state',
} as const;
