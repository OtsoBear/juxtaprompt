// src/services/storage/enhanced-storage-service.ts
import type { StoragePreference, StorageService } from '@/types/storage';
import type { LLMProvider } from '@/types/llm';
import { validateStoragePreference } from '@/schemas/llm-schemas';

/**
 * Enhanced storage service with three-tier security model:
 * - None: API keys held only in memory (most secure)
 * - Session: Keys cleared when tab closes (recommended default)
 * - Local: Persistent storage with risk warnings (least secure)
 */
export class EnhancedStorageService implements StorageService {
  private readonly inMemoryKeys = new Map<string, string>();
  private readonly PREFERENCE_KEY = 'juxtaprompt_storage_preference';
  private readonly API_KEY_PREFIX = 'juxtaprompt_api_key_';

  /**
   * Get the current storage preference with validation
   */
  public getStoragePreference(): StoragePreference {
    const stored = localStorage.getItem(this.PREFERENCE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const validation = validateStoragePreference(parsed);
        if (validation.success) {
          return validation.data;
        }
      } catch (error) {
        console.warn('Failed to parse storage preference:', error);
      }
    }
    
    // Return default preference
    return {
      type: 'session', // Default to session storage for security/convenience balance
      acknowledgedRisks: false
    };
  }

  /**
   * Set storage preference with validation
   */
  public setStoragePreference(preference: StoragePreference): void {
    const validation = validateStoragePreference(preference);
    if (!validation.success) {
      throw new Error(`Invalid storage preference: ${validation.error.message}`);
    }

    localStorage.setItem(this.PREFERENCE_KEY, JSON.stringify(preference));
    
    // If switching to a more secure option, clear less secure storage
    if (preference.type === 'none') {
      this.clearSessionStorage();
      this.clearLocalStorage();
    } else if (preference.type === 'session') {
      this.clearLocalStorage();
    }
  }

  /**
   * Save API key according to current storage preference
   */
  public saveAPIKey(provider: LLMProvider, key: string): void {
    if (!key || key.trim().length === 0) {
      throw new Error('API key cannot be empty');
    }

    const preference = this.getStoragePreference();
    const storageKey = this.getStorageKey(provider);
    
    // Clear from all other storage types first
    this.clearAPIKeyFromAllStorageTypes(provider);
    
    switch (preference.type) {
      case 'none':
        this.inMemoryKeys.set(storageKey, key);
        break;
      case 'session':
        try {
          sessionStorage.setItem(storageKey, key);
        } catch (error) {
          console.warn('Failed to save to session storage, falling back to memory:', error);
          this.inMemoryKeys.set(storageKey, key);
        }
        break;
      case 'local':
        if (!preference.acknowledgedRisks) {
          throw new Error('Cannot use local storage without acknowledging security risks');
        }
        try {
          localStorage.setItem(storageKey, key);
        } catch (error) {
          console.warn('Failed to save to local storage, falling back to session:', error);
          try {
            sessionStorage.setItem(storageKey, key);
          } catch (sessionError) {
            console.warn('Failed to save to session storage, falling back to memory:', sessionError);
            this.inMemoryKeys.set(storageKey, key);
          }
        }
        break;
      default:
        throw new Error(`Unknown storage type: ${preference.type}`);
    }
  }

  /**
   * Get API key from current storage preference
   */
  public getAPIKey(provider: LLMProvider): string | null {
    const preference = this.getStoragePreference();
    const storageKey = this.getStorageKey(provider);
    
    switch (preference.type) {
      case 'none':
        return this.inMemoryKeys.get(storageKey) ?? null;
      case 'session':
        try {
          return sessionStorage.getItem(storageKey);
        } catch (error) {
          console.warn('Failed to read from session storage:', error);
          return this.inMemoryKeys.get(storageKey) ?? null;
        }
      case 'local':
        try {
          return localStorage.getItem(storageKey);
        } catch (error) {
          console.warn('Failed to read from local storage:', error);
          try {
            return sessionStorage.getItem(storageKey);
          } catch (sessionError) {
            console.warn('Failed to read from session storage:', sessionError);
            return this.inMemoryKeys.get(storageKey) ?? null;
          }
        }
      default:
        return null;
    }
  }

  /**
   * Clear API key for specific provider from all storage locations
   */
  public clearAPIKey(provider: LLMProvider): void {
    this.clearAPIKeyFromAllStorageTypes(provider);
  }

  /**
   * Clear all API keys from all storage locations
   */
  public clearAllAPIKeys(): void {
    // Clear memory storage
    this.inMemoryKeys.clear();
    
    // Clear session storage
    this.clearSessionStorage();
    
    // Clear local storage (but preserve preferences)
    this.clearLocalStorage();
  }

  /**
   * Get all stored API key providers
   */
  public getStoredProviders(): LLMProvider[] {
    const providers: LLMProvider[] = [];
    const allProviders: LLMProvider[] = ['openai', 'anthropic', 'gemini'];
    
    for (const provider of allProviders) {
      if (this.getAPIKey(provider)) {
        providers.push(provider);
      }
    }
    
    return providers;
  }

  /**
   * Check if any API keys are stored
   */
  public hasStoredKeys(): boolean {
    return this.getStoredProviders().length > 0;
  }

  /**
   * Get storage statistics for debugging/monitoring
   */
  public getStorageStats(): {
    memoryKeys: number;
    sessionKeys: number;
    localKeys: number;
    preference: StoragePreference;
  } {
    return {
      memoryKeys: this.inMemoryKeys.size,
      sessionKeys: this.countKeysInStorage(sessionStorage),
      localKeys: this.countKeysInStorage(localStorage) - 1, // Exclude preference key
      preference: this.getStoragePreference(),
    };
  }

  // Private helper methods

  private getStorageKey(provider: LLMProvider): string {
    return `${this.API_KEY_PREFIX}${provider}`;
  }

  private clearAPIKeyFromAllStorageTypes(provider: LLMProvider): void {
    const storageKey = this.getStorageKey(provider);
    
    // Clear from memory
    this.inMemoryKeys.delete(storageKey);
    
    // Clear from session storage
    try {
      sessionStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear from session storage:', error);
    }
    
    // Clear from local storage
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear from local storage:', error);
    }
  }

  private clearSessionStorage(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(this.API_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear session storage:', error);
    }
  }

  private clearLocalStorage(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.API_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear local storage:', error);
    }
  }

  private countKeysInStorage(storage: Storage): number {
    try {
      let count = 0;
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(this.API_KEY_PREFIX)) {
          count++;
        }
      }
      return count;
    } catch (error) {
      console.warn('Failed to count keys in storage:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const storageService = new EnhancedStorageService();