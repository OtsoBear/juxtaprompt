// src/components/layout/PromptGrid.tsx
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Maximize2, Minimize2, Zap, ZapOff, Play, Square, RotateCcw, Copy, Pin, PinOff } from 'lucide-react';
import type { PromptGridProps } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { llmProviderManager } from '@/services/llm';

/**
 * Responsive grid component for displaying prompts and responses
 * Now non-destructive: grid size never deletes prompts; overflow is hidden with a counter.
 * Grid, autosend, and layout controls are persisted via uiState/onUIStateChange.
 * Per-card actions: send, stop, retry, copy prompt/response, pin to compare, title edit.
 * Streaming feedback: status chip, tokens, elapsed time; keyboard shortcuts.
 */
export const PromptGrid: React.FC<PromptGridProps> = React.memo(({
  prompts,
  responses,
  onPromptChange,
  onPromptRemove,
  onPromptAdd,
  onSendSinglePrompt,
  isLoading,
  config,
  uiState,
  onUIStateChange,
  className = '',
}) => {
  // Derived UI state (controlled)
  const gridColumns = uiState?.gridColumns ?? 4;
  const gridRows = uiState?.gridRows ?? 2;
  const fontSize = uiState?.fontSize ?? 12;
  const maxHeight = uiState?.maxHeight ?? 6;
  const autoSend = uiState?.autoSend ?? false;
  const debounceMs = uiState?.debounceMs ?? 1000;
  const pinnedIds = uiState?.comparePinnedIds ?? [];

  // Local UI state
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const visibleSlots = Math.max(1, gridColumns * gridRows);
  const promptsToRender = useMemo(() => prompts.slice(0, visibleSlots), [prompts, visibleSlots]);
  const overflowCount = Math.max(0, prompts.length - visibleSlots);

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

  // Debounced auto-send function
  const debouncedAutoSend = useCallback((promptId: string, content: string) => {
    if (!autoSend || !onSendSinglePrompt || !config || !content.trim()) {
      return;
    }

    // Clear existing timer for this prompt
    const existingTimer = debounceTimers.current.get(promptId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      onSendSinglePrompt(promptId);
      debounceTimers.current.delete(promptId);
    }, debounceMs);

    debounceTimers.current.set(promptId, timer);
  }, [autoSend, onSendSinglePrompt, config, debounceMs]);

  // Enhanced prompt change handler with auto-send
  const handlePromptChange = useCallback((id: string, content: string) => {
    onPromptChange(id, content);

    // Trigger debounced auto-send if enabled
    if (autoSend && content.trim()) {
      debouncedAutoSend(id, content);
    }
  }, [onPromptChange, autoSend, debouncedAutoSend]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // Handlers to persist UI layout controls
  const handleColumnsChange = useCallback((value: number[]) => {
    onUIStateChange?.({ gridColumns: value[0] });
  }, [onUIStateChange]);

  const handleRowsChange = useCallback((value: number[]) => {
    onUIStateChange?.({ gridRows: value[0] });
  }, [onUIStateChange]);

  const handleFontSizeChange = useCallback((value: number[]) => {
    onUIStateChange?.({ fontSize: value[0] });
  }, [onUIStateChange]);

  const handleMaxHeightChange = useCallback((value: number[]) => {
    onUIStateChange?.({ maxHeight: value[0] });
  }, [onUIStateChange]);

  const handleAutoSendToggle = useCallback((checked: boolean) => {
    onUIStateChange?.({ autoSend: checked });
  }, [onUIStateChange]);

  const handleDebounceChange = useCallback((value: number[]) => {
    onUIStateChange?.({ debounceMs: value[0] });
  }, [onUIStateChange]);

  // Calculate line height based on font size for better text density
  const getLineHeight = useCallback((size: number) => {
    const ratio = size <= 10 ? 1.4 : size <= 12 ? 1.3 : 1.2;
    return size * ratio;
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

  const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

  const togglePin = useCallback((id: string) => {
    const next = isPinned(id)
      ? pinnedIds.filter(x => x !== id)
      : [...pinnedIds, id];
    onUIStateChange?.({ comparePinnedIds: next });
  }, [isPinned, pinnedIds, onUIStateChange]);

  // Clipboard helpers
  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  // Status helpers
  const getStatus = (promptId: string) => {
    const resp = getResponseForPrompt(promptId);
    if (!resp) return 'idle';
    if (resp.response.error) return 'error';
    if (resp.response.isStreaming) return 'streaming';
    if (resp.response.isComplete) return 'complete';
    return 'idle';
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'streaming': return 'bg-blue-100 text-blue-700';
      case 'complete': return 'bg-green-100 text-green-700';
      case 'error': return 'bg-red-100 text-red-700';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, promptId: string, content: string) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (onSendSinglePrompt && config && content.trim()) {
        onSendSinglePrompt(promptId);
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      if (expandedItems.has(promptId)) {
        toggleExpanded(promptId);
        e.preventDefault();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'c')) {
      const resp = getResponseForPrompt(promptId);
      if (resp?.response.content) {
        void copyText(resp.response.content);
        e.preventDefault();
      }
    } else if (e.key === 'Delete') {
      if (content.trim().length > 0) {
        if (!window.confirm('remove this prompt?')) return;
      }
      onPromptRemove(promptId);
      e.preventDefault();
    }
  };

  const stopPrompt = (promptId: string) => {
    const resp = getResponseForPrompt(promptId);
    if (resp?.response.requestId) {
      llmProviderManager.cancelRequest(resp.response.requestId);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Grid Controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">grid</h2>
          <div className="text-xs text-muted-foreground">
            {gridColumns} × {gridRows} = {visibleSlots}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* width */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">width</label>
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

          {/* height */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">height</label>
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

          {/* font */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">font</label>
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

          {/* max height */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">max height</label>
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

          {/* auto-send */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">auto-send</label>
              {autoSend ? (
                <Zap className="h-3 w-3 text-green-500" />
              ) : (
                <ZapOff className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={autoSend}
                onCheckedChange={(checked) => handleAutoSendToggle(!!checked)}
                disabled={!config}
              />
              <span className="text-xs text-muted-foreground">
                {config ? 'enabled' : 'no config'}
              </span>
            </div>
          </div>

          {/* delay */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">delay</label>
              <span className="text-xs text-muted-foreground">{debounceMs}ms</span>
            </div>
            <Slider
              value={[debounceMs]}
              onValueChange={handleDebounceChange}
              min={500}
              max={5000}
              step={250}
              className="w-full"
              disabled={!autoSend}
            />
          </div>
        </div>

        {overflowCount > 0 && (
          <div className="text-xs text-muted-foreground">
            +{overflowCount} hidden (increase grid or scroll to manage prompts)
          </div>
        )}
      </div>

      {/* Grid */}
      <div
        className="prompt-grid-container"
        style={{
          gridTemplateColumns: `repeat(${gridColumns}, minmax(150px, 1fr))`
        }}
      >
        {promptsToRender.map((prompt, index) => {
          const response = getResponseForPrompt(prompt.id);
          const isExpanded = expandedItems.has(prompt.id);
          const isStreaming = response?.response.isStreaming || false;
          const hasError = !!response?.response.error;
          const status = getStatus(prompt.id);
          const tokenCount = response?.response.metadata.tokenCount;
          const duration = response?.response.metadata.duration;

          const row = Math.floor(index / gridColumns) + 1;
          const col = (index % gridColumns) + 1;

          return (
            <Card
              key={prompt.id}
              className={`transition-all duration-200 ${isExpanded ? 'col-span-full' : ''} ${hasError ? 'border-destructive' : ''}`}
              title={`${row},${col}`}
            >
              {/* Card Header: title + actions + expand + pin */}
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-1 pb-0">
                <div className="flex items-center space-x-1 w-full">
                  <Input
                    value={prompt.title ?? ''}
                    onChange={(e) => onPromptChange(prompt.id, prompt.content, e.target.value)}
                    placeholder="title"
                    className="h-6 text-xs"
                  />
                  <Badge className={`text-[10px] ${statusColor(status)} capitalize`} role="status">
                    {status}
                  </Badge>
                  {typeof tokenCount === 'number' && (
                    <Badge variant="secondary" className="text-[10px]">tokens: {tokenCount}</Badge>
                  )}
                  {typeof duration === 'number' && (
                    <Badge variant="secondary" className="text-[10px]">time: {duration}ms</Badge>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  {/* pin */}
                  <Button
                    onClick={() => togglePin(prompt.id)}
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title={isPinned(prompt.id) ? 'unpin' : 'pin'}
                    aria-label={isPinned(prompt.id) ? 'unpin' : 'pin'}
                  >
                    {isPinned(prompt.id) ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
                  </Button>

                  {/* expand/collapse */}
                  <Button
                    onClick={() => toggleExpanded(prompt.id)}
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title={isExpanded ? 'minimize' : 'maximize'}
                    aria-label={isExpanded ? 'minimize' : 'maximize'}
                  >
                    {isExpanded ? (
                      <Minimize2 className="h-3 w-3" />
                    ) : (
                      <Maximize2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </CardHeader>

              {/* Prompt Input + toolbar + response */}
              <CardContent className="p-1 space-y-1">
                {/* toolbar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Button
                      onClick={() => onSendSinglePrompt?.(prompt.id)}
                      disabled={isLoading || !config || !prompt.content.trim()}
                      variant="outline"
                      size="sm"
                      title="send"
                      aria-label="send"
                      className="h-6 px-2"
                    >
                      <Play className="h-3 w-3 mr-1" /> send
                    </Button>

                    <Button
                      onClick={() => stopPrompt(prompt.id)}
                      disabled={!isStreaming}
                      variant="outline"
                      size="sm"
                      title="stop"
                      aria-label="stop"
                      className="h-6 px-2"
                    >
                      <Square className="h-3 w-3 mr-1" /> stop
                    </Button>

                    <Button
                      onClick={() => onSendSinglePrompt?.(prompt.id)}
                      disabled={isLoading || !config}
                      variant="outline"
                      size="sm"
                      title="retry"
                      aria-label="retry"
                      className="h-6 px-2"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> retry
                    </Button>
                  </div>

                  <div className="flex items-center space-x-1">
                    <Button
                      onClick={() => void copyText(prompt.content)}
                      variant="ghost"
                      size="icon"
                      title="copy prompt"
                      aria-label="copy prompt"
                      className="h-6 w-6"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      onClick={() => {
                        const text = response?.response.content ?? '';
                        if (text) void copyText(text);
                      }}
                      variant="ghost"
                      size="icon"
                      title="copy response"
                      aria-label="copy response"
                      className="h-6 w-6"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* prompt textarea */}
                <div>
                  <Textarea
                    value={prompt.content}
                    onChange={(e) => handlePromptChange(prompt.id, e.target.value)}
                    onKeyDown={(e) => handleTextareaKeyDown(e, prompt.id, prompt.content)}
                    disabled={isLoading}
                    placeholder="prompt..."
                    className="resize-none p-1"
                    style={{
                      fontSize: `${fontSize}px`,
                      lineHeight: `${getLineHeight(fontSize)}px`,
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
                      <div className="flex items-center space-x-2">
                        {typeof tokenCount === 'number' && (
                          <span className="text-xs text-muted-foreground">tokens: {tokenCount}</span>
                        )}
                        {typeof duration === 'number' && (
                          <span className="text-xs text-muted-foreground">time: {duration}ms</span>
                        )}
                      </div>
                    </div>

                    <div
                      className={`prompt-response-container ${hasError ? 'prompt-response-error' : ''}`}
                      style={
                        isExpanded
                          ? { minHeight: '12rem' }
                          : { minHeight: getTextareaHeight(response.response.content || '').height }
                      }
                      aria-live="polite"
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
                          {isStreaming ? 'waiting...' : 'no response'}
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
            {prompts.length} prompts • {responses.length} responses {overflowCount > 0 ? `• +${overflowCount} hidden` : ''}
          </div>
        </div>
      )}
    </div>
  );
});

export default PromptGrid;
