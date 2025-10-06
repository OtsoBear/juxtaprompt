// src/components/layout/PromptGrid.tsx
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Zap, ZapOff } from 'lucide-react';
import type { PromptGridProps } from '@/types/app';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { PromptCell } from './PromptCell';

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
  promptSettings,
  onPromptChange,
  onPromptRemove,
  onPromptDuplicate,
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
  const handlePromptChange = useCallback((
    id: string,
    updates: Partial<Omit<import('@/types/app').PromptItem, 'id' | 'createdAt' | 'updatedAt'>>
  ) => {
    onPromptChange(id, updates);

    // Trigger debounced auto-send if enabled and content changed
    if (autoSend && updates.content !== undefined && updates.content.trim()) {
      debouncedAutoSend(id, updates.content);
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

  const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

  const togglePin = useCallback((id: string) => {
    const next = isPinned(id)
      ? pinnedIds.filter(x => x !== id)
      : [...pinnedIds, id];
    onUIStateChange?.({ comparePinnedIds: next });
  }, [isPinned, pinnedIds, onUIStateChange]);

  const getResponseForPrompt = useCallback((promptId: string) => {
    return responses.find(response => response.promptId === promptId);
  }, [responses]);

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
          const row = Math.floor(index / gridColumns) + 1;
          const col = (index % gridColumns) + 1;

          return (
            <PromptCell
              key={prompt.id}
              prompt={prompt}
              response={response}
              promptSettings={promptSettings}
              isExpanded={isExpanded}
              isPinned={isPinned(prompt.id)}
              fontSize={fontSize}
              maxHeight={maxHeight}
              isLoading={isLoading}
              config={config}
              onPromptChange={handlePromptChange}
              onSendSinglePrompt={onSendSinglePrompt}
              onToggleExpanded={toggleExpanded}
              onTogglePin={togglePin}
              onDuplicate={onPromptDuplicate}
              onRemove={onPromptRemove}
              gridPosition={{ row, col }}
            />
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
