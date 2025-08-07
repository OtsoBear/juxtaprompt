// src/components/ui/ThemeToggle.tsx
import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Theme = 'light' | 'dark' | 'system';

interface ThemeToggleProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  className?: string;
}

/**
 * Theme toggle component with three options: light, dark, and system
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  theme,
  onThemeChange,
  className = '',
}) => {
  const themes: Array<{ value: Theme; icon: React.ReactNode; label: string }> = [
    { value: 'light', icon: <Sun className="h-4 w-4" />, label: 'Light' },
    { value: 'dark', icon: <Moon className="h-4 w-4" />, label: 'Dark' },
    { value: 'system', icon: <Monitor className="h-4 w-4" />, label: 'System' },
  ];

  return (
    <div className={`flex items-center bg-muted rounded-lg p-1 ${className}`}>
      {themes.map(({ value, icon, label }) => (
        <Button
          key={value}
          onClick={() => onThemeChange(value)}
          variant={theme === value ? 'default' : 'ghost'}
          size="sm"
          className="px-3 py-2 text-sm font-medium"
          title={`Switch to ${label} theme`}
          aria-label={`Switch to ${label} theme`}
        >
          <span className="flex items-center gap-2">
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </span>
        </Button>
      ))}
    </div>
  );
};

/**
 * Simple theme toggle button that toggles between light and dark
 */
export const SimpleThemeToggle: React.FC<{
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  onToggle: () => void;
  className?: string;
}> = ({ resolvedTheme, onToggle, className = '' }) => {
  const getIcon = () => {
    return resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
  };

  const getLabel = () => {
    return resolvedTheme === 'dark' ? 'Dark' : 'Light';
  };

  return (
    <Button
      onClick={onToggle}
      variant="ghost"
      size="icon"
      className={className}
      title={`Current theme: ${getLabel()}. Click to toggle.`}
      aria-label={`Toggle theme. Current: ${getLabel()}`}
    >
      {getIcon()}
    </Button>
  );
};