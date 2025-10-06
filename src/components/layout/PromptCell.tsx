// src/components/layout/PromptCell.tsx
import React, { useState } from 'react';
import { 
  Maximize2, Minimize2, Play, Square, RotateCcw, Copy, Pin, PinOff, 
  ChevronDown, ChevronUp, Trash2, Files 
} from 'lucide-react';
import type { PromptItem, ResponseItem, PromptSettings } from '@/types/app';
import type { LLMConfig } from '@/types/llm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { llmProviderManager } from '@/services/llm';
import { promptTemplateService } from '@/services/prompt-template';

interface PromptCellProps {
  prompt: PromptItem;
  response: ResponseItem | undefined;
  promptSettings: PromptSettings;
  isExpanded: boolean;
  isPinned: boolean;
  fontSize: number;
  maxHeight: number;
  isLoading: boolean;
  config: LLMConfig | null | undefined;
  onPromptChange: (id: string, updates: Partial<Omit<PromptItem, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  onSendSinglePrompt: ((id: string) => void) | undefined;
  onToggleExpanded: (id: string) => void;
  onTogglePin: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  gridPosition: { row: number; col: number };
}

/**
 * Individual prompt cell with enhanced three-tiered input support
 */
export const PromptCell: React.FC<PromptCellProps> = React.memo(({
  prompt,
  response,
  promptSettings,
  isExpanded,
  isPinned,
  fontSize,
  maxHeight,
  isLoading,
  config,
  onPromptChange,
  onSendSinglePrompt,
  onToggleExpanded,
  onTogglePin,
  onDuplicate,
  onRemove,
  gridPosition,
}) => {
  const [showVariables, setShowVariables] = useState(false);
  const [showSystemMessage, setShowSystemMessage] = useState(false);

  const isStreaming = response?.response.isStreaming || false;
  const hasError = !!response?.response.error;
  const status = getStatus();
  const tokenCount = response?.response.metadata.tokenCount;
  const duration = response?.response.metadata.duration;

  // Extract variables from the current prompt template
  const currentTemplate = promptSettings.sharedUserPrompt
    ? promptSettings.globalUserPrompt
    : prompt.content;
  const extractedVariables = promptTemplateService.extractVariables(currentTemplate);
  const hasVariables = extractedVariables.length > 0;

  // Merge global variables with local variables (local overrides global)
  const variables = prompt.variables || {};
  const mergedVariables = extractedVariables.reduce((acc, varName) => {
    // Priority: local variable > global variable > empty string
    acc[varName] = variables[varName] ?? promptSettings.globalVariables[varName] ?? '';
    return acc;
  }, {} as Record<string, string>);

  function getStatus() {
    if (!response) return 'idle';
    if (response.response.error) return 'error';
    if (response.response.isStreaming) return 'streaming';
    if (response.response.isComplete) return 'complete';
    return 'idle';
  }

  function statusColor(status: string) {
    switch (status) {
      case 'streaming': return 'bg-blue-100 text-blue-700';
      case 'complete': return 'bg-green-100 text-green-700';
      case 'error': return 'bg-red-100 text-red-700';
      default: return 'bg-muted text-muted-foreground';
    }
  }

  const stopPrompt = () => {
    if (response?.response.requestId) {
      llmProviderManager.cancelRequest(response.response.requestId);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const getLineHeight = (size: number) => {
    const ratio = size <= 10 ? 1.4 : size <= 12 ? 1.3 : 1.2;
    return size * ratio;
  };

  const getTextareaHeight = (content: string) => {
    if (!content) return { height: '2rem' };
    const lines = content.split('\n').length;
    const estimatedLines = Math.max(lines, Math.ceil(content.length / 50));
    const actualLines = Math.min(estimatedLines, maxHeight);
    const heightInRem = Math.max(2, actualLines * 1.5);
    return { height: `${heightInRem}rem` };
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (onSendSinglePrompt && config && (prompt.content.trim() || hasVariables)) {
        onSendSinglePrompt(prompt.id);
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      if (isExpanded) {
        onToggleExpanded(prompt.id);
        e.preventDefault();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'c')) {
      if (response?.response.content) {
        void copyText(response.response.content);
        e.preventDefault();
      }
    }
  };

  return (
    <Card
      className={`transition-all duration-200 ${isExpanded ? 'col-span-full' : ''} ${hasError ? 'border-destructive' : ''}`}
      title={`${gridPosition.row},${gridPosition.col}`}
    >
      {/* Card Header */}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-1 pb-0">
        <div className="flex items-center space-x-1 w-full">
          <Input
            value={prompt.title ?? ''}
            onChange={(e) => onPromptChange(prompt.id, { title: e.target.value })}
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
          <Button
            onClick={() => onTogglePin(prompt.id)}
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={isPinned ? 'unpin' : 'pin'}
          >
            {isPinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
          </Button>
          <Button
            onClick={() => onToggleExpanded(prompt.id)}
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={isExpanded ? 'minimize' : 'maximize'}
          >
            {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-1 space-y-1">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <Button
              onClick={() => onSendSinglePrompt?.(prompt.id)}
              disabled={isLoading || !config || (!prompt.content.trim() && !hasVariables)}
              variant="outline"
              size="sm"
              className="h-6 px-2"
            >
              <Play className="h-3 w-3 mr-1" /> send
            </Button>
            <Button
              onClick={stopPrompt}
              disabled={!isStreaming}
              variant="outline"
              size="sm"
              className="h-6 px-2"
            >
              <Square className="h-3 w-3 mr-1" /> stop
            </Button>
            <Button
              onClick={() => onSendSinglePrompt?.(prompt.id)}
              disabled={isLoading || !config}
              variant="outline"
              size="sm"
              className="h-6 px-2"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> retry
            </Button>
          </div>

          <div className="flex items-center space-x-0.5 flex-shrink-0">
            <Button
              onClick={() => onDuplicate(prompt.id)}
              variant="ghost"
              size="icon"
              title="Duplicate this prompt with all settings"
              className="h-6 w-6 flex-shrink-0"
            >
              <Files className="h-3 w-3 flex-shrink-0" />
            </Button>
            <Button
              onClick={() => void copyText(prompt.content)}
              variant="ghost"
              size="icon"
              title="Copy prompt to clipboard"
              className="h-6 w-6 flex-shrink-0"
            >
              <Copy className="h-3 w-3 flex-shrink-0" />
            </Button>
            <Button
              onClick={() => {
                const text = response?.response.content ?? '';
                if (text) void copyText(text);
              }}
              variant="ghost"
              size="icon"
              title="Copy response to clipboard"
              className="h-6 w-6 flex-shrink-0"
              disabled={!response?.response.content}
            >
              <Copy className="h-3 w-3 flex-shrink-0" />
            </Button>
            <Button
              onClick={() => {
                if (!prompt.content.trim() || window.confirm('Remove this prompt?')) {
                  onRemove(prompt.id);
                }
              }}
              variant="ghost"
              size="icon"
              title="Delete this prompt"
              className="h-6 w-6 text-destructive flex-shrink-0"
            >
              <Trash2 className="h-3 w-3 flex-shrink-0" />
            </Button>
          </div>
        </div>

        {/* System Message Section */}
        {!promptSettings.sharedSystemMessage && (
          <div className="space-y-1">
            <Button
              onClick={() => setShowSystemMessage(!showSystemMessage)}
              variant="ghost"
              size="sm"
              className="h-5 px-2 w-full justify-between"
            >
              <span className="text-xs">System Message</span>
              {showSystemMessage ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            {showSystemMessage && (
              <Textarea
                value={prompt.systemMessage || ''}
                onChange={(e) => onPromptChange(prompt.id, { systemMessage: e.target.value })}
                placeholder="System message (optional)..."
                className="resize-none p-1 text-xs"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: `${getLineHeight(fontSize)}px`,
                  height: '3rem',
                }}
              />
            )}
          </div>
        )}

        {/* User Prompt Section */}
        {!promptSettings.sharedUserPrompt && (
          <div className="space-y-1">
            <Label className="text-xs">User Prompt</Label>
            <Textarea
              value={prompt.content}
              onChange={(e) => onPromptChange(prompt.id, { content: e.target.value })}
              onKeyDown={handleTextareaKeyDown}
              disabled={isLoading}
              placeholder="Enter your prompt... Use {{variable}} for placeholders"
              className="resize-none p-1 font-mono"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: `${getLineHeight(fontSize)}px`,
                ...(isExpanded ? { height: '8rem' } : getTextareaHeight(prompt.content))
              }}
            />
          </div>
        )}

        {/* Variables Section */}
        {hasVariables && (
          <div className="space-y-1">
            <Button
              onClick={() => setShowVariables(!showVariables)}
              variant="ghost"
              size="sm"
              className="h-5 px-2 w-full justify-between"
            >
              <span className="text-xs">Variables ({extractedVariables.length})</span>
              {showVariables ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            {showVariables && (
              <div className="space-y-1 bg-muted p-2 rounded">
                {extractedVariables.map((varName) => {
                  const hasGlobalValue = promptSettings.globalVariables[varName];
                  const hasLocalValue = variables[varName] !== undefined;
                  return (
                    <div key={varName} className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-mono">{varName}</Label>
                        {hasGlobalValue && !hasLocalValue && (
                          <span className="text-[10px] text-muted-foreground">(global)</span>
                        )}
                      </div>
                      <Input
                        value={mergedVariables[varName] || ''}
                        onChange={(e) => {
                          const newVars = { ...variables, [varName]: e.target.value };
                          onPromptChange(prompt.id, { variables: newVars });
                        }}
                        placeholder={
                          hasGlobalValue
                            ? `Local override (global: "${promptSettings.globalVariables[varName]}")`
                            : `Value for ${varName}`
                        }
                        className="h-6 text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Response Section */}
        {response && (
          <div className="space-y-1">
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
});

PromptCell.displayName = 'PromptCell';

export default PromptCell;