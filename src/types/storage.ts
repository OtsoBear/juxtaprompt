// src/types/storage.ts
export const STORAGE_TYPES = ['none', 'session', 'local'] as const;
export type StorageType = typeof STORAGE_TYPES[number];

export interface StoragePreference {
  readonly type: StorageType;
  readonly acknowledgedRisks: boolean;
}

export interface SecurityWarning {
  readonly level: 'low' | 'medium' | 'high';
  readonly title: string;
  readonly description: string;
  readonly risks: ReadonlyArray<string>;
  readonly recommendation?: string;
}

export interface StorageService {
  getStoragePreference(): StoragePreference;
  setStoragePreference(preference: StoragePreference): void;
  saveAPIKey(provider: string, key: string): void;
  getAPIKey(provider: string): string | null;
  clearAPIKey(provider: string): void;
  clearAllAPIKeys(): void;
}

// Security warning configurations for each storage type
export const SECURITY_WARNINGS: Record<StorageType, SecurityWarning> = {
  none: {
    level: 'low',
    title: 'No Storage (Most Secure)',
    description: 'API key stored only in memory',
    risks: ['Lost on page refresh', 'Lost when tab closes'],
    recommendation: 'Best for maximum security'
  },
  session: {
    level: 'medium',
    title: 'Session Storage (Recommended)',
    description: 'API key stored for current browser session',
    risks: [
      'Accessible by malicious browser extensions',
      'Vulnerable to newly discovered site flaws',
      'Cleared when tab closes'
    ],
    recommendation: 'Good balance of security and convenience'
  },
  local: {
    level: 'high',
    title: 'Local Storage (Least Secure)',
    description: 'API key stored permanently in browser',
    risks: [
      'Persistent target for attackers',
      'Accessible by malicious browser extensions',
      'Vulnerable to newly discovered site flaws',
      'Remains until manually cleared'
    ],
    recommendation: 'Use only with strict spending limits'
  }
} as const;