// src/components/settings/PromptSettingsPanel.tsx
import React from 'react';
import { MessageSquare, Lock, Unlock } from 'lucide-react';
import type { PromptSettings } from '@/types/app';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PromptSettingsPanelProps {
  settings: PromptSettings;
  onSettingsChange: (updates: Partial<PromptSettings>) => void;
  className?: string;
}

/**
 * Panel for configuring shared vs individual prompt settings
 */
export const PromptSettingsPanel: React.FC<PromptSettingsPanelProps> = React.memo(({
  settings,
  onSettingsChange,
  className = '',
}) => {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center space-x-2">
          <MessageSquare className="h-5 w-5" />
          <span>Prompt Configuration</span>
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure shared or individual prompts for each cell. Variables like {'{'}{'{'} variable {'}'}{'}'} can be used in prompts.
        </p>
      </div>

      <Separator />

      {/* System Message Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-base font-medium">System Message</Label>
            <p className="text-xs text-muted-foreground">
              Sets the context and behavior for the AI
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={settings.sharedSystemMessage}
              onCheckedChange={(checked) => 
                onSettingsChange({ sharedSystemMessage: !!checked })
              }
            />
            <Label className="text-sm font-normal flex items-center space-x-1">
              {settings.sharedSystemMessage ? (
                <>
                  <Lock className="h-3 w-3" />
                  <span>Shared across all prompts</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3 w-3" />
                  <span>Individual per prompt</span>
                </>
              )}
            </Label>
          </div>
        </div>

        {settings.sharedSystemMessage && (
          <div className="space-y-2">
            <Label className="text-sm">Global System Message</Label>
            <Textarea
              value={settings.globalSystemMessage}
              onChange={(e) => onSettingsChange({ globalSystemMessage: e.target.value })}
              placeholder="You are a helpful assistant. You provide clear, accurate, and concise responses."
              rows={3}
              className="resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This system message will be used for all prompts
            </p>
          </div>
        )}

        {!settings.sharedSystemMessage && (
          <p className="text-sm text-muted-foreground italic">
            Each prompt cell will have its own system message field
          </p>
        )}
      </div>

      <Separator />

      {/* User Prompt Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-base font-medium">User Prompt Template</Label>
            <p className="text-xs text-muted-foreground">
              The main prompt or question template
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={settings.sharedUserPrompt}
              onCheckedChange={(checked) => 
                onSettingsChange({ sharedUserPrompt: !!checked })
              }
            />
            <Label className="text-sm font-normal flex items-center space-x-1">
              {settings.sharedUserPrompt ? (
                <>
                  <Lock className="h-3 w-3" />
                  <span>Shared template</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3 w-3" />
                  <span>Individual per prompt</span>
                </>
              )}
            </Label>
          </div>
        </div>

        {settings.sharedUserPrompt && (
          <div className="space-y-2">
            <Label className="text-sm">Global User Prompt Template</Label>
            <Textarea
              value={settings.globalUserPrompt}
              onChange={(e) => onSettingsChange({ globalUserPrompt: e.target.value })}
              placeholder="Explain the concept of {{topic}} in simple terms."
              rows={4}
              className="resize-none text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Use {'{'}{'{'} variable {'}'}{'}'} or {'{'} variable {'}'} for placeholders. Each prompt cell can set different variable values.
            </p>
          </div>
        )}

        {!settings.sharedUserPrompt && (
          <p className="text-sm text-muted-foreground italic">
            Each prompt cell will have its own user prompt field
          </p>
        )}
      </div>

      <Separator />

      {/* Global Variables Section */}
      <div className="space-y-4">
        <div className="space-y-1">
          <Label className="text-base font-medium">Global Variables</Label>
          <p className="text-xs text-muted-foreground">
            Define variables that will be available across all prompts. Local variables can override these values.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Add Global Variable</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Variable name (e.g., language)"
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.currentTarget;
                  const varName = input.value.trim();
                  if (varName && !settings.globalVariables[varName]) {
                    onSettingsChange({
                      globalVariables: { ...settings.globalVariables, [varName]: '' }
                    });
                    input.value = '';
                  }
                }
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Press Enter to add a new global variable
          </p>
        </div>

        {Object.keys(settings.globalVariables).length > 0 && (
          <div className="space-y-2 bg-muted p-3 rounded">
            {Object.entries(settings.globalVariables).map(([key, value]) => (
              <div key={key} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs font-mono">{key}</Label>
                  <Input
                    value={value}
                    onChange={(e) => {
                      onSettingsChange({
                        globalVariables: {
                          ...settings.globalVariables,
                          [key]: e.target.value
                        }
                      });
                    }}
                    placeholder={`Default value for ${key}`}
                    className="h-7 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 mt-5"
                  onClick={() => {
                    const newVars = { ...settings.globalVariables };
                    delete newVars[key];
                    onSettingsChange({ globalVariables: newVars });
                  }}
                  title="Remove variable"
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Variable Examples */}
      <div className="space-y-2 rounded-lg bg-muted p-4">
        <h4 className="text-sm font-medium">Variable Syntax Examples</h4>
        <div className="space-y-1 text-xs text-muted-foreground font-mono">
          <div className="flex justify-between">
            <span>{'{'}{'{'} input {'}'}{'}'}</span>
            <span className="text-xs">→ Replaced with variable value</span>
          </div>
          <div className="flex justify-between">
            <span>{'{'} topic {'}'}</span>
            <span className="text-xs">→ Alternative syntax</span>
          </div>
          <div className="flex justify-between">
            <span>{'{'}{'{'} language {'}'}{'}'}</span>
            <span className="text-xs">→ Multiple variables supported</span>
          </div>
        </div>
      </div>

      {/* Usage Examples */}
      <div className="space-y-2 rounded-lg bg-muted p-4">
        <h4 className="text-sm font-medium">Usage Examples</h4>
        <div className="space-y-2 text-xs">
          <div>
            <p className="font-medium mb-1">Template:</p>
            <p className="font-mono bg-background p-2 rounded">
              "Translate the following text to {'{'}{'{'} language {'}'}{'}'}: {'{'}{'{'} text {'}'}{'}'}"
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">Cell 1 Variables:</p>
            <p className="font-mono bg-background p-2 rounded">
              language: "Spanish", text: "Hello world"
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">Cell 2 Variables:</p>
            <p className="font-mono bg-background p-2 rounded">
              language: "French", text: "Hello world"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

PromptSettingsPanel.displayName = 'PromptSettingsPanel';

export default PromptSettingsPanel;