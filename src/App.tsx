// src/App.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Settings } from 'lucide-react';
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
import { SimpleThemeToggle } from '@/components/ui';
// Lazy load settings panel since it's only shown when needed
const LLMConfigurationPanel = React.lazy(() =>
  import('@/components/settings').then(module => ({ default: module.LLMConfigurationPanel }))
);
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
      ui: {
        ...DEFAULT_UI_STATE,
        ...(urlState?.ui && Object.fromEntries(
          Object.entries(urlState.ui).filter(([_, value]) => value !== undefined)
        ))
      },
      isLoading: false,
      error: null,
    };
  });

  // Settings panel state
  const [showSettings, setShowSettings] = useState(false);

  // Theme management
  const { theme, resolvedTheme, toggleTheme } = useTheme(
    state.ui.theme,
    (newTheme) => {
      updateUIState({ theme: newTheme });
    }
  );

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
          
          // Validate the configuration before setting it
          const validation = llmProviderManager.validateConfig(provider, config);
          if (validation.success) {
            setState(prev => ({ ...prev, config: validation.data }));
            break; // Use the first available provider
          } else {
            console.warn(`Invalid configuration for ${provider}:`, validation.error.message);
            // Clear the invalid API key
            storageService.clearAPIKey(provider);
          }
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

  const sendSinglePrompt = useCallback(async (promptId: string) => {
    if (!state.config) {
      setError('No LLM configuration available');
      return;
    }

    const prompt = state.prompts.find(p => p.id === promptId);
    if (!prompt || !prompt.content.trim()) {
      return;
    }

    // Clear existing response for this prompt
    setState(prev => ({
      ...prev,
      responses: prev.responses.filter(r => r.promptId !== promptId),
      error: null
    }));

    try {
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
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }, [state.config, state.prompts, setError]);

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
      const promises = promptsWithContent
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

  // Memoized expensive computations
  const promptsWithContent = useMemo(() =>
    state.prompts.filter(p => p.content.trim().length > 0),
    [state.prompts]
  );


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
      sendSinglePrompt,
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
    sendSinglePrompt,
    clearResponses,
    setError,
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="w-full px-2 py-2">
        <header className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-4">
              <h1 className="text-4xl font-bold">
                Juxtaprompt
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <SimpleThemeToggle
                theme={theme}
                resolvedTheme={resolvedTheme}
                onToggle={toggleTheme}
              />
              <Button
                onClick={() => setShowSettings(true)}
                variant="ghost"
                size="icon"
                title="Open settings"
                aria-label="Open settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-center text-sm">
            Professional prompt comparison tool with real-time streaming responses
          </p>
        </header>

        <main>
          {/* Configuration Notice */}
          {!contextValue.config && (
            <Alert className="mb-6">
              <div className="text-yellow-600">⚠️</div>
              <AlertDescription>
                <h3 className="font-medium mb-1">
                  Configuration Required
                </h3>
                <p className="text-sm">
                  Please configure an LLM provider to start comparing prompts.
                  Add your API key in the settings panel.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {contextValue.error && (
            <Alert variant="destructive" className="mb-6">
              <div className="text-destructive">❌</div>
              <AlertDescription>
                <h3 className="font-medium mb-1">Error</h3>
                <p className="text-sm">{contextValue.error}</p>
                <Button
                  onClick={() => setError(null)}
                  variant="link"
                  size="sm"
                  className="mt-2 h-auto p-0 text-xs text-destructive hover:underline"
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
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
                  <Badge variant="secondary" className="text-xs">
                    {contextValue.config.provider} • {contextValue.config.model}
                  </Badge>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {promptsWithContent.length > 0 && contextValue.config && (
                  <Button
                    onClick={sendPrompts}
                    disabled={contextValue.isLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {contextValue.isLoading ? 'Sending...' : 'Send All Prompts'}
                  </Button>
                )}
                
                {contextValue.responses.length > 0 && (
                  <Button
                    onClick={clearResponses}
                    disabled={contextValue.isLoading}
                    variant="secondary"
                  >
                    Clear Responses
                  </Button>
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
              onSendSinglePrompt={sendSinglePrompt}
              isLoading={contextValue.isLoading}
              config={contextValue.config}
              uiState={contextValue.ui}
            />
          </div>
        </main>

        {/* Settings Modal */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>
                Configure your application preferences including theme and LLM settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Theme</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Choose your preferred theme
                  </span>
                  <SimpleThemeToggle
                    theme={theme}
                    resolvedTheme={resolvedTheme}
                    onToggle={toggleTheme}
                  />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-4">LLM Configuration</h3>
                <React.Suspense fallback={<div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                  <LLMConfigurationPanel
                    config={contextValue.config}
                    onConfigChange={setConfig}
                  />
                </React.Suspense>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default App;