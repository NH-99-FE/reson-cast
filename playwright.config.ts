import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  timeout: 120_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4318', headless: true },
  webServer: {
    command: 'node scripts/verify-generation-ui.mjs',
    url: 'http://127.0.0.1:4318',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
