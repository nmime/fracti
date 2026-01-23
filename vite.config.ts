import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router'],
          // UI libraries
          'ui-vendor': [
            '@radix-ui/react-avatar',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          // Data fetching and state
          'data-vendor': ['@tanstack/react-query', 'react-hook-form', 'zod'],
          // TON blockchain
          'ton-vendor': ['@tonconnect/ui-react'],
          // i18n
          'i18n-vendor': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          // Visualization
          'graph-vendor': ['react-force-graph-2d'],
          // Icons
          'icons-vendor': ['lucide-react'],
        },
      },
    },
    // Target modern browsers for smaller bundles
    target: 'es2024',
    // Minimize chunk size warning threshold
    chunkSizeWarningLimit: 500,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router',
      '@tanstack/react-query',
      'i18next',
      'react-i18next',
    ],
  },
})
