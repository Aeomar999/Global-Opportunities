import { existsSync } from 'fs';
import { defineConfig, devices } from '@playwright/test';
import { AUTH_FILE } from './tests/global-setup';
import { ADMIN_PORT, MOCK_RUN, defaultBaseUrl } from './tests/mode';

/**
 * Test credentials: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are read from .env.test.local in the project root
 * (gitignored by the `.env*` rule). Values already set in the shell (CI secrets) win over the file. There are no
 * defaults: tests/credentials.ts fails with a clear message when either is missing. When the API server below is
 * started by this config, it seeds its admin from the same two variables, so the suite and the API agree.
 */
if (existsSync('.env.test.local')) process.loadEnvFile('.env.test.local');

/**
 * The suite drives the real admin UI against a real API. Both servers are started here so
 * `npm run test:e2e` works the same locally and in CI:
 *
 *  - the API from ../kredibble-backend (`npm run e2e:server`): in-memory MongoDB seeded with one admin,
 *    so no database or credentials are needed beyond the two variables above;
 *  - the admin dev server, pointed at that API.
 *
 * Locally, already-running servers on those ports are reused. Set E2E_BASE_URL and E2E_API_URL to run
 * against a deployed environment instead (no servers are started then).
 *
 * Two runs (tests/mode.ts): `npm run test:e2e` drives the real API on port 3000; `npm run test:e2e:mock`
 * starts the dev server with NEXT_PUBLIC_USE_MOCKS=true on port 3100. Different ports keep a reused server
 * from answering in the wrong mode.
 */
const BASE_URL = defaultBaseUrl();
const API_URL = process.env.E2E_API_URL || 'http://localhost:4000/api';
const external = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: './tests',
  // Log in once per run and save the session (see tests/global-setup.ts).
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    // Every test starts signed in with the session saved by the global setup.
    storageState: AUTH_FILE,
    // Traces are OFF on purpose: they keep every typed value, and the login test types the real password.
    trace: 'off',
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
          command: `npm run dev -- -p ${ADMIN_PORT}`,
          url: `${BASE_URL}/login`,
          env: { NEXT_PUBLIC_API_URL: API_URL, NEXT_PUBLIC_USE_MOCKS: MOCK_RUN ? 'true' : 'false' },
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      ],
});
