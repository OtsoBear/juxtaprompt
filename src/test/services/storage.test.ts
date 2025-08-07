// src/test/services/storage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedStorageService } from '@/services/storage/enhanced-storage-service';
import type { StoragePreference } from '@/types/storage';

describe('EnhancedStorageService', () => {
  let storageService: EnhancedStorageService;
  let mockLocalStorage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let mockSessionStorage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Reset mocks
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    
    mockSessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
    });

    storageService = new EnhancedStorageService();
  });

  describe('getStoragePreference', () => {
    it('should return default preference when none stored', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const preference = storageService.getStoragePreference();
      
      expect(preference).toEqual({
        type: 'session',
        acknowledgedRisks: false,
      });
    });

    it('should return stored preference when available', () => {
      const storedPreference: StoragePreference = {
        type: 'local',
        acknowledgedRisks: true,
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedPreference));
      
      const preference = storageService.getStoragePreference();
      
      expect(preference).toEqual(storedPreference);
    });

    it('should return default preference when stored data is invalid', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');
      
      const preference = storageService.getStoragePreference();
      
      expect(preference).toEqual({
        type: 'session',
        acknowledgedRisks: false,
      });
    });
  });

  describe('setStoragePreference', () => {
    it('should store preference in localStorage', () => {
      const preference: StoragePreference = {
        type: 'local',
        acknowledgedRisks: true,
      };
      
      storageService.setStoragePreference(preference);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'juxtaprompt_storage_preference',
        JSON.stringify(preference)
      );
    });
  });

  describe('API Key Management', () => {
    describe('saveAPIKey', () => {
      it('should save to memory when preference is "none"', () => {
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
          type: 'none',
          acknowledgedRisks: true,
        }));
        
        storageService.saveAPIKey('openai', 'test-key');
        
        expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith('openai_api_key', 'test-key');
        expect(mockSessionStorage.setItem).not.toHaveBeenCalledWith('openai_api_key', 'test-key');
      });

      it('should save to sessionStorage when preference is "session"', () => {
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
          type: 'session',
          acknowledgedRisks: true,
        }));
        
        storageService.saveAPIKey('openai', 'test-key');
        
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('juxtaprompt_api_key_openai', 'test-key');
      });

      it('should save to localStorage when preference is "local"', () => {
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
          type: 'local',
          acknowledgedRisks: true,
        }));
        
        storageService.saveAPIKey('openai', 'test-key');
        
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('juxtaprompt_api_key_openai', 'test-key');
      });
    });

    describe('getAPIKey', () => {
      it('should retrieve from memory when preference is "none"', () => {
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
          type: 'none',
          acknowledgedRisks: true,
        }));
        
        // First save a key to memory
        storageService.saveAPIKey('openai', 'test-key');
        
        const key = storageService.getAPIKey('openai');
        
        expect(key).toBe('test-key');
      });

      it('should retrieve from sessionStorage when preference is "session"', () => {
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
          type: 'session',
          acknowledgedRisks: true,
        }));
        mockSessionStorage.getItem.mockReturnValue('test-key');
        
        const key = storageService.getAPIKey('openai');
        
        expect(key).toBe('test-key');
        expect(mockSessionStorage.getItem).toHaveBeenCalledWith('juxtaprompt_api_key_openai');
      });

      it('should retrieve from localStorage when preference is "local"', () => {
        mockLocalStorage.getItem
          .mockReturnValueOnce(JSON.stringify({
            type: 'local',
            acknowledgedRisks: true,
          }))
          .mockReturnValueOnce('test-key');
        
        const key = storageService.getAPIKey('openai');
        
        expect(key).toBe('test-key');
      });

      it('should return null when key not found', () => {
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
          type: 'session',
          acknowledgedRisks: true,
        }));
        mockSessionStorage.getItem.mockReturnValue(null);
        
        const key = storageService.getAPIKey('openai');
        
        expect(key).toBeNull();
      });
    });

    describe('clearAPIKey', () => {
      it('should clear from all storage locations', () => {
        storageService.clearAPIKey('openai');
        
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('juxtaprompt_api_key_openai');
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('juxtaprompt_api_key_openai');
      });
    });
  });

  describe('Multiple Providers', () => {
    it('should handle different providers independently', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        type: 'session',
        acknowledgedRisks: true,
      }));
      
      storageService.saveAPIKey('openai', 'openai-key');
      storageService.saveAPIKey('anthropic', 'anthropic-key');
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('juxtaprompt_api_key_openai', 'openai-key');
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('juxtaprompt_api_key_anthropic', 'anthropic-key');
    });
  });

  describe('Security Considerations', () => {
    it('should not store keys when preference type is invalid', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        type: 'invalid-type',
        acknowledgedRisks: true,
      }));
      
      storageService.saveAPIKey('openai', 'test-key');
      
      // Should not call any storage methods
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith('openai_api_key', 'test-key');
      expect(mockSessionStorage.setItem).not.toHaveBeenCalledWith('openai_api_key', 'test-key');
    });
  });
});