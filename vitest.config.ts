import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/__tests__/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.claude/**', '.worktrees/**', '.superpowers/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      thresholds: {
        statements: 70,
        branches: 55,
        functions: 65,
        lines: 75,
      },
    },
  },
})
