import { test, expect } from '@playwright/test';
import { BRAND, BRAND_ADMIN_TITLE, BRAND_EMAIL_DOMAIN } from '../src/config/brand';
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { isDevRoleSwitcherEnabled, parseDevRoles } from '../src/config/dev-roles';
import { SCREENS, editableRoleGrants, roleCan } from '../src/config/permissions';
import { KPIS, KPI_KEYS, kpisOwnedBy } from '../src/config/kpis';
import { ROLE_IDS } from '../src/config/roles';
import { formatMonth, joinList } from '../src/lib/format';
import { attainment, currentMonth, daysInMonth, isPastMonth, kpiMonthStatus, kpiStatus, kpiTarget, kpiValue, monthProgress, monthSeries, monthsBefore, newInMonth, shouldRecordReport } from '../src/lib/kpi';
import { staffOwningKpi } from '../src/lib/services/staff';
import { AMBASSADOR_STATUSES, AMBASSADOR_TIERS, LISTING_TYPES, PARTNER_STAGES, PARTNER_STAGE_LABELS, isPartnerClosed, partnerClosedAt, PROGRAM_STATUSES, PROGRAM_TYPES, RECORD_SOURCES, SOCIAL_PLATFORMS, TESTIMONIAL_STATUSES } from '../src/lib/mock-entities';
import { DEFAULT_TARGETS, DEFAULT_THRESHOLDS, buildSeed } from '../src/lib/mock-seed';
import { getKpiThresholds } from '../src/lib/mock-store';
import { getStatusMeta } from '../src/lib/status-map';
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

    await page.getByRole('combobox', { name: 'Role', exact: true }).click();
    const options = page.getByRole('option');
    await expect(options).toHaveCount(12); // every role
    for (const role of ['Super Admin', 'Moderator', 'Support']) {
      const option = page.getByRole('option', { name: new RegExp(`^${role}`) });
      await expect(option).toBeVisible();
      expect(((await option.innerText()).split('\n').filter(Boolean)).length).toBeGreaterThanOrEqual(2); // label + description
    }
  });

  test('the Role select works from the keyboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/staff/invite`, { timeout: 30_000 });
    const role = page.getByRole('combobox', { name: 'Role', exact: true });
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
    await page.getByRole('combobox', { name: 'Role', exact: true }).click();
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
    await page.getByRole('combobox', { name: 'Role', exact: true }).click();
    await expect(page.getByRole('option', { name: /^Support/ })).toContainText('suspend accounts and send notifications');
  });

  test('unsaved permission edits survive a switch of tab, and leaving asks first', async ({ page }) => {
    await page.goto(`${BASE_URL}/team?tab=roles`, { timeout: 30_000 });
    await page.getByRole('region', { name: 'Moderator permissions' }).getByRole('switch', { name: 'Manage staff accounts' }).click();
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
      expect(describeRole('support')).toBe('Can suspend accounts.');
      only(['suspend', 'broadcast']);
      expect(describeRole('support')).toBe('Can suspend accounts and send notifications.');
      only(['verifications', 'moderate', 'suspend']);
      expect(describeRole('support')).toBe('Can review verifications, moderate opportunities and community, and suspend accounts.');
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
          .filter((el) => !el.closest('thead,.sr-only,[data-edge-fade]') && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().right > vw + 1)
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
      const lastField = (await page.getByTestId('invite-role-chips').boundingBox())!;
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
        await expectSingleFocus(page.getByRole('combobox', { name: 'Role', exact: true }));
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
    // The baseline image was generated on Windows (font rendering differs per OS), and CI fails on a missing baseline.
    test.skip(process.platform !== 'win32', 'the screenshot baseline exists for Windows only; regenerate with --update-snapshots on this OS');
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
    // the label follows the URL, which changes a moment after the choice
    await expect(trigger).not.toHaveText(first);
    const second = (await trigger.innerText()).trim();
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
    await expect(trigger).not.toHaveText(before);
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
  moderator: ['Overview', 'Scorecard', 'Seekers', 'Hirers', 'Channels', 'Verification Queue', 'Reports Queue', 'Opportunities Queue', 'Settings'],
  support: ['Overview', 'Scorecard', 'Seekers', 'Hirers', 'Settings'],
  partnerships_officer: ['Overview', 'Monthly report', 'Scorecard', 'Partners', 'Network', 'Leaderboard', 'Settings'],
  opportunities_officer: ['Overview', 'Scorecard', 'Opportunities Queue', 'Events', 'Grants', 'Career Resources', 'Settings'],
  training_officer: ['Overview', 'Scorecard', 'Events', 'Programs', 'Network', 'Settings'],
  database_officer: ['Overview', 'Scorecard', 'Network', 'Database', 'Settings'],
  communications_officer: ['Overview', 'Monthly report', 'Scorecard', 'Career Resources', 'Social', 'Testimonials', 'Notifications', 'Settings'],
  social_media_manager: ['Overview', 'Scorecard', 'Social', 'Settings'],
  country_lead: ['Overview', 'Scorecard', 'Partners', 'Network', 'Leaderboard', 'Programs', 'Database', 'Settings'],
  admin_support: ['Overview', 'Scorecard', 'Team', 'Settings'],
  'moderator,communications_officer': ['Overview', 'Monthly report', 'Scorecard', 'Seekers', 'Hirers', 'Channels', 'Verification Queue', 'Reports Queue', 'Career Resources', 'Social', 'Testimonials', 'Notifications', 'Settings', 'Opportunities Queue'],
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
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500); // hydration
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
      await expect(state).toContainText('Ask a Desk Lead or Super Admin if you need access.');
      await expect(state).not.toContainText('Ask your desk lead');
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
    await expect(page.getByText('Targets and results for you.', { exact: true })).toBeVisible();
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
    ['/partners', 'Partners'], ['/network', 'Network'], ['/leaderboard', 'Leaderboard'], ['/database', 'Database'],
    ['/social', 'Social'], ['/testimonials', 'Testimonials'], ['/settings', 'Settings'], ['/monthly-report', 'Monthly report'], ['/scorecard', 'Scorecard'],
  ];
  for (const [path, title] of STUBS) {
    test(`${path}: header, breadcrumb group and the later-step state, no console errors`, async ({ page }) => {
      const problems = trackProblems(page);
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      await expect(page.getByTestId('page-title')).toHaveText(title);
      // the Scorecard of a Super Admin owns no metrics, so it shows that empty state instead
      await expect(page.getByText(path === '/scorecard' ? 'No metrics are assigned to your role' : 'This screen is built in a later step')).toBeVisible();
      await expect(page.locator('header.sticky nav[aria-label="Breadcrumb"]')).toContainText(title);
      expect(problems).toEqual([]);
    });
  }

  test('entity accents: Partners and Network are purple (Programs is orange: see the Programs tests)', async ({ page }) => {
    const tone = async (path: string) => {
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      return page.locator('main header .bg-orange-50, main header .bg-purple-50').first().evaluate((el) => (el.className.includes('bg-orange-50') ? 'orange' : 'purple'));
    };
    expect(await tone('/partners')).toBe('purple');
    expect(await tone('/network')).toBe('purple');
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

// ---------------------------------------------------------------------------
// Seed data, KPI configuration and shared helpers (pure functions: no page needed)
// ---------------------------------------------------------------------------
// A fixed "today" (the 15th, mid-month) so every number below is the same on every day the suite runs.
const FIXED_TODAY = new Date(Date.UTC(2026, 5, 15));
const seeded = buildSeed(FIXED_TODAY);
const seed = seeded.collections;
const FIXED_MONTHS = Array.from({ length: 6 }, (_, i) => monthsBefore('2026-06', 5 - i)); // oldest -> current
const kpiData = { ...seed };

test.describe('KPI status', () => {
  const T = DEFAULT_THRESHOLDS;
  test('the stored thresholds are 0.95 and 0.7', () => {
    expect(T).toEqual({ green: 0.95, amber: 0.7 });
    expect(getKpiThresholds()).toEqual({ green: 0.95, amber: 0.7 });
  });

  test('boundaries on a full month: exactly at the edge counts as the better colour', () => {
    // target 20, a whole month (30 of 30 days)
    expect(kpiStatus(19, 20, 30, 30, T)).toBe('green'); // exactly 0.95
    expect(kpiStatus(18, 20, 30, 30, T)).toBe('amber'); // 0.90
    expect(kpiStatus(14, 20, 30, 30, T)).toBe('amber'); // exactly 0.70
    expect(kpiStatus(13, 20, 30, 30, T)).toBe('red'); // 0.65
    // just either side of each edge, with a bigger target
    expect(kpiStatus(95, 100, 30, 30, T)).toBe('green');
    expect(kpiStatus(94, 100, 30, 30, T)).toBe('amber');
    expect(kpiStatus(70, 100, 30, 30, T)).toBe('amber');
    expect(kpiStatus(69, 100, 30, 30, T)).toBe('red');
    expect(kpiStatus(120, 100, 30, 30, T)).toBe('green'); // over target
    expect(kpiStatus(0, 100, 30, 30, T)).toBe('red');
  });

  test('pro-rating: day 1 of the month needs only a small share of the target', () => {
    // target 30 over 30 days: day 1 asks for 1, day 2 for 2
    expect(kpiStatus(1, 30, 1, 30, T)).toBe('green');
    expect(kpiStatus(0, 30, 1, 30, T)).toBe('red');
    expect(kpiStatus(2, 30, 2, 30, T)).toBe('green');
    expect(kpiStatus(1, 30, 2, 30, T)).toBe('red'); // 1 of 2 = 0.5
    // halfway (15 of 30) the share is half the target
    expect(kpiStatus(10, 20, 15, 30, T)).toBe('green'); // 10 of 10
    expect(kpiStatus(9, 20, 15, 30, T)).toBe('amber'); // 0.9
    expect(kpiStatus(7, 20, 15, 30, T)).toBe('amber'); // exactly 0.7
    expect(kpiStatus(6, 20, 15, 30, T)).toBe('red'); // 0.6
  });

  test('pro-rating: on the last day the full target applies, and a past month is judged on the full target', () => {
    expect(kpiStatus(29, 30, 30, 30, T)).toBe('green');
    expect(kpiStatus(28, 30, 30, 30, T)).toBe('amber');
    expect(kpiStatus(10, 20, 31, 31, T)).toBe('red'); // a past month passes dayOfMonth = daysInMonth
    // the same value is healthy earlier in the current month and weak at the end of it
    expect(kpiStatus(10, 20, 15, 30, T)).toBe('green');
    expect(kpiStatus(10, 20, 30, 30, T)).toBe('red');
  });

  test('a KPI without a target is green; thresholds are read from the argument, not hard-coded', () => {
    expect(kpiStatus(0, 0, 10, 30, T)).toBe('green');
    expect(kpiStatus(8, 10, 30, 30, { green: 0.8, amber: 0.5 })).toBe('green');
    expect(kpiStatus(8, 10, 30, 30, { green: 0.9, amber: 0.5 })).toBe('amber');
    expect(kpiStatus(4, 10, 30, 30, { green: 0.9, amber: 0.5 })).toBe('red');
  });

  test('attainment is value over target (not capped), null with no target', () => {
    expect(attainment(50, 100)).toBe(0.5);
    expect(attainment(120, 100)).toBe(1.2);
    expect(attainment(5, 0)).toBeNull();
  });

  test('month helpers', () => {
    expect(currentMonth(FIXED_TODAY)).toBe('2026-06');
    expect(monthsBefore('2026-03', 4)).toBe('2025-11');
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(isPastMonth('2026-05', FIXED_TODAY)).toBe(true);
    expect(isPastMonth('2026-06', FIXED_TODAY)).toBe(false);
    expect(monthProgress('2026-06', FIXED_TODAY)).toEqual({ dayOfMonth: 15, daysInMonth: 30 });
    expect(monthProgress('2026-05', FIXED_TODAY)).toEqual({ dayOfMonth: 31, daysInMonth: 31 });
    expect(formatMonth('2026-10')).toBe('October 2026');
    expect(formatMonth('nonsense')).toBe('nonsense');
  });
});

test.describe('KPI configuration', () => {
  test('ten KPIs, each with a label, unit, note, link screen and owners', () => {
    expect(KPI_KEYS).toHaveLength(10);
    for (const key of KPI_KEYS) {
      const kpi = KPIS[key];
      expect(kpi.key).toBe(key);
      expect(kpi.label.length).toBeGreaterThan(0);
      expect(kpi.unit.length).toBeGreaterThan(0);
      expect(kpi.note.length).toBeGreaterThan(0);
      expect(SCREENS).toContain(kpi.screen);
      expect(kpi.owners.length).toBeGreaterThan(0);
    }
    expect(KPIS.programs_organised.note).toBe('Delivered programs this month');
  });

  test('role ownership follows the brief; the desk lead owns all ten; admin support owns none', () => {
    const owned = (role: string) => KPI_KEYS.filter((key) => (KPIS[key].owners as string[]).includes(role));
    expect(owned('opportunities_officer')).toEqual(['opportunities_published']);
    expect(owned('training_officer')).toEqual(['programs_organised']);
    expect(owned('partnerships_officer')).toEqual(['partners_onboarded']);
    expect(owned('database_officer')).toEqual(['beneficiaries_verified']);
    expect(owned('social_media_manager')).toEqual(['social_reach', 'social_engagement', 'posts_published']);
    expect(owned('communications_officer')).toEqual(['website_views', 'monthly_reports']);
    expect(owned('country_lead')).toEqual(['active_ambassadors']);
    expect(owned('desk_lead')).toEqual([...KPI_KEYS]);
    expect(owned('admin_support')).toEqual([]);
    expect(kpisOwnedBy(['admin_support'])).toEqual([]);
    expect(kpisOwnedBy(['training_officer', 'country_lead']).map((kpi) => kpi.key)).toEqual(['programs_organised', 'active_ambassadors']);
  });

  test('every KPI has a stored default target, the thresholds are stored, and no component hard-codes them', () => {
    expect(Object.keys(DEFAULT_TARGETS).sort()).toEqual([...KPI_KEYS].sort());
    for (const key of KPI_KEYS) expect(kpiTarget(key, kpiData)).toBe(DEFAULT_TARGETS[key]);
    expect(seed.targets).toHaveLength(10);
    expect(seed.targets.every((target) => target.target > 0)).toBe(true);
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
    const ui = [...walk(path.join(__dirname, '..', 'src', 'components')), ...walk(path.join(__dirname, '..', 'src', 'app'))].filter((file) => /\.tsx$/.test(file));
    const offenders = ui.filter((file) => /\b0\.95\b|\b0\.7\b/.test(readFileSync(file, 'utf8')));
    expect(offenders.map((file) => path.relative(path.join(__dirname, '..'), file))).toEqual([]);
  });
});

test.describe('Seed data', () => {
  const ids = (rows: { id: string }[]) => rows.map((row) => row.id);
  const unique = (values: string[]) => new Set(values).size === values.length;

  test('the volumes are fully populated, and the seed is deterministic', () => {
    expect(seed.listings).toHaveLength(14);
    expect(seed.programs).toHaveLength(12);
    expect(seed.partners).toHaveLength(18);
    expect(seed.ambassadors).toHaveLength(40);
    expect(seed.databaseRecords).toHaveLength(120);
    expect(seed.socialPosts).toHaveLength(60);
    expect(seed.testimonials).toHaveLength(9);
    expect(seed.staff).toHaveLength(13);
    expect(seed.websiteMonths).toHaveLength(6);
    expect(seed.targets).toHaveLength(10);
    expect(seed.amplificationLogs.length).toBeGreaterThan(40);
    expect(JSON.stringify(buildSeed(FIXED_TODAY))).toBe(JSON.stringify(seeded)); // same input, same data
  });

  test('every kind and status is represented', () => {
    expect(new Set(seed.listings.map((l) => l.type))).toEqual(new Set(LISTING_TYPES));
    expect(new Set(seed.listings.map((l) => l.status))).toEqual(new Set(['draft', 'published']));
    expect(seed.listings.some((l) => l.vetted) && seed.listings.some((l) => !l.vetted)).toBe(true);
    expect(new Set(seed.programs.map((p) => p.type))).toEqual(new Set(PROGRAM_TYPES));
    expect(new Set(seed.programs.map((p) => p.status))).toEqual(new Set(PROGRAM_STATUSES));
    expect(seed.programs.some((p) => p.partnerId) && seed.programs.some((p) => !p.partnerId)).toBe(true);
    expect(new Set(seed.partners.map((p) => p.stage))).toEqual(new Set(PARTNER_STAGES));
    expect(new Set(seed.ambassadors.map((a) => a.tier))).toEqual(new Set(AMBASSADOR_TIERS));
    expect(new Set(seed.ambassadors.map((a) => a.status))).toEqual(new Set(AMBASSADOR_STATUSES));
    expect(new Set(seed.databaseRecords.map((r) => r.source))).toEqual(new Set(RECORD_SOURCES));
    expect(seed.databaseRecords.some((r) => r.verified) && seed.databaseRecords.some((r) => !r.verified)).toBe(true);
    expect(new Set(seed.socialPosts.map((p) => p.platform))).toEqual(new Set(SOCIAL_PLATFORMS));
    expect(new Set(seed.testimonials.map((t) => t.status))).toEqual(new Set(TESTIMONIAL_STATUSES));
    for (const campus of ['KNUST', 'University of Ghana', 'Ashesi University', 'UCC']) expect(seed.ambassadors.map((a) => a.campus)).toContain(campus);
    // six stage histories: every partner past "prospect" went through the earlier stages in order
    for (const partner of seed.partners) {
      expect(partner.stage).toBe(partner.stageHistory[partner.stageHistory.length - 1].stage);
      const positions = partner.stageHistory.map((entry) => PARTNER_STAGES.indexOf(entry.stage));
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expect(partner.stageHistory.map((entry) => entry.at)).toEqual([...partner.stageHistory.map((entry) => entry.at)].sort());
    }
  });

  test('ids and referral codes are unique, and codes look like GOD-7K2M4Q', () => {
    for (const rows of [seed.listings, seed.programs, seed.partners, seed.ambassadors, seed.databaseRecords, seed.socialPosts, seed.testimonials, seed.staff, seed.amplificationLogs]) {
      expect(unique(ids(rows))).toBe(true);
    }
    const codes = seed.ambassadors.map((a) => a.referralCode);
    expect(unique(codes)).toBe(true);
    for (const code of codes) expect(code).toMatch(/^GOD-[2-9A-HJ-NP-Z]{6}$/);
    expect(unique(seed.ambassadors.map((a) => a.name))).toBe(true);
    expect(unique(seed.databaseRecords.map((r) => r.name))).toBe(true);
  });

  test('every foreign key resolves', () => {
    const has = (rows: { id: string }[]) => new Set(ids(rows));
    const partners = has(seed.partners);
    const ambassadors = has(seed.ambassadors);
    const listings = has(seed.listings);
    const staff = has(seed.staff);
    for (const program of seed.programs) if (program.partnerId) expect(partners.has(program.partnerId)).toBe(true);
    for (const record of seed.databaseRecords) {
      if (record.ambassadorId) expect(ambassadors.has(record.ambassadorId)).toBe(true);
      if (record.listingId) expect(listings.has(record.listingId)).toBe(true);
    }
    for (const log of seed.amplificationLogs) {
      expect(ambassadors.has(log.ambassadorId)).toBe(true);
      expect(listings.has(log.listingId)).toBe(true);
    }
    for (const post of seed.socialPosts) expect(staff.has(post.authorId)).toBe(true);
    for (const metrics of seed.listingMetrics) expect(listings.has(metrics.listingId)).toBe(true);
    // some records are linked to ambassadors and some to listings
    expect(seed.databaseRecords.filter((r) => r.ambassadorId).length).toBeGreaterThan(10);
    expect(seed.databaseRecords.filter((r) => r.listingId).length).toBeGreaterThan(10);
  });

  test('rules of the domain hold: published listings are vetted, verified records have a date, nobody is dormant before they joined', () => {
    for (const listing of seed.listings) {
      if (listing.status === 'published') {
        expect(listing.vetted).toBe(true);
        expect(listing.publishedAt).toBeDefined();
      } else expect(listing.publishedAt).toBeUndefined();
    }
    for (const record of seed.databaseRecords) {
      expect(!!record.verifiedAt).toBe(record.verified);
      if (record.verifiedAt) expect(record.createdAt <= record.verifiedAt).toBe(true);
    }
    for (const ambassador of seed.ambassadors) {
      if (ambassador.status === 'dormant') expect(ambassador.dormantSince && ambassador.dormantSince >= ambassador.joinedAt).toBeTruthy();
      else expect(ambassador.dormantSince).toBeUndefined();
    }
    for (const log of seed.amplificationLogs) {
      const ambassador = seed.ambassadors.find((a) => a.id === log.ambassadorId)!;
      expect(ambassador.status).not.toBe('applicant');
    }
  });

  test('staff: thirteen people, two hold two roles, exactly one is the signed-in dev user, one metric per published listing', () => {
    expect(seed.staff.filter((s) => s.roles.length === 2)).toHaveLength(2);
    expect(seed.staff.every((s) => s.roles.length >= 1 && s.roles.length <= 2)).toBe(true);
    expect(seed.staff.filter((s) => s.isCurrentUser)).toHaveLength(1);
    for (const role of ROLE_IDS) expect(seed.staff.some((s) => s.roles.includes(role))).toBe(true);
    expect(seed.listingMetrics).toHaveLength(seed.listings.filter((l) => l.status === 'published').length);
    for (const m of seed.listingMetrics) {
      expect(m.views.website).toBeGreaterThan(0);
      expect(m.views.app).toBeGreaterThan(0);
      expect(m.applications.website).toBeLessThan(m.views.website);
      expect(m.applications.app).toBeLessThan(m.views.app);
    }
  });

  test('website audience: six consecutive months, a channel table that adds up to the views', () => {
    expect(seed.websiteMonths.map((row) => row.month)).toEqual(FIXED_MONTHS);
    for (const row of seed.websiteMonths) {
      expect(row.channels.reduce((sum, c) => sum + c.views, 0)).toBe(row.views);
      expect(row.dailyFirstVisits).toBeGreaterThan(0);
      expect(row.dailyVisitors).toBeGreaterThan(row.dailyFirstVisits);
    }
  });

  test('dates are relative to today: nothing is dated in the future except what is planned', () => {
    const today = '2026-06-15';
    for (const listing of seed.listings) if (listing.publishedAt) expect(listing.publishedAt <= today).toBe(true);
    for (const record of seed.databaseRecords) expect((record.verifiedAt ?? record.createdAt) <= today).toBe(true);
    for (const post of seed.socialPosts) if (post.status === 'published') expect(post.postedAt <= today).toBe(true);
    for (const post of seed.socialPosts) if (post.status !== 'published') expect(post.postedAt > today).toBe(true);
    for (const ambassador of seed.ambassadors) expect(ambassador.joinedAt <= today).toBe(true);
    // a different "today" moves every date with it
    const later = buildSeed(new Date(Date.UTC(2027, 0, 20))).collections;
    expect(later.websiteMonths[5].month).toBe('2027-01');
  });
});

test.describe('KPI values come from the data (coherence)', () => {
  const byMonth = <T,>(rows: T[], dateOf: (row: T) => string | undefined, keep: (row: T) => boolean = () => true) => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const date = dateOf(row);
      if (date && keep(row)) counts.set(date.slice(0, 7), (counts.get(date.slice(0, 7)) ?? 0) + 1);
    }
    return counts;
  };
  const sumByMonth = <T,>(rows: T[], dateOf: (row: T) => string, amount: (row: T) => number, keep: (row: T) => boolean) => {
    const sums = new Map<string, number>();
    for (const row of rows) if (keep(row)) sums.set(dateOf(row).slice(0, 7), (sums.get(dateOf(row).slice(0, 7)) ?? 0) + amount(row));
    return sums;
  };

  test('kpiValue equals counts computed directly from the seed, for every KPI and every month', () => {
    const expected: Record<string, Map<string, number>> = {
      opportunities_published: byMonth(seed.listings, (l) => l.publishedAt, (l) => l.status === 'published' && l.vetted),
      programs_organised: byMonth(seed.programs, (p) => p.deliveredAt, (p) => p.status === 'delivered'),
      partners_onboarded: new Map(),
      beneficiaries_verified: byMonth(seed.databaseRecords, (r) => r.verifiedAt, (r) => r.verified),
      social_reach: sumByMonth(seed.socialPosts, (p) => p.postedAt, (p) => p.reach, (p) => p.status === 'published'),
      social_engagement: sumByMonth(seed.socialPosts, (p) => p.postedAt, (p) => p.engagement, (p) => p.status === 'published'),
      posts_published: byMonth(seed.socialPosts, (p) => p.postedAt, (p) => p.status === 'published'),
      website_views: new Map(seed.websiteMonths.map((row) => [row.month, row.views])),
      monthly_reports: byMonth(seed.monthlyReports, (r) => r.generatedAt),
    };
    // partners: a partner counts in a month when it moved to onboard or renew in it
    for (const partner of seed.partners) {
      const months = new Set(partner.stageHistory.filter((e) => e.stage === 'onboard' || e.stage === 'renew').map((e) => e.at.slice(0, 7)));
      for (const month of months) expected.partners_onboarded.set(month, (expected.partners_onboarded.get(month) ?? 0) + 1);
    }
    for (const key of KPI_KEYS) {
      for (const month of FIXED_MONTHS) {
        if (key === 'active_ambassadors') continue; // checked on its own below
        expect(kpiValue(key, month, kpiData), `${key} ${month}`).toBe(expected[key].get(month) ?? 0);
      }
    }
  });

  test('active ambassadors is a running total: joined by month end, minus those gone dormant by then', () => {
    for (const month of FIXED_MONTHS) {
      const end = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
      let active = 0;
      for (const a of seed.ambassadors) {
        const everActive = a.status === 'active' || a.status === 'dormant';
        if (everActive && a.joinedAt <= end && !(a.dormantSince !== undefined && a.dormantSince <= end)) active++;
      }
      expect(kpiValue('active_ambassadors', month, kpiData)).toBe(active);
    }
    // today: the current month ends the running total at the number of ambassadors that are active now
    expect(kpiValue('active_ambassadors', '2026-06', kpiData)).toBe(seed.ambassadors.filter((a) => a.status === 'active').length);
  });

  test('the same totals come out of every path: list, KPI and report', () => {
    const series = (key: (typeof KPI_KEYS)[number]) => monthSeries(key, 6, FIXED_TODAY, kpiData);
    // listings: published in the window = published listings dated in the six months
    expect(series('opportunities_published').reduce((s, p) => s + p.value, 0)).toBe(seed.listings.filter((l) => l.status === 'published').length);
    // programs: delivered in the window = delivered programs
    expect(series('programs_organised').reduce((s, p) => s + p.value, 0)).toBe(seed.programs.filter((p) => p.status === 'delivered').length);
    // social: the posts KPI is the published posts, and reach and engagement add up
    expect(series('posts_published').reduce((s, p) => s + p.value, 0)).toBe(seed.socialPosts.filter((p) => p.status === 'published').length);
    expect(series('social_reach').reduce((s, p) => s + p.value, 0)).toBe(seed.socialPosts.reduce((s, p) => s + p.reach, 0));
    expect(series('social_engagement').reduce((s, p) => s + p.value, 0)).toBe(seed.socialPosts.reduce((s, p) => s + p.engagement, 0));
    // database: verified in the window = verified records
    expect(series('beneficiaries_verified').reduce((s, p) => s + p.value, 0)).toBe(seed.databaseRecords.filter((r) => r.verified).length);
    // website: views over the window = the channel table summed
    expect(series('website_views').reduce((s, p) => s + p.value, 0)).toBe(seed.websiteMonths.flatMap((m) => m.channels).reduce((s, c) => s + c.views, 0));
    // reports: one a month except the missed one
    expect(series('monthly_reports').map((p) => p.value)).toEqual([1, 1, 0, 1, 1, 0]); // none in the weak month, and none generated yet this month
    // the series is six months, oldest first, ending now
    expect(series('posts_published').map((p) => p.month)).toEqual(FIXED_MONTHS);
  });

  test('five of six months look healthy and one is a bit weak', () => {
    const greenCount = (month: string) => KPI_KEYS.filter((key) => kpiMonthStatus(key, month, FIXED_TODAY, kpiData) === 'green').length;
    const counts = FIXED_MONTHS.map(greenCount);
    // healthy = six or more of the ten KPIs green (the current month is 6 green, 2 amber, 2 red); weak = at most two
    const healthy = counts.filter((n) => n >= 6);
    const weak = counts.filter((n) => n <= 2);
    expect(healthy).toHaveLength(5);
    expect(weak).toHaveLength(1);
    expect(counts[2]).toBeLessThanOrEqual(2); // three months ago, counting back from the current month (index 5)
    // the weak month still has real numbers (nothing is empty)
    expect(kpiValue('posts_published', FIXED_MONTHS[2], kpiData)).toBeGreaterThan(0);
    expect(kpiValue('website_views', FIXED_MONTHS[2], kpiData)).toBeGreaterThan(0);
  });
});

test.describe('Status map: desk statuses and the info tone', () => {
  const tone = (status: string) => getStatusMeta(status).tone;
  test('programs', () => {
    expect(tone('planned')).toBe('neutral');
    expect(tone('running')).toBe('info');
    expect(tone('delivered')).toBe('success');
    expect(tone('cancelled')).toBe('danger');
  });
  test('ambassadors', () => {
    expect(tone('applicant')).toBe('neutral');
    expect(tone('onboarding')).toBe('info');
    expect(tone('active')).toBe('success');
    expect(tone('dormant')).toBe('warning');
  });
  test('database records, testimonials, listings and vetting', () => {
    expect(tone('verified')).toBe('success');
    expect(tone('pending')).toBe('warning');
    expect(tone('approved')).toBe('success');
    expect(tone('unpublished')).toBe('neutral');
    expect(tone('rejected')).toBe('danger');
    expect(tone('draft')).toBe('neutral');
    expect(tone('published')).toBe('success');
    expect(tone('unvetted')).toBe('warning');
    expect(tone('vetted')).toBe('success');
  });
  test('the labels are readable', () => {
    expect(getStatusMeta('onboarding').label).toBe('Onboarding');
    expect(getStatusMeta('unvetted').label).toBe('Unvetted');
  });
});

test.describe('Status badges in the design review page', () => {
  test('the info tone is purple-50 with purple-700 text, and has a dot plus text', async ({ page }) => {
    await page.goto(`${BASE_URL}/_design`, { timeout: 30_000 });
    const running = page.getByTestId('status-badge').filter({ hasText: 'Running' }).first();
    await expect(running).toBeVisible();
    await expect(running).toHaveClass(/bg-purple-50/);
    await expect(running).toHaveClass(/text-purple-700/);
    await expect(running.locator('span[aria-hidden="true"]')).toHaveClass(/bg-purple-600/); // the dot
    for (const label of ['Planned', 'Delivered', 'Applicant', 'Onboarding', 'Dormant', 'Unpublished', 'Unvetted', 'Vetted']) {
      await expect(page.getByTestId('status-badge').filter({ hasText: label }).first()).toBeVisible();
    }
  });
});

test.describe('useMonth: the month lives in the URL', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('default is the current month; choosing a past month sets ?month= and survives a reload', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, { timeout: 30_000 });
    const trigger = page.getByRole('combobox', { name: 'Month' });
    const current = (await trigger.innerText()).trim();
    expect(current).toMatch(/^[A-Z][a-z]+ \d{4}$/);
    expect(new URL(page.url()).searchParams.get('month')).toBeNull();

    await trigger.click();
    await page.getByRole('option').nth(2).click();
    await expect(trigger).not.toHaveText(current);
    const chosen = (await trigger.innerText()).trim();
    const param = new URL(page.url()).searchParams.get('month');
    expect(param).toMatch(/^\d{4}-\d{2}$/);
    await expect(page.getByRole('status').filter({ hasText: 'do not change by month' })).toContainText(chosen);

    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Month' })).toHaveText(chosen);

    // choosing the current month again removes the parameter
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option').first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get('month')).toBeNull();
    await expect(page.getByRole('status').filter({ hasText: 'do not change by month' })).toHaveCount(0);
  });

  test('a bad or out-of-range month falls back to the current month, and other parameters are kept', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`, { timeout: 30_000 });
    const current = (await page.getByRole('combobox', { name: 'Month' }).innerText()).trim();
    for (const bad of ['2026-13', 'abc', '1999-01', '2999-01']) {
      await page.goto(`${BASE_URL}/analytics?month=${bad}`);
      await expect(page.getByRole('combobox', { name: 'Month' })).toHaveText(current);
    }
    await page.goto(`${BASE_URL}/analytics?foo=bar`);
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option').nth(1).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('foo')).toBe('bar');
  });

  test('the Overview uses the same month state', async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option').nth(3).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('month')).toMatch(/^\d{4}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// Data foundations, second pass: partner stages, one staff collection, month-to-date, status variety,
// monthly reports and "new in a month"
// ---------------------------------------------------------------------------
test.describe('Partner stages', () => {
  test('the stage keys are exactly prospect, outreach, proposal, mou, onboard, renew, with these labels', () => {
    expect([...PARTNER_STAGES]).toEqual(['prospect', 'outreach', 'proposal', 'mou', 'onboard', 'renew']);
    expect(PARTNER_STAGE_LABELS).toEqual({ prospect: 'Prospect', outreach: 'Outreach', proposal: 'Proposal', mou: 'MOU', onboard: 'Onboard', renew: 'Renew' });
    for (const old of ['contacted', 'negotiating', 'active']) expect((PARTNER_STAGES as readonly string[]).includes(old)).toBe(false);
  });

  test('the 18 partners spread over the stages and follow a path with no gaps; the last entry is the current stage', () => {
    const count = (stage: string) => seed.partners.filter((p) => p.stage === stage).length;
    expect(PARTNER_STAGES.map(count)).toEqual([4, 4, 3, 2, 3, 2]);
    for (const partner of seed.partners) {
      const positions = partner.stageHistory.map((entry) => PARTNER_STAGES.indexOf(entry.stage));
      expect(positions[0]).toBe(0); // every partner started as a prospect
      positions.forEach((position, i) => expect(position).toBe(i)); // prospect, outreach, proposal, mou, onboard, renew: one step at a time
      expect(partner.stage).toBe(partner.stageHistory[partner.stageHistory.length - 1].stage);
      expect(partner.stageHistory.map((e) => e.at)).toEqual([...partner.stageHistory.map((e) => e.at)].sort());
    }
  });

  test('closed is derived from the stage (onboard or renew) and never stored on its own', () => {
    for (const partner of seed.partners) {
      expect('closed' in partner).toBe(false);
      expect(isPartnerClosed(partner)).toBe(partner.stage === 'onboard' || partner.stage === 'renew');
    }
    expect(seed.partners.filter(isPartnerClosed)).toHaveLength(5);
    // a copy moved to another stage changes "closed" with it: nothing else needs updating
    const moved = { ...seed.partners[14], stage: 'renew' as const };
    expect(isPartnerClosed(seed.partners[14])).toBe(false);
    expect(isPartnerClosed(moved)).toBe(true);
    // the day it was closed is the first onboard / renew entry of its history, and open partners have none
    for (const partner of seed.partners) {
      const first = partner.stageHistory.find((e) => e.stage === 'onboard' || e.stage === 'renew');
      expect(partnerClosedAt(partner)).toBe(first?.at);
      expect(partnerClosedAt(partner) === undefined).toBe(!isPartnerClosed(partner));
    }
  });

  test('stage tones: prospect neutral, outreach / proposal / mou in progress, onboard / renew closed (success)', () => {
    expect(getStatusMeta('prospect').tone).toBe('neutral');
    for (const stage of ['outreach', 'proposal', 'mou']) expect(getStatusMeta(stage).tone).toBe('info');
    for (const stage of ['onboard', 'renew']) expect(getStatusMeta(stage).tone).toBe('success');
    expect(getStatusMeta('mou').label).toBe('MOU');
  });
});

test.describe('One staff collection', () => {
  const names = seed.staff.map((person) => person.name);

  test('the three original accounts keep their ids, and the ten desk staff join them', () => {
    expect(seed.staff).toHaveLength(13);
    const byId = (id: string) => seed.staff.find((person) => person.id === id)!;
    expect([byId('staff-1').name, byId('staff-1').roles]).toEqual(['Nana Adjei', ['super_admin']]);
    expect([byId('staff-2').name, byId('staff-2').roles]).toEqual(['Efua Mensimah', ['moderator']]);
    expect([byId('staff-3').name, byId('staff-3').roles]).toEqual(['Yaw Antwi', ['support']]);
    expect(new Set(seed.staff.map((p) => p.id)).size).toBe(13);
    expect(new Set(names).size).toBe(13);
    expect(seed.staff.filter((p) => p.roles.length === 2)).toHaveLength(2);
    expect(seed.staff.every((p) => p.status === 'active')).toBe(true);
  });

  test('scorecard owners come from the same collection', () => {
    for (const key of KPI_KEYS) {
      const owners = staffOwningKpi(key, seed.staff);
      expect(owners.length, key).toBeGreaterThan(0); // the desk lead at least
      for (const person of owners) expect(seed.staff).toContain(person);
    }
    expect(staffOwningKpi('programs_organised', seed.staff).map((p) => p.name)).toEqual(expect.arrayContaining(['Kwabena Tetteh', 'Esi Mensah-Owusu']));
  });

  test('Team page: the member count equals the collection, with a pill for every role', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/team`, { timeout: 30_000 });
    const rows = page.getByTestId('table-row');
    await expect(rows.first()).toBeVisible();
    await expect(rows).toHaveCount(13); // = the collection (the browser store starts from the same seed)
    await expect(page.getByText(/Showing 1.13 of 13/)).toBeVisible();
    // a person with two roles shows both pills
    const adaeze = rows.filter({ hasText: 'Adaeze Okonkwo' });
    await expect(adaeze).toContainText('Opportunities Officer');
    await expect(adaeze).toContainText('Moderator');
    await expect(rows.filter({ hasText: 'Nana Adjei' })).toContainText('Super Admin');
    // the original ids still work
    for (const id of ['staff-1', 'staff-2', 'staff-3']) {
      await page.goto(`${BASE_URL}/staff/${id}`);
      await expect(page.getByTestId('page-title')).toBeVisible();
      await expect(page.getByTestId('no-access')).toHaveCount(0);
    }
  });

  test('every person a scorecard or an assigned-owner choice would list exists on the Team page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/team`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    const onPage = await page.getByTestId('table-row').locator('a').allInnerTexts();
    for (const key of KPI_KEYS) for (const person of staffOwningKpi(key, seed.staff)) expect(onPage.map((t) => t.trim())).toContain(person.name);
  });

  test('inviting adds to the same collection: the new person is on the Team page, with their own member page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/staff/invite`, { timeout: 30_000 });
    await page.getByLabel('Full name').fill('Added Person');
    await page.getByLabel('Email').fill('added.person@example.org');
    await page.getByRole('combobox', { name: 'Role', exact: true }).click();
    await page.getByRole('option', { name: /^Partnerships Officer/ }).click();
    await page.getByRole('button', { name: 'Send invite' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/team`, { timeout: 10_000 });
    await expect(page.getByTestId('table-row')).toHaveCount(14);
    const row = page.getByTestId('table-row').filter({ hasText: 'Added Person' });
    await expect(row).toContainText('Partnerships Officer');
    await row.getByRole('link', { name: 'Added Person' }).click();
    await expect(page.getByTestId('page-title')).toHaveText('Added Person');
    // change the roles on the member page (up to two); the Team list follows
    await page.getByRole('checkbox', { name: /Database Officer/ }).check();
    await expect(page.getByRole('checkbox', { name: /^Moderator/ })).toBeDisabled(); // two held: the rest are locked
  });
});

test.describe('Current month is month-to-date', () => {
  const early = buildSeed(new Date(Date.UTC(2026, 5, 3))).collections;
  const late = buildSeed(new Date(Date.UTC(2026, 5, 28))).collections;
  const cur = '2026-06';
  const viewsOf = (c: typeof seed, month: string) => c.websiteMonths.find((m) => m.month === month)!.views;

  test('website views, social reach and engagement grow through the month, and are a fraction of a full month early on', () => {
    const fullViews = 15200;
    expect(viewsOf(early, cur)).toBeLessThan(fullViews * 0.2); // day 3 of 30
    expect(viewsOf(seed, cur)).toBeGreaterThan(fullViews * 0.4); // day 15
    expect(viewsOf(seed, cur)).toBeLessThan(fullViews * 0.6);
    expect(viewsOf(late, cur)).toBeGreaterThan(fullViews * 0.85); // day 28
    expect(viewsOf(early, cur)).toBeLessThan(viewsOf(seed, cur));
    expect(viewsOf(seed, cur)).toBeLessThan(viewsOf(late, cur));
    for (const key of ['social_reach', 'social_engagement'] as const) {
      const a = kpiValue(key, cur, { ...early });
      const b = kpiValue(key, cur, { ...seed });
      const c = kpiValue(key, cur, { ...late });
      expect(a, key).toBeLessThan(b);
      expect(b, key).toBeLessThan(c);
      // roughly the share of the month gone (day 15 of 30), not a full month
      expect(b, key).toBeLessThan(kpiValue(key, '2026-05', { ...seed }) * 0.7);
    }
  });

  test('it is fair against the pro-rated target: month-to-date over (target x share) is close to 1 or above for views', () => {
    for (const [data, day] of [[early, 3], [seed, 15], [late, 28]] as const) {
      const ratio = viewsOf(data, cur) / (DEFAULT_TARGETS.website_views * (day / 30));
      expect(ratio).toBeGreaterThan(1); // views are healthy at every point of the month
      expect(ratio).toBeLessThan(1.6);
    }
  });

  test('past months stay complete and do not change with the day', () => {
    for (const month of FIXED_MONTHS.slice(0, 5)) {
      expect(viewsOf(early, month)).toBe(viewsOf(late, month));
      expect(kpiValue('social_reach', month, { ...early })).toBe(kpiValue('social_reach', month, { ...late }));
    }
    expect(FIXED_MONTHS.slice(0, 5).map((m) => viewsOf(seed, m))).toEqual([13200, 13800, 10200, 14100, 14900]);
  });

  test('daily visits are month-to-date too, and the channel table and the series agree with the values', () => {
    for (const data of [early, seed, late]) {
      const row = data.websiteMonths.find((m) => m.month === cur)!;
      const days = data === early ? 3 : data === seed ? 15 : 28;
      expect(row.channels.reduce((sum, c) => sum + c.views, 0)).toBe(row.views);
      expect(Math.abs(row.dailyVisitors * days - row.views / 1.35)).toBeLessThan(days); // per-day average over the days that have passed
      expect(monthSeries('website_views', 6, new Date(Date.UTC(2026, 5, days)), { ...data }).at(-1)!.value).toBe(row.views);
      const posts = data.socialPosts.filter((p) => p.status === 'published' && p.postedAt.startsWith(cur));
      expect(posts.reduce((sum, p) => sum + p.reach, 0)).toBe(kpiValue('social_reach', cur, { ...data }));
      expect(posts.reduce((sum, p) => sum + p.engagement, 0)).toBe(kpiValue('social_engagement', cur, { ...data }));
      expect(data.socialPosts).toHaveLength(60);
    }
  });
});

test.describe('KPI status variety', () => {
  const statusesFor = (today: Date) => {
    const data = { ...buildSeed(today).collections };
    const cur = currentMonth(today);
    return Object.fromEntries(KPI_KEYS.map((key) => [key, kpiMonthStatus(key, cur, today, data)])) as Record<(typeof KPI_KEYS)[number], string>;
  };

  test('the current month is six green, two amber and two red, early, middle and late in the month', () => {
    for (const day of [2, 9, 15, 22, 28]) {
      const statuses = statusesFor(new Date(Date.UTC(2026, 5, day)));
      const count = (colour: string) => Object.values(statuses).filter((s) => s === colour).length;
      expect([count('green'), count('amber'), count('red')], `day ${day}`).toEqual([6, 2, 2]);
      expect(Object.entries(statuses).filter(([, s]) => s === 'amber').map(([k]) => k).sort(), `day ${day}`).toEqual(['social_engagement', 'social_reach']);
      expect(Object.entries(statuses).filter(([, s]) => s === 'red').map(([k]) => k).sort(), `day ${day}`).toEqual(['monthly_reports', 'partners_onboarded']);
    }
  });

  test('the past months stay five healthy and one weak, and the status of every KPI is printed', () => {
    const today = FIXED_TODAY;
    const greens = FIXED_MONTHS.map((month) => KPI_KEYS.filter((key) => kpiMonthStatus(key, month, today, kpiData) === 'green').length);
    expect(greens).toEqual([9, 10, 0, 10, 10, 6]);
    const weak = FIXED_MONTHS[2];
    for (const key of KPI_KEYS) expect(kpiMonthStatus(key, weak, today, kpiData), `${key} in the weak month`).not.toBe('green');
    const table = KPI_KEYS.map(
      (key) =>
        `${key.padEnd(24)} ${String(kpiValue(key, currentMonth(today), kpiData)).padStart(6)} ${kpiMonthStatus(key, currentMonth(today), today, kpiData).padEnd(6)} | ${String(kpiValue(key, weak, kpiData)).padStart(6)} ${kpiMonthStatus(key, weak, today, kpiData)}`,
    );
    console.log(`KPI status (day 15): current month | weak month (${weak})\n${table.join('\n')}`);
  });
});

test.describe('Monthly reports', () => {
  test('each report has reportMonth (the month it covers) and generatedAt, and the KPI counts by generatedAt', () => {
    expect(seed.monthlyReports.length).toBe(4);
    for (const report of seed.monthlyReports) {
      expect(report.reportMonth).toMatch(/^\d{4}-\d{2}$/);
      expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(monthsBefore(report.generatedAt.slice(0, 7), 1)).toBe(report.reportMonth); // generated the month after the one it covers
      expect('month' in report || 'publishedAt' in report).toBe(false);
    }
    // the KPI is by the month of generatedAt: May's report (generated in June) counts for June, not May
    const june = kpiValue('monthly_reports', '2026-06', kpiData);
    const may = kpiValue('monthly_reports', '2026-05', kpiData);
    expect(june).toBe(0); // nothing generated yet this month (Download PDF will add it)
    expect(may).toBe(1);
    const extra = [...seed.monthlyReports, { id: 'r-new', reportMonth: '2026-05', generatedAt: '2026-06-10' }];
    expect(kpiValue('monthly_reports', '2026-06', { ...kpiData, monthlyReports: extra })).toBe(1);
    expect(kpiValue('monthly_reports', '2026-05', { ...kpiData, monthlyReports: extra })).toBe(1); // unchanged
  });

  test('Download PDF records a report at most once per reportMonth in each calendar month of generation', () => {
    const now = new Date(Date.UTC(2026, 5, 15));
    expect(shouldRecordReport(seed.monthlyReports, '2026-05', now)).toBe(true); // first time this month
    const afterFirst = [...seed.monthlyReports, { id: 'r1', reportMonth: '2026-05', generatedAt: '2026-06-15' }];
    expect(shouldRecordReport(afterFirst, '2026-05', now)).toBe(false); // the same report again, same month: nothing added
    expect(shouldRecordReport(afterFirst, '2026-04', now)).toBe(true); // another reportMonth is a new record
    expect(shouldRecordReport(afterFirst, '2026-05', new Date(Date.UTC(2026, 6, 2)))).toBe(true); // generated again next month: counts again
  });
});

test.describe('Report metric dates and newInMonth', () => {
  test('the seed carries the dates the partner report needs', () => {
    for (const ambassador of seed.ambassadors) expect(ambassador.joinedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const partner of seed.partners.filter(isPartnerClosed)) expect(partnerClosedAt(partner)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const program of seed.programs.filter((p) => p.status === 'delivered')) expect(program.deliveredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const program of seed.programs.filter((p) => p.status !== 'delivered')) expect(program.deliveredAt).toBeUndefined();
    for (const listing of seed.listings.filter((l) => l.status === 'published')) expect(listing.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const record of seed.databaseRecords.filter((r) => r.verified)) expect(record.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('newInMonth equals direct counts from the seed, for every entity and month', () => {
    const direct = (dates: (string | undefined)[], month: string) => dates.filter((d) => d?.startsWith(month)).length;
    for (const month of FIXED_MONTHS) {
      expect(newInMonth('ambassadors', month, seed), month).toBe(direct(seed.ambassadors.filter((a) => a.status !== 'applicant').map((a) => a.joinedAt), month));
      expect(newInMonth('partners', month, seed), month).toBe(direct(seed.partners.map((p) => p.stageHistory.find((e) => e.stage === 'onboard' || e.stage === 'renew')?.at), month));
      expect(newInMonth('programs', month, seed), month).toBe(direct(seed.programs.filter((p) => p.status === 'delivered').map((p) => p.deliveredAt), month));
      expect(newInMonth('listings', month, seed), month).toBe(direct(seed.listings.filter((l) => l.status === 'published').map((l) => l.publishedAt), month));
      expect(newInMonth('records', month, seed), month).toBe(direct(seed.databaseRecords.filter((r) => r.verified).map((r) => r.verifiedAt), month));
    }
  });

  test('totals agree: new programs, listings and records match their KPIs; new partners are the closed ones', () => {
    for (const month of FIXED_MONTHS) {
      expect(newInMonth('programs', month, seed)).toBe(kpiValue('programs_organised', month, kpiData));
      expect(newInMonth('listings', month, seed)).toBe(kpiValue('opportunities_published', month, kpiData));
      expect(newInMonth('records', month, seed)).toBe(kpiValue('beneficiaries_verified', month, kpiData));
    }
    const closedInWindow = FIXED_MONTHS.reduce((sum, month) => sum + newInMonth('partners', month, seed), 0);
    expect(closedInWindow).toBe(seed.partners.filter(isPartnerClosed).length); // every closed partner closed inside the six months
    expect(FIXED_MONTHS.reduce((sum, month) => sum + newInMonth('programs', month, seed), 0)).toBe(seed.programs.filter((p) => p.status === 'delivered').length);
  });
});

// ---------------------------------------------------------------------------
// Roles fix pass: new permission keys, toggles, nav, invite, tagline, account menu, scorecard copy
// ---------------------------------------------------------------------------
// Hand-written. The value is the level each of the 12 roles has on the screen (null = no access).
const NONE_EXCEPT = (grants: Record<string, 'edit' | 'view'>): Record<string, 'edit' | 'view' | null> => {
  const all: Record<string, 'edit' | 'view' | null> = {};
  for (const role of ROLE_IDS) all[role] = grants[role] ?? null;
  return all;
};
const NEW_KEY_ACCESS: Record<string, Record<string, 'edit' | 'view' | null>> = {
  roles_permissions: NONE_EXCEPT({ super_admin: 'edit', desk_lead: 'view' }),
  settings_admin: NONE_EXCEPT({ super_admin: 'edit', desk_lead: 'edit' }),
  listings_curate: NONE_EXCEPT({ super_admin: 'edit', desk_lead: 'edit', opportunities_officer: 'edit' }),
};

test.describe('Roles fix pass: new permission keys (no browser)', () => {
  for (const [screen, byRole] of Object.entries(NEW_KEY_ACCESS)) {
    test(`${screen}: the access of each of the 12 roles`, () => {
      expect(Object.keys(byRole)).toHaveLength(12);
      for (const [role, level] of Object.entries(byRole)) {
        const r = [role] as never;
        expect(roleCan(r, screen as never, 'view'), `${role} view ${screen}`).toBe(level !== null);
        expect(roleCan(r, screen as never, 'edit'), `${role} edit ${screen}`).toBe(level === 'edit');
      }
    });
  }

  test('Partnerships Officer can view the Monthly report but not edit it', () => {
    expect(roleCan(['partnerships_officer'], 'monthly_report', 'view')).toBe(true);
    expect(roleCan(['partnerships_officer'], 'monthly_report', 'edit')).toBe(false);
    expect(roleCan(['desk_lead'], 'team', 'edit')).toBe(true);
  });

  test('toggle-to-screen mapping for Moderator and Support (hand-written)', () => {
    const allOff = { verifications: false, moderate: false, suspend: false, content: false, broadcast: false, staff: false };
    const grants = (on: Partial<typeof allOff>) => editableRoleGrants('moderator', { ...allOff, ...on });
    expect(grants({})).toEqual({ overview: 'view', my_scorecard: 'edit', settings: 'edit', seekers: 'view', hirers: 'view' });
    expect(grants({ verifications: true }).verification).toBe('edit');
    const moderate = grants({ moderate: true });
    expect([moderate.opportunities_queue, moderate.channels, moderate.reports_queue]).toEqual(['edit', 'edit', 'edit']);
    const suspend = grants({ suspend: true });
    expect([suspend.seekers, suspend.hirers]).toEqual(['edit', 'edit']);
    const content = grants({ content: true });
    expect([content.reference_data, content.career_resources]).toEqual(['edit', 'edit']);
    expect(grants({ broadcast: true }).notifications).toBe('edit');
    expect(grants({ staff: true }).team).toBe('edit');
    // "Manage staff accounts" never reaches the roles matrix, and no toggle grants settings_admin or listings_curate
    const everyToggle = grants({ verifications: true, moderate: true, suspend: true, content: true, broadcast: true, staff: true });
    expect(everyToggle.roles_permissions).toBeUndefined();
    expect(everyToggle.settings_admin).toBeUndefined();
    expect(everyToggle.listings_curate).toBeUndefined();
    expect(editableRoleGrants('support', { ...allOff, staff: true }).settings_admin).toBeUndefined();
  });
});

test.describe('Roles fix pass: Team > Roles & permissions access and the toggles', () => {
  test.skip(process.env.E2E_PROD === '1', 'the dev role switcher only exists in development with mock data');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Desk Lead sees the tab read-only: disabled switches, no action bar; the matrix lists the other ten roles', async ({ page, context }) => {
    await asRoles(context, 'desk_lead');
    await page.goto(`${BASE_URL}/team?tab=roles`, { timeout: 30_000 });
    await expect(page.getByRole('tab', { name: 'Roles & permissions' })).toHaveAttribute('aria-selected', 'true');
    const moderator = page.getByRole('region', { name: 'Moderator permissions' });
    await expect(moderator.getByRole('switch')).toHaveCount(6);
    for (const toggle of await moderator.getByRole('switch').all()) await expect(toggle).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    const table = page.getByRole('table', { name: /other roles can do/ });
    await expect(table.getByRole('columnheader')).toHaveCount(11); // Screen + ten roles
    const headers = (await table.getByRole('columnheader').allInnerTexts()).map((text) => text.trim());
    const column = headers.indexOf('Partnerships Officer');
    expect(column).toBeGreaterThan(0);
    const cell = async (screen: string) =>
      (await table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: screen, exact: true }) }).getByRole('cell').nth(column - 1).innerText()).trim();
    expect(await cell('Partners')).toBe('Edit');
    expect(await cell('Monthly report')).toBe('View');
    expect(await cell('Seekers')).toBe('—');
  });

  test('Admin Support has Members but no Roles & permissions tab; ?tab=roles falls back to Members', async ({ page, context }) => {
    await asRoles(context, 'admin_support');
    await page.goto(`${BASE_URL}/team?tab=roles`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Team');
    await expect(page.getByRole('tab', { name: 'Roles & permissions' })).toHaveCount(0);
    await expect(page.locator('main tbody tr').first()).toBeVisible();
    await page.getByRole('button', { name: /Account menu/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Team', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Roles & Permissions' })).toHaveCount(0);
  });

  test('turning "Moderate opportunities & community" off for Moderator removes Reports Queue and Channels (and Opportunities Queue) from the nav', async ({ page, context }) => {
    await asRoles(context, 'super_admin');
    await page.goto(`${BASE_URL}/team?tab=roles`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
    const nav = page.locator('aside nav');
    await page.getByRole('region', { name: 'Moderator permissions' }).getByRole('switch', { name: 'Moderate opportunities & community' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Role permissions were saved.')).toBeVisible();
    // switch to Moderator with the account menu (client side, so the saved matrix survives)
    await page.getByRole('button', { name: /Account menu/ }).click();
    const menu = page.getByRole('menu', { name: 'Account' });
    await menu.getByRole('menuitemcheckbox', { name: 'Super Admin', exact: true }).click(); // off
    await menu.getByRole('menuitemcheckbox', { name: 'Moderator', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('viewing-as')).toContainText('Viewing as Moderator');
    await expect(nav.getByTestId('nav-item-reports-queue')).toHaveCount(0);
    await expect(nav.getByTestId('nav-item-channels')).toHaveCount(0);
    await expect(nav.getByTestId('nav-item-opportunities-queue')).toHaveCount(0);
    // the toggles that stayed on still work: Verification Queue (verifications) is there
    await expect(nav.getByTestId('nav-item-verification-queue')).toHaveCount(1);
  });

  test('turning "Manage reference data & content" and "Manage staff accounts" on adds Reference data and Team, never the Roles tab', async ({ page, context }) => {
    await asRoles(context, 'super_admin');
    await page.goto(`${BASE_URL}/team?tab=roles`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
    const moderator = page.getByRole('region', { name: 'Moderator permissions' });
    await expect(moderator.getByRole('switch', { name: 'Manage staff accounts' })).toHaveAttribute('aria-checked', 'false');
    await moderator.getByRole('switch', { name: 'Manage staff accounts' }).click();
    await moderator.getByRole('switch', { name: 'Manage reference data & content' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('button', { name: /Account menu/ }).click();
    const menu = page.getByRole('menu', { name: 'Account' });
    await menu.getByRole('menuitemcheckbox', { name: 'Super Admin', exact: true }).click();
    await menu.getByRole('menuitemcheckbox', { name: 'Moderator', exact: true }).click();
    await page.keyboard.press('Escape');
    const nav = page.locator('aside nav');
    await expect(page.getByTestId('viewing-as')).toContainText('Viewing as Moderator');
    await nav.getByTestId('nav-group-content').click(); // content -> Career Resources and Reference data
    await expect(nav.getByTestId('nav-item-reference-data')).toHaveCount(1);
    await page.getByTestId('nav-item-team').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Team');
    await expect(page.getByRole('tab', { name: 'Roles & permissions' })).toHaveCount(0);
  });
});

test.describe('Roles fix pass: sidebar open state, direct rows, tagline, account menu', () => {
  test.skip(process.env.E2E_PROD === '1', 'the dev role switcher only exists in development with mock data');
  test.use({ viewport: { width: 1440, height: 900 } });

  const openGroups = (page: import('@playwright/test').Page) =>
    page.evaluate(() => [...document.querySelectorAll('aside nav [data-testid^="nav-group-"][aria-expanded="true"]')].map((el) => el.getAttribute('data-testid')));

  const CASES: [string, string, string[]][] = [
    ['moderator', '/scorecard', ['nav-group-dashboard']],
    ['partnerships_officer', '/partners', ['nav-group-partners-network']],
    ['database_officer', '/scorecard', ['nav-group-dashboard']],
    ['country_lead', '/partners', ['nav-group-partners-network']],
  ];
  for (const [role, route, expected] of CASES) {
    test(`${role} on ${route}: exactly one group is open`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}${route}`, { timeout: 30_000 });
      await expect(page.getByTestId('page-title')).toBeVisible();
      expect(await openGroups(page)).toEqual(expected);
      await expect(page.getByTestId('no-access')).toHaveCount(0);
    });
  }

  test('switching role forgets the groups opened by hand under the previous role', async ({ page, context }) => {
    await asRoles(context, 'super_admin');
    await page.goto(`${BASE_URL}/scorecard`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
    await page.getByTestId('nav-group-opportunities').click(); // now Dashboard (active) and Opportunities are open
    expect(await openGroups(page)).toEqual(['nav-group-dashboard', 'nav-group-opportunities']);
    await page.getByRole('button', { name: /Account menu/ }).click();
    const menu = page.getByRole('menu', { name: 'Account' });
    await menu.getByRole('menuitemcheckbox', { name: 'Super Admin', exact: true }).click();
    await menu.getByRole('menuitemcheckbox', { name: 'Moderator', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('viewing-as')).toContainText('Viewing as Moderator');
    expect(await openGroups(page)).toEqual(['nav-group-dashboard']);
  });

  test('a group with one visible page is a direct row at the end: Partnerships Officer (Settings) and Database Officer (Network, Database, Settings)', async ({ page, context }) => {
    await asRoles(context, 'partnerships_officer');
    await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
    const nav = page.locator('aside nav');
    await expect(nav.getByTestId('nav-group-comms-admin')).toHaveCount(0);
    await expect(nav.getByTestId('nav-item-settings')).toBeVisible(); // visible without opening anything
    expect(await nav.locator('a[data-testid^="nav-item-"]').last().getAttribute('data-testid')).toBe('nav-item-settings');

    await asRoles(context, 'database_officer');
    await page.goto(`${BASE_URL}/database`);
    await expect(page.getByTestId('page-title')).toBeVisible();
    expect(await nav.locator('[data-testid^="nav-group-"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')))).toEqual(['nav-group-dashboard']);
    await expect(nav.getByTestId('nav-item-database')).toHaveAttribute('aria-current', 'page');
    expect(await nav.locator('a[data-testid^="nav-item-"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')))).toEqual(['nav-item-network', 'nav-item-database', 'nav-item-settings']);
    expect(await openGroups(page)).toEqual([]); // the active page is a direct row, so no group opens
  });

  test('the tagline is one line in the expanded desktop sidebar and the collapse button is visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
    const tagline = page.getByTestId('brand-tagline');
    await expect(tagline).toHaveText('Global Opportunity Desk');
    const m = await tagline.evaluate((el) => ({ h: el.getBoundingClientRect().height, sw: el.scrollWidth, cw: el.clientWidth, ws: getComputedStyle(el).whiteSpace, fs: getComputedStyle(el).fontSize }));
    expect(m.fs).toBe('11px');
    expect(m.ws).toBe('nowrap');
    expect(m.h).toBeLessThanOrEqual(17);
    expect(m.sw).toBeLessThanOrEqual(m.cw);
    const toggle = page.getByTestId('sidebar-toggle');
    await expect(toggle).toBeVisible();
    const t = (await toggle.boundingBox())!;
    const a = (await page.locator('aside').boundingBox())!;
    expect(t.x + t.width).toBeLessThanOrEqual(a.x + a.width);
    const textBox = (await tagline.boundingBox())!;
    expect(textBox.x + m.sw).toBeLessThanOrEqual(t.x + 1); // the text does not run under the button
  });

  test('in the phone drawer the tagline may wrap and is never cut off', async ({ page }) => {
    await page.setViewportSize({ width: 434, height: 900 });
    await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const tagline = page.getByTestId('brand-tagline');
    await expect(tagline).toBeVisible();
    const m = await tagline.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, ws: getComputedStyle(el).whiteSpace, ow: getComputedStyle(el).overflowWrap }));
    expect(m.ws).toBe('normal');
    expect(m.ow).toBe('break-word');
    expect(m.sw).toBeLessThanOrEqual(m.cw);
  });

  test('below 640px the "Viewing as" pill is hidden and the account menu names the roles as text', async ({ page, context }) => {
    await asRoles(context, 'support,moderator');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
    await expect(page.getByTestId('viewing-as')).toBeHidden();
    await page.getByRole('button', { name: /Account menu/ }).click();
    await expect(page.getByTestId('account-roles')).toContainText('Your roles');
    await expect(page.getByTestId('account-roles')).toContainText('Support + Moderator');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId('viewing-as')).toBeVisible();
  });

  test('the account menu names a single role too', async ({ page, context }) => {
    await asRoles(context, 'training_officer');
    await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
    await page.getByRole('button', { name: /Account menu/ }).click();
    await expect(page.getByTestId('account-roles')).toContainText('Your role');
    await expect(page.getByTestId('account-roles')).toContainText('Training and Capacity Development Officer');
  });
});

test.describe('Roles fix pass: Scorecard copy and the empty state', () => {
  test.skip(process.env.E2E_PROD === '1', 'the dev role switcher only exists in development with mock data');
  test.use({ viewport: { width: 1440, height: 900 } });

  const SUBTITLE_YOU = 'Targets and results for you.';
  const SUBTITLE_TEAM = 'Targets and results for you and the team.';

  for (const role of ['desk_lead', 'super_admin']) {
    test(`${role}: subtitle mentions the team and the Team tab exists`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/scorecard`, { timeout: 30_000 });
      await expect(page.getByText(SUBTITLE_TEAM, { exact: true })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Team' })).toBeVisible();
    });
  }
  for (const role of ['moderator', 'partnerships_officer', 'admin_support']) {
    test(`${role}: subtitle is only about you`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/scorecard`, { timeout: 30_000 });
      await expect(page.getByText(SUBTITLE_YOU, { exact: true })).toBeVisible();
      await expect(page.getByRole('tab')).toHaveCount(0);
    });
  }

  for (const role of ['moderator', 'support', 'admin_support', 'super_admin']) {
    test(`${role}: no owned metrics -> an empty state, never a 0 score`, async ({ page, context }) => {
      expect(kpisOwnedBy([role as never])).toHaveLength(0);
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/scorecard`, { timeout: 30_000 });
      const card = page.getByRole('region', { name: 'My scorecard' });
      await expect(card).toContainText('No metrics are assigned to your role');
      await expect(card).toContainText('A Desk Lead can assign them.');
      await expect(card).not.toContainText(/\b0\b/);
    });
  }

  test('a role that owns metrics does not get the empty state', async ({ page, context }) => {
    await asRoles(context, 'partnerships_officer');
    await page.goto(`${BASE_URL}/scorecard`, { timeout: 30_000 });
    await expect(page.getByText('No metrics are assigned to your role')).toHaveCount(0);
  });
});

test.describe('Roles fix pass: invite with two roles', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Role and Second role selects, chips, and the new person holds both roles', async ({ page }) => {
    await page.goto(`${BASE_URL}/staff/invite`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
    const chips = page.getByTestId('invite-role-chips');
    await expect(chips.getByRole('listitem')).toHaveText(['Support']);

    await page.getByRole('combobox', { name: 'Role', exact: true }).click();
    await expect(page.getByRole('option')).toHaveCount(12);
    await page.getByRole('option', { name: /^Moderator/ }).click();

    await page.getByRole('combobox', { name: /Second role/ }).click();
    await expect(page.getByRole('option')).toHaveCount(12); // "No second role" + the 11 others
    await expect(page.getByRole('option', { name: /^Moderator/ })).toHaveCount(0); // not the same role twice
    await page.getByRole('option', { name: /^Communications Officer/ }).click();
    await expect(chips.getByRole('listitem')).toHaveText(['Moderator', 'Communications Officer']);

    await page.getByLabel('Full name').fill('Two Roles Person');
    await page.getByLabel('Email').fill('two.roles@kredibble.com');
    await page.getByRole('button', { name: 'Send invite' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/team`, { timeout: 10_000 });
    await expect(page.getByText('Two Roles Person was invited as Moderator and Communications Officer.')).toBeVisible();
    const row = page.locator('main tbody tr').filter({ hasText: 'Two Roles Person' });
    await expect(row).toContainText('Moderator');
    await expect(row).toContainText('Communications Officer');
  });

  test('the second role can be removed with its x', async ({ page }) => {
    await page.goto(`${BASE_URL}/staff/invite`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
    await page.getByRole('combobox', { name: /Second role/ }).click();
    await page.getByRole('option', { name: /^Moderator/ }).click();
    const chips = page.getByTestId('invite-role-chips');
    await expect(chips.getByRole('listitem')).toHaveText(['Support', 'Moderator']);
    await page.getByRole('button', { name: 'Remove Moderator' }).click();
    await expect(chips.getByRole('listitem')).toHaveText(['Support']);
  });
});

test.describe('Roles fix pass: every role in the dev switcher opens and works', () => {
  test.skip(process.env.E2E_PROD === '1', 'the dev role switcher only exists in development with mock data');
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const role of ROLE_IDS) {
    test(`${role}: its first and last nav items open, with no console errors`, async ({ page, context }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) errors.push(message.text());
      });
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
      await expect(page.getByTestId('page-title')).toBeVisible();
      const nav = page.locator('aside nav');
      const closed = nav.locator('[data-testid^="nav-group-"][aria-expanded="false"]');
      for (let i = 0; i < 10 && (await closed.count()) > 0; i++) await closed.first().click();
      const hrefs = await nav.locator('a[data-testid^="nav-item-"]').evaluateAll((els) => els.map((el) => el.getAttribute('href')!));
      expect(hrefs.length).toBeGreaterThan(2);
      for (const href of [hrefs[0], hrefs[hrefs.length - 1]]) {
        await page.goto(`${BASE_URL}${href}`, { timeout: 30_000 });
        await expect(page.getByTestId('page-title')).toBeVisible();
        await expect(page.getByTestId('no-access')).toHaveCount(0);
      }
      expect(errors).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Opportunities Queue: hirer-submitted and staff-curated listings in one place
// ---------------------------------------------------------------------------
// Hand-written from the seed and the hirer mock data: 6 hirer postings (3 jobs, 1 internship, 1 event, 1 grant; 2
// approved, 3 pending, 1 rejected) and 14 curated listings (4 jobs, 2 each of internship, scholarship, fellowship,
// grant, event; 11 published, 3 draft).
const todayLocal = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

test.describe('Opportunities Queue: one list for both sources', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const tabCount = async (page: import('@playwright/test').Page, name: string) =>
    (await page.getByRole('radiogroup', { name: 'Filter by type' }).getByRole('radio', { name: new RegExp(`^${name}`) }).innerText()).replace(/\D+/g, '');

  test('columns, type tabs with counts, and the Other tab', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    const headers = (await page.locator('main table thead th').allTextContents()).map((text) => text.trim()).filter((text) => text && text !== 'Open');
    expect(headers).toEqual(['Title', 'Company', 'Type', 'Source', 'Vetting', 'Posted', 'Status']);
    expect(await tabCount(page, 'All')).toBe('20');
    expect(await tabCount(page, 'Jobs')).toBe('7');
    expect(await tabCount(page, 'Internships')).toBe('3');
    expect(await tabCount(page, 'Events')).toBe('3');
    expect(await tabCount(page, 'Grants')).toBe('3');
    expect(await tabCount(page, 'Other')).toBe('4'); // 2 scholarships + 2 fellowships, all curated
    await page.getByRole('radiogroup', { name: 'Filter by type' }).getByRole('radio', { name: /^Other/ }).click();
    const rows = page.getByTestId('table-row');
    await expect(rows).toHaveCount(4);
    for (const row of await rows.all()) await expect(row).toContainText('Staff-curated');
  });

  test('Source filter: Hirer-submitted shows 6, Staff-curated shows 14; badges differ', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    const source = page.getByRole('radiogroup', { name: 'Filter by source' });
    await source.getByRole('radio', { name: 'Hirer-submitted' }).click();
    await expect(page.getByTestId('table-row')).toHaveCount(6);
    expect(await tabCount(page, 'All')).toBe('6');
    expect(await tabCount(page, 'Jobs')).toBe('3');
    for (const row of await page.getByTestId('table-row').all()) {
      await expect(row).toContainText('Hirer');
      await expect(row).not.toContainText('Vetted'); // vetting is for curated rows only
      await expect(row).not.toContainText('Unvetted');
    }
    await source.getByRole('radio', { name: 'Staff-curated' }).click();
    expect(await tabCount(page, 'All')).toBe('14');
    expect(await tabCount(page, 'Jobs')).toBe('4');
    await expect(page.getByTestId('table-row')).toHaveCount(10); // first of two pages
    const first = page.getByTestId('table-row').first();
    await expect(first.getByText(/^(Vetted|Unvetted)$/)).toBeVisible();
  });

  test('Country filter: Ghana has 6 rows; the options are the countries that have a row', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await page.getByRole('combobox', { name: 'Filter by country' }).click();
    const options = (await page.getByRole('option').allInnerTexts()).map((text) => text.trim());
    expect(options).toEqual(["All countries", "Côte d'Ivoire", 'Ghana', 'Kenya', 'Nigeria', 'Rwanda', 'Senegal', 'Sierra Leone', 'Uganda']);
    await page.getByRole('option', { name: 'Ghana' }).click();
    await expect(page.getByTestId('table-row')).toHaveCount(6); // 3 curated + 3 hirer
    expect(await tabCount(page, 'All')).toBe('6');
    await page.getByRole('combobox', { name: 'Filter by country' }).click();
    await page.getByRole('option', { name: 'Senegal' }).click();
    await expect(page.getByTestId('table-row')).toHaveCount(2);
  });

  test('Status filter: Draft shows the 3 drafts; Pending shows the 3 pending postings', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await page.getByRole('combobox', { name: 'Filter by status' }).click();
    await page.getByRole('option', { name: 'Draft' }).click();
    await expect(page.getByTestId('table-row')).toHaveCount(3);
    await page.getByRole('combobox', { name: 'Filter by status' }).click();
    await page.getByRole('option', { name: 'Pending' }).click();
    await expect(page.getByTestId('table-row')).toHaveCount(3);
    await page.getByRole('combobox', { name: 'Filter by status' }).click();
    await page.getByRole('option', { name: 'Rejected' }).click();
    await expect(page.getByTestId('table-row')).toHaveCount(1);
    // an impossible combination shows the no-results state
    await page.getByRole('radiogroup', { name: 'Filter by source' }).getByRole('radio', { name: 'Staff-curated' }).click();
    await expect(page.getByText('No opportunities match these filters')).toBeVisible();
  });

  test('?state=empty and ?state=error show their states', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities?state=empty`, { timeout: 30_000 });
    await expect(page.getByText('No opportunities yet')).toBeVisible();
    await page.goto(`${BASE_URL}/opportunities?state=error`);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

test.describe('Opportunities: the listing form', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const publishButton = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Publish', exact: true });

  const fillBasics = async (page: import('@playwright/test').Page, title: string, deadline = '2099-12-31') => {
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Description', { exact: true }).fill('A listing made in a test.');
    await page.getByLabel('Offering organisation').fill('Test Organisation');
    await page.getByRole('combobox', { name: 'Opportunity type' }).click();
    await page.getByRole('option', { name: 'Fellowship' }).click();
    await page.getByRole('combobox', { name: 'Country' }).click();
    await page.getByRole('option', { name: 'Ghana' }).click();
    await page.getByLabel('Application deadline').fill(deadline);
    await page.getByLabel('Official application link').fill('https://example.org/apply');
  };

  test('has the four sections, the vetting card and the right actions', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities/new`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('New listing');
    for (const title of ['Basic details', 'Logistics', 'Media and attribution']) await expect(page.getByRole('heading', { name: title })).toBeVisible();
    const vetting = page.getByTestId('vetting-checkpoint');
    await expect(vetting).toBeVisible();
    await expect(vetting).toContainText('Listings must be vetted before they can be published.');
    await expect(vetting.getByRole('checkbox', { name: 'Vetted' })).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    await expect(publishButton(page)).toBeDisabled();
    await expect(page.getByRole('switch', { name: 'Referral code on apply' })).toBeVisible();
    // required fields carry no "Optional" tag; the optional ones do
    await expect(page.getByText('Optional', { exact: true })).toHaveCount(7); // logo, cost, location, event date, duration, image, writer
    // the vetting card is visually distinct: a 2px warning-tinted border
    expect(await vetting.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('2px');
  });

  test('Publish is disabled until Vetted is checked, with the reason beside it and in a tooltip; then it is enabled', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities/new`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
    await fillBasics(page, 'Vetting Gate Test');
    await expect(publishButton(page)).toBeDisabled();
    await expect(page.getByTestId('save-disabled-reason')).toHaveText('Check "Vetted" to publish.');
    await publishButton(page).hover({ force: true });
    await expect(page.getByRole('tooltip')).toContainText('Check "Vetted" to publish.');
    await page.mouse.move(5, 5); // the tooltip floats above the bar and could sit over the checkbox
    await expect(page.getByRole('tooltip')).toHaveCount(0);

    await page.getByTestId('vetting-checkpoint').getByRole('checkbox', { name: 'Vetted' }).check();
    await expect(publishButton(page)).toBeEnabled();
    await expect(page.getByTestId('save-disabled-reason')).toHaveCount(0);
    // Vetted by defaults to the signed-in person; Vetted on is today, and editable
    await expect(page.getByRole('combobox', { name: 'Vetted by' })).toContainText('Esi Mensah-Owusu');
    await expect(page.getByLabel('Vetted on')).toHaveValue(todayLocal());
    await page.getByLabel('Vetted on').fill('2026-01-05');
    await expect(page.getByLabel('Vetted on')).toHaveValue('2026-01-05');
    // unchecking clears them again and disables Publish
    await page.getByTestId('vetting-checkpoint').getByRole('checkbox', { name: 'Vetted' }).uncheck();
    await expect(publishButton(page)).toBeDisabled();
    await expect(page.getByLabel('Vetted on')).toHaveValue('');
  });

  test('Save draft works unvetted: the listing appears in the list as Draft + Unvetted and the count goes up by one', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities/new`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
    await fillBasics(page, 'Draft Saved Unvetted');
    await page.getByRole('button', { name: 'Save draft' }).click();
    // the toast shows at once; on a cold dev server the detail page then takes a while to compile, so look for it first
    await expect(page.getByText('Draft Saved Unvetted was saved as a draft.')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/opportunities\/lst-new-/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Draft Saved Unvetted');
    await expect(page.getByTestId('vetting-badge')).toContainText('Unvetted');
    await expect(page.getByTestId('source-pill')).toContainText('Staff-curated');
    await expect(page.getByRole('region', { name: 'Reach' })).toHaveCount(0); // not published

    // back to the list (client side, so the store survives)
    await page.locator('header.sticky').getByRole('link', { name: 'Opportunities Queue' }).click();
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    expect(await tabCount(page, 'All')).toBe('21');
    expect(await tabCount(page, 'Other')).toBe('5'); // the new one is a fellowship
    const row = page.getByTestId('table-row').filter({ hasText: 'Draft Saved Unvetted' });
    await expect(row).toContainText('Staff-curated');
    await expect(row).toContainText('Unvetted');
    await expect(row).toContainText('Draft');
  });

  const tabCount = async (page: import('@playwright/test').Page, name: string) =>
    (await page.getByRole('radiogroup', { name: 'Filter by type' }).getByRole('radio', { name: new RegExp(`^${name}`) }).innerText()).replace(/\D+/g, '');

  test('Publish sets status published and the published date, and the list shows Published + Vetted', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities/new`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
    await fillBasics(page, 'Published In Test');
    await page.getByTestId('vetting-checkpoint').getByRole('checkbox', { name: 'Vetted' }).check();
    await publishButton(page).click();
    await expect(page.getByText('Published In Test was published.')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/opportunities\/lst-new-/, { timeout: 30_000 });
    await expect(page.getByRole('main').getByText('Published', { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId('vetting-badge')).toContainText('Vetted');
    const details = page.getByRole('region', { name: 'Details' });
    await expect(details).toContainText(new Date().getFullYear().toString()); // the published date is today
    await expect(page.getByRole('region', { name: 'Reach' })).toBeVisible();
    await page.locator('header.sticky').getByRole('link', { name: 'Opportunities Queue' }).click();
    const row = page.getByTestId('table-row').filter({ hasText: 'Published In Test' });
    await expect(row).toContainText('Vetted');
    await expect(row).toContainText('Published');
  });

  test('validation: required fields, a bad link, and a past deadline only when publishing; the first invalid field takes focus', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities/new`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Save draft' }).click();
    for (const message of ['Enter a title.', 'Enter a description.', 'Enter the offering organisation.', 'Choose the opportunity type.', 'Choose a country.', 'Choose the application deadline.', 'Enter the official application link.']) {
      await expect(page.getByText(message)).toBeVisible();
    }
    await expect(page.getByLabel('Title', { exact: true })).toBeFocused();

    await fillBasics(page, 'Validation Test', '2020-01-01');
    await page.getByLabel('Official application link').fill('not a link');
    await page.getByLabel('Official application link').blur();
    await expect(page.getByText('Enter a full web address, starting with https://')).toBeVisible();
    await page.getByLabel('Official application link').fill('https://example.org/ok');
    // a past deadline is fine for a draft ... but not for publishing
    await page.getByTestId('vetting-checkpoint').getByRole('checkbox', { name: 'Vetted' }).check();
    await publishButton(page).click();
    await expect(page.getByText('The deadline has passed. Choose today or a later date to publish.')).toBeVisible();
    await expect(page.getByLabel('Application deadline')).toBeFocused();
    await expect(page).toHaveURL(`${BASE_URL}/opportunities/new`);
  });

  test('leaving with unsaved changes asks first', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities/new`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
    await page.getByLabel('Title', { exact: true }).fill('Unsaved');
    await page.locator('header.sticky').getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeVisible();
  });

  test('edit: a vetted draft can be published straight away; an unvetted one cannot; hirer postings and unknown ids are not found', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities/lst-12/edit`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit listing');
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Startup Seed Grant');
    await expect(page.getByTestId('vetting-checkpoint').getByRole('checkbox', { name: 'Vetted' })).toBeChecked();
    await expect(publishButton(page)).toBeEnabled();

    await page.goto(`${BASE_URL}/opportunities/lst-13/edit`);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Virtual Graduate Employability Summit');
    await expect(publishButton(page)).toBeDisabled();

    for (const path of ['/opportunities/opp-1/edit', '/opportunities/nope/edit', '/opportunities/lst-01/edit?state=notfound']) {
      await page.goto(`${BASE_URL}${path}`);
      await expect(page.getByText(/not found/i).first()).toBeVisible();
    }
  });

  test('a published listing is edited with "Save changes" (no Save draft)', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities/lst-01/edit`, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Save draft' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});

test.describe('Opportunities: curated detail, reach and unpublish', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Reach: totals equal website plus app, for views and applications, and match the data', async ({ page }) => {
    const metrics = buildSeed().collections.listingMetrics.find((entry) => entry.listingId === 'lst-01')!;
    await page.goto(`${BASE_URL}/opportunities/lst-01`, { timeout: 30_000 });
    const number = async (id: string) => Number((await page.getByTestId(id).innerText()).replace(/[^0-9]/g, ''));
    for (const kind of ['views', 'applications'] as const) {
      const website = await number(`reach-${kind}-website`);
      const app = await number(`reach-${kind}-app`);
      const total = await number(`reach-${kind}-total`);
      expect(total).toBe(website + app);
      expect(website).toBe(metrics[kind].website);
      expect(app).toBe(metrics[kind].app);
      // the numbers are text: the split line carries both shares
      await expect(page.getByTestId(`reach-${kind}-split`)).toContainText(/Website \d+% · App \d+%/);
    }
  });

  test('header shows Source and Vetting badges and an Edit button; a draft has no Reach and no Unpublish', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities/lst-13`, { timeout: 30_000 });
    await expect(page.getByTestId('source-pill')).toContainText('Staff-curated');
    await expect(page.getByTestId('vetting-badge')).toContainText('Unvetted');
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/opportunities/lst-13/edit');
    await expect(page.getByRole('region', { name: 'Reach' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Unpublish listing' })).toHaveCount(0);
  });

  test('Unpublish asks first, then returns the listing to Draft (still vetted)', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities/lst-02`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
    await expect(page.getByRole('region', { name: 'Reach' })).toBeVisible();
    await page.getByRole('button', { name: 'Unpublish listing' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Unpublish this listing?');
    await dialog.getByRole('button', { name: 'Unpublish listing' }).click();
    await expect(page.getByText('Operations Analyst was unpublished.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Reach' })).toHaveCount(0);
    await expect(page.getByTestId('vetting-badge')).toContainText('Vetted');
    await expect(page.getByRole('button', { name: 'Unpublish listing' })).toHaveCount(0);
  });

  test('a hirer posting keeps its approve / reject page', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities/opp-3`, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Approve' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Reject opportunity' })).toBeEnabled();
    await expect(page.getByTestId('source-pill')).toHaveCount(0);
  });
});

test.describe('Opportunities: roles', () => {
  test.skip(process.env.E2E_PROD === '1', 'the dev role switcher only exists in development with mock data');
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const role of ['opportunities_officer', 'desk_lead', 'super_admin']) {
    test(`${role} sees New listing and can open the form and the edit page`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
      await expect(page.getByRole('link', { name: 'New listing' })).toHaveAttribute('href', '/opportunities/new');
      await page.goto(`${BASE_URL}/opportunities/new`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('New listing');
      await page.goto(`${BASE_URL}/opportunities/lst-01`);
      await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
    });
  }

  test('a moderator keeps approve / reject, but has no New listing button and cannot open the form or edit', async ({ page, context }) => {
    await asRoles(context, 'moderator');
    await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Opportunities Queue');
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'New listing' })).toHaveCount(0);
    await page.goto(`${BASE_URL}/opportunities/opp-3`);
    await expect(page.getByRole('button', { name: 'Approve' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Reject opportunity' })).toBeEnabled();
    for (const path of ['/opportunities/new', '/opportunities/lst-01/edit']) {
      await page.goto(`${BASE_URL}${path}`);
      await expect(page.getByTestId('no-access')).toBeVisible();
    }
    // a curated listing is readable, but Edit is disabled with the standard tooltip and there is no Unpublish
    await page.goto(`${BASE_URL}/opportunities/lst-01`);
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);
    const edit = page.getByRole('button', { name: 'Edit' });
    await expect(edit).toBeDisabled();
    await edit.hover({ force: true });
    await expect(page.getByRole('tooltip')).toContainText('Your role can view this page but not change it');
    await expect(page.getByRole('button', { name: 'Unpublish listing' })).toHaveCount(0);
  });
});

test.describe('Opportunities: phone (434px)', () => {
  test.use({ viewport: { width: 434, height: 900 } });
  const noOverflow = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  test('list rows are cards with the source and the vetting; nothing is wider than the screen', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
    const card = page.getByTestId('table-row').first();
    await expect(card).toBeVisible();
    await expect(card).toContainText('Staff-curated');
    await expect(card.locator('td[data-label="Source"]')).toContainText('Staff-curated');
    await expect(card.locator('td[data-label="Vetting"]')).toContainText(/Vetted|Unvetted/);
    expect(await noOverflow(page)).toBe(true);
    for (const name of ['Filter by source']) await expect(page.getByRole('radiogroup', { name })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Filter by country' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New listing' })).toBeVisible();
    // the sheet opens for the country filter on a phone
    await page.getByRole('combobox', { name: 'Filter by country' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('the form fits: no sideways scroll, the vetting card and both action buttons are reachable, 40px+ hit areas', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities/new`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('New listing');
    expect(await noOverflow(page)).toBe(true);
    await expect(page.getByTestId('back-button')).toBeVisible();
    const save = page.getByRole('button', { name: 'Save draft' });
    const publish = page.getByRole('button', { name: 'Publish', exact: true });
    await expect(save).toBeVisible();
    await expect(publish).toBeVisible();
    await expect(page.getByTestId('save-disabled-reason')).toBeVisible();
    for (const button of [save, publish]) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    const a = (await save.boundingBox())!;
    const b = (await publish.boundingBox())!;
    expect(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1).toBe(true); // they do not overlap
    await page.getByTestId('vetting-checkpoint').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('vetting-checkpoint')).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
  });

  test('a curated detail page fits and keeps the Reach numbers in text', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities/lst-01`, { timeout: 30_000 });
    await expect(page.getByTestId('reach-views-total')).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
  });
});

test.describe('Phone overflow exemption is narrow (434px)', () => {
  test.use({ viewport: { width: 434, height: 900 } });

  // The same predicate as the "nothing is wider than the screen" check on the list pages: the only thing it skips is
  // a header row, screen-reader-only text and a scroll container that carries an edge fade (data-edge-fade).
  const wideElements = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const vw = window.innerWidth;
      return [...document.querySelectorAll('main *')]
        .filter((el) => !el.closest('thead,.sr-only,[data-edge-fade]') && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().right > vw + 1)
        .map((el) => el.tagName);
    });

  test('a plain element wider than the viewport is still caught', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    expect(await wideElements(page)).toEqual([]);
    await page.evaluate(() => {
      const wide = document.createElement('div');
      wide.style.width = '700px';
      wide.textContent = 'too wide';
      document.querySelector('main')!.appendChild(wide);
    });
    expect(await wideElements(page)).toContain('DIV');
  });

  test('a wide element inside a scroller WITHOUT a fade is also caught; with a fade it is exempt', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await page.evaluate(() => {
      const scroller = document.createElement('div');
      scroller.id = 'plain-scroller';
      scroller.style.cssText = 'overflow-x:auto;width:200px';
      scroller.innerHTML = '<div style="width:900px">wide</div>';
      document.querySelector('main')!.appendChild(scroller);
    });
    expect(await wideElements(page)).toContain('DIV'); // the scroller has no fade: not exempt
    await page.evaluate(() => document.getElementById('plain-scroller')!.setAttribute('data-edge-fade', 'true'));
    expect(await wideElements(page)).toEqual([]);
  });

  test('every exempt scroller shows an edge fade on each side that has more content', async ({ page }) => {
    for (const path of ['/opportunities', '/team', '/notifications']) {
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      await page.waitForTimeout(600);
      const result = await page.evaluate(() =>
        [...document.querySelectorAll('[data-edge-fade]')].map((el) => {
          const wrapper = el.parentElement!;
          const fadeStart = wrapper.querySelector('[data-testid$="fade-start"]') as HTMLElement | null;
          const fadeEnd = wrapper.querySelector('[data-testid$="fade-end"]') as HTMLElement | null;
          const shown = (fade: HTMLElement | null) => !!fade && getComputedStyle(fade).opacity === '1';
          const moreBefore = el.scrollLeft > 1;
          const moreAfter = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
          return {
            hasFade: !!fadeStart && !!fadeEnd,
            // a fade must show on every side that has more content beyond it
            fadesMatch: (!moreBefore || shown(fadeStart)) && (!moreAfter || shown(fadeEnd)),
          };
        }),
      );
      expect(result.length).toBeGreaterThan(0);
      for (const scroller of result) {
        expect(scroller.hasFade).toBe(true);
        expect(scroller.fadesMatch).toBe(true);
      }
    }
  });
});

test.describe('Opportunities Queue: memory note', () => {
  test('mock mode shows no note about curated listings being kept in memory', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await expect(page.getByTestId('curated-memory-note')).toHaveCount(0);
  });

  test('real-API mode shows the muted note (E2E_REAL_DATA=1)', async ({ page }) => {
    test.skip(process.env.E2E_REAL_DATA !== '1', 'set E2E_REAL_DATA=1 with the admin running in real-API mode against the seeded e2e backend');
    await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
    await expect(page.getByTestId('curated-memory-note')).toHaveText('Curated listings are saved in memory until the backend supports them.');
  });
});

// ---------------------------------------------------------------------------
// Programs: list, form, detail (GOD's own activities; a separate entity from Opportunities)
// ---------------------------------------------------------------------------
// Hand-written from the seed: 12 programs. Delivered 6, running 3, planned 2, cancelled 1, so Active (planned + running)
// is 5 and Delivered is 6. Types: training 1, bootcamp 2, webinar 2, outreach 2, project 2, mentorship 1, event 2.
// Countries: Ghana 3, Nigeria 2, Kenya 2, and one each in Uganda, Sierra Leone, Rwanda, Senegal and Côte d'Ivoire.
test.describe('Programs: the data', () => {
  test('the seven program types and four statuses, and the seed counts', () => {
    expect([...PROGRAM_TYPES]).toEqual(['training', 'bootcamp', 'webinar', 'outreach', 'project', 'mentorship', 'event']);
    expect([...PROGRAM_STATUSES]).toEqual(['planned', 'running', 'delivered', 'cancelled']);
    const programs = buildSeed().collections.programs;
    const count = (pick: (p: (typeof programs)[number]) => string) => {
      const out: Record<string, number> = {};
      for (const program of programs) out[pick(program)] = (out[pick(program)] ?? 0) + 1;
      return out;
    };
    expect(count((p) => p.status)).toEqual({ delivered: 6, running: 3, planned: 2, cancelled: 1 });
    expect(count((p) => p.type)).toEqual({ training: 1, bootcamp: 2, webinar: 2, outreach: 2, project: 2, mentorship: 1, event: 2 });
    for (const program of programs) {
      expect(program.target).toBeGreaterThanOrEqual(1);
      expect(program.participants).toBeLessThanOrEqual(program.target);
      expect(program.facilitators.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Programs: list', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const statusCount = async (page: import('@playwright/test').Page, name: string) =>
    (await page.getByRole('radiogroup', { name: 'Filter by status' }).getByRole('radio', { name: new RegExp(`^${name}`) }).innerText()).replace(/\D+/g, '');
  const stat = async (page: import('@playwright/test').Page, id: 'active' | 'delivered') =>
    (await page.getByTestId(`program-summary-${id}`).innerText()).replace(/\D+/g, '');

  test('two SEPARATE stats, Active 5 and Delivered 6, equal to the counts from the list', async ({ page }) => {
    await page.goto(`${BASE_URL}/programs`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await expect(page.getByTestId('program-summary-active')).toContainText('Active');
    await expect(page.getByTestId('program-summary-delivered')).toContainText('Delivered');
    expect(await stat(page, 'active')).toBe('5');
    expect(await stat(page, 'delivered')).toBe('6');
    // they equal what the list itself says: Active = planned + running, Delivered = delivered
    expect(Number(await statusCount(page, 'Planned')) + Number(await statusCount(page, 'Running'))).toBe(5);
    expect(await statusCount(page, 'Delivered')).toBe('6');
    // two different tiles, not one combined figure
    const a = (await page.getByTestId('program-summary-active').boundingBox())!;
    const d = (await page.getByTestId('program-summary-delivered').boundingBox())!;
    expect(a.x + a.width).toBeLessThanOrEqual(d.x + 1);
  });

  test('columns, orange tiles, "42 of 60" figures with a bar, and the first rows', async ({ page }) => {
    await page.goto(`${BASE_URL}/programs`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    const headers = (await page.locator('main table thead th').allTextContents()).map((text) => text.trim()).filter((text) => text && text !== 'Open');
    expect(headers).toEqual(['Program', 'Status', 'Partner', 'Participants', 'Start date', 'Country']);
    // soonest start first: the planned webinar in Senegal
    await expect(page.getByTestId('table-row').first()).toContainText('Climate Careers Webinar');
    await page.getByRole('radiogroup', { name: 'Filter by status' }).getByRole('radio', { name: /^Delivered/ }).click();
    const row = page.getByTestId('table-row').filter({ hasText: 'CV and Interview Masterclass' });
    await expect(row).toContainText('Training'); // the type under the name
    await expect(row).toContainText('140 of 155');
    await expect(row).toContainText('Delivered');
    await expect(row).toContainText('Ghana');
    await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '90'); // 140 / 155
    // the program tile is orange
    expect(await row.locator('.bg-orange-50').count()).toBeGreaterThan(0);
  });

  test('status tabs with counts, and the Type and Country filters combine', async ({ page }) => {
    await page.goto(`${BASE_URL}/programs`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    expect(await statusCount(page, 'All')).toBe('12');
    expect(await statusCount(page, 'Planned')).toBe('2');
    expect(await statusCount(page, 'Running')).toBe('3');
    expect(await statusCount(page, 'Delivered')).toBe('6');
    expect(await statusCount(page, 'Cancelled')).toBe('1');

    await page.getByRole('combobox', { name: 'Filter by type' }).click();
    await page.getByRole('option', { name: 'Outreach' }).click();
    expect(await statusCount(page, 'All')).toBe('2');
    expect(await statusCount(page, 'Delivered')).toBe('1'); // Scholarship Application Clinic
    expect(await statusCount(page, 'Running')).toBe('1'); // Study Abroad Info Campaign
    await expect(page.getByTestId('table-row')).toHaveCount(2);

    await page.getByRole('combobox', { name: 'Filter by type' }).click();
    await page.getByRole('option', { name: 'All types' }).click();
    await page.getByRole('combobox', { name: 'Filter by country' }).click();
    await page.getByRole('option', { name: 'Ghana' }).click();
    expect(await statusCount(page, 'All')).toBe('3');
    expect(await statusCount(page, 'Delivered')).toBe('2');
    await page.getByRole('radiogroup', { name: 'Filter by status' }).getByRole('radio', { name: /^Running/ }).click();
    await expect(page.getByTestId('table-row')).toHaveCount(1);
    await expect(page.getByTestId('table-row')).toContainText('Career Mentorship Circle');
    // the summary counts ALL programs, so a filter does not move it
    expect(await stat(page, 'active')).toBe('5');
    expect(await stat(page, 'delivered')).toBe('6');
    // an impossible combination
    await page.getByRole('radiogroup', { name: 'Filter by status' }).getByRole('radio', { name: /^Cancelled/ }).click();
    await expect(page.getByText('No programs match these filters')).toBeVisible();
  });

  test('?state=empty and ?state=error show their states; the summary shows "—" while unknown', async ({ page }) => {
    await page.goto(`${BASE_URL}/programs?state=empty`, { timeout: 30_000 });
    await expect(page.getByText('No programs yet')).toBeVisible();
    await page.goto(`${BASE_URL}/programs?state=error`);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await page.goto(`${BASE_URL}/programs?state=loading`);
    await expect(page.getByTestId('program-summary-active')).toContainText('—');
    await expect(page.getByTestId('program-summary-delivered')).toContainText('—');
  });
});

test.describe('Programs: form', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const ready = async (page: import('@playwright/test').Page, path: string) => {
    await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
  };

  test('validation: end before start, count above the target while planned, target of at least 1', async ({ page }) => {
    await ready(page, '/programs/new');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('New program');
    await page.getByRole('button', { name: 'Create program' }).click();
    for (const message of ['Enter a title.', 'Choose a country.', 'Choose the start date and time.', 'Choose the end date and time.', 'Enter a target of at least 1.']) {
      await expect(page.getByText(message)).toBeVisible();
    }
    await expect(page.getByLabel('Title', { exact: true })).toBeFocused();

    await page.getByLabel('Title', { exact: true }).fill('Form Test Program');
    await page.getByLabel('Start date and time').fill('2030-05-10T10:00');
    await page.getByLabel('End date and time').fill('2030-05-10T09:00');
    await page.getByLabel('End date and time').blur();
    await expect(page.getByText('The end must be after the start.')).toBeVisible();
    await page.getByLabel('End date and time').fill('2030-05-10T10:00'); // equal is not "after" either
    await page.getByLabel('End date and time').blur();
    await expect(page.getByText('The end must be after the start.')).toBeVisible();
    await page.getByLabel('End date and time').fill('2030-05-11T10:00');
    await expect(page.getByText('The end must be after the start.')).toHaveCount(0);

    await page.getByLabel('Participant target').fill('0');
    await page.getByLabel('Participant target').blur();
    await expect(page.getByText('Enter a target of at least 1.')).toBeVisible();
    await page.getByLabel('Participant target').fill('20');
    await page.getByLabel('Participants now').fill('25');
    await page.getByLabel('Participants now').blur();
    await expect(page.getByText('The count cannot be above the target while the program is planned.')).toBeVisible();
    // ... but a running program may be over its target
    await page.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'Running' }).click();
    await expect(page.getByText('The count cannot be above the target while the program is planned.')).toHaveCount(0);
  });

  test('a delivered program shows the monthly-target note; other statuses do not', async ({ page }) => {
    await ready(page, '/programs/new');
    await expect(page.getByTestId('delivered-note')).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'Delivered' }).click();
    await expect(page.getByTestId('delivered-note')).toHaveText('Delivered programs count toward the monthly target');
    await page.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'Cancelled' }).click();
    await expect(page.getByTestId('delivered-note')).toHaveCount(0);
  });

  test('facilitators: Enter and comma add, duplicates are skipped, Backspace and the x remove', async ({ page }) => {
    await ready(page, '/programs/new');
    const input = page.getByRole('textbox', { name: 'Facilitators' });
    const chips = page.getByRole('list', { name: 'Added facilitators' }).getByRole('listitem');
    await input.fill('Ama Boateng');
    await input.press('Enter');
    await input.fill('Kofi Mensah');
    await input.press(',');
    await input.fill('ama boateng'); // a duplicate, ignoring case
    await input.press('Enter');
    await expect(chips).toHaveText(['Ama Boateng', 'Kofi Mensah']);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('New program'); // Enter did not submit the form
    await input.press('Backspace');
    await expect(chips).toHaveText(['Ama Boateng']);
    await input.fill('Efua Darko');
    await input.blur(); // leaving the field adds what was typed
    await expect(chips).toHaveText(['Ama Boateng', 'Efua Darko']);
    await page.getByRole('button', { name: 'Remove Ama Boateng' }).click();
    await expect(chips).toHaveText(['Efua Darko']);
  });

  test('creating a planned program adds it to the list and moves Active from 5 to 6', async ({ page }) => {
    await ready(page, '/programs/new');
    await page.getByLabel('Title', { exact: true }).fill('Created In Test');
    await page.getByRole('combobox', { name: 'Country' }).click();
    await page.getByRole('option', { name: 'Ghana' }).click();
    await page.getByLabel('Start date and time').fill('2031-02-01T09:00');
    await page.getByLabel('End date and time').fill('2031-02-01T12:00');
    await page.getByLabel('Participant target').fill('30');
    await page.getByRole('textbox', { name: 'Facilitators' }).fill('Test Facilitator');
    await page.getByRole('textbox', { name: 'Facilitators' }).press('Enter');
    await page.getByRole('button', { name: 'Create program' }).click();
    await expect(page.getByText('Created In Test was created.')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/programs\/prg-new-/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Created In Test');
    await expect(page.getByTestId('participants-figure')).toHaveText('0 of 30');
    await page.locator('header.sticky').getByRole('link', { name: 'Programs' }).click();
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    expect((await page.getByTestId('program-summary-active').innerText()).replace(/\D+/g, '')).toBe('6');
    expect((await page.getByTestId('program-summary-delivered').innerText()).replace(/\D+/g, '')).toBe('6');
    await expect(page.getByTestId('table-row').filter({ hasText: 'Created In Test' })).toContainText('0 of 30');
  });

  test('edit: the form is filled; saving a program as Delivered raises Delivered from 6 to 7 and lowers Active', async ({ page }) => {
    await ready(page, '/programs/prg-10/edit'); // Entrepreneurship Pitch Day, planned
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit program');
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Entrepreneurship Pitch Day');
    await page.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'Delivered' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Entrepreneurship Pitch Day was updated.')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(`${BASE_URL}/programs/prg-10`, { timeout: 30_000 });
    await page.locator('header.sticky').getByRole('link', { name: 'Programs' }).click();
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    expect((await page.getByTestId('program-summary-active').innerText()).replace(/\D+/g, '')).toBe('4');
    expect((await page.getByTestId('program-summary-delivered').innerText()).replace(/\D+/g, '')).toBe('7');
  });

  test('unknown ids and hirer postings are not found; leaving with unsaved changes asks first', async ({ page }) => {
    await page.goto(`${BASE_URL}/programs/nope/edit`, { timeout: 30_000 });
    await expect(page.getByText(/not found/i).first()).toBeVisible();
    await ready(page, '/programs/new');
    await page.getByLabel('Title', { exact: true }).fill('Unsaved');
    await page.locator('header.sticky').getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeVisible();
  });
});

test.describe('Programs: detail and cancel', () => {
  test.skip(process.env.E2E_PROD === '1', 'the dev role switcher only exists in development with mock data');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('header, participants, facilitators, details and the partner link', async ({ page }) => {
    const seed = buildSeed().collections;
    const program = seed.programs.find((p) => p.id === 'prg-01')!;
    const partner = seed.partners.find((p) => p.id === program.partnerId)!;
    await page.goto(`${BASE_URL}/programs/prg-01`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('CV and Interview Masterclass');
    await expect(page.getByRole('region', { name: 'Summary' })).toContainText('Training');
    await expect(page.getByRole('region', { name: 'Summary' })).toContainText('Delivered');
    await expect(page.getByTestId('participants-figure')).toHaveText('140 of 155');
    await expect(page.getByRole('progressbar', { name: 'Participants: 90%' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Facilitators' }).getByRole('listitem')).toHaveText(['Kwabena Tetteh']);
    await expect(page.getByRole('region', { name: 'Details' })).toContainText('Delivered programs count toward the monthly target.');
    await expect(page.getByTestId('partner-link')).toHaveText(partner.name);
    await expect(page.getByTestId('partner-link')).toHaveAttribute('href', '/partners');
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/programs/prg-01/edit');
    // a delivered program cannot be cancelled
    await expect(page.getByRole('button', { name: 'Cancel program' })).toHaveCount(0);
  });

  test('Cancel asks first; confirming updates the list and the figures (Active 5 to 4, Delivered stays 6)', async ({ page }) => {
    await page.goto(`${BASE_URL}/programs/prg-07`, { timeout: 30_000 }); // Career Mentorship Circle, running
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Career Mentorship Circle');
    await page.getByRole('button', { name: 'Cancel program' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Cancel this program?');
    // backing out changes nothing
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Summary' })).toContainText('Running');

    await page.getByRole('button', { name: 'Cancel program' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel program' }).click();
    await expect(page.getByText('Career Mentorship Circle was cancelled.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Summary' })).toContainText('Cancelled');
    await expect(page.getByRole('button', { name: 'Cancel program' })).toHaveCount(0);

    await page.locator('header.sticky').getByRole('link', { name: 'Programs' }).click();
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    expect((await page.getByTestId('program-summary-active').innerText()).replace(/\D+/g, '')).toBe('4');
    expect((await page.getByTestId('program-summary-delivered').innerText()).replace(/\D+/g, '')).toBe('6');
    const tabs = page.getByRole('radiogroup', { name: 'Filter by status' });
    await expect(tabs.getByRole('radio', { name: /^Running/ })).toContainText('2');
    await expect(tabs.getByRole('radio', { name: /^Cancelled/ })).toContainText('2');
  });

  test('?state=notfound and ?state=error work on the detail page', async ({ page }) => {
    await page.goto(`${BASE_URL}/programs/prg-01?state=notfound`, { timeout: 30_000 });
    await expect(page.getByText(/not found/i).first()).toBeVisible();
    await page.goto(`${BASE_URL}/programs/prg-01?state=error`);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('entity accent: the program tile on the detail page is orange', async ({ page }) => {
    await page.goto(`${BASE_URL}/programs/prg-01`, { timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Summary' }).locator('.bg-orange-50').first()).toBeVisible();
  });
});

test.describe('Programs: roles', () => {
  test.skip(process.env.E2E_PROD === '1', 'the dev role switcher only exists in development with mock data');
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const role of ['training_officer', 'desk_lead', 'super_admin']) {
    test(`${role} edits: New program, Edit and Cancel are there`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/programs`, { timeout: 30_000 });
      await expect(page.getByRole('link', { name: 'New program' })).toHaveAttribute('href', '/programs/new');
      await page.goto(`${BASE_URL}/programs/new`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('New program');
      await page.goto(`${BASE_URL}/programs/prg-08`);
      await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel program' })).toBeVisible();
    });
  }

  test('country_lead can read but not change: no New program, Edit disabled with the tooltip, no Cancel, no form', async ({ page, context }) => {
    await asRoles(context, 'country_lead');
    await page.goto(`${BASE_URL}/programs`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Programs');
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'New program' })).toHaveCount(0);
    await page.goto(`${BASE_URL}/programs/prg-08`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Digital Skills Cohort 3');
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);
    const edit = page.getByRole('button', { name: 'Edit' });
    await expect(edit).toBeDisabled();
    await edit.hover({ force: true });
    await expect(page.getByRole('tooltip')).toContainText('Your role can view this page but not change it');
    await expect(page.getByRole('button', { name: 'Cancel program' })).toHaveCount(0);
    // a country lead can see Partners, so the partner is a link
    await expect(page.getByTestId('partner-link')).toBeVisible();
    for (const path of ['/programs/new', '/programs/prg-08/edit']) {
      await page.goto(`${BASE_URL}${path}`);
      await expect(page.getByTestId('no-access')).toBeVisible();
    }
  });

  test('a training officer cannot see Partners, so the partner is plain text; a moderator has no access at all', async ({ page, context }) => {
    await asRoles(context, 'training_officer');
    await page.goto(`${BASE_URL}/programs/prg-08`, { timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Details' })).toContainText('Partner');
    await expect(page.getByTestId('partner-link')).toHaveCount(0);
    await asRoles(context, 'moderator');
    await page.goto(`${BASE_URL}/programs`);
    await expect(page.getByTestId('no-access')).toBeVisible();
    await expect(page.getByTestId('no-access')).toContainText('Training');
  });
});

test.describe('Programs: phone (434px)', () => {
  test.use({ viewport: { width: 434, height: 900 } });
  const noOverflow = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  test('list rows are cards: name and status on top, labelled values, the bar; both stats and filters fit', async ({ page }) => {
    await page.goto(`${BASE_URL}/programs`, { timeout: 30_000 });
    const card = page.getByTestId('table-row').first();
    await expect(card).toBeVisible();
    await expect(card.locator('td[data-label="Participants"]')).toContainText(/\d+ of \d+/);
    await expect(card.locator('td[data-label="Country"]')).not.toBeEmpty();
    await expect(card.getByTestId('status-badge')).toBeVisible();
    await expect(page.getByTestId('program-summary-active')).toBeVisible();
    await expect(page.getByTestId('program-summary-delivered')).toBeVisible();
    await expect(page.getByRole('link', { name: 'New program' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Filter by type' })).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await page.getByRole('combobox', { name: 'Filter by country' }).click();
    await expect(page.getByRole('dialog')).toBeVisible(); // the bottom sheet
  });

  test('the form fits: one column, no sideways scroll, the buttons are 40px+ and do not overlap', async ({ page }) => {
    await page.goto(`${BASE_URL}/programs/new`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('New program');
    await expect(page.getByTestId('back-button')).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    const create = page.getByRole('button', { name: 'Create program' });
    const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
    await expect(create).toBeVisible();
    expect((await create.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    const a = (await create.boundingBox())!;
    const b = (await cancel.boundingBox())!;
    expect(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1).toBe(true);
  });

  test('the detail page fits and keeps the figures in text', async ({ page }) => {
    await page.goto(`${BASE_URL}/programs/prg-01`, { timeout: 30_000 });
    await expect(page.getByTestId('participants-figure')).toHaveText('140 of 155');
    expect(await noOverflow(page)).toBe(true);
  });
});
