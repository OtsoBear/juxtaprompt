// src/hooks/useTheme.ts
import { useEffect, useState, useCallback } from 'react';
import type { UIState } from '@/types/url-state';

type Theme = 'light' | 'dark' | 'system';

interface UseThemeReturn {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/**
 * Custom hook for managing theme state with system preference detection
 */
export const useTheme = (
  initialTheme: Theme = 'system',
  onThemeChange?: (theme: Theme) => void
): UseThemeReturn => {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateSystemTheme = () => {
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    };

    // Set initial system theme
    updateSystemTheme();

    // Listen for changes
    mediaQuery.addEventListener('change', updateSystemTheme);

    return () => {
      mediaQuery.removeEventListener('change', updateSystemTheme);
    };
  }, []);

  // Calculate resolved theme (what should actually be applied)
  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? systemTheme : theme;

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark');
    
    // Add the resolved theme class
    root.classList.add(resolvedTheme);
    
    // Also set data attribute for CSS targeting
    root.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  // Set theme with callback
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    onThemeChange?.(newTheme);
  }, [onThemeChange]);

  // Toggle between light and dark (ignoring system)
  const toggleTheme = useCallback(() => {
    if (theme === 'system') {
      // If currently system, toggle to opposite of current system preference
      setTheme(systemTheme === 'dark' ? 'light' : 'dark');
    } else {
      // Toggle between light and dark
      setTheme(theme === 'light' ? 'dark' : 'light');
    }
  }, [theme, systemTheme, setTheme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  };
};