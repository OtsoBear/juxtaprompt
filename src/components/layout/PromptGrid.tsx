// src/components/layout/PromptGrid.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { Plus, X, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import type { PromptGridProps } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';

/**
 * Responsive grid component for displaying prompts and responses
 * Features slider-based grid controls with auto-generated prompts
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
  const [gridColumns, setGridColumns] = useState(4);
  const [gridRows, setGridRows] = useState(2);
  const [fontSize, setFontSize] = useState(12);
  const [maxHeight, setMaxHeight] = useState(6);
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

  // Auto-generate prompts based on grid dimensions
  useEffect(() => {
    const targetPromptCount = gridColumns * gridRows;
    const currentPromptCount = prompts.length;
    
    if (targetPromptCount > currentPromptCount) {
      // Add more prompts
      const promptsToAdd = targetPromptCount - currentPromptCount;
      for (let i = 0; i < promptsToAdd; i++) {
        onPromptAdd('', `Prompt ${currentPromptCount + i + 1}`);
      }
    } else if (targetPromptCount < currentPromptCount) {
      // Remove excess prompts (from the end)
      const promptsToDelete = prompts.slice(targetPromptCount);
      
      // Remove the excess prompts
      promptsToDelete.forEach(prompt => {
        onPromptRemove(prompt.id);
      });
    }
  }, [gridColumns, gridRows, prompts.length, onPromptAdd, onPromptRemove]);

  const handleColumnsChange = useCallback((value: number[]) => {
    setGridColumns(value[0]);
  }, []);

  const handleRowsChange = useCallback((value: number[]) => {
    setGridRows(value[0]);
  }, []);

  const handleFontSizeChange = useCallback((value: number[]) => {
    setFontSize(value[0]);
  }, []);

  const handleMaxHeightChange = useCallback((value: number[]) => {
    setMaxHeight(value[0]);
  }, []);

  // Calculate textarea height based on content and max height setting
  const getTextareaHeight = useCallback((content: string) => {
    if (!content) return { height: '2rem' }; // 32px minimum
    const lines = content.split('\n').length;
    const estimatedLines = Math.max(lines, Math.ceil(content.length / 50)); // Estimate based on content length
    const actualLines = Math.min(estimatedLines, maxHeight);
    const heightInRem = Math.max(2, actualLines * 1.5); // 1.5rem per line, minimum 2rem
    return { height: `${heightInRem}rem` };
  }, [maxHeight]);

  const getResponseForPrompt = (promptId: string) => {
    return responses.find(response => response.promptId === promptId);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Grid Controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Grid</h2>
          <div className="text-xs text-muted-foreground">
            {gridColumns} × {gridRows} = {gridColumns * gridRows}
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Width Control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Width</label>
              <span className="text-xs text-muted-foreground">{gridColumns}</span>
            </div>
            <Slider
              value={[gridColumns]}
              onValueChange={handleColumnsChange}
              min={1}
              max={20}
              step={1}
              className="w-full"
            />
          </div>

          {/* Height Control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Height</label>
              <span className="text-xs text-muted-foreground">{gridRows}</span>
            </div>
            <Slider
              value={[gridRows]}
              onValueChange={handleRowsChange}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
          </div>

          {/* Font Size Control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Font</label>
              <span className="text-xs text-muted-foreground">{fontSize}px</span>
            </div>
            <Slider
              value={[fontSize]}
              onValueChange={handleFontSizeChange}
              min={8}
              max={16}
              step={1}
              className="w-full"
            />
          </div>

          {/* Max Height Control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Max Height</label>
              <span className="text-xs text-muted-foreground">{maxHeight} lines</span>
            </div>
            <Slider
              value={[maxHeight]}
              onValueChange={handleMaxHeightChange}
              min={2}
              max={20}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div
        className="prompt-grid-container"
        style={{
          gridTemplateColumns: `repeat(${gridColumns}, minmax(150px, 1fr))`
        }}
      >
        {prompts.map((prompt, index) => {
          const response = getResponseForPrompt(prompt.id);
          const isExpanded = expandedItems.has(prompt.id);
          const isStreaming = response?.response.isStreaming || false;
          const hasError = !!response?.response.error;

          return (
            <Card
              key={prompt.id}
              className={`transition-all duration-200 ${
                isExpanded ? 'col-span-full' : ''
              } ${hasError ? 'border-destructive' : ''}`}
            >
              {/* Card Header - Minimal */}
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0.5 pb-0">
                <span className="text-xs text-muted-foreground">
                  {Math.floor(index / gridColumns) + 1},{(index % gridColumns) + 1}
                </span>
                <Button
                  onClick={() => toggleExpanded(prompt.id)}
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4"
                  title={isExpanded ? 'Minimize' : 'Maximize'}
                >
                  {isExpanded ? (
                    <Minimize2 className="h-2 w-2" />
                  ) : (
                    <Maximize2 className="h-2 w-2" />
                  )}
                </Button>
              </CardHeader>

              {/* Prompt Input */}
              <CardContent className="p-0.5 space-y-1">
                <div>
                  <Textarea
                    value={prompt.content}
                    onChange={(e) => onPromptChange(prompt.id, e.target.value)}
                    disabled={isLoading}
                    placeholder="Prompt..."
                    className="resize-none p-1"
                    style={{
                      fontSize: `${fontSize}px`,
                      ...(isExpanded ? { height: '8rem' } : getTextareaHeight(prompt.content))
                    }}
                  />
                </div>

                {/* Response Section */}
                {response && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      {isStreaming && (
                        <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                      )}
                      {response.response.metadata.tokenCount && (
                        <span className="text-xs text-muted-foreground">{response.response.metadata.tokenCount}t</span>
                      )}
                    </div>

                    <div
                      className={`prompt-response-container ${
                        hasError ? 'prompt-response-error' : ''
                      }`}
                      style={
                        isExpanded
                          ? { minHeight: '12rem' }
                          : { minHeight: getTextareaHeight(response.response.content || '').height }
                      }
                    >
                      {hasError ? (
                        <div className="text-destructive" style={{ fontSize: `${fontSize}px` }}>
                          <div className="font-medium">Error</div>
                          <div>{response.response.error?.message || 'Unknown error occurred'}</div>
                        </div>
                      ) : response.response.content ? (
                        <div className="whitespace-pre-wrap" style={{ fontSize: `${fontSize}px` }}>
                          {response.response.content}
                          {isStreaming && (
                            <span className="inline-block w-1 h-2 bg-primary animate-pulse ml-1" />
                          )}
                        </div>
                      ) : (
                        <div className="text-muted-foreground italic" style={{ fontSize: `${fontSize}px` }}>
                          {isStreaming ? 'Waiting...' : 'No response'}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {isLoading && !response && (
                  <div className="prompt-loading-container">
                    <div className="flex items-center space-x-1 text-muted-foreground">
                      <div className="w-1 h-1 border border-primary border-t-transparent rounded-full animate-spin"></div>
                      <span style={{ fontSize: `${fontSize}px` }}>•••</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Grid Statistics */}
      {prompts.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
          <div>
            {prompts.length} prompts • {responses.length} responses
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptGrid;