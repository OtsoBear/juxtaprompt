# Juxtaprompt

A professional prompt comparison tool built as a static web application for GitHub Pages hosting. Compare multiple prompt variations against LLM providers with real-time streaming responses, enhanced security, and URL state management.

## 🚀 Features

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

### 🤖 LLM Provider Support
- **OpenAI**: GPT-4, GPT-3.5 Turbo with streaming
- **Anthropic**: Claude 3.5 Sonnet, Haiku with streaming
- **Google Gemini**: Gemini 1.5 Pro, Flash with streaming

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite 4
- **Styling**: Tailwind CSS
- **Validation**: Zod
- **Icons**: Lucide React
- **Testing**: Vitest + jsdom
- **Deployment**: GitHub Pages + GitHub Actions

## 🏗️ Architecture

### Core Services
- **Enhanced Storage Service**: Three-tier API key storage with security warnings
- **LLM Provider Manager**: Unified interface for multiple LLM providers
- **Rate Limiting Service**: Exponential backoff and request throttling
- **URL State Manager**: Compressed state serialization for sharing

### Type Safety
- 100% TypeScript coverage with strict configuration
- Runtime validation with Zod schemas
- Immutable data structures throughout

### Security First
- Clear risk communication for storage options
- No API keys in localStorage by default
- Runtime validation prevents injection attacks

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/juxtaprompt.git
cd juxtaprompt

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Quality Assurance
npm run type-check   # TypeScript type checking
npm run lint         # ESLint code linting
npm run test         # Run test suite
npm run test:ui      # Run tests with UI
npm run test:coverage # Generate coverage report
```

## 📖 Usage

### Basic Setup
1. Open the application
2. Configure your preferred API key storage method
3. Add your LLM provider API key
4. Create multiple prompts for comparison
5. Send requests and compare responses in real-time

### Advanced Features
- **URL Sharing**: Copy the URL to share your prompt setup
- **Grid Layout**: Adjust columns (1-4) for optimal viewing
- **Response Analysis**: Compare token usage, response time, and content length
- **Security Settings**: Choose appropriate storage level for your use case

## 🔧 Configuration

### LLM Providers

#### OpenAI
- API Key format: `sk-...`
- Supported models: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- Base URL: `https://api.openai.com/v1`

#### Anthropic
- API Key format: `sk-ant-...`
- Supported models: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- Base URL: `https://api.anthropic.com`

#### Google Gemini
- API Key: Google AI Studio API key
- Supported models: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 1.0 Pro
- Base URL: `https://generativelanguage.googleapis.com/v1beta`

### Security Settings

#### Storage Options
1. **Memory Only** (Most Secure)
   - API keys stored only in memory
   - Lost on page refresh
   - Maximum security

2. **Session Storage** (Recommended)
   - Keys persist for browser session
   - Cleared when tab closes
   - Good security/convenience balance

3. **Local Storage** (Least Secure)
   - Keys persist until manually cleared
   - Vulnerable to XSS attacks
   - Use only with spending limits

## 🧪 Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Structure
- **Unit Tests**: Individual service and component testing
- **Integration Tests**: Service interaction testing
- **Type Tests**: TypeScript compilation verification

## 🚀 Deployment

### GitHub Pages (Automatic)
1. Push to `main` branch
2. GitHub Actions automatically builds and deploys
3. Available at `https://yourusername.github.io/juxtaprompt`

### Manual Deployment
```bash
# Build for production
npm run build

# Deploy dist/ folder to your hosting provider
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript strict mode
- Write tests for new features
- Use conventional commit messages
- Ensure all CI checks pass

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenAI](https://openai.com) for GPT models
- [Anthropic](https://anthropic.com) for Claude models
- [Google](https://ai.google.dev) for Gemini models
- [Vercel](https://vercel.com) for inspiration on modern web development
- [shadcn/ui](https://ui.shadcn.com) for design system inspiration

## 📞 Support

- 📧 Email: support@juxtaprompt.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/juxtaprompt/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/juxtaprompt/discussions)

---

Built with ❤️ for the AI community