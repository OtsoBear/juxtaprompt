// src/components/layout/PromptGrid.tsx
import React, { useState, useCallback } from 'react';
import { Plus, X, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import type { PromptGridProps } from '@/types/app';

/**
 * Responsive grid component for displaying prompts and responses
 * Features manual size controls and responsive layout
 */
export const PromptGrid: React.FC<PromptGridProps> = ({
  prompts,
  responses,
  onPromptChange,
  onPromptRemove,
  onPromptAdd,
  isLoading,
  className = '',
}) => {
  const [gridColumns, setGridColumns] = useState(2);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const getGridCols = () => {
    switch (gridColumns) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-1 md:grid-cols-2';
      case 3: return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      case 4: return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
      default: return 'grid-cols-1 md:grid-cols-2';
    }
  };

  const getResponseForPrompt = (promptId: string) => {
    return responses.find(response => response.promptId === promptId);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Grid Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold">Prompt Comparison</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Columns:</span>
            {[1, 2, 3, 4].map(cols => (
              <button
                key={cols}
                onClick={() => setGridColumns(cols)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  gridColumns === cols
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {cols}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onPromptAdd()}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Prompt</span>
        </button>
      </div>

      {/* Grid */}
      <div className={`grid gap-6 ${getGridCols()}`}>
        {prompts.map((prompt, index) => {
          const response = getResponseForPrompt(prompt.id);
          const isExpanded = expandedItems.has(prompt.id);
          const isStreaming = response?.response.isStreaming || false;
          const hasError = !!response?.response.error;

          return (
            <div
              key={prompt.id}
              className={`border rounded-lg transition-all duration-200 ${
                isExpanded ? 'col-span-full' : ''
              } ${hasError ? 'border-destructive' : 'border-border'}`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center space-x-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Prompt {index + 1}</span>
                  {prompt.title && (
                    <span className="text-sm text-muted-foreground">
                      - {prompt.title}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleExpanded(prompt.id)}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title={isExpanded ? 'Minimize' : 'Maximize'}
                  >
                    {isExpanded ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </button>

                  {prompts.length > 1 && (
                    <button
                      onClick={() => onPromptRemove(prompt.id)}
                      disabled={isLoading}
                      className="p-1 hover:bg-destructive/10 text-destructive rounded transition-colors disabled:opacity-50"
                      title="Remove prompt"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Prompt Input */}
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Prompt
                  </label>
                  <textarea
                    value={prompt.content}
                    onChange={(e) => onPromptChange(prompt.id, e.target.value)}
                    disabled={isLoading}
                    placeholder="Enter your prompt here..."
                    className={`w-full p-3 border rounded-lg resize-none transition-all focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
                      isExpanded ? 'h-32' : 'h-24'
                    }`}
                  />
                </div>

                {/* Response Section */}
                {response && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium">
                        Response
                      </label>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        {isStreaming && (
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span>Streaming...</span>
                          </div>
                        )}
                        {response.response.metadata.tokenCount && (
                          <span>{response.response.metadata.tokenCount} tokens</span>
                        )}
                        <span>{response.response.metadata.model}</span>
                      </div>
                    </div>

                    <div
                      className={`p-3 border rounded-lg bg-muted/30 ${
                        hasError ? 'border-destructive bg-destructive/5' : ''
                      } ${isExpanded ? 'min-h-48' : 'min-h-32'}`}
                    >
                      {hasError ? (
                        <div className="text-destructive">
                          <div className="font-medium mb-1">Error</div>
                          <div className="text-sm">
                            {response.response.error?.message || 'Unknown error occurred'}
                          </div>
                          {response.response.error?.retryable && (
                            <div className="text-xs mt-2 opacity-75">
                              This error is retryable. Try sending the prompt again.
                            </div>
                          )}
                        </div>
                      ) : response.response.content ? (
                        <div className="whitespace-pre-wrap text-sm">
                          {response.response.content}
                          {isStreaming && (
                            <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
                          )}
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-sm italic">
                          {isStreaming ? 'Waiting for response...' : 'No response yet'}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {isLoading && !response && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">
                      Response
                    </label>
                    <div className="p-3 border rounded-lg bg-muted/30 min-h-32 flex items-center justify-center">
                      <div className="flex items-center space-x-2 text-muted-foreground">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm">Preparing request...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {prompts.length === 0 && (
        <div className="text-center py-16">
          <div className="text-muted-foreground mb-4">
            <div className="text-4xl mb-2">📝</div>
            <h3 className="text-lg font-medium mb-2">No prompts yet</h3>
            <p className="text-sm">Add your first prompt to start comparing responses</p>
          </div>
          <button
            onClick={() => onPromptAdd()}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Add Your First Prompt
          </button>
        </div>
      )}

      {/* Grid Statistics */}
      {prompts.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
          <div>
            {prompts.length} prompt{prompts.length !== 1 ? 's' : ''} • {responses.length} response{responses.length !== 1 ? 's' : ''}
          </div>
          <div>
            Grid: {gridColumns} column{gridColumns !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptGrid;