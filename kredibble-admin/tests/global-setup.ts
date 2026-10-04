/**
 * Playwright global setup: log in ONCE per run and save the session.
 *
 * Every test then starts already signed in (the saved cookie + localStorage are
 * loaded through `use.storageState` in playwright.config.ts), so a full run
 * makes one login request instead of one per test. The backend rate-limits
 * login attempts, and the old suite used to exhaust that limit.
 *
 * Tests that must start signed OUT (the login form, route protection, the
 * unauthenticated API checks) opt out with:
 *   test.use({ storageState: { cookies: [], origins: [] } });
 * and the single dedicated test of the login form itself still logs in through
 * the form.
 *
 * The saved file lives in playwright/.auth/ (gitignored: it holds a session cookie).
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { getAdminCredentials } from './credentials';
import { AUTH_FILE, defaultBaseUrl } from './mode';

// One saved session per run (real API or mock mode): see tests/mode.ts.
export { AUTH_FILE };

export default async function globalSetup() {
  // Read inside the function: playwright.config.ts loads .env.test.local after importing this file.
  const BASE_URL = defaultBaseUrl();
  mkdirSync(dirname(AUTH_FILE), { recursive: true });

  // E2E_REUSE_SESSION=1 keeps the saved session instead of logging in again (no login request at all).
  if (process.env.E2E_REUSE_SESSION === '1' && existsSync(AUTH_FILE)) return;

  // Throws a clear message (variable names only) when a variable is missing, BEFORE any login attempt.
  const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = getAdminCredentials();

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL(`${BASE_URL}/`, { timeout: 15_000 });
    } catch {
      const message = await page.locator('form [role="alert"]').first().textContent({ timeout: 1_000 }).catch(() => null);
      throw new Error(
        `Global setup could not sign in as ${ADMIN_EMAIL}${message ? ` (${message.trim()})` : ''}. ` +
          'ONE attempt was made and it was not retried (the backend rate-limits logins and locks accounts). ' +
          'Check E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in .env.test.local, then run again.',
      );
    }
    await page.context().storageState({ path: AUTH_FILE });
  } finally {
    await browser.close();
  }
}
