import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/**/*.{test,spec}.{ts,tsx}',
      'gui/react/app/**/*.{test,spec}.{ts,tsx}',
      'server/**/*.{test,spec}.ts',
      'core/**/*.{test,spec}.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'forks',
    forks: {
      singleFork: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'gui/react/app/**/*.{ts,tsx}',
        'server/**/*.ts',
        'core/**/*.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/tests/**',
        '**/e2e/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
        '**/*.types.ts',
        '**/index.ts',
        '**/constants.ts',
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
    reporters: ['verbose'],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './gui/react/app'),
      '@server': path.resolve(__dirname, './server'),
      '@core': path.resolve(__dirname, './core'),
    },
  },
})
