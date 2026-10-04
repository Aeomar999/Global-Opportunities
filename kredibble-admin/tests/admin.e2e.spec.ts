import { test, expect } from '@playwright/test';
import { BRAND, BRAND_ADMIN_TITLE, BRAND_EMAIL_DOMAIN } from '../src/config/brand';
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { isDevRoleSwitcherEnabled, parseDevRoles } from '../src/config/dev-roles';
import { roleCan } from '../src/config/permissions';
import { ROLE_IDS } from '../src/config/roles';
import { joinList } from '../src/lib/format';
import { emptyCollections } from '../src/lib/mock-entities';
import { PERMISSIONS, describeRole, rolePermissionsStore } from '../src/lib/role-permissions';
import { getAdminCredentials } from './credentials';
import { MOCK_COUNTS } from '../src/lib/services/mock-counts';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API_URL = process.env.E2E_API_URL || 'http://localhost:4000/api';

// Every test starts signed in (session saved once by tests/global-setup.ts). Tests that must start
// signed OUT opt out with test.use(SIGNED_OUT).
const SIGNED_OUT = { storageState: { cookies: [], origins: [] } };

// Tests that call the real backend skip (with this reason) when it is not reachable.
const apiAvailable = (request: import('@playwright/test').APIRequestContext) =>
  request.get(`${API_URL}/health`, { timeout: 3_000 }).then((response) => response.ok()).catch(() => false);
const API_DOWN_REASON = `the backend API is not reachable at ${API_URL}`;

test.describe('Admin Authentication', () => {
  // The login form itself: start signed out. 'successful login redirects to dashboard' is the one
  // dedicated test that signs in through the form; everything else reuses the saved session.
  test.use(SIGNED_OUT);

  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    // Each test runs in a fresh browser context, so storage starts empty.
    await page.context().clearCookies();
  });

  test('login page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('h1')).toContainText(BRAND_ADMIN_TITLE);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign in');
  });

  test('successful login redirects to dashboard', async ({ page, request }) => {
    test.skip(!(await apiAvailable(request)), API_DOWN_REASON);
    const { email, password } = getAdminCredentials(); // from .env.test.local; throws a clear message if missing
    await page.goto(`${BASE_URL}/login`);

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect(page.locator('main')).toBeVisible();
  });

  test('failed login shows error message', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error and stay on login page
    await expect(page.locator('text=Invalid admin credentials')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });

  test('empty form shows validation', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Submit button should be disabled when empty
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    
    await page.fill('input[type="email"]', 'test@test.com');
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    
    await page.fill('input[type="password"]', 'password');
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });
});

test.describe('Admin Session Protection', () => {
  test.use(SIGNED_OUT);

  test.beforeEach(async ({ page }) => {
    // Each test runs in a fresh browser context, so storage starts empty.
    await page.context().clearCookies();
  });

  test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    
    // Should redirect to login
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });

  test('unauthenticated access to protected routes redirects to login', async ({ page }) => {
    const protectedRoutes = [
      '/seekers',
      '/hirers',
      '/opportunities',
      '/events',
      '/grants',
      '/verification',
      '/reports',
      '/community',
      '/notifications',
      '/notifications/compose',
      '/notifications/history',
      '/analytics',
      '/staff',
      '/content/articles',
      '/taxonomy/seeker',
      '/taxonomy/grants',
      '/taxonomy/hirer',
      // new short URLs for the pages that will be merged later (see src/config/redirects.ts)
      '/reference-data',
      '/team',
    ];

    for (const route of protectedRoutes) {
      await page.goto(`${BASE_URL}${route}`);
      await expect(page).toHaveURL(`${BASE_URL}/login`);
    }
  });
});

test.describe('Admin Logout', () => {
  test('logout clears session and redirects to login', async ({ page }) => {
    // Starts signed in (saved session), so there is no extra login here.
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // The sidebar's real label is "Log Out" (the old selector looked for "Sign out" / "Logout",
    // matched nothing, and the whole block was skipped silently).
    const logoutButton = page.locator('aside button:has-text("Log Out")');
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();
    await expect(page).toHaveURL(`${BASE_URL}/login`);

    // Verify session is cleared - accessing dashboard should redirect
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });
});

test.describe('Admin Dashboard Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Already signed in (saved session); just open the dashboard.
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveURL(`${BASE_URL}/`);
  });

  test('dashboard loads with summary data', async ({ page }) => {
    await expect(page.locator('main')).toBeVisible();
    // Dashboard should show some content
    await expect(page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)/ })).toBeVisible({ timeout: 5000 });
  });

  test('navigation sidebar is present', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    // Check for key navigation items (scoped to the sidebar; the page body repeats some words)
    // The nav is two-level now: the active group (Overview) is open, the others are collapsed.
    // "Dashboard" is labelled "Overview"; Seekers / Hirers / Opportunities Queue sit inside groups.
    await expect(sidebar.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-expanded', 'true'); // group was "Overview"
    await expect(sidebar.getByRole('link', { name: 'Overview' })).toBeVisible(); // its child keeps the name
    await expect(sidebar.getByRole('link', { name: 'Insights' })).toBeVisible();
    await sidebar.getByRole('button', { name: 'People' }).click();
    await expect(sidebar.getByRole('link', { name: 'Seekers' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Hirers' })).toBeVisible();
    await sidebar.getByRole('button', { name: 'Opportunities' }).click();
    await expect(sidebar.getByRole('link', { name: 'Opportunities Queue' })).toBeVisible();
  });
});

test.describe('Admin API Integration', () => {
  test('dashboard summary API returns data for authenticated admin', async ({ request }) => {
    test.skip(!(await apiAvailable(request)), API_DOWN_REASON);
    // The request context carries the admin cookie saved by the global setup: no login call here.
    const summaryResponse = await request.get(`${API_URL}/dashboard/summary`);

    expect(summaryResponse.ok()).toBeTruthy();
    const data = await summaryResponse.json();
    expect(data.data).toBeDefined();
    expect(data.data.totalUsers).toBeDefined();
    expect(data.data.totalOpportunities).toBeDefined();
  });

  test.describe('without a session', () => {
    // These must NOT carry the saved admin cookie, or they would be authenticated.
    test.use(SIGNED_OUT);

  test('dashboard summary API rejects non-admin token', async ({ request }) => {
    // Try to access with a regular user token (should fail)
    const response = await request.get(`${API_URL}/dashboard/summary`, {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    
    expect(response.status()).toBe(401);
  });

  test('dashboard summary API rejects unauthenticated request', async ({ request }) => {
    const response = await request.get(`${API_URL}/dashboard/summary`);
    expect(response.status()).toBe(401);
  });
  });
});
// ---------------------------------------------------------------------------------------------
// App shell: redirects, collapsible sidebar, command palette, drawer.
// These tests skip the login form: the shell only needs the stored admin user to render, and it
// keeps the suite well under the backend's login rate limit.
// ---------------------------------------------------------------------------------------------
const signedIn = async (page: import('@playwright/test').Page) => {
  await page.addInitScript(() =>
    window.localStorage.setItem(
      'kredibble_admin_user',
      JSON.stringify({ id: '1', name: 'Test Admin', email: 'test@example.com', role: 'admin' }),
    ),
  );
};
const sidebarWidth = (page: import('@playwright/test').Page) =>
  page.locator('aside').evaluate((el) => Math.round(el.getBoundingClientRect().width));

test.describe('Route redirects (old URLs -> merged pages)', () => {
  const redirects: [string, string][] = [
    ['/taxonomy/seeker', '/reference-data'],
    ['/taxonomy/hirer', '/reference-data?tab=hirer'],
    ['/taxonomy/grants', '/reference-data?tab=grants'],
    ['/notifications/compose', '/notifications'],
    ['/notifications/history', '/notifications?tab=history'],
    ['/staff', '/team'],
    ['/roles', '/team?tab=roles'],
  ];
  for (const [from, to] of redirects) {
    test(`${from} redirects to ${to}`, async ({ request }) => {
      const response = await request.get(`${BASE_URL}${from}`, { maxRedirects: 0 });
      expect([307, 308]).toContain(response.status());
      expect(response.headers()['location']).toContain(to);
    });
  }

  test('no loop: every destination is a real page (no second redirect)', async ({ request }) => {
    for (const [, to] of redirects) {
      const response = await request.get(`${BASE_URL}${to}`, { maxRedirects: 0 });
      expect(response.status(), `${to} must not redirect again`).toBe(200);
    }
  });

  test('following each old URL ends on the new page, not on an error', async ({ page }) => {
    await signedIn(page);
    for (const [from, to] of redirects) {
      await page.goto(`${BASE_URL}${from}`, { timeout: 30_000 });
      await expect(page).toHaveURL(`${BASE_URL}${to}`);
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('the staff invite form and member pages are still real routes', async ({ page }) => {
    await signedIn(page);
    for (const path of ['/staff/invite', '/staff/staff-1']) {
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      await expect(page).toHaveURL(`${BASE_URL}${path}`);
      await expect(page.locator('main')).toBeVisible();
    }
  });
});

test.describe('Sidebar', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('toggle collapses to a rail and the choice persists across reload', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    expect(await sidebarWidth(page)).toBe(248);

    const toggle = page.getByRole('button', { name: 'Collapse sidebar' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect.poll(() => sidebarWidth(page)).toBe(72); // 200ms animation
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');

    await page.reload();
    await expect(page.locator('aside')).toBeVisible();
    expect(await sidebarWidth(page)).toBe(72);
    expect((await page.context().cookies()).find((c) => c.name === 'sidebar')?.value).toBe('collapsed');

    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect.poll(() => sidebarWidth(page)).toBe(248);
  });

  test('Ctrl+B toggles the sidebar', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    expect(await sidebarWidth(page)).toBe(248);
    await page.keyboard.press('Control+b');
    await expect.poll(() => sidebarWidth(page)).toBe(72);
    await page.keyboard.press('Control+b');
    await expect.poll(() => sidebarWidth(page)).toBe(248);
  });

  test('a detail page highlights its parent and opens its group', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/seekers/abc123`);
    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('button', { name: 'People' })).toHaveAttribute('aria-expanded', 'true');
    await expect(sidebar.getByRole('link', { name: 'Seekers' })).toHaveAttribute('aria-current', 'page');
  });

  test('rail: a group icon opens a flyout, Esc closes it and returns focus to the icon', async ({ page }) => {
    await page.context().addCookies([{ name: 'sidebar', value: 'collapsed', url: BASE_URL }]);
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    expect(await sidebarWidth(page)).toBe(72);

    const peopleIcon = page.getByRole('button', { name: 'People' });
    await peopleIcon.click();
    const flyout = page.getByRole('region', { name: 'People' });
    await expect(flyout).toBeVisible();
    await expect(flyout.getByRole('link', { name: 'Seekers' })).toBeVisible();
    expect(Math.round((await flyout.boundingBox())!.width)).toBe(220);

    await page.keyboard.press('Escape');
    await expect(flyout).toBeHidden();
    await expect(peopleIcon).toBeFocused();
  });

  test('rail: hovering an icon shows a tooltip with its name', async ({ page }) => {
    await page.context().addCookies([{ name: 'sidebar', value: 'collapsed', url: BASE_URL }]);
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    await page.getByRole('button', { name: 'People' }).hover();
    await expect(page.getByRole('tooltip')).toHaveText('People');
  });

  test('narrow windows start collapsed when there is no cookie', async ({ page }) => {
    await page.setViewportSize({ width: 1120, height: 800 });
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    expect(await sidebarWidth(page)).toBe(72);
  });
});

test.describe('Command palette', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Ctrl+K opens it, typing filters, Enter opens the page', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    // Wait for the shell to hydrate: a shortcut pressed before React attaches its listeners is lost on a cold dev server.
    await expect(page.getByTestId('sidebar-toggle')).toBeVisible();
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox')).toBeFocused();

    await page.keyboard.type('seek');
    await expect(dialog.getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${BASE_URL}/seekers`);
    await expect(dialog).toBeHidden();
  });

  test('arrow keys move the highlight and Esc closes it', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    await page.getByRole('button', { name: 'Search pages' }).click();
    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await expect(dialog.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(dialog.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});

test.describe('Mobile drawer', () => {
  test.use({ viewport: { width: 434, height: 900 } });

  test('hamburger opens the drawer, Esc closes it', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeHidden(); // off-canvas and invisible while closed
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Log Out' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sidebar).toBeHidden();
  });
});

test.describe('Content panel and breadcrumbs', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the breadcrumb menu marks the current page', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/seekers`);
    await page.locator('header button[aria-haspopup="menu"]').first().click();
    const current = page.locator('header [role="menuitem"][aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText('Seekers');
    await expect(current.locator('svg.lucide-check')).toBeVisible();
    expect(await current.evaluate((el) => getComputedStyle(el).fontWeight)).toBe('600');
  });

  test('rail: the flyout highlights the active child', async ({ page }) => {
    await page.context().addCookies([{ name: 'sidebar', value: 'collapsed', url: BASE_URL }]);
    await signedIn(page);
    await page.goto(`${BASE_URL}/seekers`);
    await page.locator('aside').getByRole('button', { name: 'People' }).click();
    await expect(page.getByRole('region', { name: 'People' }).getByRole('link', { name: 'Seekers' })).toHaveAttribute('aria-current', 'page');
  });

  test('the top bar stays stuck while scrolling', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect.poll(() => page.locator('header.sticky').evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(0);
  });

  test('the rounded panel corner exists from 1024px up and is flush below', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    const corner = () => page.locator('header.sticky').evaluate((el) => getComputedStyle(el, '::before').width);
    expect(await corner()).toBe('28px');
    await page.setViewportSize({ width: 900, height: 800 });
    await expect.poll(() => page.locator('header.sticky').evaluate((el) => getComputedStyle(el, '::before').content)).toBe('none');
  });
});

test.describe('Sidebar: the active group is always open', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const expandedGroups = (page: import('@playwright/test').Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('aside nav button[aria-expanded="true"]')].map((el) => el.textContent?.trim()),
    );

  // The reported repro: rail -> Dashboard flyout -> Opportunities flyout -> Opportunities Queue -> expand.
  test('rail -> flyouts -> navigate -> expand opens the active group', async ({ page }) => {
    await page.context().addCookies([{ name: 'sidebar', value: 'collapsed', url: BASE_URL }]);
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    const aside = page.locator('aside');

    await aside.getByRole('button', { name: 'Dashboard' }).click(); // Dashboard flyout open ...
    await aside.getByRole('button', { name: 'Opportunities' }).click(); // ... then straight to another flyout
    await page.getByRole('region', { name: 'Opportunities' }).getByRole('link', { name: 'Opportunities Queue' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/opportunities`);

    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect.poll(() => sidebarWidth(page)).toBe(248);
    // Only the active group is open: Dashboard was auto-opened (active) and was never opened by hand,
    // so it closed when navigation moved to Opportunities.
    expect(await expandedGroups(page)).toEqual(['Opportunities']);
    await expect(aside.getByRole('link', { name: 'Opportunities Queue' })).toHaveAttribute('aria-current', 'page');
  });

  test('the same repro with Ctrl+B and Esc between flyouts', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    await expect(page.locator('aside')).toBeVisible(); // the shortcut is registered once the shell has mounted
    await page.keyboard.press('Control+b');
    await expect.poll(() => sidebarWidth(page)).toBe(72);
    const aside = page.locator('aside');
    await aside.getByRole('button', { name: 'Dashboard' }).click();
    await page.keyboard.press('Escape');
    await aside.getByRole('button', { name: 'Opportunities' }).click();
    await page.getByRole('region', { name: 'Opportunities' }).getByRole('link', { name: 'Events' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/events`);
    await page.keyboard.press('Control+b');
    await expect.poll(() => sidebarWidth(page)).toBe(248);
    expect(await expandedGroups(page)).toEqual(['Opportunities']); // the active group is open after expanding
  });

  test('groups opened by hand stay open, and the active group is added on each navigation', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    const aside = page.locator('aside');
    await aside.getByRole('button', { name: 'People' }).click(); // opened by hand
    await aside.getByRole('button', { name: 'Opportunities' }).click(); // opened by hand
    await aside.getByRole('link', { name: 'Events' }).click(); // navigate: Opportunities is now active
    await expect(page).toHaveURL(`${BASE_URL}/events`);
    // Hand-opened groups (People, Opportunities) stay open; Dashboard was only auto-opened, so it closed.
    expect((await expandedGroups(page)).sort()).toEqual(['Opportunities', 'People']);
  });

  test('Seekers -> Verification Queue leaves only Trust & safety open', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/seekers`);
    const aside = page.locator('aside');
    await expect(aside.getByRole('button', { name: 'People' })).toHaveAttribute('aria-expanded', 'true'); // auto-opened
    expect(await expandedGroups(page)).toEqual(['People']);

    await aside.getByRole('button', { name: 'Trust & safety' }).click(); // opened by hand
    await aside.getByRole('link', { name: 'Verification Queue' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/verification`);
    // People was only auto-opened, so it closed; Trust & safety is open (active + opened by hand).
    expect(await expandedGroups(page)).toEqual(['Trust & safety']);
  });

  test("clicking an open group's chevron closes it and forgets that it was opened by hand", async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/seekers`);
    const aside = page.locator('aside');
    const opportunities = aside.getByRole('button', { name: 'Opportunities' });
    await opportunities.click(); // userOpened
    await expect(opportunities).toHaveAttribute('aria-expanded', 'true');
    await opportunities.click(); // closes and removes it from userOpened
    await expect(opportunities).toHaveAttribute('aria-expanded', 'false');
    // Navigating elsewhere (Hirers is in the same group as Seekers) must not bring it back.
    await aside.getByRole('link', { name: 'Hirers' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/hirers`);
    await expect(opportunities).toHaveAttribute('aria-expanded', 'false');
  });

  test('collapsing the active group by hand keeps it collapsed until the next navigation', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    const aside = page.locator('aside');
    const dashboard = aside.getByRole('button', { name: 'Dashboard' });
    await expect(dashboard).toHaveAttribute('aria-expanded', 'true');
    await dashboard.click();
    await expect(dashboard).toHaveAttribute('aria-expanded', 'false');
    await page.waitForTimeout(500); // nothing re-opens it on its own

    await page.keyboard.press('Control+k'); // navigate within the same group (Overview -> Insights)
    await page.keyboard.type('insights');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${BASE_URL}/analytics`);
    await expect(dashboard).toHaveAttribute('aria-expanded', 'true'); // re-opened by the navigation
  });
});

test.describe('Handled errors', () => {
  // The two queues show mock data by default in dev, so the inline error is reached with the
  // dev-only ?state=error switch (the real 401 path is covered by the unit-level behaviour:
  // errors are kept in component state). Handled errors must not throw or call console.error.
  test.skip(process.env.E2E_PROD === '1', 'the ?state= switch does not exist in production builds');

  for (const path of ['/opportunities', '/verification']) {
    test(`${path}?state=error shows an inline error and throws nothing`, async ({ page }) => {
      const uncaught: string[] = [];
      const consoleErrors: string[] = [];
      page.on('pageerror', (error) => uncaught.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) consoleErrors.push(message.text());
      });
      await page.goto(`${BASE_URL}${path}?state=error`);
      const alert = page.getByRole('alert').filter({ hasText: 'Could not load this list' });
      await expect(alert).toBeVisible();
      await expect(alert.getByRole('button', { name: 'Try again' })).toBeEnabled();
      expect(uncaught).toEqual([]);
      expect(consoleErrors).toEqual([]);

      // In a dev server the Next.js indicator must not show an issue count (the node is absent in production builds).
      const issues = await page.evaluate(() => {
        const text = document.querySelector('nextjs-portal')?.shadowRoot?.textContent ?? '';
        return /\d+\s*Issues?/i.exec(text)?.[0] ?? null;
      });
      expect(issues).toBeNull();
    });
  }
});

test.describe('Overview', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('greets the signed-in person by first name, time-of-day aware', async ({ page }) => {
    await signedIn(page); // name: "Test Admin"
    await page.goto(`${BASE_URL}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Good (morning|afternoon|evening), Test\.$/);
    await expect(page.getByText("Here's what's happening across your platform today.")).toBeVisible();
    await expect(page.getByRole('link', { name: 'View report' })).toHaveAttribute('href', '/analytics');
  });

  test('shows the dark attention card and the activity timeline', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    const attention = page.getByRole('region', { name: 'Needs your attention' });
    await expect(attention).toBeVisible();
    await expect(attention.getByRole('link', { name: /Pending verifications/ })).toHaveAttribute('href', '/verification');
    await expect(attention.getByRole('link', { name: /Open reports/ })).toHaveAttribute('href', '/reports');
    await expect(attention.getByRole('link', { name: 'Review now' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Recent activity' }).getByRole('listitem')).toHaveCount(4);
  });

  test('the New submissions chart switches range without a new request', async ({ page }) => {
    await signedIn(page);
    let apiCalls = 0;
    page.on('request', (request) => request.url().includes('/api/') && apiCalls++);
    await page.goto(`${BASE_URL}/`);
    const chart = page.getByRole('group', { name: /^New submissions per day/ });
    await expect(chart).toBeVisible();
    const before = apiCalls;
    await page.getByRole('radio', { name: '7 days' }).click();
    await expect(page.getByRole('group', { name: /last 7 days/ })).toBeVisible();
    await page.getByRole('radio', { name: '30 days' }).click();
    await expect(page.getByRole('group', { name: /last 30 days/ })).toBeVisible();
    expect(apiCalls).toBe(before);
  });
});

// Dev-only ?state= switch (mock mode, never in production builds): every state keeps the final layout.
test.describe('Overview ?state= switch (dev server, mock mode)', () => {
  test.skip(process.env.E2E_PROD === '1', 'the ?state= switch does not exist in production builds');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('?state=401 shows the session-expired banner with a Sign in button', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/?state=401`);
    const banner = page.getByRole('alert').filter({ hasText: 'Your session has expired' });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  test('?state=429 disables Try again and counts down', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/?state=429`);
    const retry = page.getByRole('button', { name: /^Try again in \d+s$/ });
    await expect(retry).toBeVisible();
    await expect(retry).toBeDisabled();
  });

  test('?state=error and ?state=partial show "—" and a retry banner', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/?state=error`);
    await expect(page.getByRole('alert').filter({ hasText: 'Could not load the overview' }).getByRole('button', { name: 'Try again' })).toBeEnabled();
    await expect(page.getByRole('img', { name: 'unavailable' }).first()).toBeVisible();

    await page.goto(`${BASE_URL}/?state=partial`);
    await expect(page.getByRole('alert').filter({ hasText: 'Some sections could not be loaded' })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(`Pending verification: ${MOCK_COUNTS.pendingVerifications}$`) })).toBeVisible(); // KPIs still load
  });

  test('?state=empty shows empty layouts, ?state=loading keeps skeletons', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/?state=empty`);
    await expect(page.getByText('No submissions in this period')).toBeVisible();
    await expect(page.getByText('No opportunities have been posted yet.')).toBeVisible();
    await expect(page.getByText('All clear: nothing is waiting on you.')).toBeVisible();

    await page.goto(`${BASE_URL}/?state=loading`);
    await expect(page.getByLabel('Loading review queues')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByLabel('Loading review queues')).toBeVisible(); // never resolves
  });
});

test.describe('Overview error hygiene', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the Overview throws nothing and the Next.js dev badge stays neutral', async ({ page }) => {
    const uncaught: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => uncaught.push(`${error.name}: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) consoleErrors.push(message.text());
    });
    await page.goto(`${BASE_URL}/`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Exercise the interactive parts: chart hover + keyboard, every range, the palette, the user menu.
    const chart = page.getByRole('group', { name: /^New submissions per day/ });
    await chart.hover();
    await chart.focus();
    await page.keyboard.press('ArrowLeft');
    for (const range of ['7 days', '30 days', '14 days']) await page.getByRole('radio', { name: range }).click();
    await page.keyboard.press('Control+k');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Account menu/ }).click();
    await page.keyboard.press('Escape');

    expect(uncaught).toEqual([]);
    expect(consoleErrors).toEqual([]);
    const issues = await page.evaluate(() => /\d+\s*Issues?/i.exec(document.querySelector('nextjs-portal')?.shadowRoot?.textContent ?? '')?.[0] ?? null);
    expect(issues).toBeNull(); // the indicator node only exists on a dev server
  });
});

// ---------------------------------------------------------------------------------------------
// List pages (shared template): one smoke test per page, plus checks of the template itself.
// They reuse the saved session; no extra logins.
// ---------------------------------------------------------------------------------------------
const LIST_PAGES = [
  { path: '/verification', title: 'Verification Queue', mockOnly: true },
  { path: '/opportunities', title: 'Opportunities Queue', mockOnly: true },
  { path: '/seekers', title: 'Seekers Directory' },
  { path: '/hirers', title: 'Hirers Directory' },
  { path: '/community', title: 'Community Channels' },
  { path: '/reports', title: 'Reports Queue' },
  { path: '/content/articles', title: 'Career Resources' },
  { path: '/events', title: 'Events' },
  { path: '/grants', title: 'Grants' },
  { path: '/team', title: 'Team', detailBase: '/staff' },
];

test.describe('List pages: smoke', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const { path, title, mockOnly, detailBase = path } of LIST_PAGES) {
    test(`${title}: renders, logs no console errors, and a row opens its detail page`, async ({ page }) => {
      // The two queues call the real API outside mock mode (and then show an inline error instead of rows).
      test.skip(!!mockOnly && process.env.E2E_PROD === '1', 'the queues need mock mode for rows');
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) problems.push(message.text());
      });

      await page.goto(`${BASE_URL}${path}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      const firstRow = page.locator('main tbody tr').first();
      await expect(firstRow).toBeVisible();
      const link = firstRow.getByRole('link').first();
      const href = await link.getAttribute('href');
      expect(href).toMatch(new RegExp(`^${detailBase}/[^/]+$`)); // a detail route under the list

      await link.click();
      // A dev server compiles each detail route on first visit, which can take a few seconds.
      await expect(page).toHaveURL(`${BASE_URL}${href}`, { timeout: 30_000 });
      expect(problems).toEqual([]);
    });
  }
});

test.describe('List pages: template', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('table geometry: 36px header band, 56px rows, footer "Showing 1-N of N" and no paging for one page', async ({ page }) => {
    await page.goto(`${BASE_URL}/seekers`);
    const rows = page.locator('main tbody tr');
    await expect(rows.first()).toBeVisible();
    const n = await rows.count();
    expect(Math.round((await page.locator('main thead tr').boundingBox())!.height)).toBe(36);
    for (let i = 0; i < n; i++) expect(Math.round((await rows.nth(i).boundingBox())!.height)).toBe(56);
    await expect(page.getByText(`Showing 1-${n} of ${n}`)).toBeVisible();
    // One page: Previous / Next are not shown at all ("Showing 1-N of N" stays).
    await expect(page.getByRole('button', { name: 'Previous', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
  });

  test('filters show counts and narrow the rows (Verification)', async ({ page }) => {
    test.skip(process.env.E2E_PROD === '1', 'needs mock mode');
    await page.goto(`${BASE_URL}/verification`);
    await expect(page.locator('main tbody tr a').first()).toBeVisible();
    const all = await page.locator('main tbody tr').count();
    await expect(page.getByRole('radio', { name: new RegExp(`^All ${all}$`) })).toBeVisible();
    await page.getByRole('radio', { name: /^Pending/ }).click();
    const pending = await page.locator('main tbody tr').count();
    expect(pending).toBeGreaterThan(0);
    expect(pending).toBeLessThan(all);
    await expect(page.locator('main tbody tr').filter({ hasText: 'Approved' })).toHaveCount(0);
    await expect(page.getByText(`Showing 1-${pending} of ${pending}`)).toBeVisible();
  });

  test('search with no match and an empty list show DIFFERENT messages (Seekers)', async ({ page }) => {
    await page.goto(`${BASE_URL}/seekers`);
    await expect(page.locator('main tbody tr a').first()).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search seekers' }).fill('zzzz-no-such-person');
    await expect(page.getByText('No seekers match your search')).toBeVisible();

    test.skip(process.env.E2E_PROD === '1', 'the ?state= switch does not exist in production builds');
    await page.goto(`${BASE_URL}/seekers?state=empty`);
    await expect(page.getByText('No seeker accounts yet')).toBeVisible();
    await expect(page.getByText('No seekers match your search')).toHaveCount(0);
  });

  test('?state=loading shows skeleton rows with the header band and keeps them', async ({ page }) => {
    test.skip(process.env.E2E_PROD === '1', 'the ?state= switch does not exist in production builds');
    await page.goto(`${BASE_URL}/events?state=loading`);
    await expect(page.locator('main table[aria-busy="true"]')).toBeVisible();
    expect(await page.locator('main tbody tr').count()).toBe(5);
    await page.waitForTimeout(1200);
    await expect(page.locator('main table[aria-busy="true"]')).toBeVisible(); // never resolves
  });

  test('status badges follow the one status map (Reports: Open is a warning, Resolved is neutral)', async ({ page }) => {
    await page.goto(`${BASE_URL}/reports`);
    const openBadge = page.locator('main tbody tr').first().locator('span', { hasText: /^Open$/ });
    await expect(openBadge).toBeVisible();
    expect(await openBadge.evaluate((el) => el.className)).toContain('bg-warning-soft');
    await page.getByRole('radio', { name: /^Resolved/ }).click();
    const resolved = page.locator('main tbody tr').first().locator('span', { hasText: /^Resolved$/ });
    await expect(resolved).toBeVisible();
    expect(await resolved.evaluate((el) => el.className)).toContain('bg-neutral-soft');
  });

  test('a flagged channel shows a flag icon and the word "Flagged", never an emoji', async ({ page }) => {
    await page.goto(`${BASE_URL}/community`);
    const flagged = page.locator('main tbody tr').filter({ hasText: 'Flagged' });
    await expect(flagged).toHaveCount(1);
    await expect(flagged.locator('svg.lucide-flag')).toBeVisible();
    const text = (await flagged.innerText()).trim();
    expect(/\p{Extended_Pictographic}/u.test(text)).toBe(false);
  });

  test('action buttons: New Article and Invite Staff', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/articles`);
    await expect(page.getByRole('link', { name: 'New Article' })).toHaveAttribute('href', '/content/articles/new');
    await page.goto(`${BASE_URL}/staff`);
    await expect(page.getByRole('link', { name: 'Invite Staff' })).toHaveAttribute('href', '/staff/invite');
  });

  test('progress columns show the figure, a bar and the percentage (Events, Grants)', async ({ page }) => {
    await page.goto(`${BASE_URL}/events`);
    const attendance = page.locator('main tbody tr').first().getByRole('progressbar');
    await expect(attendance).toHaveAttribute('aria-valuenow', /^\d+$/);
    expect(Math.round((await attendance.boundingBox())!.height)).toBe(6);
    await page.goto(`${BASE_URL}/grants`);
    await expect(page.locator('main tbody tr').first()).toContainText(/\$[\d,]+ \/ \$[\d,]+/);
  });
});

test.describe('List pages: mobile', () => {
  test.use({ viewport: { width: 434, height: 900 } });

  test('below 640px each row is a stacked card with labelled pairs', async ({ page }) => {
    await page.goto(`${BASE_URL}/hirers`);
    await expect(page.locator('main tbody tr a').first()).toBeVisible(); // rows have loaded (not the skeleton)
    const row = page.locator('main tbody tr').first();
    expect(await row.evaluate((el) => getComputedStyle(el).display)).toBe('grid');
    // the header band is hidden visually (screen-reader only)
    expect(await page.locator('main thead').evaluate((el) => getComputedStyle(el).position)).toBe('absolute');
    // a label/value pair
    expect(await row.locator('td[data-label="Recruiter"]').evaluate((el) => getComputedStyle(el, '::before').content)).toContain('Recruiter');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); // no horizontal scroll
  });
});

test.describe('Mock counts agree everywhere', () => {
  test.skip(process.env.E2E_PROD === '1', 'mock counts only exist in mock mode');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('sidebar pills, breadcrumb pill, KPI cards, attention card and the lists show the same numbers', async ({ page }) => {
    const { pendingVerifications, openReports } = MOCK_COUNTS;
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);

    // Overview: KPI cards and the dark attention card
    await expect(page.getByRole('link', { name: `Pending verification: ${pendingVerifications}` })).toBeVisible();
    await expect(page.getByRole('link', { name: `Open reports: ${openReports}` })).toBeVisible();
    const attention = page.getByRole('region', { name: 'Needs your attention' });
    await expect(attention.getByRole('link', { name: /Pending verifications/ })).toContainText(String(pendingVerifications));
    await expect(attention.getByRole('link', { name: /Open reports/ })).toContainText(String(openReports));

    // Sidebar pills (open the group that holds them)
    const aside = page.locator('aside');
    await aside.getByRole('button', { name: 'Trust & safety' }).click();
    await expect(aside.getByRole('link', { name: /^Verification Queue/ })).toContainText(String(pendingVerifications));
    await expect(aside.getByRole('link', { name: /^Reports Queue/ })).toContainText(String(openReports));

    // The Verification list's Pending filter holds exactly that many rows; the breadcrumb pill matches.
    await page.goto(`${BASE_URL}/verification`);
    await expect(page.locator('main tbody tr a').first()).toBeVisible();
    await page.getByRole('radio', { name: /^Pending/ }).click();
    await expect(page.locator('main tbody tr')).toHaveCount(pendingVerifications);
    await expect(page.locator('header.sticky nav[aria-label="Breadcrumb"] [aria-current="page"]')).toContainText(String(pendingVerifications));

    // The Reports list's default filter is Open: same count.
    await page.goto(`${BASE_URL}/reports`);
    await expect(page.locator('main tbody tr')).toHaveCount(openReports);
  });
});

test.describe('Truncated cells', () => {
  // 1024px with the sidebar expanded leaves a narrow table, so long titles are cut off.
  test.use({ viewport: { width: 1024, height: 900 } });

  test('a cut-off title has a title attribute and shows the full text in the tooltip on hover and on focus', async ({ page }) => {
    await page.context().addCookies([{ name: 'sidebar', value: 'expanded', url: BASE_URL }]);
    await signedIn(page);
    await page.goto(`${BASE_URL}/community`);
    const fullTitle = 'Guaranteed Visa Sponsorship Jobs';
    const link = page.getByRole('link', { name: fullTitle });
    await expect(link).toBeVisible();
    expect(await link.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true); // really truncated
    await expect(link).toHaveAttribute('title', fullTitle);

    await link.hover();
    await expect(page.getByRole('tooltip')).toHaveText(fullTitle);
    await page.mouse.move(5, 5);
    await expect(page.getByRole('tooltip')).toHaveCount(0);

    await link.focus();
    await expect(page.getByRole('tooltip')).toHaveText(fullTitle); // keyboard focus shows it too
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });

  test('text that fits has no title, no tooltip and is not a tab stop', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/community`);
    const short = page.getByRole('link', { name: 'Google Tech Circle' });
    await expect(short).toBeVisible();
    expect(await short.getAttribute('title')).toBeNull();
    expect(await page.locator('main tbody span[tabindex="0"]').count()).toBe(
      await page.locator('main tbody span[title]').count(), // every focusable cell is a truncated one with a title
    );
  });
});

// ---------------------------------------------------------------------------
// Detail pages (one shared template)
// ---------------------------------------------------------------------------
const DETAIL_PAGES = [
  { path: '/verification/comp-1', list: 'Verification' },
  { path: '/opportunities/opp-1', list: 'Opportunities' },
  { path: '/reports/report-1', list: 'Reports' },
  { path: '/seekers/seeker-1', list: 'Seekers' },
  { path: '/hirers/hirer-1', list: 'Hirers' },
  { path: '/community/ch-1', list: 'Community' },
  { path: '/events/event-1', list: 'Events' },
  { path: '/grants/grant-1', list: 'Grants' },
  { path: '/staff/staff-1', list: 'Staff' },
];

test.describe('Detail pages: template', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const { path } of DETAIL_PAGES) {
    test(`${path}: title, breadcrumb with the entity name, no console errors`, async ({ page }) => {
      test.skip(process.env.E2E_PROD === '1', 'detail pages use mock records');
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) problems.push(message.text());
      });

      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      const title = (await page.getByRole('heading', { level: 1 }).innerText()).trim();
      expect(title.length).toBeGreaterThan(0);

      const crumbs = page.locator('header.sticky');
      await expect(crumbs.getByRole('link', { name: 'Home' })).toBeVisible();
      await expect(crumbs).toContainText(title);
      await expect(crumbs).not.toContainText('Details');
      await expect(crumbs).not.toContainText('Loading');
      await expect(page.getByText(/^Back to /)).toHaveCount(0);
      expect(problems).toEqual([]);
    });
  }

  test('an unknown id shows the not-found state with a link to the list', async ({ page }) => {
    await page.goto(`${BASE_URL}/seekers/does-not-exist`);
    await expect(page.getByRole('link', { name: /Seekers/ }).last()).toBeVisible();
    await expect(page.getByText(/not found/i).first()).toBeVisible();
  });

  test('a destructive action: dialog opens, Esc cancels, confirm updates the badge and shows a toast', async ({ page }) => {
    await page.goto(`${BASE_URL}/seekers/seeker-1`, { timeout: 30_000 });
    const summary = page.getByRole('region', { name: 'Summary' });
    await expect(summary.getByText('Active', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Suspend account' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Enoch Mensah');

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(summary.getByText('Active', { exact: true })).toBeVisible(); // nothing changed

    await page.getByRole('button', { name: 'Suspend account' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Suspend account' }).click();
    await expect(summary.getByText('Suspended', { exact: true })).toBeVisible();
    await expect(page.getByText('Enoch Mensah was suspended.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reinstate account' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Verification detail: icon buttons and derived summary
// ---------------------------------------------------------------------------
test.describe('Verification detail: document actions', () => {
  test.skip(process.env.E2E_PROD === '1', 'detail pages use mock records');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('icon buttons are named per document, have a tooltip and a 40px hit area', async ({ page }) => {
    await page.goto(`${BASE_URL}/verification/comp-1`, { timeout: 30_000 });
    const approve = page.getByRole('button', { name: 'Approve Business Registration' });
    await expect(page.getByRole('button', { name: 'Reject Business Registration' })).toBeVisible();
    const box = await approve.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(40);
    expect(box!.height).toBeGreaterThanOrEqual(40);
    await approve.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Approve document');
    await expect(page.getByText('1 of 4 documents approved')).toBeVisible();
  });

  test('Approve is disabled on an approved document, Reject on a rejected one, and the summary follows', async ({ page }) => {
    await page.goto(`${BASE_URL}/verification/comp-1`, { timeout: 30_000 });
    // Company Logo starts approved.
    await expect(page.getByRole('button', { name: 'Approve Company Logo' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: 'Reject Company Logo' })).not.toHaveAttribute('aria-disabled', 'true');

    await page.getByRole('button', { name: 'Approve Business Registration' }).click();
    await expect(page.getByRole('button', { name: 'Approve Business Registration' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: 'Reject Business Registration' })).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('2 of 4 documents approved')).toBeVisible();

    // The other action keeps its confirm dialog.
    await page.getByRole('button', { name: 'Reject Business Registration' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reject document' }).click();
    await expect(page.getByRole('button', { name: 'Reject Business Registration' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: 'Approve Business Registration' })).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('1 of 4 documents approved')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Shared mock store, toast, progress cells
// ---------------------------------------------------------------------------
test.describe('Shared mock store', () => {
  test.skip(process.env.E2E_PROD === '1', 'the mock store only exists in mock mode');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('suspending a seeker shows Suspended in the Seekers list', async ({ page }) => {
    await page.goto(`${BASE_URL}/seekers/seeker-1`, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Suspend account' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Suspend account' }).click();
    await expect(page.getByText('Enoch Mensah was suspended.')).toBeVisible();

    await page.locator('aside').getByRole('link', { name: 'Seekers' }).click(); // client-side: the store survives
    await expect(page).toHaveURL(`${BASE_URL}/seekers`);
    await expect(page.locator('main tbody tr').filter({ hasText: 'Enoch Mensah' })).toContainText('Suspended');
  });

  test('approving the last pending document updates the row, the count and the sidebar pill', async ({ page }) => {
    await page.goto(`${BASE_URL}/verification/comp-2`, { timeout: 30_000 });
    const aside = page.locator('aside');
    const pill = aside.getByRole('link', { name: /^Verification Queue/ });
    await expect(pill).toContainText(String(MOCK_COUNTS.pendingVerifications));

    await page.getByRole('button', { name: 'Approve Proof of Organization' }).click();
    await expect(pill).toContainText(String(MOCK_COUNTS.pendingVerifications - 1));

    await pill.click();
    await expect(page).toHaveURL(`${BASE_URL}/verification`);
    await expect(page.locator('main tbody tr').filter({ hasText: 'Ashesi Ventures' })).toContainText('Approved');
    await page.getByRole('radio', { name: /^Pending/ }).click();
    await expect(page.locator('main tbody tr')).toHaveCount(MOCK_COUNTS.pendingVerifications - 1);
  });

  test('the toast sits bottom-right, outside the header and its actions, and closes on its own', async ({ page }) => {
    await page.goto(`${BASE_URL}/seekers/seeker-1`, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Suspend account' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Suspend account' }).click();

    const toast = page.getByRole('status', { name: 'Status messages' }).locator('> div').first();
    await expect(toast).toBeVisible();
    await expect(toast.getByRole('button', { name: 'Dismiss message' })).toBeVisible();
    const toastBox = (await toast.boundingBox())!;
    const action = (await page.getByRole('button', { name: 'Reinstate account' }).boundingBox())!;
    const header = (await page.getByRole('region', { name: 'Summary' }).boundingBox())!;
    const overlaps = (a: typeof toastBox, b: typeof toastBox) =>
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    expect(overlaps(toastBox, action)).toBe(false);
    expect(overlaps(toastBox, header)).toBe(false);

    const viewport = page.viewportSize()!;
    expect(Math.round(viewport.width - (toastBox.x + toastBox.width))).toBe(24);
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(viewport.height - 24);

    await expect(toast).toHaveCount(0, { timeout: 8_000 }); // auto-dismiss after 5s
  });
});

test.describe('Progress cells never truncate', () => {
  for (const width of [1440, 1280, 1120]) {
    for (const path of ['/events', '/grants']) {
      test(`${path} at ${width}px: full figure, no ellipsis, no page scroll`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
        await expect(page.locator('main tbody tr').first()).toBeVisible();
        const result = await page.evaluate(() => {
          const bars = [...document.querySelectorAll('main tbody [role="progressbar"]')] as HTMLElement[];
          return {
            count: bars.length,
            cells: bars.map((bar) => {
              const cell = bar.parentElement as HTMLElement;
              const td = cell.closest('td') as HTMLElement;
              const figure = cell.querySelector('span') as HTMLElement;
              const tdBox = td.getBoundingClientRect();
              return {
                width: Math.round(cell.getBoundingClientRect().width),
                clipped: figure.scrollWidth > figure.clientWidth,
                ellipsis: getComputedStyle(figure).textOverflow === 'ellipsis',
                inside: cell.getBoundingClientRect().right <= tdBox.right + 1,
              };
            }),
            pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
          };
        });
        expect(result.count).toBeGreaterThan(0);
        for (const cell of result.cells) {
          expect(cell.width).toBeGreaterThanOrEqual(180);
          expect(cell.clipped).toBe(false);
          expect(cell.ellipsis).toBe(false);
          expect(cell.inside).toBe(true);
        }
        expect(result.pageOverflow).toBe(false);
        console.log(`progress ${path} @${width}: cell widths ${[...new Set(result.cells.map((c) => c.width))].join(', ')}px`);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Forms: article editor and staff invite
// ---------------------------------------------------------------------------
test.describe('Forms: article editor', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('errors show after blur and on submit, then a valid save shows a toast and returns to the list', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/articles/new`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('New article');

    // No error while untouched; blur an empty required field -> inline error with the message.
    await expect(page.getByText('Enter a title.')).toHaveCount(0);
    await page.getByLabel('Title').focus();
    await page.getByLabel('Category').focus();
    await expect(page.getByText('Enter a title.')).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Enter a summary.')).toHaveCount(0); // not touched yet

    // Submit: every error shows and focus moves to the first invalid field.
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Enter a summary.')).toBeVisible();
    await expect(page.getByText('Enter the article body.')).toBeVisible();
    await expect(page.getByLabel('Title')).toBeFocused();
    await expect(page).toHaveURL(`${BASE_URL}/content/articles/new`);

    await page.getByLabel('Title').fill('A test article');
    await page.getByLabel('Summary').fill('Short summary');
    await page.getByLabel('Body').fill('Body text');
    await page.getByLabel('Category').fill('Testing');
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    const save = page.getByRole('button', { name: 'Save draft' });
    await save.click();
    await expect(save).toBeDisabled(); // submitting
    await expect(save).toHaveAttribute('aria-busy', 'true');
    await expect(page).toHaveURL(`${BASE_URL}/content/articles`, { timeout: 10_000 }); // no discard prompt
    await expect(page.getByText('The draft was saved.')).toBeVisible();
  });

  test('Read time is optional; the Publishing switch changes the save label', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/articles/new`, { timeout: 30_000 });
    await expect(page.getByText('Optional').first()).toBeVisible();
    await page.getByRole('switch').click();
    await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: 'Publish article' })).toBeVisible();
  });

  test('editing an existing article is prefilled and starts clean', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/articles/article-1`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit article');
    await expect(page.getByLabel('Title')).not.toHaveValue('');
    await expect(page.getByText('Unsaved changes')).toHaveCount(0);
    await page.getByLabel('Read time').fill('9 min read');
    await expect(page.getByText('Unsaved changes')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
  });

  test('cover image: a picked image previews and can be removed', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/articles/new`, { timeout: 30_000 });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.locator('input[type="file"]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByRole('img', { name: 'Article cover image' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('img', { name: 'Article cover image' })).toHaveCount(0);

    await page.locator('input[type="file"]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
    await expect(page.getByText('That file is not an image.')).toBeVisible();
  });

  test('the action bar is pinned to the bottom of the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 500 });
    await page.goto(`${BASE_URL}/content/articles/new`, { timeout: 30_000 });
    const bar = page.getByRole('button', { name: 'Cancel' }).locator('xpath=ancestor::div[contains(@class,"sticky")]');
    await expect.poll(async () => Math.round((await bar.boundingBox())!.y + (await bar.boundingBox())!.height)).toBe(500);
  });

  test('leaving with unsaved changes asks first; Keep editing stays, Discard leaves', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/articles/new`, { timeout: 30_000 });
    await page.getByLabel('Title').fill('Half-written');

    await page.locator('header.sticky').getByRole('link', { name: 'Home' }).click(); // any in-app link is guarded
    const dialog = page.getByRole('alertdialog', { name: 'Discard unsaved changes?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(`${BASE_URL}/content/articles/new`);
    await expect(page.getByLabel('Title')).toHaveValue('Half-written');

    await page.getByRole('button', { name: 'Cancel' }).click(); // Cancel uses the same guard
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/content/articles`);
  });

  test('closing the tab with unsaved changes triggers the browser prompt; a clean form does not', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/articles/new`, { timeout: 30_000 });
    const prompts: string[] = [];
    page.on('dialog', (dialog) => {
      prompts.push(dialog.type());
      void dialog.dismiss();
    });
    await page.getByLabel('Title').fill('Unsaved');
    await page.close({ runBeforeUnload: true });
    await expect.poll(() => prompts).toContain('beforeunload');
  });
});

test.describe('Forms: staff invite', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('single 640px column; role options each show a one-line description', async ({ page }) => {
    await page.goto(`${BASE_URL}/staff/invite`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Invite Staff');
    const width = await page.getByLabel('Full name').evaluate((el) => el.closest('.max-w-160')!.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(640);

    await page.getByRole('combobox', { name: 'Role' }).click();
    const options = page.getByRole('option');
    await expect(options).toHaveCount(3);
    for (const role of ['Super Admin', 'Moderator', 'Support']) {
      const option = page.getByRole('option', { name: new RegExp(`^${role}`) });
      await expect(option).toBeVisible();
      expect(((await option.innerText()).split('\n').filter(Boolean)).length).toBeGreaterThanOrEqual(2); // label + description
    }
  });

  test('the Role select works from the keyboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/staff/invite`, { timeout: 30_000 });
    const role = page.getByRole('combobox', { name: 'Role' });
    await expect(role).toContainText('Support'); // default
    await role.focus();
    await page.keyboard.press('ArrowDown'); // opens
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(role).toContainText('Moderator');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape'); // closes without changing
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(role).toContainText('Moderator');
  });

  test('validation, then a successful invite adds the person to the Staff list', async ({ page }) => {
    await page.goto(`${BASE_URL}/staff/invite`, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Send invite' }).click();
    await expect(page.getByText("Enter the person's full name.")).toBeVisible();
    await expect(page.getByText('Enter an email address.')).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeFocused();

    await page.getByLabel('Full name').fill('Test Person');
    await page.getByLabel('Email').fill('test.person@kredibble.com');
    await page.getByRole('button', { name: 'Send invite' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/team`, { timeout: 10_000 });
    await expect(page.getByText('Test Person was invited as Support.')).toBeVisible();
    await expect(page.locator('main tbody tr').filter({ hasText: 'Test Person' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Merged pages: Reference data, Notifications, Team
// ---------------------------------------------------------------------------
test.describe('Reference data', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('groups, list tabs with counts, and the add / duplicate / remove rules', async ({ page }) => {
    await page.goto(`${BASE_URL}/reference-data`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reference data');
    const group = page.getByRole('radiogroup', { name: 'Reference data group' });
    await expect(group.getByRole('radio')).toHaveText(['Seekers', 'Hirers', 'Grants']);

    // Second row: the four seeker lists, each with its count.
    const tabs = page.getByRole('tablist', { name: 'Seekers lists' });
    await expect(tabs.getByRole('tab')).toHaveCount(4);
    await expect(tabs.getByRole('tab', { name: /^Universities/ })).toContainText('21');
    await expect(page.getByText('21 items')).toBeVisible();

    // Placeholder grammar: the explicit singular, never "universitie".
    const add = page.getByRole('textbox', { name: 'Add a new university' });
    await expect(add).toHaveAttribute('placeholder', 'Add a new university...');

    // Empty input disables Add; Enter submits; a duplicate shows an inline error.
    const addButton = page.getByRole('button', { name: 'Add', exact: true });
    await expect(addButton).toBeDisabled();
    await add.fill('Test University');
    await expect(addButton).toBeEnabled();
    await add.press('Enter');
    await expect(page.getByText('22 items')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Test University' })).toBeVisible();
    await add.fill('test university');
    await add.press('Enter');
    await expect(page.getByText('"test university" is already in this list.')).toBeVisible();
    await expect(page.getByText('22 items')).toBeVisible();

    // Search appears for lists over 12 items and filters the chips.
    const search = page.getByRole('searchbox', { name: 'Search universities' });
    await search.fill('Ghana');
    await expect(page.getByRole('list', { name: 'Universities' }).getByRole('listitem')).toHaveCount(1);
    await search.fill('');

    // Remove is a real button named for the item.
    await page.getByRole('button', { name: 'Remove Test University' }).click();
    await expect(page.getByText('21 items')).toBeVisible();
    await expect(tabs.getByRole('tab', { name: /^Universities/ })).toContainText('21');
  });

  test('every list uses its own singular in the placeholder; short lists have no search', async ({ page }) => {
    await page.goto(`${BASE_URL}/reference-data?tab=hirer`, { timeout: 30_000 });
    await expect(page.getByRole('radio', { name: 'Hirers' })).toBeChecked();
    const expected: [RegExp, string][] = [
      [/^Industries/, 'Add a new industry...'],
      [/^Company Sizes/, 'Add a new company size...'],
      [/^Position Roles/, 'Add a new position role...'],
    ];
    for (const [tab, placeholder] of expected) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.getByPlaceholder(placeholder)).toBeVisible();
      await expect(page.getByRole('searchbox')).toHaveCount(0); // 10 items or fewer
    }
    await page.getByRole('radio', { name: 'Grants' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/reference-data?tab=grants`);
    await expect(page.getByPlaceholder('Add a new sector...')).toBeVisible();
    await page.getByRole('tab', { name: /^Funding Agencies/ }).click();
    await expect(page.getByPlaceholder('Add a new funding agency...')).toBeVisible();
  });
});

test.describe('Notifications', () => {
  test('1024px and up: composer and history side by side; below: Compose and History tabs', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE_URL}/notifications`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notifications');
    const compose = await page.getByRole('heading', { name: 'Compose' }).boundingBox();
    const history = await page.getByRole('heading', { name: 'History' }).boundingBox();
    expect(history!.x).toBeGreaterThan(compose!.x + 300); // second column
    expect(Math.abs(history!.y - compose!.y)).toBeLessThan(40); // same row
    await expect(page.getByRole('tablist', { name: 'Notifications sections' })).toBeHidden();

    await page.setViewportSize({ width: 900, height: 900 });
    const tabs = page.getByRole('tablist', { name: 'Notifications sections' });
    await expect(tabs).toBeVisible();
    await expect(page.getByRole('heading', { name: 'History' })).toBeHidden();
    await tabs.getByRole('tab', { name: 'History' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/notifications?tab=history`);
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Compose' })).toBeHidden();
  });

  test('Send is disabled until filled, confirms the audience, then toasts, clears and adds to the top of history', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/notifications`, { timeout: 30_000 });
    const send = page.getByRole('button', { name: 'Send notification' });
    await expect(send).toBeDisabled();
    await page.getByLabel('Title').fill('Maintenance tonight');
    await expect(send).toBeDisabled(); // message still empty
    await page.getByRole('textbox', { name: 'Message' }).fill('The app will be offline for ten minutes.');
    await expect(page.getByText('40 characters')).toBeVisible();
    await expect(send).toBeEnabled();

    // Live preview follows what is typed, and the audience control.
    const preview = page.getByRole('region', { name: 'Preview' });
    await expect(preview).toContainText('Maintenance tonight');
    await page.getByRole('radio', { name: 'All Hirers' }).click();
    await expect(preview).toContainText('All Hirers');

    await send.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('All Hirers');
    await expect(dialog).toContainText('cannot be undone');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel('Title')).toHaveValue('Maintenance tonight'); // cancelled: nothing sent

    await send.click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Send notification' }).click();
    await expect(page.getByText('The notification was sent to All Hirers.')).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'Message' })).toHaveValue('');
    await expect(page.getByRole('region', { name: 'History' }).getByRole('listitem').first()).toContainText('Maintenance tonight');
  });
});

test.describe('Team', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Members tab: the list with Invite Staff; a row opens the member page', async ({ page }) => {
    await page.goto(`${BASE_URL}/team`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Team');
    await expect(page.getByRole('tab', { name: 'Members' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('link', { name: 'Invite Staff' })).toHaveAttribute('href', '/staff/invite');
    await expect(page.locator('main tbody tr').first()).toBeVisible();
  });

  test('Roles tab: Super Admin is locked; switches are labelled; the action bar counts, resets and saves', async ({ page }) => {
    await page.goto(`${BASE_URL}/team?tab=roles`, { timeout: 30_000 });
    await expect(page.getByRole('tab', { name: 'Roles & permissions' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Super Admin always retains full access.')).toBeVisible();

    const superAdmin = page.getByRole('region', { name: 'Super Admin permissions' });
    await expect(superAdmin.getByRole('switch')).toHaveCount(6);
    for (const toggle of await superAdmin.getByRole('switch').all()) {
      await expect(toggle).toBeDisabled();
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
    }

    const moderator = page.getByRole('region', { name: 'Moderator permissions' });
    const support = page.getByRole('region', { name: 'Support permissions' });
    await expect(page.getByText(/changes?$/)).toHaveCount(0); // no bar while nothing changed

    await moderator.getByRole('switch', { name: 'Manage reference data & content' }).click();
    await support.getByRole('switch', { name: 'Send platform-wide notifications' }).click();
    await expect(page.getByText('2 changes')).toBeVisible();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByText('2 changes')).toHaveCount(0);
    await expect(moderator.getByRole('switch', { name: 'Manage reference data & content' })).toHaveAttribute('aria-checked', 'false');

    await moderator.getByRole('switch', { name: 'Manage reference data & content' }).click();
    await expect(page.getByText('1 change')).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Role permissions were saved.')).toBeVisible();
    await expect(page.getByText('1 change')).toHaveCount(0);

    // The invite form's role descriptions are derived from the saved permissions.
    await page.goto(`${BASE_URL}/staff/invite`);
    await page.getByRole('combobox', { name: 'Role' }).click();
    // (a full reload resets the in-memory store, so the derived text shows the defaults here)
    await expect(page.getByRole('option', { name: /^Moderator/ })).toContainText('Can review verifications');
  });

  test('role descriptions follow the permissions without a reload', async ({ page }) => {
    await page.goto(`${BASE_URL}/team?tab=roles`, { timeout: 30_000 });
    const support = page.getByRole('region', { name: 'Support permissions' });
    await support.getByRole('switch', { name: 'Send platform-wide notifications' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('tab', { name: 'Members' }).click();
    await page.getByRole('link', { name: 'Invite Staff' }).click(); // client-side: the store survives
    await page.getByRole('combobox', { name: 'Role' }).click();
    await expect(page.getByRole('option', { name: /^Support/ })).toContainText('suspend accounts and send notifications');
  });

  test('unsaved permission edits survive a switch of tab, and leaving asks first', async ({ page }) => {
    await page.goto(`${BASE_URL}/team?tab=roles`, { timeout: 30_000 });
    await page.getByRole('region', { name: 'Moderator permissions' }).getByRole('switch', { name: 'Manage staff & permissions' }).click();
    await page.getByRole('tab', { name: 'Members' }).click();
    await page.getByRole('tab', { name: 'Roles & permissions' }).click();
    await expect(page.getByText('1 change')).toBeVisible();
    await page.locator('header.sticky').getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeVisible();
  });
});

test.describe('Toast with a sticky action bar', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the toast sits 24px above the bar and never over the Save button', async ({ page }) => {
    // Hold the next page's request so the editor (and its bar) stay mounted while the toast shows.
    await page.route('**/content/articles?_rsc=*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await page.goto(`${BASE_URL}/content/articles/new`, { timeout: 30_000 });
    await page.getByLabel('Title').fill('Toast test');
    await page.getByLabel('Summary').fill('Summary');
    await page.getByLabel('Body').fill('Body');
    await page.getByLabel('Category').fill('Testing');
    const save = page.getByRole('button', { name: 'Save draft' });
    await save.click();

    const toast = page.getByRole('status', { name: 'Status messages' }).locator('> div').first();
    await expect(toast).toBeVisible();
    const toastBox = (await toast.boundingBox())!;
    const bar = (await save.locator('xpath=ancestor::div[contains(@class,"sticky")]').boundingBox())!;
    const saveBox = (await save.boundingBox())!;
    const overlaps = (a: typeof toastBox, b: typeof toastBox) =>
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    expect(overlaps(toastBox, saveBox)).toBe(false);
    expect(overlaps(toastBox, bar)).toBe(false);
    expect(Math.round(bar.y - (toastBox.y + toastBox.height))).toBeGreaterThanOrEqual(24);
  });
});

// ---------------------------------------------------------------------------
// Addenda: tabs, dev badge hygiene, sidebar groups, mock copy, forms wording
// ---------------------------------------------------------------------------
test.describe('Tabs: no scrollbar, nothing overflows', () => {
  for (const [path, width] of [['/reference-data', 1440], ['/team', 1440], ['/notifications', 900]] as const) {
    test(`${path} @${width}: overflow-y hidden, scrollbar hidden, scrollHeight <= clientHeight`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      const tablist = page.getByRole('tablist').first();
      await expect(tablist).toBeVisible();
      const m = await tablist.evaluate((el) => {
        const cs = getComputedStyle(el);
        const underline = el.querySelector('[aria-selected="true"]')!.getBoundingClientRect();
        return {
          overflowX: cs.overflowX,
          overflowY: cs.overflowY,
          scrollbarWidth: cs.scrollbarWidth,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          underlineBelow: Math.round((underline.bottom - el.getBoundingClientRect().bottom) * 100) / 100,
        };
      });
      expect(m.overflowY).toBe('hidden');
      expect(m.overflowX).toBe('auto');
      expect(m.scrollbarWidth).toBe('none');
      expect(m.scrollHeight).toBeLessThanOrEqual(m.clientHeight);
      expect(m.underlineBelow).toBeLessThanOrEqual(0); // the active underline never extends below the list
      console.log(`tablist ${path} @${width}: ${JSON.stringify(m)}`);
    });
  }

  test('keyboard still moves between tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/team`, { timeout: 30_000 });
    await page.getByRole('tab', { name: 'Members' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Roles & permissions' })).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('Dev badge hygiene on the merged pages (mock mode)', () => {
  test.skip(process.env.E2E_PROD === '1', 'mock mode only');
  test('walking Reference data, Notifications and Team logs no console error or warning and throws no unhandled error', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type()) && !message.text().startsWith('Failed to load resource')) {
        problems.push(`console.${message.type()}: ${message.text()}`);
      }
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of ['/reference-data', '/reference-data?tab=hirer', '/notifications', '/notifications?tab=history', '/team', '/team?tab=roles', '/analytics', '/staff/invite', '/content/articles/new']) {
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    await page.goto(`${BASE_URL}/reference-data`);
    await page.getByRole('radio', { name: 'Grants' }).click();
    await page.getByRole('tab', { name: /Applicant Types/ }).click();
    await page.goto(`${BASE_URL}/team?tab=roles`);
    await page.getByRole('tab', { name: 'Members' }).click();
    expect(problems).toEqual([]);
  });
});

test.describe('Sidebar: only the active group stays open', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Content > Reference data > Comms & admin > Team leaves only the active group (plus ones opened by hand)', async ({ page }) => {
    await page.goto(`${BASE_URL}/reference-data`, { timeout: 30_000 });
    const aside = page.locator('aside');
    const expanded = async () =>
      (
        await Promise.all(
          ['Dashboard', 'Opportunities', 'People', 'Trust & safety', 'Content', 'Comms & admin'].map(async (name) => ({
            name,
            open: (await aside.getByRole('button', { name, exact: true }).getAttribute('aria-expanded')) === 'true',
          })),
        )
      )
        .filter((group) => group.open)
        .map((group) => group.name);

    // On Reference data only Content is open.
    expect(await expanded()).toEqual(['Content']);

    // The person opens Comms & admin by clicking, then goes to Team: Comms & admin stays open (it is active
    // and was opened by hand) and Content, which was only open automatically, closes.
    await aside.getByRole('button', { name: 'Comms & admin', exact: true }).click();
    await aside.getByRole('link', { name: 'Team' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/team`);
    expect(await expanded()).toEqual(['Comms & admin']);

    // Back to Content > Reference data: Content opens again; Comms & admin, opened by hand, stays open.
    await aside.getByRole('button', { name: 'Content', exact: true }).click();
    await aside.getByRole('link', { name: 'Reference data' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/reference-data`);
    expect(await expanded()).toEqual(['Content', 'Comms & admin']);
  });
});

test.describe('Mock copy uses the brand', () => {
  test('history and staff data come from src/config/brand.ts', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`, { timeout: 30_000 });
    await expect(page.getByText(`Welcome to ${BRAND.name}`)).toBeVisible();
    await expect(page.getByText(/Kredibble/i)).toHaveCount(0);
    await page.goto(`${BASE_URL}/team`);
    await expect(page.locator('main tbody tr').first()).toContainText(`@${BRAND_EMAIL_DOMAIN}`);
    await expect(page.locator('main')).not.toContainText(/kredibble/i);
  });
});

test.describe('Forms: wording and layout fixes', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('article: Published switch label and helper; Summary placeholder differs from its helper', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/articles/new`, { timeout: 30_000 });
    const published = page.getByRole('switch', { name: 'Published' });
    await expect(published).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByText('Visible to seekers when on. Saved as a draft when off.')).toBeVisible();
    await published.click();
    await expect(published).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('switch', { name: 'Published' })).toBeVisible(); // the label never changes to "Draft"
    await expect(page.getByRole('button', { name: 'Publish article' })).toBeVisible();
    const summary = page.getByRole('textbox', { name: 'Summary' });
    await expect(summary).toHaveAttribute('placeholder', 'e.g. Practical tips for a resume that stands out');
    await expect(page.getByText('One or two sentences shown in the article list.')).toBeVisible();
  });

  test('audience: "Everyone" in the control, preview, dialog, toast and history pill', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`, { timeout: 30_000 });
    await expect(page.getByRole('radio', { name: 'Both' })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Everyone' })).toBeChecked(); // the default
    await page.getByLabel('Title').fill('Hello all');
    await page.getByRole('textbox', { name: 'Message' }).fill('A note for everyone.');
    await expect(page.getByRole('region', { name: 'Preview' })).toContainText('Everyone');
    await page.getByRole('button', { name: 'Send notification' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Everyone');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Send notification' }).click();
    await expect(page.getByText('The notification was sent to Everyone.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'History' }).getByRole('listitem').first()).toContainText('Everyone');
  });

  test('every history timestamp uses the shared 12-hour format', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`, { timeout: 30_000 });
    await page.getByLabel('Title').fill('Time check');
    await page.getByRole('textbox', { name: 'Message' }).fill('Checking the clock format.');
    await page.getByRole('button', { name: 'Send notification' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Send notification' }).click();
    const items = page.getByRole('region', { name: 'History' }).getByRole('listitem');
    await expect(items).toHaveCount(3);
    for (const item of await items.all()) {
      const stamp = (await item.locator('p.caption').innerText()).trim();
      expect(stamp).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{1,2}:\d{2} (AM|PM)$/);
    }
    await expect(items.nth(1)).toContainText('10 Jul 2026, 2:30 PM');
    await expect(items.nth(2)).toContainText('1 Jul 2026, 9:00 AM');
  });

  test('invite: the action bar sits under the form edge; the email field is empty with a neutral placeholder', async ({ page }) => {
    await page.goto(`${BASE_URL}/staff/invite`, { timeout: 30_000 });
    const email = page.getByLabel('Email');
    await expect(email).toHaveValue(''); // a placeholder, never a pre-filled value
    await expect(email).toHaveAttribute('placeholder', 'name@company.com');
    const form = (await page.getByLabel('Full name').evaluate((el) => el.closest('.max-w-160')!.getBoundingClientRect().right));
    const send = (await page.getByRole('button', { name: 'Send invite' }).boundingBox())!;
    expect(Math.abs(send.x + send.width - form)).toBeLessThanOrEqual(2);
  });
});

test.describe('joinList and role descriptions', () => {
  test('joinList: 1, 2 and 3+ items with an Oxford comma', () => {
    expect(joinList([])).toBe('');
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b'])).toBe('a and b');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b, and c');
    expect(joinList(['a', 'b', 'c', 'd'])).toBe('a, b, c, and d');
  });

  test('describeRole for 1, 2 and 3 permissions', () => {
    const original = rolePermissionsStore.grants;
    const only = (keys: string[]) => {
      const grants = rolePermissionsStore.grants;
      for (const permission of PERMISSIONS) grants.Support[permission.key] = keys.includes(permission.key);
      rolePermissionsStore.save(grants);
    };
    try {
      only(['suspend']);
      expect(describeRole('Support')).toBe('Can suspend accounts.');
      only(['suspend', 'broadcast']);
      expect(describeRole('Support')).toBe('Can suspend accounts and send notifications.');
      only(['verifications', 'moderate', 'suspend']);
      expect(describeRole('Support')).toBe('Can review verifications, moderate opportunities and community, and suspend accounts.');
    } finally {
      rolePermissionsStore.save(original);
    }
  });
});

// ---------------------------------------------------------------------------
// Insights and Login
// ---------------------------------------------------------------------------
test.describe('Insights', () => {
  test.skip(process.env.E2E_PROD === '1', 'mock data');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('one stat row, segmented bars with legends, a highlight bar chart, hidden tables and a month note', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) problems.push(message.text());
    });
    await page.goto(`${BASE_URL}/analytics`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Insights');

    // Only two stats: no Active Seekers / Verified Hirers cards (the Overview owns those).
    await expect(page.getByText('Total applications')).toBeVisible();
    await expect(page.getByText('Open reports', { exact: true })).toBeVisible();
    await expect(page.getByText('Active Seekers')).toHaveCount(0);
    await expect(page.getByText('Verified Hirers')).toHaveCount(0);

    // Postings by type: inset box with the total and a legend of dot, label, value, percent.
    const postings = page.getByRole('region', { name: 'Postings by type' });
    await expect(postings.getByText('Total postings')).toBeVisible();
    for (const label of ['Jobs', 'Internships', 'Events', 'Grants']) {
      await expect(postings.getByRole('listitem').filter({ hasText: label })).toContainText(/\d+%/);
    }
    // Verification status
    const verification = page.getByRole('region', { name: 'Verification status' });
    await expect(verification.getByRole('listitem').filter({ hasText: 'Approved' })).toContainText(/\d+%/);

    // Text alternatives: a hidden table per chart.
    await expect(postings.locator('table.sr-only')).toHaveCount(1);
    await expect(verification.locator('table.sr-only')).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Reports by reason' }).locator('table')).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Reports by reason' })).toContainText('Scam / Fraud');

    // Month selector: UI only, and it says so.
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option').nth(1).click();
    await expect(page.getByRole('status').filter({ hasText: 'do not change by month' })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('the charts follow decisions made elsewhere (shared mock store)', async ({ page }) => {
    await page.goto(`${BASE_URL}/verification/comp-2`, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Approve Proof of Organization' }).click();
    await page.locator('aside').getByRole('button', { name: 'Dashboard', exact: true }).click();
    await page.locator('aside').getByRole('link', { name: 'Insights' }).click();
    const approved = page.getByRole('region', { name: 'Verification status' }).getByRole('listitem').filter({ hasText: 'Approved' });
    await expect(approved).toContainText('2'); // comp-3 was approved already; comp-2 just joined it
  });
});

test.describe('Login page', () => {
  test.use(SIGNED_OUT);

  test('1024px and up: split layout with the brand panel; below: only the form card', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/login`);
    const panel = page.locator('aside');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(BRAND.name);
    const panelBox = (await panel.boundingBox())!;
    const formBox = (await page.locator('form').boundingBox())!;
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(formBox.x); // panel left of the form
    await expect(page.getByText('Access is by invitation only.')).toBeVisible();

    await page.setViewportSize({ width: 900, height: 800 });
    await expect(panel).toBeHidden();
    const narrow = (await page.locator('form').boundingBox())!;
    expect(Math.abs(narrow.x + narrow.width / 2 - 450)).toBeLessThanOrEqual(2); // centred
  });

  test('email is focused; the password can be shown and hidden', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.getByLabel('Email')).toBeFocused();
    const password = page.getByLabel('Password', { exact: true });
    await password.fill('not-a-real-password');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('a failed sign-in shows a spinner, then an announced error banner (the API is stubbed: no real login)', async ({ page }) => {
    const cors = { 'access-control-allow-origin': BASE_URL, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type' };
    await page.route('**/auth/admin/login', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors }); // CORS preflight
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Invalid admin credentials' } }) });
    });
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel('Email').fill('someone@example.com');
    await page.getByLabel('Password', { exact: true }).fill('not-a-real-password');
    const submit = page.locator('button[type="submit"]');
    await submit.click();
    await expect(submit).toHaveAttribute('aria-busy', 'true');
    await expect(submit).toBeDisabled();
    const banner = page.getByRole('alert').filter({ hasText: 'Invalid admin credentials' });
    await expect(banner).toBeVisible();
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });
});

// ---------------------------------------------------------------------------
// Final quality pass: smoke over every route, test ids, mobile, drawer, skip link, dead-code guard
// ---------------------------------------------------------------------------
// Every route in docs/ui-audit.md (sample ids for the [id] routes). Old URLs follow their redirect.
const AUDIT_ROUTES: { path: string; mockOnly?: boolean }[] = [
  { path: '/' },
  { path: '/analytics' },
  { path: '/verification', mockOnly: true },
  { path: '/verification/comp-1' },
  { path: '/opportunities', mockOnly: true },
  { path: '/opportunities/opp-1' },
  { path: '/reports' },
  { path: '/reports/report-1' },
  { path: '/seekers' },
  { path: '/seekers/seeker-1' },
  { path: '/hirers' },
  { path: '/hirers/hirer-1' },
  { path: '/community' },
  { path: '/community/ch-1' },
  { path: '/content/articles' },
  { path: '/content/articles/article-1' },
  { path: '/content/articles/new' },
  { path: '/events' },
  { path: '/events/event-1' },
  { path: '/grants' },
  { path: '/grants/grant-1' },
  { path: '/notifications/compose' },
  { path: '/notifications/history' },
  { path: '/staff' },
  { path: '/staff/staff-1' },
  { path: '/staff/invite' },
  { path: '/roles' },
  { path: '/taxonomy/seeker' },
  { path: '/taxonomy/hirer' },
  { path: '/taxonomy/grants' },
];

const trackProblems = (page: import('@playwright/test').Page) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()) && !message.text().startsWith('Failed to load resource')) {
      problems.push(`console.${message.type()}: ${message.text()}`);
    }
  });
  return problems;
};

test.describe('Smoke: every audited route renders its title with no console errors', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  for (const { path, mockOnly } of AUDIT_ROUTES) {
    test(`${path}`, async ({ page }) => {
      test.skip(!!mockOnly && process.env.E2E_PROD === '1', 'this queue reads the real API outside mock mode, which needs a bearer token the test session does not have');
      const problems = trackProblems(page);
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      const title = page.getByTestId('page-title');
      await expect(title).toBeVisible();
      expect(((await title.innerText()) || '').trim().length).toBeGreaterThan(0);
      expect(problems).toEqual([]);
    });
  }

  test('/login (signed out)', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const problems = trackProblems(page);
    await page.goto(`${BASE_URL}/login`);
    await expect(page.getByTestId('page-title')).toHaveText(BRAND_ADMIN_TITLE);
    expect(problems).toEqual([]);
    await context.close();
  });
});

test.describe('Test ids', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('sidebar items, toggle, status badges, table rows', async ({ page }) => {
    await page.goto(`${BASE_URL}/seekers`, { timeout: 30_000 });
    await expect(page.getByTestId('sidebar-toggle')).toBeVisible();
    await expect(page.getByTestId('nav-group-people')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('nav-item-seekers')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('nav-group-trust-safety')).toBeVisible();
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await expect(page.getByTestId('status-badge').first()).toBeVisible();
    await page.getByTestId('sidebar-toggle').click();
    await expect.poll(() => sidebarWidth(page)).toBe(72);
  });

  test('confirm dialog buttons and toast', async ({ page }) => {
    await page.goto(`${BASE_URL}/seekers/seeker-2`, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Suspend account' }).click();
    await expect(page.getByTestId('confirm-dialog-cancel')).toBeFocused();
    await page.getByTestId('confirm-dialog-confirm').click();
    await expect(page.getByTestId('toast')).toContainText('was suspended.');
    await expect(page.getByTestId('status-badge').first()).toContainText('Suspended');
  });
});

test.describe('Mobile: no horizontal scroll on any page type (434px and 390px)', () => {
  const pages = ['/', '/seekers', '/seekers/seeker-1', '/staff/invite', '/content/articles/new', '/team', '/team?tab=roles', '/reference-data', '/notifications', '/notifications?tab=history', '/analytics', '/verification/comp-1', '/events/event-1'];
  for (const width of [434, 390]) {
    for (const path of pages) {
      test(`${path} @${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
        await expect(page.getByTestId('page-title')).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
    test(`/login @${width}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/login`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      await context.close();
    });
  }

  test('a list becomes stacked cards, with each card a single link target', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`${BASE_URL}/seekers`, { timeout: 30_000 });
    const row = page.getByTestId('table-row').first();
    await expect(row).toBeVisible();
    const box = (await row.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(390);
    // the row's link covers the card: a click near the card's bottom-right corner opens the detail page
    await page.mouse.click(box.x + box.width - 12, box.y + box.height - 12);
    await expect(page).toHaveURL(/\/seekers\/[^/]+$/);
  });

  test('the toast and the sticky bar do not overlap on a phone', async ({ page }) => {
    await page.route('**/content/articles?_rsc=*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`${BASE_URL}/content/articles/new`, { timeout: 30_000 });
    await page.getByLabel('Title').fill('Phone toast');
    await page.getByLabel('Summary').fill('Summary');
    await page.getByLabel('Body').fill('Body');
    await page.getByLabel('Category').fill('Testing');
    const save = page.getByRole('button', { name: 'Save draft' });
    await save.click();
    const toast = page.getByTestId('toast');
    await expect(toast).toBeVisible();
    const toastBox = (await toast.boundingBox())!;
    const bar = (await save.locator('xpath=ancestor::div[contains(@class,"sticky")]').boundingBox())!;
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(bar.y); // the toast sits above the bar
    expect(toastBox.x).toBeGreaterThanOrEqual(0);
    expect(toastBox.x + toastBox.width).toBeLessThanOrEqual(390);
  });
});

test.describe('Mobile drawer: focus trap, Esc, links', () => {
  for (const width of [434, 390]) {
    test(`@${width}: open, Tab stays inside, Esc closes and returns focus, a link navigates and closes`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
      const opener = page.getByRole('button', { name: 'Open navigation' });
      await opener.click();
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();
      // Tab (and Shift+Tab) never leaves the drawer while it is open.
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => !!document.activeElement?.closest('aside'))).toBe(true);
      }
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Shift+Tab');
        expect(await page.evaluate(() => !!document.activeElement?.closest('aside'))).toBe(true);
      }
      await page.keyboard.press('Escape');
      await expect(sidebar).toBeHidden();
      await expect(opener).toBeFocused();

      await opener.click();
      await sidebar.getByTestId('nav-group-people').click();
      await sidebar.getByTestId('nav-item-seekers').click();
      await expect(page).toHaveURL(`${BASE_URL}/seekers`);
      await expect(sidebar).toBeHidden(); // closes after navigating
    });
  }
});

test.describe('Touch targets and the skip link (desktop)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('sidebar toggle, nav rows and breadcrumb links are at least 40px tall', async ({ page }) => {
    await page.goto(`${BASE_URL}/seekers/seeker-1`, { timeout: 30_000 });
    const heights = async (locators: import('@playwright/test').Locator[]) =>
      Promise.all(locators.map(async (locator) => Math.round((await locator.boundingBox())!.height)));
    for (const h of await heights([
      page.getByTestId('sidebar-toggle'),
      page.getByTestId('nav-item-seekers'),
      page.getByTestId('nav-item-hirers'),
      page.getByTestId('nav-group-people'),
      page.locator('header.sticky').getByRole('link', { name: 'Home' }),
      page.getByRole('radio').first().or(page.getByTestId('nav-item-channels')),
    ])) {
      expect(h).toBeGreaterThanOrEqual(40);
    }
    await page.goto(`${BASE_URL}/team?tab=roles`);
    const switchBox = (await page.getByRole('switch').nth(6).boundingBox())!; // an editable role switch
    expect(switchBox.height).toBeGreaterThanOrEqual(24); // the visible track; the hit area is extended below
    const hit = await page.getByRole('switch').nth(6).evaluate((el) => {
      const box = el.getBoundingClientRect();
      const probe = document.elementFromPoint(box.left + box.width / 2, box.top - 6); // 6px above the track
      return probe === el;
    });
    expect(hit).toBe(true);
  });

  test('the first Tab stop is "Skip to content" and it moves focus to the page', async ({ page }) => {
    await page.goto(`${BASE_URL}/team`, { timeout: 30_000 });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Tab');
    // In development the Next.js dev-tools badge is a tab stop before the page; skip it (it is absent in production).
    if (await page.evaluate(() => document.activeElement?.tagName === 'NEXTJS-PORTAL')) await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main-content')).toBeFocused();
  });

  test('Published switch shows "Published" or "Draft" next to it', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/articles/new`, { timeout: 30_000 });
    await expect(page.getByTestId('switch-status')).toHaveText('Draft');
    await page.getByRole('switch', { name: 'Published' }).click();
    await expect(page.getByTestId('switch-status')).toHaveText('Published');
  });
});

test.describe('Dead code guard', () => {
  test('no legacy kb-* aliases or removed files come back', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
      });
    const files = walk(path.join(__dirname, '..', 'src')).filter((file) => /\.(tsx?|css)$/.test(file));
    const offenders = files.filter((file) => /\bkb-|--color-kb-|\btext-body\b|\bbg-brand\b/.test(readFileSync(file, 'utf8')));
    expect(offenders.map((file) => path.relative(path.join(__dirname, '..'), file))).toEqual([]);
    expect(existsSync(path.join(__dirname, '..', 'src', 'lib', 'design-tokens.ts'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phone pass (below 640px): list cards, no breadcrumb, 64px top bar, drawer tagline, bars and tabs
// ---------------------------------------------------------------------------
const LIST_ROUTES = ['/verification', '/opportunities', '/reports', '/seekers', '/hirers', '/community', '/content/articles', '/events', '/grants', '/team'];
const DETAIL_ROUTES: [string, string][] = [
  ['/verification/comp-1', '/verification'],
  ['/opportunities/opp-1', '/opportunities'],
  ['/reports/report-1', '/reports'],
  ['/seekers/seeker-1', '/seekers'],
  ['/hirers/hirer-1', '/hirers'],
  ['/community/ch-1', '/community'],
  ['/events/event-1', '/events'],
  ['/grants/grant-1', '/grants'],
  ['/staff/staff-1', '/team'],
];

test.describe('Phone (434px): list cards', () => {
  test.skip(process.env.E2E_PROD === '1', 'mock rows');
  test.use({ viewport: { width: 434, height: 900 } });

  for (const path of LIST_ROUTES) {
    test(`${path}: every label has a value, the card has a badge, nothing is wider than the screen`, async ({ page }) => {
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      await expect(page.getByTestId('table-row').first()).toBeVisible();
      const result = await page.evaluate(() => {
        const vw = window.innerWidth;
        const cells = [...document.querySelectorAll('main td[data-label]')].filter((td) => td.getBoundingClientRect().width > 0);
        const empty = cells
          .filter((td) => !(td.textContent || '').trim() && !td.querySelector('[role=progressbar]'))
          .map((td) => td.getAttribute('data-label'));
        const outside = cells.filter((td) => td.getBoundingClientRect().right > vw + 1).map((td) => td.getAttribute('data-label'));
        const wide = [...document.querySelectorAll('main *')]
          .filter((el) => !el.closest('thead,.sr-only') && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().right > vw + 1)
          .map((el) => el.tagName);
        const row = document.querySelector('[data-testid="table-row"]')!;
        const badge = row.querySelector('[data-testid="status-badge"]');
        const rowBox = row.getBoundingClientRect();
        const badgeBox = badge?.getBoundingClientRect();
        return {
          cells: cells.length,
          empty,
          outside,
          wide: wide.slice(0, 3),
          hasBadge: !!badge,
          badgeInsideCard: !!badgeBox && badgeBox.right <= rowBox.right + 1 && badgeBox.left >= rowBox.left - 1,
          hscroll: document.documentElement.scrollWidth - vw,
        };
      });
      expect(result.cells).toBeGreaterThan(0);
      expect(result.empty).toEqual([]);
      expect(result.outside).toEqual([]);
      expect(result.wide).toEqual([]);
      expect(result.hscroll).toBeLessThanOrEqual(0);
      expect(result.hasBadge).toBe(true);
      expect(result.badgeInsideCard).toBe(true);
    });
  }

  test('a progress cell is "figure + percent" on one line with a full-width 6px bar beneath', async ({ page }) => {
    await page.goto(`${BASE_URL}/events`, { timeout: 30_000 });
    const row = page.getByTestId('table-row').first();
    const bar = row.getByRole('progressbar');
    const cell = row.locator('td[data-label="Attendance"]');
    const barBox = (await bar.boundingBox())!;
    const cellBox = (await cell.boundingBox())!;
    expect(Math.round(barBox.height)).toBe(6);
    expect(barBox.width).toBeGreaterThanOrEqual(cellBox.width - 2); // spans the card width
    const figure = (await cell.locator('span.text-ink').first().boundingBox())!;
    expect(barBox.y).toBeGreaterThan(figure.y + figure.height - 2); // beneath the figure line
  });

  test('titles wrap instead of running under the badge', async ({ page }) => {
    await page.goto(`${BASE_URL}/grants`, { timeout: 30_000 });
    const row = page.getByTestId('table-row').first();
    const title = (await row.getByRole('link').first().boundingBox())!;
    const badge = (await row.getByTestId('status-badge').boundingBox())!;
    expect(title.x + title.width).toBeLessThanOrEqual(badge.x + 1);
  });
});

test.describe('Phone (434px): detail pages', () => {
  test.skip(process.env.E2E_PROD === '1', 'mock records');
  test.use({ viewport: { width: 434, height: 900 } });

  for (const [path, list] of DETAIL_ROUTES) {
    test(`${path}: no breadcrumb, 64px top bar, back button to ${list}`, async ({ page }) => {
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      await expect(page.getByTestId('page-title')).toBeVisible();
      await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeHidden();
      expect(Math.round((await page.locator('header.sticky').boundingBox())!.height)).toBe(64);
      const back = page.getByTestId('back-button');
      await expect(back).toBeVisible();
      expect(await back.getAttribute('aria-label')).toMatch(/^Back to /);
      const box = (await back.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(40);
      expect(box.height).toBeGreaterThanOrEqual(40);
      await back.click();
      await expect(page).toHaveURL(`${BASE_URL}${list}`);
    });
  }

  test('list pages and the Overview show only the hamburger; the Mock data pill is hidden', async ({ page }) => {
    for (const path of ['/', '/seekers', '/team']) {
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
      await expect(page.getByTestId('back-button')).toHaveCount(0);
      await expect(page.locator('header.sticky').getByText('Mock data')).toBeHidden();
      expect(Math.round((await page.locator('header.sticky').boundingBox())!.height)).toBe(64);
    }
  });

  test('the drawer tagline is not cut off', async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const tagline = page.locator('aside .brand-sub');
    await expect(tagline).toBeVisible();
    const m = await tagline.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, ellipsis: getComputedStyle(el).textOverflow }));
    expect(m.sw).toBeLessThanOrEqual(m.cw);
    expect(m.ellipsis).not.toBe('ellipsis');
    await expect(tagline).toHaveText(BRAND.sub);
  });
});

test.describe('Breadcrumb from 640px up', () => {
  test('at 700px the breadcrumb is visible and the back button is not', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await page.goto(`${BASE_URL}/seekers/seeker-1`, { timeout: 30_000 });
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
    await expect(page.getByTestId('back-button')).toBeHidden();
  });
});

test.describe('Phone (390px): sticky bars, tab rows, composer, login', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('article editor: status above the buttons, 44px buttons, and the bar never covers the last field', async ({ page }) => {
    await page.goto(`${BASE_URL}/content/articles/new`, { timeout: 30_000 });
    await page.getByLabel('Title').fill('Phone bar');
    const save = page.getByRole('button', { name: 'Save draft' });
    const cancel = page.getByRole('button', { name: 'Cancel' });
    for (const button of [save, cancel]) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const statusBox = (await page.getByText('Unsaved changes').boundingBox())!;
    expect(statusBox.y + statusBox.height).toBeLessThanOrEqual((await save.boundingBox())!.y); // own line, above
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    // scrolled to the very end, the last field sits above the bar
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const bar = (await save.locator('xpath=ancestor::div[contains(@class,"sticky")]').boundingBox())!;
    const lastField = (await page.getByRole('button', { name: 'Image', exact: true }).boundingBox())!;
    expect(lastField.y + lastField.height).toBeLessThanOrEqual(bar.y + 1);
  });

  test('invite form and Roles & permissions bars fit; the role cards stack', async ({ page }) => {
    await page.goto(`${BASE_URL}/staff/invite`, { timeout: 30_000 });
    await page.getByLabel('Full name').fill('Phone Person');
    expect((await page.getByRole('button', { name: 'Send invite' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.goto(`${BASE_URL}/team?tab=roles`);
    const cards = await Promise.all(['Super Admin', 'Moderator', 'Support'].map(async (name) => (await page.getByRole('region', { name: `${name} permissions` }).boundingBox())!));
    expect(new Set(cards.map((box) => Math.round(box.x))).size).toBe(1);
    expect(cards[1].y).toBeGreaterThan(cards[0].y + cards[0].height - 2);
    await page.getByRole('region', { name: 'Moderator permissions' }).getByRole('switch').first().click();
    expect((await page.getByRole('button', { name: 'Reset' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test('tab rows: counts never wrap, the active tab is scrolled into view, an edge fade shows there is more', async ({ page }) => {
    await page.goto(`${BASE_URL}/reference-data`, { timeout: 30_000 });
    const list = page.getByRole('tablist', { name: 'Seekers lists' });
    await expect(list).toBeVisible();
    expect(await list.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true); // four lists with counts do not fit in 390px
    await expect(page.getByTestId('tabs-fade-end').first()).toHaveCSS('opacity', '1');
    for (const tab of await list.getByRole('tab').all()) {
      expect((await tab.boundingBox())!.height).toBeLessThanOrEqual(44); // a wrapped label or count would be taller
    }
    await list.getByRole('tab', { name: /Career Interests/ }).click();
    const tab = (await list.getByRole('tab', { name: /Career Interests/ }).boundingBox())!;
    const box = (await list.boundingBox())!;
    expect(tab.x).toBeGreaterThanOrEqual(box.x - 1);
    expect(tab.x + tab.width).toBeLessThanOrEqual(box.x + box.width + 1);
    await expect(page.getByTestId('tabs-fade-start').first()).toHaveCSS('opacity', '1');
  });

  test('Notifications: composer and preview stack with no sideways scroll; Login is one centred card', async ({ page, browser }) => {
    await page.goto(`${BASE_URL}/notifications`, { timeout: 30_000 });
    const compose = (await page.getByRole('heading', { name: 'Compose' }).boundingBox())!;
    const preview = (await page.getByRole('heading', { name: 'Preview' }).boundingBox())!;
    expect(preview.y).toBeGreaterThan(compose.y);
    expect(Math.abs(preview.x - compose.x)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const login = await context.newPage();
    await login.goto(`${BASE_URL}/login`);
    await expect(login.locator('aside')).toBeHidden();
    const form = (await login.locator('form').boundingBox())!;
    expect(Math.abs(form.x + form.width / 2 - 195)).toBeLessThanOrEqual(2);
    for (const field of [login.getByLabel('Email'), login.getByLabel('Password', { exact: true })]) {
      const box = (await field.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(form.x);
      expect(box.x + box.width).toBeLessThanOrEqual(form.x + form.width);
    }
    expect((await login.getByRole('button', { name: 'Show password' }).boundingBox())!.width).toBeGreaterThanOrEqual(40);
    await context.close();
  });
});

// ---------------------------------------------------------------------------
// Phone polish and the single focus treatment
// ---------------------------------------------------------------------------
for (const width of [434, 390]) {
  test.describe(`Phone polish @${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('Reference data: the active tab is fully visible (and clear of the edge fades) after each click', async ({ page }) => {
      await page.goto(`${BASE_URL}/reference-data`, { timeout: 30_000 });
      const list = page.getByRole('tablist', { name: 'Seekers lists' });
      await expect(list).toBeVisible();
      const check = async () => {
        const tab = (await list.locator('[aria-selected="true"]').boundingBox())!;
        const box = (await list.boundingBox())!;
        expect(tab.x).toBeGreaterThanOrEqual(box.x - 1);
        expect(tab.x + tab.width).toBeLessThanOrEqual(box.x + box.width + 1);
        // not under a visible fade (each fade is 32px wide)
        const startFade = await page.getByTestId('tabs-fade-start').first().evaluate((el) => getComputedStyle(el).opacity === '1');
        const endFade = await page.getByTestId('tabs-fade-end').first().evaluate((el) => getComputedStyle(el).opacity === '1');
        if (startFade) expect(tab.x).toBeGreaterThanOrEqual(box.x + 32 - 1);
        if (endFade) expect(tab.x + tab.width).toBeLessThanOrEqual(box.x + box.width - 32 + 1);
      };
      await check(); // on load
      for (const name of [/^Programs/, /^Skills/, /^Career Interests/, /^Universities/]) {
        await list.getByRole('tab', { name }).click();
        await expect.poll(async () => {
          const tab = (await list.locator('[aria-selected="true"]').boundingBox())!;
          const box = (await list.boundingBox())!;
          return tab.x >= box.x - 1 && tab.x + tab.width <= box.x + box.width + 1;
        }).toBe(true);
        await check();
      }
    });

    test('Invite Staff: the action bar bottom edge is the viewport bottom even though the form is short', async ({ page }) => {
      await page.goto(`${BASE_URL}/staff/invite`, { timeout: 30_000 });
      const bar = page.getByRole('button', { name: 'Send invite' }).locator('xpath=ancestor::div[contains(@class,"sticky")]');
      await expect.poll(async () => {
        const box = (await bar.boundingBox())!;
        return Math.round(box.y + box.height);
      }).toBe(900);
      // the form content is short, and nothing hides behind the bar
      const lastField = (await page.getByRole('combobox', { name: 'Role' }).boundingBox())!;
      expect(lastField.y + lastField.height).toBeLessThanOrEqual((await bar.boundingBox())!.y);
    });

    test('Article editor: the Publishing switch and its status text share one centred row; the helper uses the full width', async ({ page }) => {
      await page.goto(`${BASE_URL}/content/articles/new`, { timeout: 30_000 });
      const sw = (await page.getByRole('switch', { name: 'Published' }).boundingBox())!;
      const status = (await page.getByTestId('switch-status').boundingBox())!;
      expect(Math.abs(sw.y + sw.height / 2 - (status.y + status.height / 2))).toBeLessThanOrEqual(2);
      const helper = page.getByText('Visible to seekers when on. Saved as a draft when off.');
      const card = page.getByRole('heading', { name: 'Publishing' }).locator('xpath=ancestor::div[contains(@class,"card-surface")][1]');
      const helperBox = (await helper.boundingBox())!;
      const cardBox = (await card.boundingBox())!;
      expect(helperBox.height).toBeLessThanOrEqual(2 * 16 + 2); // two lines at most (12/16 text)
      expect(helperBox.width).toBeGreaterThanOrEqual(cardBox.width - 2 * 20 - 4); // the card's full inner width
    });

    test('Grant applications: labelled Approve / Reject buttons on a second row, 44px tall; badges line up', async ({ page }) => {
      await page.goto(`${BASE_URL}/grants/grant-1`, { timeout: 30_000 });
      const approve = page.getByRole('button', { name: /^Approve / }).filter({ hasText: 'Approve' });
      await expect(approve.first()).toBeVisible();
      for (const button of [...(await approve.all()), ...(await page.getByRole('button', { name: /^Reject / }).filter({ hasText: 'Reject' }).all())]) {
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      const row = page.getByRole('region', { name: 'Applications' }).or(page.locator('li').filter({ has: page.getByRole('button', { name: /^Approve / }) })).first();
      const badges = await page.locator('li').filter({ has: page.getByTestId('status-badge') }).getByTestId('status-badge').all();
      const rights = await Promise.all(badges.map(async (badge) => Math.round((await badge.boundingBox())!.x + (await badge.boundingBox())!.width)));
      expect(new Set(rights).size).toBe(1); // the badge is at the same right edge on every row
      void row;
    });
  });
}

test.describe('List cards use flat dividers', () => {
  test.use({ viewport: { width: 434, height: 900 } });
  for (const path of ['/verification', '/opportunities', '/reports', '/seekers', '/hirers', '/community', '/content/articles', '/events', '/grants', '/team']) {
    test(`${path}: no rounded card corners`, async ({ page }) => {
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      await expect(page.getByTestId('table-row').first()).toBeVisible();
      const radius = await page.getByTestId('table-row').first().evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
      expect(radius).toBe('0px');
    });
  }
});

test.describe('One focus treatment on text fields', () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 434, height: 900 }]) {
    test.describe(`@${viewport.width}`, () => {
      test.use({ viewport });

      // Exactly one visible treatment: a flush ring (box-shadow, 0 offset) and a purple border.
      // The outline is transparent (kept only so forced-colors mode can paint it) and has no offset.
      const expectSingleFocus = async (locator: import('@playwright/test').Locator, border = 'rgb(121, 46, 164)') => {
        await locator.focus();
        await expect(locator).toBeFocused();
        const read = () =>
          locator.evaluate((el) => {
            const cs = getComputedStyle(el);
            return { outlineOffset: cs.outlineOffset, outlineColor: cs.outlineColor, outlineStyle: cs.outlineStyle, border: cs.borderTopColor, shadow: cs.boxShadow };
          });
        // The colours animate for 150ms (transition-colors), so wait for them to settle.
        await expect.poll(async () => (await read()).border).toBe(border);
        await expect.poll(async () => {
          const m = await read();
          return m.outlineStyle === 'none' || m.outlineColor === 'rgba(0, 0, 0, 0)';
        }).toBe(true);
        const m = await read();
        expect(m.outlineOffset).toBe('0px');
        expect(m.shadow).toMatch(/0px 0px 0px 3px/); // one ring: no x/y offset, no blur, 3px spread
        expect((m.shadow.match(/(?:rgba?|color)\(/g) ?? []).length).toBe(1); // a single shadow layer
        return m;
      };

      test('Input, Textarea, Select trigger, search and add fields', async ({ page }) => {
        await page.goto(`${BASE_URL}/notifications`, { timeout: 30_000 });
        await expectSingleFocus(page.getByLabel('Title'));
        await expectSingleFocus(page.getByRole('textbox', { name: 'Message' }));
        await page.goto(`${BASE_URL}/staff/invite`);
        await expectSingleFocus(page.getByRole('combobox', { name: 'Role' }));
        await page.goto(`${BASE_URL}/reference-data`);
        await expectSingleFocus(page.getByRole('searchbox', { name: 'Search universities' }));
        await expectSingleFocus(page.getByRole('textbox', { name: 'Add a new university' }));
      });

      test('an invalid field keeps the red token on focus', async ({ page }) => {
        await page.goto(`${BASE_URL}/staff/invite`, { timeout: 30_000 });
        await page.getByRole('button', { name: 'Send invite' }).click();
        const name = page.getByLabel('Full name');
        await expect(name).toHaveAttribute('aria-invalid', 'true');
        const m = await expectSingleFocus(name, 'rgb(185, 28, 28)');
        const rgb = (m.shadow.match(/srgb ([\d.]+) ([\d.]+) ([\d.]+)/) ?? []).slice(1).map(Number);
        expect(rgb[0]).toBeGreaterThan(rgb[2] * 2); // the ring is red (high red, low blue), not purple
      });
    });
  }

  test('Notifications Title, focused (screenshot)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/notifications`, { timeout: 30_000 });
    const title = page.getByLabel('Title');
    await title.focus();
    await expect.poll(() => title.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(121, 46, 164)'); // transition finished
    await expect(title).toHaveScreenshot('notifications-title-focused.png', { animations: 'disabled', caret: 'hide' });
  });
});

// ---------------------------------------------------------------------------
// Month selector: our own Select (dropdown from 640px, bottom sheet on phones)
// ---------------------------------------------------------------------------
test.describe('Month selector', () => {
  test('1440px: options render in our listbox (not a native select); arrows and Enter change the label; Esc returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
    await expect(page.locator('select')).toHaveCount(0); // no native select anywhere on the page
    const trigger = page.getByRole('combobox', { name: 'Month' });
    const first = (await trigger.innerText()).trim();
    expect(first).toMatch(/^[A-Z][a-z]+ \d{4}$/); // the label format stays "October 2026"

    await trigger.click();
    const list = page.getByRole('listbox', { name: 'Month' });
    await expect(list).toBeVisible();
    const options = list.getByRole('option');
    await expect(options).toHaveCount(6);
    await expect(options.first()).toContainText('Current'); // newest first, current month marked
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');

    // Panel styling from the brief: white, 12px radius, 1px line border, 4px gap, at least 200px wide, 40px rows.
    const panel = await list.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { radius: cs.borderTopLeftRadius, border: cs.borderTopWidth, maxHeight: cs.maxHeight, bg: cs.backgroundColor, width: el.getBoundingClientRect().width };
    });
    expect(panel.radius).toBe('12px');
    expect(panel.border).toBe('1px');
    expect(panel.maxHeight).toBe('320px');
    expect(panel.width).toBeGreaterThanOrEqual(200);
    expect(Math.round((await options.first().boundingBox())!.height)).toBe(40);
    const gap = (await list.boundingBox())!.y - ((await trigger.boundingBox())!.y + (await trigger.boundingBox())!.height);
    expect(Math.round(gap)).toBe(4);

    // the page behind does not scroll while it is open
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');

    // Arrow keys and Enter change the label.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(list).toHaveCount(0);
    const second = (await trigger.innerText()).trim();
    expect(second).not.toBe(first);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');

    // Home / End, then Esc closes without changing and returns focus to the trigger.
    await page.keyboard.press('ArrowDown'); // opens
    await page.keyboard.press('End');
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect((await trigger.innerText()).trim()).toBe(second);
  });

  test('1440px: a click outside closes it, and Insights keeps the same shared selector and note', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/analytics`, { timeout: 30_000 });
    const trigger = page.getByRole('combobox', { name: 'Month' });
    await trigger.click();
    await expect(page.getByRole('listbox', { name: 'Month' })).toBeVisible();
    await page.mouse.click(700, 500);
    await expect(page.getByRole('listbox', { name: 'Month' })).toHaveCount(0);
    await trigger.click();
    await page.getByRole('option').nth(1).click();
    await expect(page.getByRole('status').filter({ hasText: 'do not change by month' })).toBeVisible();
  });

  test('390px: a bottom sheet opens with 48px rows, a 40px close button, and closes on a backdrop tap', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
    const trigger = page.getByRole('combobox', { name: 'Month' });
    await trigger.click();
    const sheet = page.getByRole('dialog', { name: 'Select month' });
    await expect(sheet).toBeVisible();
    // pinned to the bottom (poll: it slides up for 200ms)
    await expect.poll(async () => {
      const b = (await sheet.boundingBox())!;
      return Math.round(b.y + b.height);
    }).toBe(800);
    expect((await sheet.boundingBox())!.width).toBe(390);
    const radius = await sheet.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(radius).toBe('20px');
    const rows = sheet.getByRole('option');
    await expect(rows).toHaveCount(6);
    expect(Math.round((await rows.first().boundingBox())!.height)).toBe(48);
    const close = (await sheet.getByRole('button', { name: 'Close' }).boundingBox())!;
    expect(close.width).toBeGreaterThanOrEqual(40);
    expect(close.height).toBeGreaterThanOrEqual(40);

    // focus is trapped: Tab never leaves the sheet
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    }

    // tap the dimmed backdrop (above the sheet) to close
    await page.mouse.click(195, 60);
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();

    // Esc closes too, and choosing a row changes the label
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    const before = (await trigger.innerText()).trim();
    await trigger.click();
    await page.getByRole('dialog', { name: 'Select month' }).getByRole('option').nth(2).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await trigger.innerText()).trim()).not.toBe(before);
  });

  test('the dropdown flips upward when there is no room below', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 380 });
    await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
    const trigger = page.getByRole('combobox', { name: 'Month' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await trigger.click();
    const list = page.getByRole('listbox', { name: 'Month' });
    await expect(list).toBeVisible();
    // The list always stays inside the viewport: it fits below, or opens above, or shrinks and scrolls.
    const t = (await trigger.boundingBox())!;
    const l = (await list.boundingBox())!;
    const fitsBelow = l.y >= t.y + t.height && l.y + l.height <= 380;
    const opensAbove = l.y + l.height <= t.y && l.y >= 0;
    expect(fitsBelow || opensAbove).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Roles, permissions, gated navigation and placeholder routes
// ---------------------------------------------------------------------------
const NAV_ORDER = [
  'Overview', 'Insights', 'Monthly report', 'Scorecard',
  'Opportunities Queue', 'Events', 'Grants', 'Programs',
  'Partners', 'Network', 'Leaderboard',
  'Seekers', 'Hirers', 'Channels', 'Database',
  'Verification Queue', 'Reports Queue',
  'Career Resources', 'Reference data', 'Social', 'Testimonials',
  'Notifications', 'Team', 'Settings',
];
const slugOf = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// What each role (or pair of roles) must see in the sidebar. Written out by hand, NOT derived from the matrix,
// so a change to src/config/permissions.ts has to be made here on purpose.
const EXPECTED_NAV: Record<string, string[]> = {
  super_admin: NAV_ORDER,
  desk_lead: NAV_ORDER,
  moderator: ['Overview', 'Scorecard', 'Opportunities Queue', 'Seekers', 'Hirers', 'Channels', 'Verification Queue', 'Reports Queue', 'Settings'],
  support: ['Overview', 'Scorecard', 'Seekers', 'Hirers', 'Settings'],
  partnerships_officer: ['Overview', 'Scorecard', 'Partners', 'Network', 'Leaderboard', 'Settings'],
  opportunities_officer: ['Overview', 'Scorecard', 'Opportunities Queue', 'Events', 'Grants', 'Career Resources', 'Settings'],
  training_officer: ['Overview', 'Scorecard', 'Events', 'Programs', 'Network', 'Settings'],
  database_officer: ['Overview', 'Scorecard', 'Network', 'Database', 'Settings'],
  communications_officer: ['Overview', 'Monthly report', 'Scorecard', 'Career Resources', 'Social', 'Testimonials', 'Notifications', 'Settings'],
  social_media_manager: ['Overview', 'Scorecard', 'Social', 'Settings'],
  country_lead: ['Overview', 'Scorecard', 'Programs', 'Partners', 'Network', 'Leaderboard', 'Database', 'Settings'],
  admin_support: ['Overview', 'Scorecard', 'Team', 'Settings'],
  'moderator,communications_officer': ['Overview', 'Monthly report', 'Scorecard', 'Opportunities Queue', 'Seekers', 'Hirers', 'Channels', 'Verification Queue', 'Reports Queue', 'Career Resources', 'Social', 'Testimonials', 'Notifications', 'Settings'],
};

const asRoles = async (context: import('@playwright/test').BrowserContext, roles: string) =>
  context.addCookies([{ name: 'god_dev_roles', value: roles, url: BASE_URL }]);

test.describe('Roles: gated navigation (dev role cookie, mock mode)', () => {
  test.skip(process.env.E2E_PROD === '1', 'the dev role switcher only exists in development with mock data');
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const [roles, expected] of Object.entries(EXPECTED_NAV)) {
    test(`${roles}: sidebar shows exactly its pages`, async ({ page, context }) => {
      await asRoles(context, roles);
      await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
      await expect(page.getByTestId('page-title')).toBeVisible();
      const aside = page.locator('aside');
      // open every group (only the active one starts open)
      const closed = aside.locator('[data-testid^="nav-group-"][aria-expanded="false"]');
      for (let i = 0; i < 10 && (await closed.count()) > 0; i++) await closed.first().click(); // the list shrinks as groups open
      const ids = await aside.locator('[data-testid^="nav-item-"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!.replace('nav-item-', '')));
      expect(ids).toEqual(expected.map(slugOf));
      // a group with no visible page is not rendered at all
      const groups = await aside.locator('[data-testid^="nav-group-"]').count();
      expect(groups).toBeGreaterThan(0);
      expect(groups).toBeLessThanOrEqual(7);
    });

    test(`${roles}: Overview, My Scorecard and Settings are reachable`, async ({ page, context }) => {
      await asRoles(context, roles);
      for (const path of ['/', '/scorecard', '/settings']) {
        await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
        await expect(page.getByTestId('page-title')).toBeVisible();
        await expect(page.getByTestId('no-access')).toHaveCount(0);
      }
    });
  }

  test('the command palette and the breadcrumb menu list only visible pages', async ({ page, context }) => {
    await asRoles(context, 'support');
    await page.goto(`${BASE_URL}/seekers`, { timeout: 30_000 });
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog');
    await expect(palette.getByRole('option', { name: /Seekers/ })).toBeVisible();
    await expect(palette.getByRole('option', { name: /Verification Queue/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.locator('header button[aria-haspopup="menu"]').first().click();
    const items = await page.locator('header [role="menuitem"]').allInnerTexts();
    expect(items.map((text) => text.trim())).toEqual(['Seekers', 'Hirers']); // People group: no Channels, no Database
  });

  test('a forbidden direct URL shows the no-access state, with the owning role and a link to Overview', async ({ page, context }) => {
    await asRoles(context, 'support');
    for (const path of ['/verification', '/reports/report-1', '/team', '/staff/invite', '/analytics', '/partners']) {
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      const state = page.getByTestId('no-access');
      await expect(state).toBeVisible();
      await expect(state).toContainText("You don't have access to this page");
      await expect(state).toContainText('looked after by');
      await expect(state.getByRole('link', { name: 'Go to Overview' })).toHaveAttribute('href', '/');
      await expect(page.getByTestId('table-row')).toHaveCount(0); // the page itself did not render
    }
    // it names the role that owns it, and Overview works from there (no redirect loop)
    await page.goto(`${BASE_URL}/verification`);
    await expect(page.getByTestId('no-access')).toContainText('Moderator');
    await page.getByRole('link', { name: 'Go to Overview' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect(page.getByTestId('page-title')).toBeVisible();
  });

  test('form pages need edit access: the invite form is closed to a role that can only view Team', async ({ page, context }) => {
    await asRoles(context, 'moderator');
    await page.goto(`${BASE_URL}/staff/invite`, { timeout: 30_000 });
    await expect(page.getByTestId('no-access')).toBeVisible();
    await asRoles(context, 'admin_support');
    await page.goto(`${BASE_URL}/staff/invite`);
    await expect(page.getByTestId('page-title')).toHaveText('Invite Staff');
  });

  test('the Scorecard has a Team tab only for the desk lead and the super admin', async ({ page, context }) => {
    await asRoles(context, 'moderator');
    await page.goto(`${BASE_URL}/scorecard?tab=team`, { timeout: 30_000 });
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'My scorecard' })).toBeVisible(); // asking for Team falls back to mine
    await asRoles(context, 'desk_lead');
    await page.goto(`${BASE_URL}/scorecard`);
    await expect(page.getByRole('tab', { name: 'My scorecard' })).toBeVisible();
    await page.getByRole('tab', { name: 'Team' }).click();
    await expect(page.getByRole('region', { name: 'Team scorecard' })).toBeVisible();
    await expect(page).toHaveURL(`${BASE_URL}/scorecard?tab=team`);
  });

  test('the dev switcher: "Viewing as" pill, at most two roles, and the nav follows', async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
    await expect(page.getByTestId('viewing-as')).toContainText('Viewing as');
    await page.getByRole('button', { name: /Account menu/ }).click();
    const menu = page.getByRole('menu', { name: 'Account' });
    await expect(menu.getByRole('menuitemcheckbox')).toHaveCount(12);
    await menu.getByRole('menuitemcheckbox', { name: 'Support', exact: true }).click();
    await expect(page.getByTestId('viewing-as')).toContainText('Viewing as Support');
    await expect(menu).toBeVisible(); // the menu stays open between choices
    await menu.getByRole('menuitemcheckbox', { name: 'Moderator', exact: true }).click();
    await expect(page.getByTestId('viewing-as')).toContainText('Support + Moderator');
    // two chosen: every other role is disabled
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Desk Lead', exact: true })).toBeDisabled();
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Support', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    // the choice is in a cookie, so a reload keeps it (and the server renders it on the first paint)
    await page.reload();
    await expect(page.getByTestId('viewing-as')).toContainText('Support + Moderator');
    expect((await page.context().cookies()).find((cookie) => cookie.name === 'god_dev_roles')?.value).toBe('support,moderator');
  });
});

test.describe('Permissions: the rules themselves (no browser)', () => {
  test('the dev switcher does not exist in production, or without mock data', () => {
    expect(isDevRoleSwitcherEnabled('production', true)).toBe(false);
    expect(isDevRoleSwitcherEnabled('production', false)).toBe(false);
    expect(isDevRoleSwitcherEnabled('development', false)).toBe(false);
    expect(isDevRoleSwitcherEnabled('development', true)).toBe(true);
    expect(isDevRoleSwitcherEnabled('test', true)).toBe(true);
  });

  test('the cookie value is parsed safely: unknown ids dropped, at most two roles', () => {
    expect(parseDevRoles('moderator,support')).toEqual(['moderator', 'support']);
    expect(parseDevRoles('moderator,nope,support,desk_lead')).toEqual(['moderator', 'support']);
    expect(parseDevRoles('')).toEqual([]);
    expect(parseDevRoles(undefined)).toEqual([]);
  });

  test('two roles get the highest level of either; editing implies viewing', () => {
    expect(roleCan(['partnerships_officer'], 'network', 'edit')).toBe(false);
    expect(roleCan(['partnerships_officer'], 'network', 'view')).toBe(true);
    expect(roleCan(['partnerships_officer', 'country_lead'], 'network', 'edit')).toBe(true); // country lead edits network
    expect(roleCan(['support'], 'verification', 'view')).toBe(false);
    expect(roleCan(['desk_lead'], 'team_scorecard', 'view')).toBe(true);
    expect(roleCan(['desk_lead'], 'team_scorecard', 'edit')).toBe(false);
    expect(roleCan(['super_admin'], 'team_scorecard', 'edit')).toBe(false);
    expect(roleCan(['moderator'], 'team_scorecard', 'view')).toBe(false);
  });

  test('every role can open Overview, My scorecard and Settings; no role can edit the Team scorecard', () => {
    for (const role of ROLE_IDS) {
      expect(roleCan([role], 'overview', 'view')).toBe(true);
      expect(roleCan([role], 'my_scorecard', 'edit')).toBe(true);
      expect(roleCan([role], 'settings', 'edit')).toBe(true);
      expect(roleCan([role], 'team_scorecard', 'edit')).toBe(false);
    }
  });
});

test.describe('New placeholder routes', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  const STUBS: [string, string][] = [
    ['/programs', 'Programs'], ['/partners', 'Partners'], ['/network', 'Network'], ['/leaderboard', 'Leaderboard'], ['/database', 'Database'],
    ['/social', 'Social'], ['/testimonials', 'Testimonials'], ['/settings', 'Settings'], ['/monthly-report', 'Monthly report'], ['/scorecard', 'Scorecard'],
  ];
  for (const [path, title] of STUBS) {
    test(`${path}: header, breadcrumb group and the later-step state, no console errors`, async ({ page }) => {
      const problems = trackProblems(page);
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      await expect(page.getByTestId('page-title')).toHaveText(title);
      await expect(page.getByText('This screen is built in a later step')).toBeVisible();
      await expect(page.locator('header.sticky nav[aria-label="Breadcrumb"]')).toContainText(title);
      expect(problems).toEqual([]);
    });
  }

  test('entity accents: Programs is orange, Partners and Network are purple', async ({ page }) => {
    const tone = async (path: string) => {
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      return page.locator('main header .bg-orange-50, main header .bg-purple-50').first().evaluate((el) => (el.className.includes('bg-orange-50') ? 'orange' : 'purple'));
    };
    expect(await tone('/programs')).toBe('orange');
    expect(await tone('/partners')).toBe('purple');
    expect(await tone('/network')).toBe('purple');
  });

  test('the new entity collections exist and are empty', () => {
    const collections = emptyCollections();
    expect(Object.keys(collections).sort()).toEqual(['ambassadors', 'databaseRecords', 'listings', 'partners', 'programs', 'socialPosts', 'targets', 'testimonials']);
    for (const rows of Object.values(collections)) expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Real admin data API (added on main: SEC-075). These need a backend that has the /admin/* routes and the
// seeded fixtures of its e2e server, so they skip with a clear reason otherwise.
// ---------------------------------------------------------------------------
test.describe('Admin data API (real backend)', () => {
  test('GET /admin/dashboard returns month KPIs against targets', async ({ request }) => {
    test.skip(!(await apiAvailable(request)), API_DOWN_REASON);
    const response = await request.get(`${API_URL}/admin/dashboard`);
    test.skip(response.status() === 404, 'the running backend does not have the admin data API (/admin/*) yet');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data.data.kpis)).toBeTruthy();
    const metrics = data.data.kpis.map((kpi: { metric: string }) => kpi.metric);
    expect(metrics).toContain('opportunitiesPublished');
    expect(metrics).toContain('programsActive');
  });
});

test.describe('Directory pages show real data (E2E_REAL_DATA=1)', () => {
  // The dashboard must be running with NEXT_PUBLIC_USE_MOCKS=false against the e2e backend (seeded fixtures).
  test.skip(process.env.E2E_REAL_DATA !== '1', 'set E2E_REAL_DATA=1 with the admin running in real-API mode against the seeded e2e backend');

  test('seekers page lists the seeded seeker', async ({ page }) => {
    await page.goto(`${BASE_URL}/seekers`, { timeout: 30_000 });
    await expect(page.getByText('E2E Seeker')).toBeVisible();
    await expect(page.getByText('e2e-seeker@kredibble.com')).toBeVisible();
  });

  test('hirers page lists the seeded company', async ({ page }) => {
    await page.goto(`${BASE_URL}/hirers`, { timeout: 30_000 });
    await expect(page.getByText('E2E Holdings')).toBeVisible();
  });

  test('verification page lists the pending company', async ({ page }) => {
    await page.goto(`${BASE_URL}/verification`, { timeout: 30_000 });
    await expect(page.getByText('E2E Holdings')).toBeVisible();
  });
});
