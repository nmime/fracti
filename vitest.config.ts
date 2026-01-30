import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/**/*.{test,spec}.{ts,tsx}',
      'apps/web/app/**/*.{test,spec}.{ts,tsx}',
      'apps/server/**/*.{test,spec}.ts',
      'core/**/*.{test,spec}.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.{idea,git,cache,output,temp}/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'forks',
    forks: {
      singleFork: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['apps/web/app/**/*.{ts,tsx}', 'apps/server/**/*.ts', 'core/**/*.ts'],
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
      '@': path.resolve(__dirname, './apps/web/app'),
      '@server': path.resolve(__dirname, './apps/server'),
      '@core': path.resolve(__dirname, './core'),
    },
  },
});
