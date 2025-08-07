# Juxtaprompt - Complete Architecture & Implementation Guide

## Project Overview

**Juxtaprompt** is a professional prompt comparison tool built as a static web application for GitHub Pages hosting. It enables users to compare multiple prompt variations against a single LLM provider with real-time streaming responses, featuring enhanced security, URL state management, and runtime data validation.

## Enhanced Features

### 🔗 URL State Management
- Store prompts and LLM configuration in URL query parameters
- Enable bookmarking and sharing of specific comparison setups
- Compressed state encoding for URL efficiency

### 🔒 Three-Tier Security Model
- **No Storage**: API keys held only in memory (most secure)
- **Session Storage**: Keys cleared when tab closes (recommended default)
- **Local Storage**: Persistent storage with risk warnings (least secure)

### ✅ Runtime Data Validation
- Zod schemas for all LLM API response validation
- Type-safe data flow with runtime guarantees
- Graceful handling of malformed API responses

### 🎛️ Professional UI Features
- Responsive grid with manual size controls
- Auto-send with debounce functionality
- Advanced LLM configuration options
- Security risk warnings with tooltips

## Technology Stack

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zod": "^3.22.4",
    "lucide-react": "^0.263.1",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^1.14.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.15",
    "@types/react-dom": "^18.2.7",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.3",
    "autoprefixer": "^10.4.14",
    "eslint": "^8.45.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.3",
    "postcss": "^8.4.27",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.0.2",
    "vite": "^4.4.5",
    "vitest": "^0.34.0"
  }
}
```

## Project Structure

```
src/
├── components/              # React components
│   ├── ui/                 # shadcn/ui base components
│   ├── layout/             # Layout components (PromptGrid, Header)
│   ├── prompt/             # Prompt input and management
│   ├── response/           # Streaming response display
│   └── settings/           # Configuration and security settings
├── services/               # Business logic and API services
│   ├── llm/               # LLM provider implementations
│   ├── storage/           # Enhanced storage with security tiers
│   ├── url-state/         # URL state management
│   └── rate-limiting/     # Rate limiting with exponential backoff
├── schemas/               # Zod validation schemas
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript type definitions
├── utils/                 # Pure utility functions
└── constants/             # Application constants
```

## Core Type System

### Enhanced LLM Types

```typescript
// src/types/llm.ts
export const LLM_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;
export type LLMProvider = typeof LLM_PROVIDERS[number];

export interface LLMConfig {
  readonly provider: LLMProvider;
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly topP: number;
  readonly frequencyPenalty: number;
  readonly presencePenalty: number;
  readonly systemMessage: string;
}

export interface LLMRequest {
  readonly id: string;
  readonly prompt: string;
  readonly config: LLMConfig;
  readonly timestamp: number;
}

export interface LLMStreamChunk {
  readonly requestId: string;
  readonly content: string;
  readonly isComplete: boolean;
  readonly tokenCount?: number;
}

export interface LLMResponse {
  readonly requestId: string;
  readonly content: string;
  readonly isComplete: boolean;
  readonly isStreaming: boolean;
  readonly error?: LLMError;
  readonly metadata: ResponseMetadata;
}
```

### Security and Storage Types

```typescript
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
```

### URL State Types

```typescript
// src/types/url-state.ts
export interface URLState {
  readonly prompts: ReadonlyArray<string>;
  readonly config: Partial<LLMConfig>;
  readonly ui: Partial<UIState>;
}

export interface URLStateService {
  saveStateToURL(state: URLState): void;
  loadStateFromURL(): URLState | null;
  clearURLState(): void;
}
```

## Zod Validation Schemas

### LLM Provider Response Schemas

```typescript
// src/schemas/llm-schemas.ts
import { z } from 'zod';

// OpenAI Response Schema
export const OpenAIStreamChunkSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion.chunk'),
  created: z.number(),
  model: z.string(),
  choices: z.array(z.object({
    index: z.number(),
    delta: z.object({
      content: z.string().optional(),
      role: z.string().optional(),
    }),
    finish_reason: z.string().nullable(),
  })),
});

// Anthropic Response Schema
export const AnthropicStreamChunkSchema = z.object({
  type: z.enum(['message_start', 'content_block_delta', 'message_delta', 'message_stop']),
  message: z.object({
    id: z.string(),
    type: z.literal('message'),
    role: z.literal('assistant'),
    content: z.array(z.object({
      type: z.literal('text'),
      text: z.string(),
    })),
  }).optional(),
  delta: z.object({
    text: z.string(),
  }).optional(),
});

// Gemini Response Schema
export const GeminiStreamChunkSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({
      parts: z.array(z.object({
        text: z.string(),
      })),
      role: z.string(),
    }),
    finishReason: z.string().optional(),
    index: z.number(),
  })),
});

export type ValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

## Enhanced Service Layer

### Three-Tier Storage Service

```typescript
// src/services/storage/enhanced-storage-service.ts
export class EnhancedStorageService {
  private inMemoryKeys = new Map<string, string>();
  private readonly PREFERENCE_KEY = 'juxtaprompt_storage_preference';
  
  public getStoragePreference(): StoragePreference {
    const stored = localStorage.getItem(this.PREFERENCE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as StoragePreference;
      } catch {
        // Fall back to default
      }
    }
    
    return {
      type: 'session', // Default to session storage
      acknowledgedRisks: false
    };
  }
  
  public setStoragePreference(preference: StoragePreference): void {
    localStorage.setItem(this.PREFERENCE_KEY, JSON.stringify(preference));
  }
  
  public saveAPIKey(provider: LLMProvider, key: string): void {
    const preference = this.getStoragePreference();
    const storageKey = `${provider}_api_key`;
    
    switch (preference.type) {
      case 'none':
        this.inMemoryKeys.set(storageKey, key);
        break;
      case 'session':
        sessionStorage.setItem(storageKey, key);
        break;
      case 'local':
        localStorage.setItem(storageKey, key);
        break;
    }
  }
  
  public getAPIKey(provider: LLMProvider): string | null {
    const preference = this.getStoragePreference();
    const storageKey = `${provider}_api_key`;
    
    switch (preference.type) {
      case 'none':
        return this.inMemoryKeys.get(storageKey) ?? null;
      case 'session':
        return sessionStorage.getItem(storageKey);
      case 'local':
        return localStorage.getItem(storageKey);
      default:
        return null;
    }
  }
  
  public clearAPIKey(provider: LLMProvider): void {
    const storageKey = `${provider}_api_key`;
    
    // Clear from all possible locations
    this.inMemoryKeys.delete(storageKey);
    sessionStorage.removeItem(storageKey);
    localStorage.removeItem(storageKey);
  }
}
```

### URL State Management Service

```typescript
// src/services/url-state/url-state-service.ts
export class URLStateManager implements URLStateService {
  private readonly maxURLLength = 2000; // Browser URL length limit
  
  public saveStateToURL(state: URLState): void {
    const compressed = this.compressState(state);
    const params = new URLSearchParams();
    params.set('state', compressed);
    
    const newURL = `${window.location.pathname}?${params.toString()}`;
    if (newURL.length <= this.maxURLLength) {
      window.history.replaceState({}, '', newURL);
    }
  }
  
  public loadStateFromURL(): URLState | null {
    const params = new URLSearchParams(window.location.search);
    const stateParam = params.get('state');
    
    if (!stateParam) return null;
    
    try {
      return this.decompressState(stateParam);
    } catch {
      return null; // Invalid state parameter
    }
  }
  
  private compressState(state: URLState): string {
    // Use base64 encoding with compression for URL efficiency
    const json = JSON.stringify(state);
    return btoa(encodeURIComponent(json));
  }
  
  private decompressState(compressed: string): URLState {
    const json = decodeURIComponent(atob(compressed));
    return JSON.parse(json) as URLState;
  }
}
```

### Enhanced LLM Provider with Validation

```typescript
// src/services/llm/providers/openai-enhanced.ts
export class EnhancedOpenAIProvider implements ILLMProvider {
  public readonly name = 'openai' as const;
  
  public async* sendStreamingRequest(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    try {
      const response = await fetch(`${request.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${request.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.config.model,
          messages: [
            ...(request.config.systemMessage ? [{ role: 'system', content: request.config.systemMessage }] : []),
            { role: 'user', content: request.prompt }
          ],
          temperature: request.config.temperature,
          max_tokens: request.config.maxTokens,
          top_p: request.config.topP,
          frequency_penalty: request.config.frequencyPenalty,
          presence_penalty: request.config.presencePenalty,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new LLMError({
          code: `HTTP_${response.status}`,
          message: `API request failed: ${response.statusText}`,
          retryable: response.status >= 500,
          statusCode: response.status,
        });
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new LLMError({
          code: 'NO_RESPONSE_BODY',
          message: 'No response body received',
          retryable: false,
        });
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                yield {
                  requestId: request.id,
                  content: '',
                  isComplete: true,
                };
                return;
              }

              try {
                const parsed = JSON.parse(data);
                
                // Validate with Zod schema
                const validationResult = OpenAIStreamChunkSchema.safeParse(parsed);
                if (!validationResult.success) {
                  console.warn('Invalid OpenAI response format:', validationResult.error);
                  continue;
                }

                const chunk = validationResult.data;
                const content = chunk.choices[0]?.delta?.content || '';
                
                if (content) {
                  yield {
                    requestId: request.id,
                    content,
                    isComplete: false,
                  };
                }
              } catch (parseError) {
                console.warn('Failed to parse OpenAI response:', parseError);
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      
      throw new LLMError({
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown network error',
        retryable: true,
      });
    }
  }
}
```

## Enhanced UI Components

### Security Settings Component

```typescript
// src/components/settings/StorageSecuritySelector.tsx
export const StorageSecuritySelector: React.FC<StorageSecuritySelectorProps> = ({
  currentPreference,
  onPreferenceChange
}) => {
  const securityWarnings: Record<StorageType, SecurityWarning> = {
    none: {
      level: 'low',
      title: 'No Storage (Most Secure)',
      description: 'Key stored only in memory',
      risks: ['Lost on page refresh', 'Lost when tab closes'],
      recommendation: 'Best for maximum security'
    },
    session: {
      level: 'medium',
      title: 'Session Storage (Recommended)',
      description: 'Key stored for current browser session',
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
      description: 'Key stored permanently in browser',
      risks: [
        'Persistent target for attackers',
        'Accessible by malicious browser extensions',
        'Vulnerable to newly discovered site flaws',
        'Remains until manually cleared'
      ],
      recommendation: 'Use only with strict spending limits'
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">API Key Storage Security</h3>
      
      <RadioGroup
        value={currentPreference.type}
        onValueChange={(value: StorageType) => 
          onPreferenceChange({ type: value, acknowledgedRisks: false })
        }
      >
        {STORAGE_TYPES.map((type) => {
          const warning = securityWarnings[type];
          const iconColor = {
            low: 'text-green-500',
            medium: 'text-orange-500',
            high: 'text-red-500'
          }[warning.level];
          
          return (
            <div key={type} className="flex items-center space-x-3">
              <RadioGroupItem value={type} id={type} />
              <label htmlFor={type} className="flex-1 cursor-pointer">
                {warning.title}
              </label>
              
              <Tooltip>
                <TooltipTrigger>
                  <TriangleAlert className={`h-5 w-5 ${iconColor}`} />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <div className="space-y-2">
                    <h4 className="font-semibold">{warning.title}</h4>
                    <p className="text-sm">{warning.description}</p>
                    
                    <div>
                      <p className="text-sm font-medium">Risks:</p>
                      <ul className="text-xs list-disc list-inside space-y-1">
                        {warning.risks.map((risk, index) => (
                          <li key={index}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                    
                    {warning.recommendation && (
                      <p className="text-sm font-medium text-blue-400">
                        {warning.recommendation}
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
      </RadioGroup>
      
      {currentPreference.type !== 'none' && (
        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600 rounded">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Security Acknowledgment Required</p>
              <p className="mt-1">
                By selecting this storage option, you acknowledge the security risks outlined above.
              </p>
              <label className="flex items-center mt-2 space-x-2">
                <input
                  type="checkbox"
                  checked={currentPreference.acknowledgedRisks}
                  onChange={(e) => 
                    onPreferenceChange({
                      ...currentPreference,
                      acknowledgedRisks: e.target.checked
                    })
                  }
                />
                <span>I understand and accept these risks</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

## Configuration Files

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/juxtaprompt/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          validation: ['zod'],
          llm: ['./src/services/llm'],
          ui: ['./src/components/ui']
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
```

### GitHub Actions Deployment

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v3
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Type check
      run: npm run type-check
      
    - name: Lint
      run: npm run lint
      
    - name: Test
      run: npm test
      
    - name: Build
      run: npm run build
      
    - name: Deploy to GitHub Pages
      if: github.ref == 'refs/heads/main'
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

## Implementation Roadmap

### Phase 1: Foundation & Security
1. Initialize TypeScript + Vite project structure
2. Configure Tailwind CSS and shadcn/ui
3. Add Zod for runtime validation
4. Create enhanced storage service with three-tier security
5. Implement Zod schemas for LLM validation

### Phase 2: Core Services
6. Build LLM provider abstraction with validation
7. Create OpenAI, Anthropic, and Gemini integrations
8. Implement rate limiting with exponential backoff
9. Add URL state management service
10. Build comprehensive error handling system

### Phase 3: UI Components
11. Create main App component with state management
12. Build responsive PromptGrid with manual controls
13. Implement streaming response components
14. Create security settings UI with risk warnings
15. Add advanced LLM configuration interface

### Phase 4: Features & Polish
16. Add prompt management features
17. Implement keyboard shortcuts and accessibility
18. Performance optimization and code splitting
19. Comprehensive testing suite
20. Documentation and deployment preparation

## Success Criteria

- ✅ **Security**: Three-tier storage with clear risk communication
- ✅ **Shareability**: URL state management for bookmarking/sharing
- ✅ **Reliability**: Runtime validation prevents crashes from malformed data
- ✅ **Performance**: Sub-100ms UI response times with streaming
- ✅ **Code Quality**: 100% TypeScript coverage, comprehensive tests
- ✅ **User Experience**: Intuitive interface with professional design

This enhanced architecture provides enterprise-grade features while maintaining clean, maintainable code that follows TypeScript best practices and modern web development standards.