import { defineConfig, devices } from '@playwright/test';

/**
 * The suite drives the real admin UI against a real API. Both servers are started
 * here so `npm run test:e2e` works the same locally and in CI:
 *
 *  - the API from ../kredibble-backend (`npm run e2e:server`): in-memory MongoDB
 *    seeded with one admin, so no database or credentials are needed;
 *  - the admin dev server, pointed at that API.
 *
 * Locally, already-running servers on those ports are reused. Set E2E_BASE_URL
 * and E2E_API_URL to run against a deployed environment instead (no servers
 * are started then).
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API_URL = process.env.E2E_API_URL || 'http://localhost:4000/api';
const external = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: external
    ? undefined
    : [
        {
          command: 'npm run e2e:server',
          cwd: '../kredibble-backend',
          url: `${API_URL}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
        },
        {
          command: 'npm run dev',
          url: `${BASE_URL}/login`,
          env: { NEXT_PUBLIC_API_URL: API_URL },
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      ],
});
