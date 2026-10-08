/**
 * Playwright global setup: get ONE signed-in session, save it, and warm the dev server up.
 *
 * 1. SESSION. Every test starts already signed in (the saved cookie + localStorage are loaded through
 *    `use.storageState` in playwright.config.ts), so a full run makes one login instead of one per test. The backend
 *    rate-limits login attempts, and the old suite used to exhaust that limit.
 *    The saved session is REUSED, with no login at all, when all of these are true:
 *      - the file is younger than 30 minutes,
 *      - the access-token cookie has at least 10 minutes left (it lives 15 minutes, and a full run takes longer than a
 *        few minutes: the API tests send the cookie as it is and cannot refresh it, so a token that is about to expire
 *        would fail them half way through), and
 *      - one cheap authenticated request (GET /dashboard/summary, with the saved cookie) succeeds.
 *    Otherwise (no file, an old file, or a session the API no longer knows, for example because the in-memory test API
 *    was restarted) it makes exactly ONE login through the login form. There is no retry: a failed login stops the run
 *    with a clear message. No flag is needed to reuse a session.
 *
 * 2. WARM-UP. The dev server compiles a page the first time it is asked for it, which can take several seconds and made
 *    the first test to open a page time out. After the session is ready, this setup opens every page of the app once
 *    (the routes are found from src/app, a dynamic segment such as [id] is visited with the id "warmup"), three at a time,
 *    and prints how long each took. The tests then find every page already compiled. Skipped against a deployed
 *    environment (E2E_BASE_URL) or with E2E_NO_WARMUP=1. A page that fails to warm is reported and never stops the run.
 *
 * Tests that must start signed OUT (the login form, route protection, the unauthenticated API checks) opt out with:
 *   test.use({ storageState: { cookies: [], origins: [] } });
 * and the dedicated tests of the login form itself still log in through the form.
 *
 * Messages go to stderr (stdout belongs to the reporter). The saved file lives in playwright/.auth/ (gitignored: it
 * holds a session cookie). Nothing here ever prints the password.
 */
import { chromium, request, type Browser } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { getAdminCredentials } from './credentials';
import { AUTH_FILE, defaultBaseUrl } from './mode';

// One saved session per run (real API or mock mode): see tests/mode.ts.
export { AUTH_FILE };

const MAX_SESSION_AGE_MS = 30 * 60 * 1000;
/** The access token must stay valid for the whole run: it needs at least this long left to be reused. */
const MIN_TOKEN_LEFT_MS = 10 * 60 * 1000;
const WARM_UP_CONCURRENCY = 3;
const log = (message: string) => console.error(`[global-setup] ${message}`);

/** True when the saved session is fresh (under 30 minutes) and the API still accepts it. */
async function savedSessionIsUsable(): Promise<boolean> {
  if (!existsSync(AUTH_FILE)) return false;
  const ageMs = Date.now() - statSync(AUTH_FILE).mtimeMs;
  if (ageMs > MAX_SESSION_AGE_MS) {
    log(`saved session is ${Math.round(ageMs / 60_000)} minutes old (more than 30): logging in again`);
    return false;
  }
  // The access-token cookie (it expires after 15 minutes) must outlast the run.
  const saved = JSON.parse(readFileSync(AUTH_FILE, 'utf8')) as { cookies?: { name: string; expires: number }[] };
  const token = (saved.cookies ?? []).find((cookie) => /token/i.test(cookie.name) && cookie.expires > 0);
  const tokenLeftMs = token ? token.expires * 1000 - Date.now() : 0;
  if (tokenLeftMs < MIN_TOKEN_LEFT_MS) {
    log(`the access token has ${Math.max(0, Math.round(tokenLeftMs / 60_000))} minutes left (a run needs at least 10): logging in again`);
    return false;
  }
  const api = process.env.E2E_API_URL || 'http://localhost:4000/api';
  const context = await request.newContext({ storageState: AUTH_FILE });
  try {
    const response = await context.get(`${api}/dashboard/summary`, { timeout: 5_000 });
    if (!response.ok()) log(`saved session was refused by the API (HTTP ${response.status()}): logging in again`);
    return response.ok();
  } catch {
    log('the API did not answer the session check: logging in again');
    return false;
  } finally {
    await context.dispose();
  }
}

/** ONE login through the form, then save the session. Throws on failure; never retries. */
async function loginOnce(baseUrl: string) {
  // Throws a clear message (variable names only) when a variable is missing, BEFORE any login attempt.
  const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = getAdminCredentials();

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL(`${baseUrl}/`, { timeout: 15_000 });
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

/** Every page route of the app, found from src/app: "(dashboard)/partners/[id]/edit/page.tsx" -> "/partners/warmup/edit". */
export function pageRoutes(dir = 'src/app', prefix = ''): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const segment = /^\(.*\)$/.test(entry) ? '' : entry === '%5Fdesign' ? '_design' : /^\[.+\]$/.test(entry) ? 'warmup' : entry;
      routes.push(...pageRoutes(full, segment ? `${prefix}/${segment}` : prefix));
    } else if (entry === 'page.tsx') {
      routes.push(prefix || '/');
    }
  }
  return routes;
}

/** Opens every page once with the saved session, so the dev server has compiled it before any test runs. */
async function warmUp(baseUrl: string) {
  const routes = [...new Set(pageRoutes())].sort();
  const started = Date.now();
  log(`warming up ${routes.length} pages (${WARM_UP_CONCURRENCY} at a time)`);
  const browser: Browser = await chromium.launch();
  try {
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const queue = [...routes];
    const timings: { route: string; ms: number; ok: boolean }[] = [];
    const worker = async () => {
      const page = await context.newPage();
      for (let route = queue.shift(); route !== undefined; route = queue.shift()) {
        const t0 = Date.now();
        let ok = true;
        try {
          await page.goto(`${baseUrl}${route}`, { waitUntil: 'load', timeout: 120_000 });
        } catch (error) {
          ok = false;
          log(`could not warm ${route}: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`);
        }
        timings.push({ route, ms: Date.now() - t0, ok });
      }
      await page.close();
    };
    await Promise.all(Array.from({ length: WARM_UP_CONCURRENCY }, worker));
    for (const { route, ms, ok } of timings.sort((a, b) => b.ms - a.ms)) log(`warm-up ${String(ms).padStart(6)} ms  ${ok ? '' : 'FAILED '}${route}`);
    log(`warm-up done in ${Math.round((Date.now() - started) / 1000)} s`);
  } finally {
    await browser.close();
  }
}

export default async function globalSetup() {
  // Read inside the function: playwright.config.ts loads .env.test.local after importing this file.
  const baseUrl = defaultBaseUrl();
  mkdirSync(dirname(AUTH_FILE), { recursive: true });

  if (await savedSessionIsUsable()) {
    log('LOGINS THIS RUN: 0 (reused the saved session: under 30 minutes old, a token with 10+ minutes left, accepted by the API)');
  } else {
    await loginOnce(baseUrl);
    log('LOGINS THIS RUN: 1 (a new session was saved)');
  }

  if (!process.env.E2E_BASE_URL && process.env.E2E_NO_WARMUP !== '1') await warmUp(baseUrl);
}
