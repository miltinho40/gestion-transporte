import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.CI ? undefined : 'chrome'
      }
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        channel: process.env.CI ? undefined : 'chrome'
      }
    }
  ]
});
