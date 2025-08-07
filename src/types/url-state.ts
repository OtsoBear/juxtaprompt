// src/types/url-state.ts
import type { LLMConfig } from './llm';

export interface UIState {
  readonly gridColumns: number;
  readonly autoSend: boolean;
  readonly debounceMs: number;
  readonly showAdvancedSettings: boolean;
  readonly theme: 'light' | 'dark' | 'system';
}

export interface URLState {
  readonly prompts: ReadonlyArray<string>;
  readonly config: Partial<LLMConfig>;
  readonly ui: Partial<UIState>;
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
  gridColumns: 2,
  autoSend: false,
  debounceMs: 500,
  showAdvancedSettings: false,
  theme: 'system',
} as const;

// URL state compression settings
export const URL_STATE_CONFIG = {
  maxURLLength: 2000,
  compressionLevel: 6,
  parameterName: 'state',
} as const;