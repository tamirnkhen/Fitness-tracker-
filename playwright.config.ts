import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    trace: 'off',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'node tests/e2e/server.mjs',
    url: 'http://localhost:4173/version.json',
    reuseExistingServer: false,
    env: { E2E_SQL: '1', PORT: '4173' },
    timeout: 60_000,
  },
});
