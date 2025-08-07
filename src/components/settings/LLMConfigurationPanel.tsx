// src/components/settings/LLMConfigurationPanel.tsx
import React, { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import type { LLMConfig, LLMProvider } from '@/types/llm';
import { DEFAULT_PROVIDER_CONFIGS, PROVIDER_MODELS } from '@/types/llm';
import { StorageSecuritySelector } from './StorageSecuritySelector';
import { storageService } from '@/services/storage';
import { llmProviderManager } from '@/services/llm';

interface LLMConfigurationPanelProps {
  config: LLMConfig | null;
  onConfigChange: (config: LLMConfig) => void;
  className?: string;
}

/**
 * Advanced LLM configuration interface with provider-specific settings
 */
export const LLMConfigurationPanel: React.FC<LLMConfigurationPanelProps> = ({
  config,
  onConfigChange,
  className = '',
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [storagePreference, setStoragePreference] = useState(storageService.getStoragePreference());

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

  // Validate configuration
  const validateConfig = async (configToValidate: Partial<LLMConfig>) => {
    if (!configToValidate.provider || !configToValidate.apiKey) {
      return;
    }

    setValidationStatus('validating');
    setValidationError(null);

    try {
      const validation = llmProviderManager.validateConfig(
        configToValidate.provider,
        configToValidate as LLMConfig
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
  };

  // Save configuration
  const handleSave = () => {
    if (!formData.provider || !formData.apiKey) {
      setValidationError('Provider and API key are required');
      return;
    }

    const fullConfig: LLMConfig = {
      provider: formData.provider,
      apiKey: formData.apiKey,
      baseUrl: formData.baseUrl || DEFAULT_PROVIDER_CONFIGS[formData.provider].baseUrl,
      model: formData.model || DEFAULT_PROVIDER_CONFIGS[formData.provider].model,
      temperature: formData.temperature ?? DEFAULT_PROVIDER_CONFIGS[formData.provider].temperature,
      maxTokens: formData.maxTokens ?? DEFAULT_PROVIDER_CONFIGS[formData.provider].maxTokens,
      topP: formData.topP ?? DEFAULT_PROVIDER_CONFIGS[formData.provider].topP,
      frequencyPenalty: formData.frequencyPenalty ?? DEFAULT_PROVIDER_CONFIGS[formData.provider].frequencyPenalty,
      presencePenalty: formData.presencePenalty ?? DEFAULT_PROVIDER_CONFIGS[formData.provider].presencePenalty,
      systemMessage: formData.systemMessage || DEFAULT_PROVIDER_CONFIGS[formData.provider].systemMessage,
    };

    onConfigChange(fullConfig);
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
              <button
                key={provider}
                onClick={() => handleProviderChange(provider as LLMProvider)}
                className={`p-3 border rounded-lg text-center transition-colors ${
                  formData.provider === provider
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <div className="font-medium capitalize">{provider}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {PROVIDER_MODELS[provider as LLMProvider].length} models
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">API Key</label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={formData.apiKey || ''}
              onChange={(e) => handleFieldChange('apiKey', e.target.value)}
              placeholder={`Enter your ${formData.provider} API key`}
              className="w-full p-3 pr-20 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
              {getValidationIcon()}
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="p-1 hover:bg-muted rounded transition-colors"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {validationError && (
            <p className="text-sm text-red-600">{validationError}</p>
          )}
        </div>

        {/* Model Selection */}
        {formData.provider && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Model</label>
            <select
              value={formData.model || ''}
              onChange={(e) => handleFieldChange('model', e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {PROVIDER_MODELS[formData.provider].map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Base URL */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Base URL</label>
          <input
            type="url"
            value={formData.baseUrl || ''}
            onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
            placeholder="API base URL"
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Advanced Parameters */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Advanced Parameters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Temperature */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Temperature ({formData.temperature ?? 0.7})
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={formData.temperature ?? 0.7}
              onChange={(e) => handleFieldChange('temperature', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Focused</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Max Tokens</label>
            <input
              type="number"
              min="1"
              max="32000"
              value={formData.maxTokens ?? 2048}
              onChange={(e) => handleFieldChange('maxTokens', parseInt(e.target.value))}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Top P */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Top P ({formData.topP ?? 1.0})
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={formData.topP ?? 1.0}
              onChange={(e) => handleFieldChange('topP', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Frequency Penalty */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Frequency Penalty ({formData.frequencyPenalty ?? 0.0})
            </label>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              value={formData.frequencyPenalty ?? 0.0}
              onChange={(e) => handleFieldChange('frequencyPenalty', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* System Message */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">System Message</label>
          <textarea
            value={formData.systemMessage || ''}
            onChange={(e) => handleFieldChange('systemMessage', e.target.value)}
            placeholder="Optional system message to set context for the AI"
            rows={3}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="text-sm text-muted-foreground">
          {validationStatus === 'valid' && 'Configuration is valid'}
          {validationStatus === 'invalid' && 'Please fix configuration errors'}
          {validationStatus === 'validating' && 'Validating configuration...'}
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => validateConfig(formData)}
            disabled={!formData.provider || !formData.apiKey || validationStatus === 'validating'}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Validate
          </button>
          
          <button
            onClick={handleSave}
            disabled={!formData.provider || !formData.apiKey || (!storagePreference.acknowledgedRisks && storagePreference.type !== 'none')}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default LLMConfigurationPanel;