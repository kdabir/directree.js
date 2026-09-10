import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // explicit on top of vitest's defaults (node_modules, dist, ...) so a
    // stray build artifact under example/ (or elsewhere) can never get
    // swept into the test run
    include: ['spec/**/*.spec.ts'],
  },
})
