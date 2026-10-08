import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/discrete-tasks/',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: '/usr/bin/google-chrome',
    },
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/discrete-tasks/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
