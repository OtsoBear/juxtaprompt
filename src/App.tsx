// src/App.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  AppState,
  PromptItem,
  ResponseItem
} from '@/types/app';
import type { LLMProvider, LLMConfig } from '@/types/llm';
import { DEFAULT_UI_STATE, type UIState } from '@/types/url-state';
import { DEFAULT_PROVIDER_CONFIGS } from '@/types/llm';
import { storageService } from '@/services/storage';
import { urlStateManager } from '@/services/url-state';
import { llmProviderManager } from '@/services/llm';
import { openaiProvider, anthropicProvider, geminiProvider } from '@/services/llm/providers';
import { PromptGrid } from '@/components/layout';

/**
 * Main application component with comprehensive state management
 */
const App: React.FC = () => {
  // Initialize state
  const [state, setState] = useState<AppState>(() => {
    // Try to load state from URL first
    const urlState = urlStateManager.loadStateFromURL();
    
    return {
      prompts: urlState?.prompts.map((content, index) => ({
        id: `prompt-${index}`,
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })) || [
        {
          id: 'prompt-1',
          content: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'prompt-2',
          content: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      responses: [],
      config: null,
      ui: { ...DEFAULT_UI_STATE, ...urlState?.ui },
      isLoading: false,
      error: null,
    };
  });

  // Register LLM providers on mount
  useEffect(() => {
    llmProviderManager.registerProvider(openaiProvider);
    llmProviderManager.registerProvider(anthropicProvider);
    llmProviderManager.registerProvider(geminiProvider);

    return () => {
      // Cleanup on unmount
      llmProviderManager.cancelAllRequests();
    };
  }, []);

  // Load configuration from storage on mount
  useEffect(() => {
    const loadConfig = () => {
      // Try to get stored API keys and create config
      const providers: LLMProvider[] = ['openai', 'anthropic', 'gemini'];
      
      for (const provider of providers) {
        const apiKey = storageService.getAPIKey(provider);
        if (apiKey) {
          const defaultConfig = DEFAULT_PROVIDER_CONFIGS[provider];
          const config: LLMConfig = {
            ...defaultConfig,
            apiKey,
          };
          
          setState(prev => ({ ...prev, config }));
          break; // Use the first available provider
        }
      }
    };

    loadConfig();
  }, []);

  // Save state to URL when relevant parts change
  useEffect(() => {
    if (state.prompts.length > 0 || state.config) {
      const urlState = {
        prompts: state.prompts.map(p => p.content).filter(c => c.trim().length > 0),
        config: state.config ? {
          provider: state.config.provider,
          model: state.config.model,
          temperature: state.config.temperature,
          maxTokens: state.config.maxTokens,
          topP: state.config.topP,
          frequencyPenalty: state.config.frequencyPenalty,
          presencePenalty: state.config.presencePenalty,
          systemMessage: state.config.systemMessage,
        } : {},
        ui: state.ui,
      };
      
      urlStateManager.saveStateToURL(urlState);
    }
  }, [state.prompts, state.config, state.ui]);

  // Action handlers
  const addPrompt = useCallback((content: string = '', title?: string) => {
    const newPrompt: PromptItem = {
      id: `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      ...(title !== undefined && { title }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setState(prev => ({
      ...prev,
      prompts: [...prev.prompts, newPrompt],
    }));
  }, []);

  const updatePrompt = useCallback((id: string, content: string, title?: string) => {
    setState(prev => ({
      ...prev,
      prompts: prev.prompts.map(prompt =>
        prompt.id === id
          ? {
              ...prompt,
              content,
              ...(title !== undefined && { title }),
              updatedAt: Date.now()
            }
          : prompt
      ),
    }));
  }, []);

  const removePrompt = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      prompts: prev.prompts.filter(prompt => prompt.id !== id),
      responses: prev.responses.filter(response => response.promptId !== id),
    }));
  }, []);

  const clearPrompts = useCallback(() => {
    setState(prev => ({
      ...prev,
      prompts: [],
      responses: [],
    }));
  }, []);

  const setConfig = useCallback((config: LLMConfig) => {
    setState(prev => ({ ...prev, config }));
    
    // Save API key to storage
    storageService.saveAPIKey(config.provider, config.apiKey);
  }, []);

  const updateUIState = useCallback((updates: Partial<UIState>) => {
    setState(prev => ({
      ...prev,
      ui: { ...prev.ui, ...updates },
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const clearResponses = useCallback(() => {
    setState(prev => ({ ...prev, responses: [] }));
  }, []);

  const sendPrompts = useCallback(async () => {
    if (!state.config) {
      setError('No LLM configuration available');
      return;
    }

    if (state.prompts.length === 0) {
      setError('No prompts to send');
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    clearResponses();

    try {
      // Send all prompts concurrently
      const promises = state.prompts
        .filter(prompt => prompt.content.trim().length > 0)
        .map(async (prompt) => {
          const requestResult = llmProviderManager.createRequest(
            prompt.content,
            state.config!
          );

          if (!requestResult.success) {
            throw new Error(`Invalid request: ${requestResult.error.message}`);
          }

          const request = requestResult.data;
          let fullContent = '';

          try {
            for await (const chunk of llmProviderManager.sendStreamingRequest(request)) {
              if (chunk.content) {
                fullContent += chunk.content;
                
                // Update response in real-time
                setState(prev => {
                  const existingIndex = prev.responses.findIndex(r => r.promptId === prompt.id);
                  const response: ResponseItem = {
                    id: `response-${prompt.id}`,
                    promptId: prompt.id,
                    response: {
                      requestId: request.id,
                      content: fullContent,
                      isComplete: chunk.isComplete,
                      isStreaming: !chunk.isComplete,
                      metadata: {
                        ...(chunk.tokenCount !== undefined && { tokenCount: chunk.tokenCount }),
                        model: state.config!.model,
                        provider: state.config!.provider,
                        timestamp: Date.now(),
                      },
                    },
                    createdAt: Date.now(),
                  };

                  if (existingIndex >= 0) {
                    const newResponses = [...prev.responses];
                    newResponses[existingIndex] = response;
                    return { ...prev, responses: newResponses };
                  } else {
                    return { ...prev, responses: [...prev.responses, response] };
                  }
                });
              }

              if (chunk.isComplete) {
                break;
              }
            }
          } catch (error) {
            console.error(`Error streaming response for prompt ${prompt.id}:`, error);
            
            // Add error response
            const errorResponse: ResponseItem = {
              id: `response-${prompt.id}`,
              promptId: prompt.id,
              response: {
                requestId: request.id,
                content: '',
                isComplete: true,
                isStreaming: false,
                error: {
                  code: 'STREAMING_ERROR',
                  message: error instanceof Error ? error.message : 'Unknown streaming error',
                  retryable: true,
                },
                metadata: {
                  model: state.config!.model,
                  provider: state.config!.provider,
                  timestamp: Date.now(),
                },
              },
              createdAt: Date.now(),
            };

            setState(prev => {
              const existingIndex = prev.responses.findIndex(r => r.promptId === prompt.id);
              if (existingIndex >= 0) {
                const newResponses = [...prev.responses];
                newResponses[existingIndex] = errorResponse;
                return { ...prev, responses: newResponses };
              } else {
                return { ...prev, responses: [...prev.responses, errorResponse] };
              }
            });
          }
        });

      await Promise.allSettled(promises);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.config, state.prompts, setError, clearResponses]);

  // Memoized context value
  const contextValue = useMemo(() => ({
    ...state,
    actions: {
      addPrompt,
      updatePrompt,
      removePrompt,
      clearPrompts,
      setConfig,
      updateUIState,
      sendPrompts,
      clearResponses,
      setError,
    },
  }), [
    state,
    addPrompt,
    updatePrompt,
    removePrompt,
    clearPrompts,
    setConfig,
    updateUIState,
    sendPrompts,
    clearResponses,
    setError,
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-center mb-2">
            Juxtaprompt
          </h1>
          <p className="text-muted-foreground text-center">
            Professional prompt comparison tool with real-time streaming responses
          </p>
        </header>

        <main>
          {/* Configuration Notice */}
          {!contextValue.config && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="text-yellow-600">⚠️</div>
                <div>
                  <h3 className="font-medium text-yellow-800 mb-1">
                    Configuration Required
                  </h3>
                  <p className="text-sm text-yellow-700">
                    Please configure an LLM provider to start comparing prompts.
                    Add your API key in the settings panel.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {contextValue.error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="text-destructive">❌</div>
                <div>
                  <h3 className="font-medium text-destructive mb-1">Error</h3>
                  <p className="text-sm">{contextValue.error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="mt-2 text-xs text-destructive hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-sm text-muted-foreground">
                  {contextValue.prompts.length} prompt{contextValue.prompts.length !== 1 ? 's' : ''} •
                  {contextValue.responses.length} response{contextValue.responses.length !== 1 ? 's' : ''}
                </div>
                {contextValue.config && (
                  <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    {contextValue.config.provider} • {contextValue.config.model}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {contextValue.prompts.some(p => p.content.trim()) && contextValue.config && (
                  <button
                    onClick={sendPrompts}
                    disabled={contextValue.isLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {contextValue.isLoading ? 'Sending...' : 'Send All Prompts'}
                  </button>
                )}
                
                {contextValue.responses.length > 0 && (
                  <button
                    onClick={clearResponses}
                    disabled={contextValue.isLoading}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Clear Responses
                  </button>
                )}
              </div>
            </div>

            {/* Prompt Grid */}
            <PromptGrid
              prompts={contextValue.prompts}
              responses={contextValue.responses}
              onPromptChange={updatePrompt}
              onPromptRemove={removePrompt}
              onPromptAdd={addPrompt}
              isLoading={contextValue.isLoading}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;