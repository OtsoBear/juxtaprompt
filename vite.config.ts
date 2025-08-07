import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/juxtaprompt/' : '/',
  publicDir: 'public',
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
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@radix-ui/react-checkbox', '@radix-ui/react-dialog', '@radix-ui/react-label', '@radix-ui/react-radio-group', '@radix-ui/react-select', '@radix-ui/react-separator', '@radix-ui/react-slider', '@radix-ui/react-slot'],
          'validation': ['zod'],
          'icons': ['lucide-react'],
        },
      },
    },
    // Disable minification to prevent React import issues
    minify: false,
    // Increase chunk size warning limit for better performance
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 3000,
    open: true,
    // Enable CORS for development
    cors: true,
    // Configure static file serving
    fs: {
      strict: false,
    },
  },
  // Optimize dependencies for faster dev server startup
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zod',
      'lucide-react',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-label',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      'class-variance-authority',
      'clsx',
      'tailwind-merge'
    ],
    exclude: ['@vite/client', '@vite/env'],
  },
  // Define environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
}));