// src/components/response/ResponseComparison.tsx
import React, { useState, useMemo } from 'react';
import { BarChart3, Clock, Zap, FileText } from 'lucide-react';
import type { ResponseItem } from '@/types/app';
import { StreamingResponse } from './StreamingResponse';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ResponseComparisonProps {
  responses: ResponseItem[];
  className?: string;
}

/**
 * Component for comparing multiple LLM responses side by side
 */
export const ResponseComparison: React.FC<ResponseComparisonProps> = ({
  responses,
  className = '',
}) => {
  const [selectedMetric, setSelectedMetric] = useState<'tokens' | 'time' | 'length'>('tokens');

  // Calculate comparison metrics
  const metrics = useMemo(() => {
    return responses.map(response => {
      const tokenCount = response.response.metadata.tokenCount || 0;
      const duration = response.response.metadata.duration || 0;
      const length = response.response.content.length;
      const wordsPerMinute = duration > 0 ? (length / (duration / 1000)) * 60 : 0;

      return {
        id: response.id,
        promptId: response.promptId,
        tokenCount,
        duration,
        length,
        wordsPerMinute,
        isComplete: response.response.isComplete,
        hasError: !!response.response.error,
        provider: response.response.metadata.provider,
        model: response.response.metadata.model,
      };
    });
  }, [responses]);

  // Get best/worst performers
  const getBestPerformer = (metric: keyof typeof metrics[0]) => {
    const validMetrics = metrics.filter(m => !m.hasError && m.isComplete);
    if (validMetrics.length === 0) return null;

    return validMetrics.reduce((best, current) => {
      const bestValue = best[metric] as number;
      const currentValue = current[metric] as number;
      
      // For duration, lower is better; for others, higher is better
      if (metric === 'duration') {
        return currentValue < bestValue ? current : best;
      }
      return currentValue > bestValue ? current : best;
    });
  };

  const getMetricColor = (value: number, metric: string) => {
    const best = getBestPerformer(metric as keyof typeof metrics[0]);
    if (!best) return 'text-muted-foreground';
    
    const bestValue = best[metric as keyof typeof best] as number;
    const ratio = metric === 'duration' ? bestValue / value : value / bestValue;
    
    if (ratio >= 0.9) return 'text-green-600';
    if (ratio >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (responses.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          No Responses Yet
        </h3>
        <p className="text-sm text-muted-foreground">
          Send some prompts to see response comparisons here
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Comparison Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center space-x-2">
          <BarChart3 className="h-5 w-5" />
          <span>Response Comparison</span>
        </h2>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Compare by:</span>
          <div className="flex space-x-1">
            {[
              { key: 'tokens', label: 'Tokens', icon: Zap },
              { key: 'time', label: 'Time', icon: Clock },
              { key: 'length', label: 'Length', icon: FileText },
            ].map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                onClick={() => setSelectedMetric(key as typeof selectedMetric)}
                variant={selectedMetric === key ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
              >
                <Icon className="h-3 w-3 mr-1" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Zap className="h-4 w-4 text-blue-500 mr-2" />
            <CardTitle className="text-sm font-medium">Token Efficiency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {metrics.map(metric => (
              <div key={metric.id} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{metric.model}</span>
                <Badge variant="outline" className={`text-xs ${getMetricColor(metric.tokenCount, 'tokenCount')}`}>
                  {metric.tokenCount} tokens
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Clock className="h-4 w-4 text-green-500 mr-2" />
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {metrics.map(metric => (
              <div key={metric.id} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{metric.model}</span>
                <Badge variant="outline" className={`text-xs ${getMetricColor(metric.duration, 'duration')}`}>
                  {metric.duration > 0 ? `${metric.duration}ms` : 'N/A'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <FileText className="h-4 w-4 text-purple-500 mr-2" />
            <CardTitle className="text-sm font-medium">Content Length</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {metrics.map(metric => (
              <div key={metric.id} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{metric.model}</span>
                <Badge variant="outline" className={`text-xs ${getMetricColor(metric.length, 'length')}`}>
                  {metric.length} chars
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Response Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {responses.map((response, index) => (
          <div key={response.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Response {index + 1}</h3>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <span>{response.response.metadata.provider}</span>
                <span>•</span>
                <span>{response.response.metadata.model}</span>
              </div>
            </div>
            
            <StreamingResponse
              response={response.response}
              showActions={true}
            />
          </div>
        ))}
      </div>

      {/* Summary Statistics */}
      {metrics.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Fastest Response:</span>
                <div className="font-medium">
                  {(() => {
                    const fastest = getBestPerformer('duration');
                    return fastest ? `${fastest.model} (${fastest.duration}ms)` : 'N/A';
                  })()}
                </div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Most Efficient:</span>
                <div className="font-medium">
                  {(() => {
                    const efficient = getBestPerformer('tokenCount');
                    return efficient ? `${efficient.model} (${efficient.tokenCount} tokens)` : 'N/A';
                  })()}
                </div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Longest Response:</span>
                <div className="font-medium">
                  {(() => {
                    const longest = getBestPerformer('length');
                    return longest ? `${longest.model} (${longest.length} chars)` : 'N/A';
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ResponseComparison;