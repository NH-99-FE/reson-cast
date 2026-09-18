import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/navigation',
  timeout: 60_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4319', headless: true },
  webServer: {
    command: 'node scripts/verify-navigation-ui.mjs',
    url: 'http://127.0.0.1:4319',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
