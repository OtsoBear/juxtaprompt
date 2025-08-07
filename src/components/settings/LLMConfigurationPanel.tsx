// src/components/settings/LLMConfigurationPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Eye, EyeOff, AlertCircle, CheckCircle, Loader2, RefreshCw, Save } from 'lucide-react';
import type { LLMConfig, LLMProvider, ModelInfo, AvailableModelsResult } from '@/types/llm';
import { DEFAULT_PROVIDER_CONFIGS, PROVIDER_MODELS } from '@/types/llm';
import { StorageSecuritySelector } from './StorageSecuritySelector';
import { storageService } from '@/services/storage';
import { llmProviderManager } from '@/services/llm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';

// Optimized debounce utility with immediate execution option
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) func(...args);
    }, wait);
    if (callNow) func(...args);
  };
};

interface LLMConfigurationPanelProps {
  config: LLMConfig | null;
  onConfigChange: (config: LLMConfig) => void;
  className?: string;
}

/**
 * Advanced LLM configuration interface with provider-specific settings
 */
export const LLMConfigurationPanel: React.FC<LLMConfigurationPanelProps> = React.memo(({
  config,
  onConfigChange,
  className = '',
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [storagePreference, setStoragePreference] = useState(storageService.getStoragePreference());
  
  // Model loading states
  const [availableModels, setAvailableModels] = useState<Record<LLMProvider, ModelInfo[]>>({
    openai: [],
    anthropic: [],
    gemini: [],
  });
  const [modelsLoading, setModelsLoading] = useState<Record<LLMProvider, boolean>>({
    openai: false,
    anthropic: false,
    gemini: false,
  });
  const [modelsError, setModelsError] = useState<Record<LLMProvider, string | null>>({
    openai: null,
    anthropic: null,
    gemini: null,
  });

  // Form state
  const [formData, setFormData] = useState<Partial<LLMConfig>>(() => {
    if (config) return config;
    
    // Try to load from storage
    const providers: LLMProvider[] = ['openai', 'anthropic', 'gemini'];
    for (const provider of providers) {
      const apiKey = storageService.getAPIKey(provider);
      if (apiKey) {
        return {
          ...DEFAULT_PROVIDER_CONFIGS[provider],
          apiKey,
        };
      }
    }
    
    return DEFAULT_PROVIDER_CONFIGS.openai;
  });

  // Update storage preference when it changes
  useEffect(() => {
    const handleStorageChange = () => {
      setStoragePreference(storageService.getStoragePreference());
    };

    // Listen for storage changes (custom event)
    window.addEventListener('storage-preference-changed', handleStorageChange);
    return () => window.removeEventListener('storage-preference-changed', handleStorageChange);
  }, []);

  // Auto-load models for providers with saved API keys on component mount
  useEffect(() => {
    const providers: LLMProvider[] = ['openai', 'anthropic', 'gemini'];
    
    providers.forEach(provider => {
      const apiKey = storageService.getAPIKey(provider);
      if (apiKey) {
        const defaultConfig = DEFAULT_PROVIDER_CONFIGS[provider];
        loadModelsForProvider(provider, apiKey, defaultConfig.baseUrl);
      }
    });
  }, []); // Empty dependency array means this runs once on mount

  // Validate configuration
  const validateConfig = async (configToValidate: Partial<LLMConfig>) => {
    if (!configToValidate.provider || !configToValidate.apiKey) {
      return;
    }

    setValidationStatus('validating');
    setValidationError(null);

    try {
      // Create a complete config object with defaults
      const defaultConfig = DEFAULT_PROVIDER_CONFIGS[configToValidate.provider];
      const completeConfig: LLMConfig = {
        provider: configToValidate.provider,
        apiKey: configToValidate.apiKey,
        baseUrl: configToValidate.baseUrl || defaultConfig.baseUrl,
        model: configToValidate.model || defaultConfig.model,
        temperature: configToValidate.temperature ?? defaultConfig.temperature,
        maxTokens: configToValidate.maxTokens ?? defaultConfig.maxTokens,
        topP: configToValidate.topP ?? defaultConfig.topP,
        frequencyPenalty: configToValidate.frequencyPenalty ?? defaultConfig.frequencyPenalty,
        presencePenalty: configToValidate.presencePenalty ?? defaultConfig.presencePenalty,
        systemMessage: configToValidate.systemMessage || defaultConfig.systemMessage,
      };

      const validation = llmProviderManager.validateConfig(
        configToValidate.provider,
        completeConfig
      );

      if (validation.success) {
        setValidationStatus('valid');
        setValidationError(null);
      } else {
        setValidationStatus('invalid');
        setValidationError(validation.error.message);
      }
    } catch (error) {
      setValidationStatus('invalid');
      setValidationError(error instanceof Error ? error.message : 'Validation failed');
    }
  };

  // Handle form field changes
  const handleFieldChange = (field: keyof LLMConfig, value: unknown) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Reset validation status when key fields change
    if (field === 'provider' || field === 'apiKey' || field === 'model') {
      setValidationStatus('idle');
      setValidationError(null);
    }

    // Auto-validate after a delay
    if (field === 'apiKey' && typeof value === 'string' && value.length > 10) {
      setTimeout(() => validateConfig(newFormData), 500);
    }

    // Auto-save for non-API key fields (API key is handled separately)
    if (field !== 'apiKey' && newFormData.provider && newFormData.apiKey) {
      autoSaveConfig(newFormData);
    }
  };

  // Load models for a provider
  const loadModelsForProvider = async (provider: LLMProvider, apiKey: string, baseUrl?: string) => {
    if (!apiKey) return;

    setModelsLoading(prev => ({ ...prev, [provider]: true }));
    setModelsError(prev => ({ ...prev, [provider]: null }));

    try {
      const result: AvailableModelsResult = await llmProviderManager.getAvailableModels(
        provider,
        apiKey,
        baseUrl
      );
      
      setAvailableModels(prev => ({ ...prev, [provider]: result.models }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load models';
      setModelsError(prev => ({ ...prev, [provider]: errorMessage }));
      
      // Fallback to static models
      const staticModels = PROVIDER_MODELS[provider].map(modelId => ({
        id: modelId,
        name: modelId,
        description: `${provider} model`,
      }));
      setAvailableModels(prev => ({ ...prev, [provider]: staticModels }));
    } finally {
      setModelsLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  // Handle provider change
  const handleProviderChange = (provider: LLMProvider) => {
    const defaultConfig = DEFAULT_PROVIDER_CONFIGS[provider];
    const existingApiKey = storageService.getAPIKey(provider);
    
    const newFormData = {
      ...defaultConfig,
      apiKey: existingApiKey || '',
    };
    
    setFormData(newFormData);
    setValidationStatus('idle');
    setValidationError(null);

    // Auto-save if we have an API key
    if (existingApiKey) {
      autoSaveConfig(newFormData);
      loadModelsForProvider(provider, existingApiKey, defaultConfig.baseUrl);
    }
  };

  // Auto-save configuration with debouncing
  const autoSaveConfig = useCallback(
    debounce((configToSave: Partial<LLMConfig>) => {
      if (!configToSave.provider || !configToSave.apiKey) {
        return;
      }

      try {
        // Save the API key to storage
        storageService.saveAPIKey(configToSave.provider, configToSave.apiKey);

        const fullConfig: LLMConfig = {
          provider: configToSave.provider,
          apiKey: configToSave.apiKey,
          baseUrl: configToSave.baseUrl || DEFAULT_PROVIDER_CONFIGS[configToSave.provider].baseUrl,
          model: configToSave.model || DEFAULT_PROVIDER_CONFIGS[configToSave.provider].model,
          temperature: configToSave.temperature ?? DEFAULT_PROVIDER_CONFIGS[configToSave.provider].temperature,
          maxTokens: configToSave.maxTokens ?? DEFAULT_PROVIDER_CONFIGS[configToSave.provider].maxTokens,
          topP: configToSave.topP ?? DEFAULT_PROVIDER_CONFIGS[configToSave.provider].topP,
          frequencyPenalty: configToSave.frequencyPenalty ?? DEFAULT_PROVIDER_CONFIGS[configToSave.provider].frequencyPenalty,
          presencePenalty: configToSave.presencePenalty ?? DEFAULT_PROVIDER_CONFIGS[configToSave.provider].presencePenalty,
          systemMessage: configToSave.systemMessage || DEFAULT_PROVIDER_CONFIGS[configToSave.provider].systemMessage,
        };

        // Validate before saving
        const validation = llmProviderManager.validateConfig(configToSave.provider, fullConfig);
        if (validation.success) {
          onConfigChange(validation.data);
        }
      } catch (error) {
        console.warn('Auto-save failed:', error);
      }
    }, 1000),
    [onConfigChange]
  );

  // Handle API key change
  const handleApiKeyChange = (apiKey: string) => {
    handleFieldChange('apiKey', apiKey);
    
    // Auto-save when API key changes
    if (formData.provider && apiKey.length > 10) {
      const configToSave = { ...formData, apiKey };
      autoSaveConfig(configToSave);
      
      // Load models when API key is entered
      setTimeout(() => {
        loadModelsForProvider(formData.provider!, apiKey, formData.baseUrl);
      }, 500);
    }
  };

  // Refresh models for current provider
  const refreshModels = () => {
    if (formData.provider && formData.apiKey) {
      loadModelsForProvider(formData.provider, formData.apiKey, formData.baseUrl);
    }
  };


  // Handle storage preference change
  const handleStoragePreferenceChange = (preference: typeof storagePreference) => {
    storageService.setStoragePreference(preference);
    setStoragePreference(preference);
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('storage-preference-changed'));
  };

  const getValidationIcon = () => {
    switch (validationStatus) {
      case 'validating':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'invalid':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center space-x-2">
          <Settings className="h-6 w-6" />
          <span>LLM Configuration</span>
        </h2>
        <p className="text-muted-foreground">
          Configure your LLM provider settings and API credentials.
        </p>
      </div>

      {/* Storage Security Settings */}
      <StorageSecuritySelector
        currentPreference={storagePreference}
        onPreferenceChange={handleStoragePreferenceChange}
      />

      {/* Provider Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Provider Settings</h3>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium">Provider</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.keys(DEFAULT_PROVIDER_CONFIGS).map((provider) => (
              <Button
                key={provider}
                onClick={() => handleProviderChange(provider as LLMProvider)}
                variant={formData.provider === provider ? 'default' : 'outline'}
                className="h-auto p-3 flex-col"
              >
                <div className="font-medium capitalize">{provider}</div>
                <div className="text-xs opacity-70 mt-1">
                  {availableModels[provider as LLMProvider].length > 0
                    ? `${availableModels[provider as LLMProvider].length} models`
                    : `${PROVIDER_MODELS[provider as LLMProvider].length} models`
                  }
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="relative">
            <form autoComplete="on">
              <input
                type="text"
                name="username"
                value={`${formData.provider} api key`}
                autoComplete="username"
                className="hidden-form-input"
                readOnly
                aria-hidden="true"
                tabIndex={-1}
                title={`${formData.provider} API key username`}
              />
              <Input
                type={showApiKey ? 'text' : 'password'}
                name="password"
                value={formData.apiKey || ''}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder={`Enter your ${formData.provider} API key`}
                className="pr-20"
                autoComplete="current-password"
              />
            </form>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
              {getValidationIcon()}
              <Button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}
        </div>

        {/* Model Selection */}
        {formData.provider && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label>Model</Label>
                <span className="text-xs text-muted-foreground">
                  Prices shown as (input cost / output cost) per 1M tokens
                </span>
              </div>
              {formData.apiKey && (
                <Button
                  type="button"
                  onClick={refreshModels}
                  disabled={modelsLoading[formData.provider]}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                >
                  <RefreshCw className={`h-3 w-3 ${modelsLoading[formData.provider] ? 'animate-spin' : ''}`} />
                  <span className="ml-1 text-xs">Refresh</span>
                </Button>
              )}
            </div>
            
            <Select
              value={formData.model || ''}
              onValueChange={(value) => handleFieldChange('model', value)}
              disabled={modelsLoading[formData.provider]}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  modelsLoading[formData.provider]
                    ? "Loading models..."
                    : availableModels[formData.provider].length > 0
                      ? "Select a model"
                      : "Enter API key to load models"
                } />
              </SelectTrigger>
              <SelectContent>
                {availableModels[formData.provider].length > 0 ? (
                  availableModels[formData.provider].map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col py-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{model.name}</span>
                          {model.pricing && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ${model.pricing.input}/${model.pricing.output}
                            </span>
                          )}
                        </div>
                        {model.description && (
                          <span className="text-xs text-muted-foreground truncate">
                            {model.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  PROVIDER_MODELS[formData.provider].map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            
            {modelsError[formData.provider] && (
              <p className="text-sm text-destructive flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                {modelsError[formData.provider]}
              </p>
            )}
            
            {modelsLoading[formData.provider] && (
              <p className="text-sm text-muted-foreground flex items-center">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Loading available models...
              </p>
            )}
          </div>
        )}

        {/* Base URL */}
        <div className="space-y-2">
          <Label>Base URL</Label>
          <Input
            type="url"
            value={formData.baseUrl || ''}
            onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
            placeholder="API base URL"
          />
        </div>
      </div>

      {/* Advanced Parameters */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Advanced Parameters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Temperature */}
          <div className="space-y-2">
            <Label>
              Temperature ({formData.temperature ?? 0.7})
            </Label>
            <Slider
              value={[formData.temperature ?? 0.7]}
              onValueChange={(value) => handleFieldChange('temperature', value[0])}
              max={2}
              min={0}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Focused</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <Label>Max Tokens</Label>
            <Input
              type="number"
              min="1"
              max="32000"
              value={formData.maxTokens ?? 2048}
              onChange={(e) => handleFieldChange('maxTokens', parseInt(e.target.value))}
            />
          </div>

          {/* Top P */}
          <div className="space-y-2">
            <Label>
              Top P ({formData.topP ?? 1.0})
            </Label>
            <Slider
              value={[formData.topP ?? 1.0]}
              onValueChange={(value) => handleFieldChange('topP', value[0])}
              max={1}
              min={0}
              step={0.1}
              className="w-full"
            />
          </div>

          {/* Frequency Penalty */}
          <div className="space-y-2">
            <Label>
              Frequency Penalty ({formData.frequencyPenalty ?? 0.0})
            </Label>
            <Slider
              value={[formData.frequencyPenalty ?? 0.0]}
              onValueChange={(value) => handleFieldChange('frequencyPenalty', value[0])}
              max={2}
              min={-2}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>

        {/* System Message */}
        <div className="space-y-2">
          <Label>System Message</Label>
          <Textarea
            value={formData.systemMessage || ''}
            onChange={(e) => handleFieldChange('systemMessage', e.target.value)}
            placeholder="Optional system message to set context for the AI"
            rows={3}
            className="resize-none"
          />
        </div>
      </div>

      <Separator />
      
      {/* Actions */}
      <div className="flex items-center justify-between pt-6">
        <div className="text-sm text-muted-foreground">
          {validationStatus === 'valid' && '✅ Configuration is valid and auto-saved'}
          {validationStatus === 'invalid' && '❌ Please fix configuration errors'}
          {validationStatus === 'validating' && '⏳ Validating configuration...'}
          {validationStatus === 'idle' && formData.apiKey && (
            <span className="flex items-center">
              <Save className="h-4 w-4 mr-1" />
              Settings auto-save as you type
            </span>
          )}
        </div>

        <div className="flex space-x-3">
          <Button
            onClick={() => validateConfig(formData)}
            disabled={!formData.provider || !formData.apiKey || validationStatus === 'validating'}
            variant="outline"
          >
            Validate
          </Button>
        </div>
      </div>
    </div>
  );
});

export default LLMConfigurationPanel;