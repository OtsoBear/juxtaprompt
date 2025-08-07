// src/services/url-state/url-state-manager.ts
import type { URLState, URLStateManager as IURLStateManager } from '@/types/url-state';
import { validateURLState } from '@/schemas/llm-schemas';
import { URL_STATE_CONFIG } from '@/types/url-state';

/**
 * URL State Manager for saving and loading application state in URL parameters
 * Enables bookmarking and sharing of specific comparison setups
 */
export class URLStateManager implements IURLStateManager {
  public readonly maxURLLength = URL_STATE_CONFIG.maxURLLength;
  private readonly parameterName = URL_STATE_CONFIG.parameterName;

  /**
   * Save application state to URL query parameters
   */
  public saveStateToURL(state: URLState): void {
    try {
      const compressed = this.compressState(state);
      const params = new URLSearchParams(window.location.search);
      params.set(this.parameterName, compressed);
      
      const newURL = `${window.location.pathname}?${params.toString()}`;
      
      // Check URL length limit
      if (newURL.length <= this.maxURLLength) {
        window.history.replaceState({}, '', newURL);
      } else {
        console.warn(`URL too long (${newURL.length} chars), skipping state save`);
      }
    } catch (error) {
      console.error('Failed to save state to URL:', error);
    }
  }

  /**
   * Load application state from URL query parameters
   */
  public loadStateFromURL(): URLState | null {
    try {
      const params = new URLSearchParams(window.location.search);
      const stateParam = params.get(this.parameterName);
      
      if (!stateParam) {
        return null;
      }
      
      const decompressed = this.decompressState(stateParam);
      const validated = this.validateState(decompressed);
      
      return validated;
    } catch (error) {
      console.warn('Failed to load state from URL:', error);
      return null;
    }
  }

  /**
   * Clear URL state parameters
   */
  public clearURLState(): void {
    try {
      const params = new URLSearchParams(window.location.search);
      params.delete(this.parameterName);
      
      const newURL = params.toString() 
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      
      window.history.replaceState({}, '', newURL);
    } catch (error) {
      console.error('Failed to clear URL state:', error);
    }
  }

  /**
   * Get a shareable URL with the current state
   */
  public getShareableURL(state: URLState): string {
    try {
      const compressed = this.compressState(state);
      const url = new URL(window.location.href);
      url.searchParams.set(this.parameterName, compressed);
      
      const shareableURL = url.toString();
      
      if (shareableURL.length > this.maxURLLength) {
        throw new Error(`Shareable URL too long (${shareableURL.length} chars)`);
      }
      
      return shareableURL;
    } catch (error) {
      console.error('Failed to create shareable URL:', error);
      // Return current URL as fallback
      return window.location.href;
    }
  }

  /**
   * Compress state for URL efficiency using base64 encoding
   */
  public compressState(state: URLState): string {
    try {
      // Create a minimal state object with only non-default values
      const minimalState = this.createMinimalState(state);
      
      // Convert to JSON and compress
      const json = JSON.stringify(minimalState);
      const encoded = encodeURIComponent(json);
      const compressed = btoa(encoded);
      
      return compressed;
    } catch (error) {
      console.error('Failed to compress state:', error);
      throw new Error('State compression failed');
    }
  }

  /**
   * Decompress state from URL parameter
   */
  public decompressState(compressed: string): URLState {
    try {
      const decoded = atob(compressed);
      const json = decodeURIComponent(decoded);
      const parsed = JSON.parse(json);
      
      // Merge with defaults to ensure complete state
      return this.mergeWithDefaults(parsed);
    } catch (error) {
      console.error('Failed to decompress state:', error);
      throw new Error('State decompression failed');
    }
  }

  /**
   * Validate state object structure and content
   */
  public validateState(state: unknown): URLState | null {
    try {
      const validation = validateURLState(state);
      if (validation.success) {
        return validation.data;
      } else {
        console.warn('Invalid URL state format:', validation.error);
        return null;
      }
    } catch (error) {
      console.error('State validation failed:', error);
      return null;
    }
  }

  /**
   * Create minimal state object by removing default values
   */
  private createMinimalState(state: URLState): Partial<URLState> {
    const minimal: Record<string, unknown> = {};
    
    // Only include non-empty prompts
    if (state.prompts.length > 0) {
      const filteredPrompts = state.prompts.filter(prompt => prompt.trim().length > 0);
      if (filteredPrompts.length > 0) {
        minimal['prompts'] = filteredPrompts;
      }
    }
    
    // Only include non-default config values
    const config: Record<string, unknown> = {};
    if (state.config.provider) config['provider'] = state.config.provider;
    if (state.config.model) config['model'] = state.config.model;
    if (state.config.temperature !== undefined && state.config.temperature !== 0.7) {
      config['temperature'] = state.config.temperature;
    }
    if (state.config.maxTokens !== undefined && state.config.maxTokens !== 2048) {
      config['maxTokens'] = state.config.maxTokens;
    }
    if (state.config.topP !== undefined && state.config.topP !== 1.0) {
      config['topP'] = state.config.topP;
    }
    if (state.config.frequencyPenalty !== undefined && state.config.frequencyPenalty !== 0.0) {
      config['frequencyPenalty'] = state.config.frequencyPenalty;
    }
    if (state.config.presencePenalty !== undefined && state.config.presencePenalty !== 0.0) {
      config['presencePenalty'] = state.config.presencePenalty;
    }
    if (state.config.systemMessage) {
      config['systemMessage'] = state.config.systemMessage;
    }
    
    if (Object.keys(config).length > 0) {
      minimal['config'] = config;
    }
    
    // Only include non-default UI values
    const ui: Record<string, unknown> = {};
    if (state.ui.gridColumns !== undefined && state.ui.gridColumns !== 2) {
      ui['gridColumns'] = state.ui.gridColumns;
    }
    if (state.ui.autoSend !== undefined && state.ui.autoSend !== false) {
      ui['autoSend'] = state.ui.autoSend;
    }
    if (state.ui.debounceMs !== undefined && state.ui.debounceMs !== 500) {
      ui['debounceMs'] = state.ui.debounceMs;
    }
    if (state.ui.showAdvancedSettings !== undefined && state.ui.showAdvancedSettings !== false) {
      ui['showAdvancedSettings'] = state.ui.showAdvancedSettings;
    }
    if (state.ui.theme !== undefined && state.ui.theme !== 'system') {
      ui['theme'] = state.ui.theme;
    }
    
    if (Object.keys(ui).length > 0) {
      minimal['ui'] = ui;
    }
    
    return minimal as Partial<URLState>;
  }

  /**
   * Merge partial state with default values
   */
  private mergeWithDefaults(partial: Partial<URLState>): URLState {
    return {
      prompts: partial.prompts || [],
      config: {
        ...(partial.config?.provider && { provider: partial.config.provider }),
        ...(partial.config?.model && { model: partial.config.model }),
        ...(partial.config?.temperature !== undefined && { temperature: partial.config.temperature }),
        ...(partial.config?.maxTokens !== undefined && { maxTokens: partial.config.maxTokens }),
        ...(partial.config?.topP !== undefined && { topP: partial.config.topP }),
        ...(partial.config?.frequencyPenalty !== undefined && { frequencyPenalty: partial.config.frequencyPenalty }),
        ...(partial.config?.presencePenalty !== undefined && { presencePenalty: partial.config.presencePenalty }),
        ...(partial.config?.systemMessage && { systemMessage: partial.config.systemMessage }),
      },
      ui: {
        ...(partial.ui?.gridColumns !== undefined && { gridColumns: partial.ui.gridColumns }),
        ...(partial.ui?.autoSend !== undefined && { autoSend: partial.ui.autoSend }),
        ...(partial.ui?.debounceMs !== undefined && { debounceMs: partial.ui.debounceMs }),
        ...(partial.ui?.showAdvancedSettings !== undefined && { showAdvancedSettings: partial.ui.showAdvancedSettings }),
        ...(partial.ui?.theme && { theme: partial.ui.theme }),
      },
    };
  }

  /**
   * Check if current URL has state parameters
   */
  public hasURLState(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.has(this.parameterName);
  }

  /**
   * Get URL state parameter size in bytes
   */
  public getStateSize(): number {
    const params = new URLSearchParams(window.location.search);
    const stateParam = params.get(this.parameterName);
    return stateParam ? new Blob([stateParam]).size : 0;
  }

  /**
   * Estimate compressed size of a state object
   */
  public estimateStateSize(state: URLState): number {
    try {
      const compressed = this.compressState(state);
      return new Blob([compressed]).size;
    } catch {
      return 0;
    }
  }

  /**
   * Check if a state object would fit in URL
   */
  public canFitInURL(state: URLState): boolean {
    try {
      const shareableURL = this.getShareableURL(state);
      return shareableURL.length <= this.maxURLLength;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const urlStateManager = new URLStateManager();