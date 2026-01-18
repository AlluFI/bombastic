import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['client/**/*.test.js'],
    exclude: ['node_modules', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['client/**/*.js'],
      exclude: ['client/**/*.test.js', 'client/**/__tests__/**']
    }
  }
})
