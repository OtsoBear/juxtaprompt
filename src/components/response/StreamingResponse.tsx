// src/components/response/StreamingResponse.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Copy, Download, RefreshCw } from 'lucide-react';
import type { LLMResponse } from '@/types/llm';

interface StreamingResponseProps {
  response: LLMResponse;
  className?: string;
  onRetry?: () => void;
  showActions?: boolean;
}

/**
 * Component for displaying streaming LLM responses with real-time updates
 */
export const StreamingResponse: React.FC<StreamingResponseProps> = ({
  response,
  className = '',
  onRetry,
  showActions = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (response.isStreaming && isAutoScrolling && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [response.content, response.isStreaming, isAutoScrolling]);

  // Handle manual scrolling to disable auto-scroll
  const handleScroll = () => {
    if (!contentRef.current || !response.isStreaming) return;

    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    
    setIsAutoScrolling(isAtBottom);

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Re-enable auto-scroll after 3 seconds of no manual scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      setIsAutoScrolling(true);
    }, 3000);
  };

  // Copy content to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(response.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  // Download content as text file
  const handleDownload = () => {
    const blob = new Blob([response.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${response.requestId}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Format elapsed time
  const getElapsedTime = () => {
    const elapsed = Date.now() - response.metadata.timestamp;
    if (elapsed < 1000) return `${elapsed}ms`;
    if (elapsed < 60000) return `${(elapsed / 1000).toFixed(1)}s`;
    return `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`;
  };

  // Error state
  if (response.error) {
    return (
      <div className={`border rounded-lg ${className}`}>
        <div className="p-4 bg-destructive/5 border-destructive">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-destructive rounded-full"></div>
              <span className="text-sm font-medium text-destructive">Error</span>
            </div>
            {onRetry && response.error.retryable && (
              <button
                onClick={onRetry}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-destructive/10 text-destructive rounded hover:bg-destructive/20 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
          
          <div className="text-sm text-destructive mb-2">
            {response.error.message}
          </div>
          
          {response.error.retryable && (
            <div className="text-xs text-destructive/70">
              This error is retryable. You can try sending the request again.
            </div>
          )}
          
          {response.error.details !== undefined && (
            <details className="mt-2">
              <summary className="text-xs text-destructive/70 cursor-pointer hover:text-destructive">
                Error Details
              </summary>
              <pre className="mt-1 text-xs bg-destructive/5 p-2 rounded overflow-auto">
                {typeof response.error.details === 'string'
                  ? response.error.details
                  : JSON.stringify(response.error.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              response.isStreaming 
                ? 'bg-green-500 animate-pulse' 
                : response.isComplete 
                  ? 'bg-blue-500' 
                  : 'bg-gray-400'
            }`}></div>
            <span className="text-sm font-medium">
              {response.isStreaming ? 'Streaming...' : response.isComplete ? 'Complete' : 'Pending'}
            </span>
          </div>
          
          <div className="text-xs text-muted-foreground">
            {response.metadata.model} • {getElapsedTime()}
          </div>
          
          {response.metadata.tokenCount && (
            <div className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
              {response.metadata.tokenCount} tokens
            </div>
          )}
        </div>

        {showActions && response.content && (
          <div className="flex items-center space-x-1">
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Copy to clipboard"
            >
              <Copy className="h-4 w-4" />
            </button>
            
            <button
              onClick={handleDownload}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Download as text file"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="p-4 max-h-96 overflow-y-auto scrollbar-thin"
      >
        {response.content ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {response.content}
            {response.isStreaming && (
              <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-1 align-text-bottom" />
            )}
          </div>
        ) : (
          <div className="text-muted-foreground text-sm italic">
            {response.isStreaming ? 'Waiting for response...' : 'No content yet'}
          </div>
        )}
      </div>

      {/* Footer */}
      {response.isComplete && response.metadata.duration && (
        <div className="px-4 py-2 bg-muted/20 border-t text-xs text-muted-foreground">
          Completed in {response.metadata.duration}ms
        </div>
      )}

      {/* Copy feedback */}
      {copied && (
        <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded shadow-lg">
          Copied!
        </div>
      )}

      {/* Auto-scroll indicator */}
      {response.isStreaming && !isAutoScrolling && (
        <div className="absolute bottom-2 right-2">
          <button
            onClick={() => {
              setIsAutoScrolling(true);
              if (contentRef.current) {
                contentRef.current.scrollTop = contentRef.current.scrollHeight;
              }
            }}
            className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded shadow-lg hover:bg-primary/90 transition-colors"
          >
            ↓ Auto-scroll
          </button>
        </div>
      )}
    </div>
  );
};

export default StreamingResponse;