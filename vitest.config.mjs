import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
    },
  },
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx', 'tests/**/*.ts'],
    // `tests/e2e/**` belongs to Playwright (playwright.config.ts testDir). The
    // broad `tests/**/*.ts` include above would otherwise execute
    // `*.spec.ts` Playwright specs in the vitest process, where
    // `test.describe()` throws "Playwright Test did not expect ... to be called
    // here" and `npm test` reports a phantom failing suite.
    exclude: [
      'node_modules/**',
      '.next/**',
      'supabase/**',
      'coverage/**',
      'tests/e2e/**',
    ],
    environment: 'node',
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '.next/**',
        'coverage/**',
        'supabase/**',
        'supabase/database.types.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        'vitest.config.mjs',
        'eslint.config.mjs',
        'next.config.mjs',
        'postcss.config.mjs',
      ],
      thresholds: {
        lines: 30,
        functions: 25,
        branches: 25,
        statements: 30,
      },
    },
  },
})
