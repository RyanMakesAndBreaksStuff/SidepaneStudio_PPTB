import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 70,
        branches: 55,
        functions: 65,
        lines: 75,
      },
    },
  },
})
