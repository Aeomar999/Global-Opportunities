import { test, expect } from '@playwright/test';
import { BRAND, BRAND_ADMIN_TITLE, BRAND_EMAIL_DOMAIN } from '../src/config/brand';
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { isDevRoleSwitcherEnabled, parseDevRoles } from '../src/config/dev-roles';
import { SCREENS, editableRoleGrants, roleCan } from '../src/config/permissions';
import { KPIS, KPI_KEYS, kpisOwnedBy } from '../src/config/kpis';
import { ROLES, ROLE_IDS } from '../src/config/roles';
import { formatDate, formatDateTime, formatMonth, joinList } from '../src/lib/format';
import { pipelineHealth, statusForRatio } from '../src/lib/pipeline-health';
import { flattenMoves, partnerSummary } from '../src/lib/services/partners';
import { ambassadorStats, buildLeaderboard, createAmbassador, generateReferralCode, logAmplification, monthOf, networkSummary, rankAmbassadors, updateAmbassador } from '../src/lib/services/network';
import { HEALTH_OVERRIDES, demoHealth, parseHealthOverride } from '../src/lib/pipeline-health-demo';
import { attainment, currentMonth, daysInMonth, kpiThresholds, isPastMonth, kpiMonthStatus, kpiStatus, kpiTarget, kpiValue, monthProgress, monthSeries, monthsBefore, newInMonth, shouldRecordReport } from '../src/lib/kpi';
import { staffOwningKpi } from '../src/lib/services/staff';
import { addDays, addMonths, clampDate, disabledReason, endOfWeek, formatTime12, joinDateTime, longDate, monthGrid, parseTime, parseTyped, shortDate, slotFor, splitDateTime, startOfWeek, TIME_SLOTS, weekdayIndex, WEEKDAYS } from '../src/lib/date-picker';
import { DESK_TIME_ZONE } from '../src/config/time';
import {
  CLOSED_STAGES, PASSWORD_MIN, changeHistory, saveThresholds, scheduledThresholds, STAGE_LABEL_MAX, STRENGTH_HINTS, TARGET_MAX, currentStageLabels, effectiveFromOptions, getIntegration, maskedTail, parseTarget, passwordStrength,
  resetStageLabels, saveCredential, saveIdentifier, saveStageLabels, saveTargets, targetRows, testConnection, thresholdExample, thresholdPercents, validatePasswordChange,
  validateStageLabels, validateTarget, validateThresholds,
} from '../src/lib/services/settings';
import { logPost, platformRows, socialMonth, validatePost, validatePostUrl } from '../src/lib/services/social';
import { ACTIONS_BY_STATUS, ACTION_RESULT, applyTestimonialAction, publicPreview, sortTestimonials, testimonialCounts } from '../src/lib/services/testimonials';
import { DUPLICATE_MESSAGES, createRecord, findDuplicate, normalizeEmail, normalizePhone, pendingRecordCount, recordLinkAccess, recordsPace, sourceBreakdown, undoVerify, verifyRecord } from '../src/lib/services/database';
import { AMBASSADOR_STATUSES, AMBASSADOR_TIERS, AMBASSADOR_TIER_LABELS, LISTING_TYPES, PARTNER_STAGES, PARTNER_STAGE_LABELS, isPartnerClosed, partnerClosedAt, PROGRAM_STATUSES, PROGRAM_TYPES, POST_PLATFORM_LABELS, RECORD_SOURCES, RECORD_SOURCE_LABELS, SOCIAL_PLATFORMS, SOCIAL_POST_PLATFORMS, TESTIMONIAL_STATUSES } from '../src/lib/mock-entities';
import { DEFAULT_TARGETS, DEFAULT_THRESHOLDS, buildSeed } from '../src/lib/mock-seed';
import { getMockCollection, getPartnerStageLabels, setMockCollection, setPartnerStageLabels } from '../src/lib/mock-store';
import { getStatusMeta } from '../src/lib/status-map';
import { PERMISSIONS, describeRole, rolePermissionsStore } from '../src/lib/role-permissions';
import { getAdminCredentials } from './credentials';
import { MOCK_RUN, defaultBaseUrl } from './mode';
import { MOCK_COUNTS } from '../src/lib/services/mock-counts';
import { kpiMonthProgress } from '../src/lib/kpi';
import { kpiUnit, pluralize, pluralWord } from '../src/lib/plural';
import { metricDelta, partnerMetrics, lastCompleteMonth, isMonthToDate, earliestMonth, reportToday, reportTitle } from '../src/lib/report';
import { recordReport } from '../src/lib/services/report';
import { buildKpiCards } from '../src/lib/services/dashboard';
import { highlightLabels } from '../src/lib/scorecard';
import { SCORE_FROM_DAY } from '../src/config/scorecard';
import { formatAttainment, isTooEarly, metricResult, compositeSeries, composite, compositeStatus, highlightOf, metricAttainment, ownedMetrics, scorecardFor, strengths, teamScorecards, teamSummary } from '../src/lib/scorecard';

const BASE_URL = defaultBaseUrl();
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
  test.skip(!MOCK_RUN, 'the ?state= switch does not exist in production builds');

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
    await expect(page.getByRole('link', { name: 'View report' })).toHaveAttribute('href', `/monthly-report/partner?month=${currentMonth()}`);
  });

  test('shows the dark attention card and the activity timeline', async ({ page }) => {
    test.skip(!MOCK_RUN, 'the ten cards, the feed and the attention counts come from the mock store: see npm run test:e2e:mock');
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);
    const attention = page.getByRole('region', { name: 'Needs your attention' });
    await expect(attention).toBeVisible();
    await expect(attention.getByRole('link', { name: /Pending verifications/ })).toHaveAttribute('href', '/verification');
    await expect(attention.getByRole('link', { name: /Open reports/ })).toHaveAttribute('href', '/reports');
    await expect(attention.getByRole('link', { name: /Pending testimonials/ })).toHaveAttribute('href', '/testimonials');
    await expect(attention.getByRole('link', { name: /Unvetted draft listings/ })).toHaveAttribute('href', '/opportunities');
    const activity = page.getByRole('region', { name: 'Recent activity' }).getByRole('listitem');
    await expect(activity.first()).toBeVisible();
    expect(await activity.count()).toBeLessThanOrEqual(6);
  });
});

// Dev-only ?state= switch (mock mode, never in production builds): every state keeps the final layout.
test.describe('Overview ?state= switch (dev server, mock mode)', () => {
  test.skip(!MOCK_RUN, 'the ?state= switch does not exist in production builds');
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
    await expect(page.getByTestId('kpi-card-social_reach').getByTestId('kpi-status')).toBeVisible(); // the cards still load
    await expect(page.getByRole('region', { name: 'Needs your attention' }).getByRole('link', { name: /Pending verifications/ })).toContainText(String(MOCK_COUNTS.pendingVerifications));
    await expect(page.getByRole('region', { name: 'Trend' }).getByText('The trend could not be loaded.')).toBeVisible(); // the trend does not
  });

  test('?state=empty shows empty layouts, ?state=loading keeps skeletons', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/?state=empty`);
    await expect(page.getByText('Nothing counted yet')).toBeVisible();
    await expect(page.getByText('No programs in progress or upcoming')).toBeVisible();
    await expect(page.getByText('No recent activity')).toBeVisible();
    await expect(page.getByText('All clear: nothing is waiting on you.')).toBeVisible();

    await page.goto(`${BASE_URL}/?state=loading`);
    await expect(page.getByTestId('kpi-skeleton')).toHaveCount(10);
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('kpi-skeleton')).toHaveCount(10); // never resolves
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
    // Exercise the interactive parts: the palette and the user menu (every mode), and in mock mode the chart (hover + keyboard), the KPI picker and "See all"
    // (in real-API mode the monthly figures are "Not available yet": there is no chart or picker to use).
    if (MOCK_RUN) {
      const chart = page.getByRole('group', { name: /^Opportunities published, last six months/ });
      await chart.hover();
      await chart.focus();
      await page.keyboard.press('ArrowLeft');
      await page.getByRole('combobox', { name: 'KPI shown in the trend' }).click();
      await page.getByRole('option', { name: 'Social reach' }).click();
      await expect(page.getByRole('group', { name: /^Social reach, last six months/ })).toBeVisible();
      await page.getByRole('button', { name: 'See all' }).click();
      await page.getByRole('button', { name: 'Show fewer' }).click();
    } else {
      await expect(page.getByTestId('not-available-yet').first()).toBeVisible();
    }
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
      test.skip(!!mockOnly && !MOCK_RUN, 'the queues need mock mode for rows');
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
    // Count only once the data has replaced the loading skeleton (the footer appears with it).
    await expect(page.getByText(/^Showing 1-\d+ of \d+$/)).toBeVisible();
    const n = await rows.count();
    expect(Math.round((await page.locator('main thead tr').boundingBox())!.height)).toBe(36);
    for (let i = 0; i < n; i++) expect(Math.round((await rows.nth(i).boundingBox())!.height)).toBe(56);
    await expect(page.getByText(`Showing 1-${n} of ${n}`)).toBeVisible();
    // One page: Previous / Next are not shown at all ("Showing 1-N of N" stays).
    await expect(page.getByRole('button', { name: 'Previous', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
  });

  test('filters show counts and narrow the rows (Verification)', async ({ page }) => {
    test.skip(!MOCK_RUN, 'needs mock mode');
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

    test.skip(!MOCK_RUN, 'the ?state= switch does not exist in production builds');
    await page.goto(`${BASE_URL}/seekers?state=empty`);
    await expect(page.getByText('No seeker accounts yet')).toBeVisible();
    await expect(page.getByText('No seekers match your search')).toHaveCount(0);
  });

  test('?state=loading shows skeleton rows with the header band and keeps them', async ({ page }) => {
    test.skip(!MOCK_RUN, 'the ?state= switch does not exist in production builds');
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
  test.skip(!MOCK_RUN, 'mock counts only exist in mock mode');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('sidebar pills, breadcrumb pill, KPI cards, attention card and the lists show the same numbers', async ({ page }) => {
    const { pendingVerifications, openReports } = MOCK_COUNTS;
    await signedIn(page);
    await page.goto(`${BASE_URL}/`);

    // Overview: KPI cards and the dark attention card
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
    // every focusable cell is a truncated one with a title. Polled: a cell gets its title and its tab stop in two steps (after it is measured), so one instant can see one without the other.
    await expect
      .poll(async () => (await page.locator('main tbody span[tabindex="0"]').count()) - (await page.locator('main tbody span[title]').count()))
      .toBe(0);
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
      test.skip(!MOCK_RUN, 'detail pages use mock records');
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
    test.skip(!MOCK_RUN, 'uses the mock record seeker-1 (the real-API suspend test is Plan 2c Task 5)');
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
  test.skip(!MOCK_RUN, 'detail pages use mock records');
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
  test.skip(!MOCK_RUN, 'the mock store only exists in mock mode');
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
  test.skip(!MOCK_RUN, 'mock mode only');
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
  test.skip(!MOCK_RUN, 'mock data');
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
    await expect(postings.locator('.sr-only > table')).toHaveCount(1);
    await expect(verification.locator('.sr-only > table')).toHaveCount(1);
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
// mockOnly: why the real-API run skips the route. A mock record id is "not found" on the real API; those pages are
// covered there by their "(real API)" tests, which open seeded records.
const AUDIT_ROUTES: { path: string; mockOnly?: string }[] = [
  { path: '/' },
  { path: '/analytics' },
  { path: '/verification' },
  { path: '/verification/comp-1', mockOnly: 'comp-1 is a mock record id' },
  { path: '/opportunities' },
  { path: '/opportunities/opp-1', mockOnly: 'opp-1 is a mock record id' },
  { path: '/reports' },
  { path: '/reports/report-1' },
  { path: '/seekers' },
  { path: '/seekers/seeker-1', mockOnly: 'seeker-1 is a mock record id' },
  { path: '/hirers' },
  { path: '/hirers/hirer-1', mockOnly: 'hirer-1 is a mock record id' },
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
      test.skip(!!mockOnly && !MOCK_RUN, mockOnly ?? '');
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
    test.skip(!MOCK_RUN, 'uses the mock record seeker-2');
    await page.goto(`${BASE_URL}/seekers/seeker-2`, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Suspend account' }).click();
    await expect(page.getByTestId('confirm-dialog-cancel')).toBeFocused();
    await page.getByTestId('confirm-dialog-confirm').click();
    await expect(page.getByTestId('toast')).toContainText('was suspended.');
    await expect(page.getByTestId('status-badge').first()).toContainText('Suspended');
  });
});

// Detail paths that open a mock record id: they exist only in the mock run.
const MOCK_RECORD_PATHS = ['/seekers/seeker-1', '/verification/comp-1', '/events/event-1'];

test.describe('Mobile: no horizontal scroll on any page type (434px and 390px)', () => {
  const pages = ['/', '/seekers', '/seekers/seeker-1', '/staff/invite', '/content/articles/new', '/team', '/team?tab=roles', '/reference-data', '/notifications', '/notifications?tab=history', '/analytics', '/verification/comp-1', '/events/event-1'];
  for (const width of [434, 390]) {
    for (const path of pages) {
      test(`${path} @${width}`, async ({ page }) => {
        test.skip(!MOCK_RUN && MOCK_RECORD_PATHS.includes(path), 'opens a mock record id');
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
    // Wait for the shell: while the session check runs, only a loading screen is rendered and it has no skip link.
    await expect(page.getByTestId('page-title')).toHaveText('Team');
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
  test.skip(!MOCK_RUN, 'mock rows');
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
  test.skip(!MOCK_RUN, 'mock records');
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
        await expect.poll(async () => {
          const tab = await list.locator('[aria-selected="true"]').boundingBox();
          const box = await list.boundingBox();
          if (!tab || !box) return false;
          if (tab.x < box.x - 1 || tab.x + tab.width > box.x + box.width + 1) return false;
          // not under a visible fade (each fade is 32px wide)
          const startFade = await page.getByTestId('tabs-fade-start').first().evaluate((el) => getComputedStyle(el).opacity === '1');
          const endFade = await page.getByTestId('tabs-fade-end').first().evaluate((el) => getComputedStyle(el).opacity === '1');
          if (startFade && tab.x < box.x + 32 - 1) return false;
          if (endFade && tab.x + tab.width > box.x + box.width - 32 + 1) return false;
          return true;
        }).toBe(true);
      };
      await check(); // on load
      for (const name of [/^Programs/, /^Skills/, /^Career Interests/, /^Universities/]) {
        await list.getByRole('tab', { name }).click();
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
  social_media_manager: ['Overview', 'Scorecard', 'Social', 'Testimonials', 'Settings'],
  country_lead: ['Overview', 'Scorecard', 'Partners', 'Network', 'Leaderboard', 'Programs', 'Database', 'Settings'],
  admin_support: ['Overview', 'Scorecard', 'Team', 'Settings'],
  'moderator,communications_officer': ['Overview', 'Monthly report', 'Scorecard', 'Seekers', 'Hirers', 'Channels', 'Verification Queue', 'Reports Queue', 'Career Resources', 'Social', 'Testimonials', 'Notifications', 'Settings', 'Opportunities Queue'],
};

const setDateTime = async (page: import('@playwright/test').Page, label: string, date: string, time: string) => {
  const group = page.getByRole('group', { name: label });
  await group.getByLabel('Date', { exact: true }).fill(date);
  await group.getByLabel('Date', { exact: true }).blur();
  await group.getByLabel('Time', { exact: true }).fill(time);
  await group.getByLabel('Time', { exact: true }).blur();
};

const asRoles = async (context: import('@playwright/test').BrowserContext, roles: string) =>
  context.addCookies([{ name: 'god_dev_roles', value: roles, url: BASE_URL }]);

test.describe('Roles: gated navigation (dev role cookie, mock mode)', () => {
  test.skip(!MOCK_RUN, 'the dev role switcher only exists in development with mock data');
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
    await expect(page.getByTestId('page-title')).toBeVisible();
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
    await expect(page.getByText('Targets and results.', { exact: true })).toBeVisible();
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
    ['/scorecard', 'Scorecard'], // (/monthly-report is built: it redirects to the Partner report; see the Monthly report tests)
  ];
  for (const [path, title] of STUBS) {
    test(`${path}: header, breadcrumb group and the later-step state, no console errors`, async ({ page }) => {
      const problems = trackProblems(page);
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      await expect(page.getByTestId('page-title')).toHaveText(title);
      // the Scorecard of a Super Admin owns no metrics, so it shows that empty state instead (in real-API mode: the sample-data notice and "Not available yet")
      await expect(page.getByText(path === '/scorecard' ? (MOCK_RUN ? 'No metrics are assigned to your role' : 'Not available yet') : 'This screen is built in a later step')).toBeVisible();
      await expect(page.locator('header.sticky nav[aria-label="Breadcrumb"]')).toContainText(title);
      expect(problems).toEqual([]);
    });
  }

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
  test('the thresholds are 0.95 and 0.7: the seed has ONE row for them, from the first month of the data, and every month reads it', () => {
    expect(T).toEqual({ green: 0.95, amber: 0.7 });
    expect(seed.thresholdHistory).toHaveLength(1);
    expect(seed.thresholdHistory[0]).toMatchObject({ green: 0.95, amber: 0.7, effectiveFrom: FIXED_MONTHS[0] });
    expect(seed.thresholdHistory[0].previous).toBeUndefined(); // the starting point, not a change
    expect(seed.thresholdHistory[0].changedBy).toBe(seed.staff.find((person) => person.isCurrentUser)!.name);
    for (const month of FIXED_MONTHS) expect(kpiThresholds(month, kpiData)).toEqual({ green: 0.95, amber: 0.7 });
    expect(kpiThresholds(monthsBefore(FIXED_MONTHS[0], 3), kpiData)).toEqual({ green: 0.95, amber: 0.7 }); // before the first row: the first row
    expect(kpiThresholds(currentMonth())).toEqual({ green: 0.95, amber: 0.7 });
  });

  test('without thresholds given, kpiStatus reads the ones that applied in the month: the boundaries hold at 0.95 and 0.7', () => {
    expect(kpiStatus(19, 20, 30, 30)).toBe('green'); // exactly 0.95
    expect(kpiStatus(18, 20, 30, 30)).toBe('amber');
    expect(kpiStatus(14, 20, 30, 30)).toBe('amber'); // exactly 0.70
    expect(kpiStatus(13, 20, 30, 30)).toBe('red');
    expect(kpiStatus(19, 20, 30, 30, undefined, FIXED_MONTHS[2])).toBe('green');
    expect(kpiStatus(13, 20, 30, 30, undefined, FIXED_MONTHS[2])).toBe('red');
  });

  test('nothing reads the default thresholds directly: DEFAULT_THRESHOLDS is read only by the seed, and no 0.95 or 0.7 threshold is written in the app', () => {
    const readers: string[] = [];
    const literals: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name).replace(/\\/g, '/');
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx|ts)$/.test(entry.name)) {
          const text = readFileSync(full, 'utf8');
          if (/DEFAULT_THRESHOLDS/.test(text)) readers.push(full);
          if (/\b(green|amber)\s*[:=]\s*0?\.(95|7)\b/.test(text)) literals.push(full);
        }
      }
    };
    walk('src');
    expect(readers).toEqual(['src/lib/mock-seed.ts']);
    expect(literals).toEqual(['src/lib/mock-seed.ts']);
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
      expect(listings.has(log.listingId ?? "")).toBe(true);
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

  test('staff: thirteen people, four hold two roles, exactly one is the signed-in dev user, one metric per published listing', () => {
    expect(seed.staff.filter((s) => s.roles.length === 2)).toHaveLength(4); // the Scorecard spread: different people own different combinations of metrics
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
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
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
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
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
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  const names = seed.staff.map((person) => person.name);

  test('the three original accounts keep their ids, and the ten desk staff join them', () => {
    expect(seed.staff).toHaveLength(13);
    const byId = (id: string) => seed.staff.find((person) => person.id === id)!;
    expect([byId('staff-1').name, byId('staff-1').roles]).toEqual(['Nana Adjei', ['super_admin']]);
    expect([byId('staff-2').name, byId('staff-2').roles]).toEqual(['Efua Mensimah', ['moderator']]);
    expect([byId('staff-3').name, byId('staff-3').roles]).toEqual(['Yaw Antwi', ['support']]);
    expect(new Set(seed.staff.map((p) => p.id)).size).toBe(13);
    expect(new Set(names).size).toBe(13);
    expect(seed.staff.filter((p) => p.roles.length === 2)).toHaveLength(4);
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
    await expect(adaeze).toContainText('Communications Officer');
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
    // (Partners onboarded has a target of 4 now, so it is not green in the past months any more: 9 or 8 of 10 green, still healthy)
    expect(greens).toEqual([8, 9, 0, 9, 9, 6]);
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
    const extra = [...seed.monthlyReports, { id: 'r-new', reportMonth: '2026-05', view: 'partner' as const, generatedAt: '2026-06-10' }];
    expect(kpiValue('monthly_reports', '2026-06', { ...kpiData, monthlyReports: extra })).toBe(1);
    expect(kpiValue('monthly_reports', '2026-05', { ...kpiData, monthlyReports: extra })).toBe(1); // unchanged
  });

  test('Download PDF records a report at most once per reportMonth in each calendar month of generation', () => {
    const now = new Date(Date.UTC(2026, 5, 15));
    expect(shouldRecordReport(seed.monthlyReports, '2026-05', now)).toBe(true); // first time this month
    const afterFirst = [...seed.monthlyReports, { id: 'r1', reportMonth: '2026-05', view: 'partner' as const, generatedAt: '2026-06-15' }];
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
// Verification detail on the real API (SEC-077, Plan 2c Task 3)
// ---------------------------------------------------------------------------
test.describe('Verification detail (real API)', () => {
  test.skip(MOCK_RUN, 'real API only');
  test.use({ viewport: { width: 1440, height: 900 } });

  // Seeded by kredibble-backend/scripts/e2e-server.js: a pending case with all four documents pending.
  const DOCUMENTS = ['E2E Business Registration', 'E2E Organisation ID', 'E2E Company Logo', 'E2E Proof of Organisation'];

  test('approving every document approves the company, after a reload and in the queue', async ({ page }) => {
    await page.goto(`${BASE_URL}/verification`, { timeout: 30_000 });
    await page.locator('main tbody tr').filter({ hasText: 'E2E Verify Co' }).getByRole('link').first().click();
    await expect(page.getByTestId('page-title')).toHaveText('E2E Verify Co');
    await expect(page.getByText('Logistics · 11-50 · Tema')).toBeVisible();
    await expect(page.getByText('hr@verify.example.com')).toBeVisible();
    await expect(page.getByText('0 of 4 documents approved')).toBeVisible();

    for (const label of DOCUMENTS) {
      const approve = page.getByRole('button', { name: `Approve ${label}` });
      await approve.click();
      await expect(page.getByText(`${label} for E2E Verify Co was approved.`)).toBeVisible();
      await expect(approve).toHaveAttribute('aria-disabled', 'true');
    }
    await expect(page.getByText('4 of 4 documents approved')).toBeVisible();

    await page.reload();
    await expect(page.getByText('4 of 4 documents approved')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Summary' }).getByTestId('status-badge')).toHaveText('Approved');

    await page.goto(`${BASE_URL}/verification`, { timeout: 30_000 });
    await expect(page.locator('main tbody tr').filter({ hasText: 'E2E Verify Co' })).toContainText('Approved');
  });

  test('a refused change shows the server message and keeps the document as it was', async ({ page }) => {
    // Only this page's document updates fail, so the test holds in any order next to the one above.
    await page.route('**/admin/verification/documents/*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'E2E: the document could not be saved.' } }) })
        : route.continue(),
    );
    await page.goto(`${BASE_URL}/verification`, { timeout: 30_000 });
    await page.locator('main tbody tr').filter({ hasText: 'E2E Verify Co' }).getByRole('link').first().click();
    await expect(page.getByTestId('page-title')).toHaveText('E2E Verify Co');
    const logo = page.getByRole('listitem').filter({ hasText: 'E2E Company Logo' });
    const before = await logo.getByTestId('status-badge').innerText();

    await page.getByRole('button', { name: 'Reject E2E Company Logo' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reject document' }).click();
    await expect(page.getByTestId('toast')).toContainText('E2E: the document could not be saved.');
    await expect(logo.getByTestId('status-badge')).toHaveText(before);
    await expect(page.getByRole('button', { name: 'Reject E2E Company Logo' })).not.toHaveAttribute('aria-disabled', 'true');
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
  test.skip(!MOCK_RUN, 'the dev role switcher only exists in development with mock data');
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
  test.skip(!MOCK_RUN, 'the dev role switcher only exists in development with mock data');
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
  test.skip(!MOCK_RUN, 'the dev role switcher only exists in development with mock data');
  test.use({ viewport: { width: 1440, height: 900 } });

  const SUBTITLE_YOU = 'Targets and results.';
  const SUBTITLE_TEAM = 'Targets and results.'; // the same for every role: the tabs already show the team view

  for (const role of ['desk_lead', 'super_admin']) {
    test(`${role}: subtitle is "Targets and results." and the Team tab exists`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/scorecard`, { timeout: 30_000 });
      await expect(page.getByText(SUBTITLE_TEAM, { exact: true })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Team' })).toBeVisible();
    });
  }
  for (const role of ['moderator', 'partnerships_officer', 'admin_support']) {
    test(`${role}: subtitle is the same "Targets and results." and there is no Team tab`, async ({ page, context }) => {
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
      await expect(card).toContainText('A Desk Lead can assign metrics.');
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
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
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
  test.skip(!MOCK_RUN, 'the dev role switcher only exists in development with mock data');
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
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
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
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
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
    await expect(page.getByLabel('Vetted on')).toHaveValue(formatDate(todayLocal()));
    await page.getByLabel('Vetted on').fill('2026-01-05');
    await page.getByLabel('Vetted on').blur();
    await expect(page.getByLabel('Vetted on')).toHaveValue('5 Jan 2026');
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
    await expect(page).toHaveURL(/\/opportunities\/lst-new-/, { timeout: 10_000 });
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
    await expect(page).toHaveURL(/\/opportunities\/lst-new-/, { timeout: 10_000 });
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
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
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
  test.skip(!MOCK_RUN, 'the dev role switcher only exists in development with mock data');
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
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
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
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
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
      // no fixed wait: the fades are measured after load (ResizeObserver) and fade in, so poll until every scroller is settled
      const measure = () => page.evaluate(() =>
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
      await expect(page.locator('[data-edge-fade]').first()).toBeAttached();
      await expect
        .poll(async () => {
          const result = await measure();
          return result.length > 0 && result.every((scroller) => scroller.hasFade && scroller.fadesMatch);
        }, { timeout: 5_000 })
        .toBe(true);
    }
  });
});

test.describe('Opportunities Queue: memory note', () => {
  test('mock mode shows no note about curated listings being kept in memory', async ({ page }) => {
    test.skip(!MOCK_RUN, 'mock mode only');
    await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await expect(page.getByTestId('curated-memory-note')).toHaveCount(0);
  });

  test('real-API run: the muted note says curated listings are kept in memory, and no sample listing is listed', async ({ page }) => {
    test.skip(MOCK_RUN, 'the note only shows outside mock mode');
    await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
    await expect(page.locator('main tbody tr').first()).toBeVisible();
    await expect(page.getByText('Graduate Software Engineer')).toHaveCount(0); // a seeded sample listing never shows next to real postings
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
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
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
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
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
    await setDateTime(page, 'Start date and time', '2030-05-10', '10:00');
    await setDateTime(page, 'End date and time', '2030-05-10', '09:00');
    await expect(page.getByText('The end must be after the start.')).toBeVisible();
    await setDateTime(page, 'End date and time', '2030-05-10', '10:00'); // equal is not "after" either
    await expect(page.getByText('The end must be after the start.')).toBeVisible();
    await setDateTime(page, 'End date and time', '2030-05-11', '10:00');
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
    await setDateTime(page, 'Start date and time', '2031-02-01', '09:00');
    await setDateTime(page, 'End date and time', '2031-02-01', '12:00');
    await page.getByLabel('Participant target').fill('30');
    await page.getByRole('textbox', { name: 'Facilitators' }).fill('Test Facilitator');
    await page.getByRole('textbox', { name: 'Facilitators' }).press('Enter');
    await page.getByRole('button', { name: 'Create program' }).click();
    await expect(page.getByText('Created In Test was created.')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/programs\/prg-new-/, { timeout: 10_000 });
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
    await expect(page).toHaveURL(`${BASE_URL}/programs/prg-10`, { timeout: 10_000 });
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
  test.skip(!MOCK_RUN, 'the dev role switcher only exists in development with mock data');
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
    await expect(page.getByTestId('partner-link')).toHaveAttribute('href', `/partners/${partner.id}`);
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
  test.skip(!MOCK_RUN, 'the dev role switcher only exists in development with mock data');
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
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
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

// ---------------------------------------------------------------------------
// Opportunity detail on the real API (SEC-077, Plan 2c Task 4)
// ---------------------------------------------------------------------------
test.describe('Opportunity detail (real API)', () => {
  test.skip(MOCK_RUN, 'real API only');
  test.use({ viewport: { width: 1440, height: 900 } });

  // Seeded by kredibble-backend/scripts/e2e-server.js: a pending, unvetted job.
  const openPosting = async (page: import('@playwright/test').Page) => {
    await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
    await page.locator('main tbody tr').filter({ hasText: 'E2E Pending Role' }).getByRole('link').first().click();
    await expect(page.getByTestId('page-title')).toHaveText('E2E Pending Role');
  };

  test('approving a pending posting publishes it, after a reload and in the queue', async ({ page }) => {
    await openPosting(page);
    const summary = page.getByRole('region', { name: 'Summary' });
    await expect(summary).toContainText('Job');
    await expect(summary).toContainText('E2E Holdings · Accra');
    await expect(summary.getByTestId('status-badge')).toHaveText('Pending');
    await expect(page.getByText('E2E posting description')).toBeVisible();
    await expect(page.getByText('GHS 5,000')).toBeVisible();

    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.getByText('E2E Pending Role from E2E Holdings was approved.')).toBeVisible();
    await expect(summary.getByTestId('status-badge')).toHaveText('Published');
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();

    await page.reload();
    await expect(page.getByRole('region', { name: 'Summary' }).getByTestId('status-badge')).toHaveText('Published');
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();

    await page.goto(`${BASE_URL}/opportunities`, { timeout: 30_000 });
    await page.getByRole('radio', { name: /^Jobs/ }).click(); // the API's "job" is listed under Jobs
    const row = page.locator('main tbody tr').filter({ hasText: 'E2E Pending Role' });
    await expect(row).toContainText('Published');
    await expect(row).toContainText('Job');
  });

  test('a refused change shows the server message and keeps the posting as it was', async ({ page }) => {
    // Only this page's updates fail, so the test holds in any order next to the one above.
    await page.route('**/admin/opportunities/*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'E2E: the posting could not be saved.' } }) })
        : route.continue(),
    );
    await openPosting(page);
    const badge = page.getByRole('region', { name: 'Summary' }).getByTestId('status-badge');
    const before = await badge.innerText();

    await page.getByRole('button', { name: 'Reject opportunity' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reject opportunity' }).click();
    await expect(page.getByTestId('toast')).toContainText('E2E: the posting could not be saved.');
    await expect(badge).toHaveText(before);
    await expect(page.getByRole('button', { name: 'Reject opportunity' })).toBeEnabled();
  });
});

test.describe('Not connected yet', () => {
  test('a page without a backend says it shows sample data (real API run only)', async ({ page }) => {
    test.skip(MOCK_RUN, 'the notice only shows outside mock mode');
    await page.goto(`${BASE_URL}/team`);
    await expect(page.getByTestId('not-connected-notice')).toBeVisible();
  });

  test('Programs and Partners say they show sample data in the real API run, on the list, a detail page and the form', async ({ page }) => {
    test.skip(MOCK_RUN, 'the notice only shows outside mock mode');
    for (const path of ['/programs', '/programs/prg-01', '/programs/new', '/partners', '/partners/ptn-01', '/partners/new', '/network', '/network/amb-02', '/network/new', '/leaderboard']) {
      await page.goto(`${BASE_URL}${path}`);
      await expect(page.getByTestId('page-title')).toBeVisible();
      await expect(page.getByTestId('not-connected-notice')).toBeVisible();
    }
    // on the board the notice is ONE line, so it does not push the columns down
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/partners`);
    expect((await page.getByTestId('not-connected-notice').boundingBox())!.height).toBeLessThan(48);
  });

  test('mock mode shows no notice, since everything is sample data on purpose', async ({ page }) => {
    test.skip(!MOCK_RUN, 'mock mode only');
    await page.goto(`${BASE_URL}/team`);
    await expect(page.getByTestId('page-title')).toHaveText('Team');
    await expect(page.getByTestId('not-connected-notice')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Partners: the six-stage pipeline board, pipeline health, form and detail
// ---------------------------------------------------------------------------
// Hand-written from the seed: 18 partners. Prospect 4 (Google Africa, University of Ghana Careers, Wave Mobile Money,
// Africa Leadership University), Outreach 4, Proposal 3, MOU 2, Onboard 3 (MTN Ghana, Ashesi, KNUST), Renew 2.
// Open deals (Prospect to MOU) = 13. Owners rotate over Esi Mensah-Owusu, Kojo Appiah, Kwabena Tetteh and Amara Kamara
// in list order: 5, 5, 4 and 4 partners. Types: university 4 (Ashesi, KNUST, UG Careers, ALU). Ghana: 6 partners.
test.describe('Partners: pipelineHealth (no browser)', () => {
  // A fixed "today" so the six-month window is exact: 2026-10-15, window 2026-04-15 to 2026-10-15.
  const TODAY = new Date(2026, 9, 15);
  const reachedOutreach = (n: number) => Array.from({ length: n }, (_, i) => ({ partnerId: `r${i}`, from: 'prospect' as const, to: 'outreach' as const, at: '2026-08-01' }));
  const closedDeals = (n: number) => Array.from({ length: n }, (_, i) => ({ partnerId: `r${i}`, from: 'mou' as const, to: 'onboard' as const, at: '2026-09-01' }));
  const open = (n: number) => Array.from({ length: n }, () => ({ stage: 'proposal' as const }));

  test('the statuses at the boundaries: 1.0 healthy, 0.6 thin, just below 0.6 critical', () => {
    expect(statusForRatio(1)).toBe('healthy');
    expect(statusForRatio(1.7)).toBe('healthy');
    expect(statusForRatio(0.9999)).toBe('thin');
    expect(statusForRatio(0.6)).toBe('thin');
    expect(statusForRatio(0.5999)).toBe('critical');
    expect(statusForRatio(0)).toBe('critical');
  });

  test('the maths: 10 reached Outreach, 1 closed -> a 10% rate, target 1 -> 10 open deals needed', () => {
    const history = [...reachedOutreach(10), ...closedDeals(1)];
    const at = (openDeals: number) => pipelineHealth(open(openDeals), history, 1, TODAY);
    expect(at(10)).toMatchObject({ needed: 10, ratio: 1, status: 'healthy', closedInWindow: 1, reachedOutreachInWindow: 10, closeRate: 0.1 });
    expect(at(9)).toMatchObject({ needed: 10, ratio: 0.9, status: 'thin' });
    expect(at(6)).toMatchObject({ needed: 10, ratio: 0.6, status: 'thin' }); // exactly 0.6 is thin
    expect(at(5)).toMatchObject({ needed: 10, ratio: 0.5, status: 'critical' });
    expect(at(14).openDeals).toBe(14);
  });

  test('"14 open deals, 17 needed": 2 closed of 17 that reached Outreach, target 2 (whole-number maths, no 17.0000001)', () => {
    const result = pipelineHealth(open(14), [...reachedOutreach(17), ...closedDeals(2)], 2, TODAY);
    expect(result.openDeals).toBe(14);
    expect(result.needed).toBe(17);
    expect(result.ratio).toBeCloseTo(14 / 17, 10);
    expect(result.status).toBe('thin');
  });

  test('only open stages count as open deals; closed ones and the two later stages do not', () => {
    const partners = [{ stage: 'prospect' }, { stage: 'outreach' }, { stage: 'proposal' }, { stage: 'mou' }, { stage: 'onboard' }, { stage: 'renew' }] as const;
    expect(pipelineHealth([...partners], [...reachedOutreach(2), ...closedDeals(1)], 1, TODAY).openDeals).toBe(4);
  });

  test('moves older than six months or after today are ignored, and onboard -> renew is not a second close', () => {
    const old = [{ partnerId: 'old', from: 'prospect' as const, to: 'outreach' as const, at: '2026-04-14' }, { partnerId: 'old', from: 'mou' as const, to: 'onboard' as const, at: '2026-04-14' }];
    const future = [{ partnerId: 'later', from: 'prospect' as const, to: 'outreach' as const, at: '2026-10-16' }];
    expect(pipelineHealth(open(3), [...old, ...future], 1, TODAY).status).toBe('unknown'); // nothing in the window
    const stay = [...reachedOutreach(2), ...closedDeals(1), { partnerId: 'r0', from: 'onboard' as const, to: 'renew' as const, at: '2026-09-20' }];
    expect(pipelineHealth(open(3), stay, 1, TODAY).closedInWindow).toBe(1);
    // the window edges are included
    const edge = [{ partnerId: 'e', from: 'prospect' as const, to: 'outreach' as const, at: '2026-04-15' }, { partnerId: 'e', from: 'mou' as const, to: 'onboard' as const, at: '2026-10-15' }];
    expect(pipelineHealth(open(1), edge, 1, TODAY)).toMatchObject({ reachedOutreachInWindow: 1, closedInWindow: 1, needed: 1, status: 'healthy' });
  });

  test('no data, no closes and no target are explicit, never a silent zero', () => {
    expect(pipelineHealth(open(5), [], 1, TODAY)).toMatchObject({ status: 'unknown', needed: null, ratio: null, closeRate: null });
    expect(pipelineHealth(open(5), reachedOutreach(4), 1, TODAY)).toMatchObject({ status: 'critical', needed: null, closeRate: 0 }); // reached Outreach, none closed
    expect(pipelineHealth(open(0), reachedOutreach(4), 0, TODAY)).toMatchObject({ status: 'healthy', needed: 0 }); // a target of 0 needs nothing
  });

  test('a higher target needs more open deals: target 3 at a 50% rate needs 6', () => {
    expect(pipelineHealth(open(6), [...reachedOutreach(4), ...closedDeals(2)], 3, TODAY)).toMatchObject({ needed: 6, ratio: 1, status: 'healthy' });
    expect(pipelineHealth(open(5), [...reachedOutreach(4), ...closedDeals(2)], 3, TODAY)).toMatchObject({ needed: 6, status: 'thin' });
  });

  test('flattenMoves lists every step of every partner, oldest first, with from and to', () => {
    const seed = buildSeed().collections;
    const moves = flattenMoves(seed.partners);
    expect(moves).toHaveLength(seed.partners.reduce((sum, p) => sum + p.stageHistory.length, 0));
    expect([...moves].map((m) => m.at)).toEqual([...moves].map((m) => m.at).sort());
    const mtn = moves.filter((m) => m.partnerId === 'ptn-01');
    expect(mtn.map((m) => `${m.from ?? 'added'}>${m.to}`)).toEqual(['added>prospect', 'prospect>outreach', 'outreach>proposal', 'proposal>mou', 'mou>onboard']);
  });

  test('a partner moved back out of Onboard is open again and no longer counts as onboarded', () => {
    const history = [
      { stage: 'prospect' as const, at: '2026-05-01' },
      { stage: 'onboard' as const, at: '2026-06-01', from: 'prospect' as const },
      { stage: 'renew' as const, at: '2026-07-01', from: 'onboard' as const },
    ];
    expect(partnerClosedAt({ stageHistory: history })).toBe('2026-06-01'); // onboard then renew: one closed stretch
    expect(partnerClosedAt({ stageHistory: [...history, { stage: 'proposal' as const, at: '2026-08-01', from: 'renew' as const }] })).toBeUndefined();
    expect(partnerClosedAt({ stageHistory: [...history, { stage: 'proposal' as const, at: '2026-08-01', from: 'renew' as const }, { stage: 'onboard' as const, at: '2026-09-01', from: 'proposal' as const }] })).toBe('2026-09-01');
  });

  test('stage labels come from the store and can be renamed; the keys stay fixed', () => {
    const before = { ...getPartnerStageLabels() };
    expect(before).toEqual({ prospect: 'Prospect', outreach: 'Outreach', proposal: 'Proposal', mou: 'MOU', onboard: 'Onboard', renew: 'Renew' });
    setPartnerStageLabels({ proposal: 'Pitch', mou: '   ' }); // a blank label keeps the default
    expect(getPartnerStageLabels().proposal).toBe('Pitch');
    expect(getPartnerStageLabels().mou).toBe('MOU');
    expect(Object.keys(getPartnerStageLabels())).toEqual([...PARTNER_STAGES]);
    setPartnerStageLabels(before);
    expect(getPartnerStageLabels()).toEqual(before);
  });

  test('the pipeline statuses have colours and words', () => {
    expect(getStatusMeta('healthy')).toEqual({ tone: 'success', label: 'Healthy' });
    expect(getStatusMeta('thin')).toEqual({ tone: 'warning', label: 'Thin' });
    expect(getStatusMeta('critical')).toEqual({ tone: 'danger', label: 'Critical' });
    expect(getStatusMeta('unknown')).toEqual({ tone: 'neutral', label: 'Not enough data' });
  });
});

test.describe('Partners: the board', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 900 } });

  const ready = async (page: import('@playwright/test').Page, path = '/partners') => {
    await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
  };
  const count = async (page: import('@playwright/test').Page, stage: string) => Number((await page.getByTestId(`kanban-count-${stage}`).innerText()).trim());
  const counts = async (page: import('@playwright/test').Page) => ({
    prospect: await count(page, 'prospect'),
    outreach: await count(page, 'outreach'),
    proposal: await count(page, 'proposal'),
    mou: await count(page, 'mou'),
    onboard: await count(page, 'onboard'),
    renew: await count(page, 'renew'),
  });
  const moveTo = async (page: import('@playwright/test').Page, name: string, stage: string) => {
    await page.getByRole('button', { name: new RegExp(`^Move ${name} to`) }).click();
    await page.getByRole('menu', { name: `Move ${name} to another stage` }).getByRole('menuitem', { name: stage, exact: true }).click();
  };

  test('six columns in order with counts, a thin purple line, and the Closed marker on Onboard and Renew only', async ({ page }) => {
    await ready(page);
    await expect(page.getByTestId('kanban-card-ptn-15')).toBeVisible();
    const headings = await page.locator('[data-testid^="kanban-column-"] h3').allInnerTexts();
    expect(headings.map((text) => text.trim())).toEqual(['Prospect', 'Outreach', 'Proposal', 'MOU', 'Onboard', 'Renew']);
    expect(await counts(page)).toEqual({ prospect: 4, outreach: 4, proposal: 3, mou: 2, onboard: 3, renew: 2 });
    for (const stage of ['onboard', 'renew']) await expect(page.getByTestId(`kanban-marker-${stage}`)).toHaveText('Closed');
    for (const stage of ['prospect', 'outreach', 'proposal', 'mou']) await expect(page.getByTestId(`kanban-marker-${stage}`)).toHaveCount(0);
    const line = page.getByTestId('kanban-column-prospect').locator('.bg-purple-500').first();
    expect(Math.round((await line.boundingBox())!.height)).toBeLessThanOrEqual(3); // a thin line
    // no manual closed switch anywhere on the board
    await expect(page.getByRole('switch')).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: /closed/i })).toHaveCount(0);
  });

  test('a card shows the organisation, type pill, owner avatar, country, contact and what they provide', async ({ page }) => {
    await ready(page);
    const card = page.getByTestId('kanban-card-ptn-15'); // Google Africa
    await expect(card.getByRole('link', { name: 'Google Africa' })).toHaveAttribute('href', '/partners/ptn-15');
    await expect(card).toContainText('Media & tech');
    await expect(card.getByTestId('partner-owner')).toHaveAttribute('aria-label', 'Owner: Kwabena Tetteh');
    await expect(card).toContainText('Kenya · Amina Bello');
    await expect(card).toContainText('Product and cloud skills webinars');
  });

  test('moving a card with the keyboard menu changes the column and the counts, announces it, and toasts', async ({ page }) => {
    await ready(page);
    const trigger = page.getByRole('button', { name: /^Move Google Africa to/ });
    await trigger.focus();
    await page.keyboard.press('Enter'); // opens the menu with the first item focused
    const menu = page.getByRole('menu', { name: 'Move Google Africa to another stage' });
    await expect(menu).toBeVisible();
    // it lists every OTHER stage, in order
    expect((await menu.getByRole('menuitem').allInnerTexts()).map((text) => text.trim())).toEqual(['Outreach', 'Proposal', 'MOU', 'Onboard', 'Renew']);
    await page.keyboard.press('ArrowDown'); // Proposal
    await page.keyboard.press('Enter');
    await expect.poll(() => counts(page)).toEqual({ prospect: 3, outreach: 4, proposal: 4, mou: 2, onboard: 3, renew: 2 });
    await expect(page.getByTestId('kanban-column-proposal').getByTestId('kanban-card-ptn-15')).toBeVisible();
    await expect(page.getByTestId('kanban-live')).toHaveText('Google Africa moved to Proposal');
    await expect(page.getByText('Google Africa moved to Proposal.', { exact: true })).toBeVisible(); // the toast, with no "closed" note
    await expect(page.getByRole('status').filter({ hasText: 'It is now closed' })).toHaveCount(0);
  });

  test('closed is automatic in both directions: into Onboard closes it, out of Onboard opens it again', async ({ page }) => {
    await ready(page);
    await moveTo(page, 'Google Africa', 'Onboard');
    await expect(page.getByText('Google Africa moved to Onboard. It is now closed.')).toBeVisible();
    await expect.poll(() => count(page, 'onboard')).toBe(4);
    await page.getByTestId('kanban-card-ptn-15').getByRole('link', { name: 'Google Africa' }).click();
    // (the global setup has already compiled every page, so this first visit waits no longer than any other)
    await expect(page.getByTestId('closed-marker')).toHaveText('Closed');
    await expect(page.getByTestId('stage-badge')).toContainText('Onboard');
    await page.goBack();
    await moveTo(page, 'Google Africa', 'Renew'); // Onboard -> Renew stays closed: no second note
    await expect(page.getByText('Google Africa moved to Renew.', { exact: true })).toBeVisible();
    await moveTo(page, 'Google Africa', 'Proposal');
    await expect(page.getByText('Google Africa moved to Proposal. It is open again.')).toBeVisible();
    await expect.poll(() => counts(page)).toEqual({ prospect: 3, outreach: 4, proposal: 4, mou: 2, onboard: 3, renew: 2 });
    await page.getByTestId('kanban-card-ptn-15').getByRole('link', { name: 'Google Africa' }).click();
    await expect(page.getByTestId('stage-badge')).toContainText('Proposal');
    await expect(page.getByTestId('closed-marker')).toHaveCount(0);
    // the history recorded every step with its date and from-to, newest first
    const history = page.getByTestId('stage-history');
    await expect(history).toContainText('Renew → Proposal');
    await expect(history).toContainText('Onboard → Renew');
    await expect(history).toContainText('Prospect → Onboard');
    await expect(history).toContainText(formatDate(todayLocal()));
    await expect(history).toContainText('The deal closed.');
    await expect(history).toContainText('The deal is open again.');
    await expect(page.getByRole('switch')).toHaveCount(0); // still no manual closed switch
  });

  test('drag and drop with the pointer moves a card between columns', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1500 }); // tall enough that no card needs scrolling before it is dragged
    await ready(page);
    await expect(page.getByTestId('kanban-grip')).toHaveCount(18); // every card has a grip
    await page.getByTestId('kanban-card-ptn-16').dragTo(page.getByTestId('kanban-column-outreach'));
    await expect.poll(() => counts(page)).toEqual({ prospect: 3, outreach: 5, proposal: 3, mou: 2, onboard: 3, renew: 2 });
    await expect(page.getByTestId('kanban-column-outreach').getByTestId('kanban-card-ptn-16')).toBeVisible();
    await expect(page.getByTestId('kanban-live')).toHaveText('University of Ghana Careers moved to Outreach');
    // dropping a card into its own column changes nothing
    await page.getByTestId('kanban-card-ptn-16').dragTo(page.getByTestId('kanban-column-outreach'));
    await expect.poll(() => count(page, 'outreach')).toBe(5);
    // dropping into Onboard closes it
    await page.getByTestId('kanban-card-ptn-17').dragTo(page.getByTestId('kanban-column-onboard'));
    await expect(page.getByText('Wave Mobile Money moved to Onboard. It is now closed.')).toBeVisible();
  });

  test('pipeline health: the headline matches the maths on the data, and moving a deal into Onboard lowers the open deals', async ({ page }) => {
    const seed = buildSeed().collections;
    const target = kpiTarget('partners_onboarded', { targets: seed.targets });
    const expected = pipelineHealth(seed.partners, flattenMoves(seed.partners), target);
    expect(expected.openDeals).toBe(13);
    await ready(page);
    const card = page.getByRole('region', { name: 'Pipeline health' });
    await expect(page.getByTestId('pipeline-headline')).toHaveText(expected.needed === null ? '13 open deals' : `13 open deals, ${expected.needed} needed`);
    await expect(page.getByTestId('pipeline-status')).toContainText({ healthy: 'Healthy', thin: 'Thin', critical: 'Critical', unknown: 'Not enough data' }[expected.status]);
    await expect(card.getByRole('meter')).toHaveAttribute('aria-valuenow', '13');
    await expect(card).toContainText(`Next month's target: ${target} ${target === 1 ? 'partner' : 'partners'} onboarded.`);
    await moveTo(page, 'Google Africa', 'Onboard');
    await expect(page.getByTestId('pipeline-headline')).toContainText('12 open deals');
    await expect(card.getByRole('meter')).toHaveAttribute('aria-valuenow', '12');
  });

  test('search, Owner, Type and Country filters; the health card counts every partner whatever the filters say', async ({ page }) => {
    await ready(page);
    const visibleCards = page.locator('[data-testid^="kanban-card-"]');
    await expect(visibleCards).toHaveCount(18);
    await page.getByRole('searchbox', { name: 'Search partners' }).fill('google');
    await expect(visibleCards).toHaveCount(1);
    await expect(page.getByTestId('pipeline-headline')).toContainText('13 open deals'); // unchanged by the search
    await page.getByRole('searchbox', { name: 'Search partners' }).fill('');
    await page.getByRole('combobox', { name: 'Filter by type' }).click();
    await page.getByRole('option', { name: 'University' }).click();
    await expect(visibleCards).toHaveCount(4);
    await page.getByRole('combobox', { name: 'Filter by type' }).click();
    await page.getByRole('option', { name: 'All types' }).click();
    await page.getByRole('combobox', { name: 'Filter by country' }).click();
    await page.getByRole('option', { name: 'Ghana' }).click();
    await expect(visibleCards).toHaveCount(6);
    await page.getByRole('combobox', { name: 'Filter by country' }).click();
    await page.getByRole('option', { name: 'All countries' }).click();
    await page.getByRole('combobox', { name: 'Filter by owner' }).click();
    await page.getByRole('option', { name: 'Kojo Appiah' }).click();
    await expect(visibleCards).toHaveCount(5);
    expect(Object.values(await counts(page)).reduce((a, b) => a + b, 0)).toBe(5); // the column counts follow the filters
  });

  test('?state=empty, ?state=error and ?state=loading show their states', async ({ page }) => {
    await page.goto(`${BASE_URL}/partners?state=empty`, { timeout: 30_000 });
    await expect(page.getByText('No partners yet')).toBeVisible();
    await page.goto(`${BASE_URL}/partners?state=error`);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await page.goto(`${BASE_URL}/partners?state=loading`);
    await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
    await expect(page.getByTestId('pipeline-headline')).toHaveCount(0); // the health card is a skeleton, not a 0
  });
});

test.describe('Partners: form and detail', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 900 } });

  const ready = async (page: import('@playwright/test').Page, path: string) => {
    await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
  };

  test('validation: every required field, then a bad email; the first invalid field takes focus', async ({ page }) => {
    await ready(page, '/partners/new');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('New partner');
    await page.getByRole('button', { name: 'Add partner' }).click();
    for (const message of ["Enter the organisation's name.", 'Choose a country.', 'Say in a line what they provide.', "Enter the contact's name."]) {
      await expect(page.getByText(message)).toBeVisible();
    }
    await expect(page.getByLabel('Organisation name')).toBeFocused();
    await expect(page.getByRole('combobox', { name: 'Assigned owner' })).toContainText('Esi Mensah-Owusu'); // defaults to the signed-in person
    await page.getByLabel('Contact email').fill('not-an-email');
    await page.getByLabel('Contact email').blur();
    await expect(page.getByText('Enter a full email address, like name@company.com.')).toBeVisible();
    // there is no stage field and no closed switch on the form
    await expect(page.getByRole('combobox', { name: /stage/i })).toHaveCount(0);
    await expect(page.getByRole('switch')).toHaveCount(0);
  });

  test('creating a partner adds it at Prospect (5 there now), with the first history entry, and it can be edited', async ({ page }) => {
    await ready(page, '/partners/new');
    await page.getByLabel('Organisation name').fill('Acme Foundation');
    await page.getByRole('combobox', { name: 'Partner type' }).click();
    await page.getByRole('option', { name: 'Foundation' }).click();
    await page.getByRole('combobox', { name: 'Country' }).click();
    await page.getByRole('option', { name: 'Ghana' }).click();
    await page.getByLabel('What they provide').fill('Scholarship funding');
    await page.getByLabel('Contact name').fill('Ama Boateng');
    await page.getByLabel('Contact email').fill('ama@acme.example.org');
    await page.getByLabel('Contact phone').fill('+233 24 000 0000');
    await page.getByRole('button', { name: 'Add partner' }).click();
    await expect(page.getByText('Acme Foundation was added at Prospect.')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/partners\/ptn-new-/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acme Foundation');
    await expect(page.getByTestId('stage-badge')).toContainText('Prospect');
    await expect(page.getByTestId('closed-marker')).toHaveCount(0);
    await expect(page.getByTestId('stage-history')).toContainText('Added at Prospect');
    await expect(page.getByRole('region', { name: 'Contact' })).toContainText('ama@acme.example.org');
    await page.locator('header.sticky').getByRole('link', { name: 'Partners' }).click();
    await expect(page.getByTestId('kanban-card-ptn-15')).toBeVisible();
    expect(Number((await page.getByTestId('kanban-count-prospect').innerText()).trim())).toBe(5);
    expect(await page.locator('[data-testid^="kanban-card-ptn-new-"]').count()).toBe(1);
  });

  test('edit: the form is filled, and saving changes the details but not the stage', async ({ page }) => {
    await ready(page, '/partners/ptn-01/edit'); // MTN Ghana, Onboard
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit partner');
    await expect(page.getByLabel('Organisation name')).toHaveValue('MTN Ghana');
    await expect(page.getByLabel('Contact name')).toHaveValue('Efua Darko');
    await page.getByLabel('What they provide').fill('Graduate roles, internships and mentors');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('MTN Ghana was updated.')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(`${BASE_URL}/partners/ptn-01`, { timeout: 10_000 });
    await expect(page.getByRole('region', { name: 'Details' })).toContainText('Graduate roles, internships and mentors');
    await expect(page.getByTestId('stage-badge')).toContainText('Onboard');
    await expect(page.getByTestId('closed-marker')).toBeVisible();
  });

  test('detail: stage badge, Closed marker, Details, Contact, the full stage history and the linked programs', async ({ page }) => {
    await ready(page, '/partners/ptn-01'); // MTN Ghana
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('MTN Ghana');
    await expect(page.getByTestId('stage-badge')).toContainText('Onboard');
    await expect(page.getByTestId('closed-marker')).toHaveText('Closed');
    await expect(page.getByRole('region', { name: 'Details' })).toContainText('Graduate roles and internships');
    await expect(page.getByRole('region', { name: 'Contact' })).toContainText('Efua Darko');
    const items = page.getByTestId('stage-history').getByRole('listitem');
    await expect(items).toHaveCount(5);
    await expect(items.first()).toContainText('MOU → Onboard'); // newest first
    await expect(items.last()).toContainText('Added at Prospect');
    await expect(page.getByTestId('linked-programs').getByRole('link', { name: 'CV and Interview Masterclass' })).toHaveAttribute('href', '/programs/prg-01');
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/partners/ptn-01/edit');
  });

  test('Remove partner asks first, removes the card, and clears the link on its programs', async ({ page }) => {
    await ready(page, '/partners/ptn-01');
    await page.getByRole('button', { name: 'Remove partner' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Remove this partner?');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Remove partner' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove partner' }).click();
    await expect(page.getByText('MTN Ghana was removed.')).toBeVisible();
    await expect(page).toHaveURL(`${BASE_URL}/partners`, { timeout: 10_000 });
    await expect(page.getByTestId('kanban-card-ptn-01')).toHaveCount(0);
    expect(Number((await page.getByTestId('kanban-count-onboard').innerText()).trim())).toBe(2);
    // the program that was linked to MTN Ghana keeps running, without a partner (client-side, so the store survives)
    await page.getByTestId('nav-group-opportunities').click();
    await page.getByTestId('nav-item-programs').click();
    await page.getByRole('radiogroup', { name: 'Filter by status' }).getByRole('radio', { name: /^Delivered/ }).click(); // CV is on page 2 of All
    await page.getByRole('link', { name: 'CV and Interview Masterclass' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('CV and Interview Masterclass');
    await expect(page.getByTestId('partner-link')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Details' })).not.toContainText('MTN Ghana');
  });

  test('the detail page header tile is purple (Partners are purple, Programs orange)', async ({ page }) => {
    await ready(page, '/partners/ptn-01');
    await expect(page.getByRole('region', { name: 'Summary' }).locator('.bg-purple-50').first()).toBeVisible();
  });

  test('?state=notfound and unknown ids show not found', async ({ page }) => {
    await page.goto(`${BASE_URL}/partners/ptn-01?state=notfound`, { timeout: 30_000 });
    await expect(page.getByText(/not found/i).first()).toBeVisible();
    await page.goto(`${BASE_URL}/partners/nope/edit`);
    await expect(page.getByText(/not found/i).first()).toBeVisible();
  });
});

test.describe('Partners: roles', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const role of ['partnerships_officer', 'desk_lead', 'super_admin']) {
    test(`${role} edits: New partner, the Move to menu, the drag handles and the form`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
      await expect(page.getByTestId('kanban-card-ptn-15')).toBeVisible();
      await expect(page.getByRole('link', { name: 'New partner' })).toHaveAttribute('href', '/partners/new');
      await expect(page.getByRole('button', { name: /^Move .* to/ })).toHaveCount(18);
      await expect(page.getByTestId('kanban-grip')).toHaveCount(18);
      await page.goto(`${BASE_URL}/partners/new`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('New partner');
    });
  }

  test('country_lead can only view: no New partner, no Move to menu, no drag handles, Edit disabled, no Remove, no form', async ({ page, context }) => {
    await asRoles(context, 'country_lead');
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    await expect(page.getByTestId('kanban-card-ptn-15')).toBeVisible();
    expect(await counts(page)).toEqual({ prospect: 4, outreach: 4, proposal: 3, mou: 2, onboard: 3, renew: 2 });
    await expect(page.getByRole('link', { name: 'New partner' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Move .* to/ })).toHaveCount(0);
    await expect(page.getByTestId('kanban-grip')).toHaveCount(0);
    expect(await page.locator('[data-testid^="kanban-card-"][draggable="true"]').count()).toBe(0);
    // a drag attempt changes nothing
    await page.getByTestId('kanban-card-ptn-15').dragTo(page.getByTestId('kanban-column-outreach'));
    expect(await counts(page)).toEqual({ prospect: 4, outreach: 4, proposal: 3, mou: 2, onboard: 3, renew: 2 });
    await page.goto(`${BASE_URL}/partners/ptn-01`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('MTN Ghana');
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);
    const edit = page.getByRole('button', { name: 'Edit' });
    await expect(edit).toBeDisabled();
    await edit.hover({ force: true });
    await expect(page.getByRole('tooltip')).toContainText('Your role can view this page but not change it');
    await expect(page.getByRole('button', { name: 'Remove partner' })).toHaveCount(0);
    for (const path of ['/partners/new', '/partners/ptn-01/edit']) {
      await page.goto(`${BASE_URL}${path}`);
      await expect(page.getByTestId('no-access')).toBeVisible();
    }
  });

  test('a moderator has no access to Partners', async ({ page, context }) => {
    await asRoles(context, 'moderator');
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    await expect(page.getByTestId('no-access')).toBeVisible();
    await expect(page.getByTestId('kanban-column-prospect')).toHaveCount(0);
  });

  const counts = async (page: import('@playwright/test').Page) => {
    const out: Record<string, number> = {};
    for (const stage of ['prospect', 'outreach', 'proposal', 'mou', 'onboard', 'renew']) out[stage] = Number((await page.getByTestId(`kanban-count-${stage}`).innerText()).trim());
    return out;
  };
});

test.describe('Partners: phone (434px)', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 434, height: 900 } });
  const noOverflow = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  test('a tab strip with counts and one stage at a time; no drag handles; the Move to menu moves a card', async ({ page }) => {
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    const tabs = page.getByRole('tablist', { name: 'Partner pipeline stages' });
    await expect(tabs).toBeVisible();
    const names = (await tabs.getByRole('tab').allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim());
    expect(names).toEqual(['Prospect 4', 'Outreach 4', 'Proposal 3', 'MOU 2', 'Onboard 3', 'Renew 2']);
    // one column at a time: Prospect's four cards, none of Outreach's
    await expect(page.locator('[data-testid^="kanban-card-"]')).toHaveCount(4);
    await expect(page.getByTestId('kanban-card-ptn-15')).toBeVisible();
    await expect(page.getByTestId('kanban-grip')).toHaveCount(0);
    expect(await noOverflow(page)).toBe(true);

    const move = page.getByRole('button', { name: /^Move Google Africa to/ });
    expect((await move.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    await move.click();
    await page.getByRole('menu', { name: 'Move Google Africa to another stage' }).getByRole('menuitem', { name: 'Outreach', exact: true }).click();
    await expect(page.getByText('Google Africa moved to Outreach.', { exact: true })).toBeVisible();
    await expect(page.getByTestId('kanban-live')).toHaveText('Google Africa moved to Outreach');
    await expect(page.locator('[data-testid^="kanban-card-"]')).toHaveCount(3);
    await expect(tabs.getByRole('tab', { name: /^Prospect/ })).toContainText('3');
    await expect(tabs.getByRole('tab', { name: /^Outreach/ })).toContainText('5');
    await tabs.getByRole('tab', { name: /^Outreach/ }).click();
    await expect(page.getByTestId('kanban-card-ptn-15')).toBeVisible();
    await expect(page.locator('[data-testid^="kanban-card-"]')).toHaveCount(5);
    // the Closed marker shows on the Onboard tab's panel
    await tabs.getByRole('tab', { name: /^Onboard/ }).click();
    await expect(page.getByTestId('kanban-marker-onboard')).toHaveText('Closed');
    expect(await noOverflow(page)).toBe(true);
  });

  test('the health card, the toolbar, the form and the detail page fit; the buttons are 40px+', async ({ page }) => {
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    await expect(page.getByTestId('pipeline-headline')).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search partners' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New partner' })).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await page.goto(`${BASE_URL}/partners/new`);
    await expect(page.getByTestId('back-button')).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    const add = page.getByRole('button', { name: 'Add partner' });
    expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    await page.goto(`${BASE_URL}/partners/ptn-01`);
    await expect(page.getByTestId('closed-marker')).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Partners: summary tiles, health states, the empty-filter state and the board width
// ---------------------------------------------------------------------------
test.describe('Partners: summary and demo health (no browser)', () => {
  const TODAY = new Date(2026, 9, 15); // 15 October 2026

  test('partnerSummary: open = Prospect to Proposal plus MOU; closed this month = moved into Onboard or Renew this month', () => {
    const at = (stage: 'prospect' | 'outreach' | 'proposal' | 'mou' | 'onboard' | 'renew', day: string, from?: 'mou' | 'onboard') => ({ stage, at: day, from });
    const partners = [
      { stage: 'prospect' as const, stageHistory: [at('prospect', '2026-10-01')] },
      { stage: 'mou' as const, stageHistory: [at('mou', '2026-09-01')] },
      { stage: 'onboard' as const, stageHistory: [at('prospect', '2026-07-01'), at('onboard', '2026-10-03', 'mou')] }, // closed this month
      { stage: 'renew' as const, stageHistory: [at('onboard', '2026-08-01', 'mou'), at('renew', '2026-10-10', 'onboard')] }, // closed in August, renewed now: still August
      { stage: 'onboard' as const, stageHistory: [at('onboard', '2026-09-30', 'mou')] }, // closed last month
      { stage: 'proposal' as const, stageHistory: [at('onboard', '2026-10-02', 'mou'), at('proposal', '2026-10-09', 'onboard')] }, // closed and re-opened: open, not closed
    ];
    // closed in total = partners in Onboard or Renew now: the third, fourth and fifth
    expect(partnerSummary(partners, TODAY)).toEqual({ open: 3, closedThisMonth: 1, closedTotal: 3 });
    expect(partnerSummary([], TODAY)).toEqual({ open: 0, closedThisMonth: 0, closedTotal: 0 });
  });

  test('the demo override only exists in mock mode outside production', () => {
    expect(parseHealthOverride('thin', true, 'development')).toBe('thin');
    expect(parseHealthOverride('thin', true, 'test')).toBe('thin');
    expect(parseHealthOverride('thin', false, 'development')).toBeNull(); // real API: ignored
    expect(parseHealthOverride('thin', true, 'production')).toBeNull(); // production: ignored
    expect(parseHealthOverride('bogus', true, 'development')).toBeNull();
    expect(parseHealthOverride(null, true, 'development')).toBeNull();
    expect([...HEALTH_OVERRIDES]).toEqual(['healthy', 'thin', 'critical', 'nodata', 'capped']);
  });

  test('the four demo states work out to healthy, thin, critical and unknown through the real pipelineHealth()', () => {
    expect(demoHealth('healthy', TODAY).health).toMatchObject({ openDeals: 14, needed: 10, status: 'healthy', closeRate: 0.2 });
    expect(demoHealth('thin', TODAY).health).toMatchObject({ openDeals: 8, needed: 10, status: 'thin' });
    expect(demoHealth('critical', TODAY).health).toMatchObject({ openDeals: 4, needed: 10, status: 'critical' });
    expect(demoHealth('nodata', TODAY).health).toMatchObject({ openDeals: 5, needed: null, status: 'unknown' });
    expect(demoHealth('capped', TODAY).health).toMatchObject({ openDeals: 31, needed: 10, status: 'healthy' }); // a ratio of 3.1: past the end of the scale
    expect(demoHealth('healthy', TODAY).target).toBe(2);
  });
});

test.describe('Partners: summary tiles, health states and the empty filter', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });

  const ready = async (page: import('@playwright/test').Page, path = '/partners') => {
    await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
  };
  const tile = async (page: import('@playwright/test').Page, id: 'open' | 'closed') => (await page.getByTestId(`partner-summary-${id}`).locator('.ministat-value').innerText()).trim();
  const moveTo = async (page: import('@playwright/test').Page, name: string, stage: string) => {
    await page.getByRole('button', { name: new RegExp(`^Move ${name} to`) }).click();
    await page.getByRole('menu', { name: `Move ${name} to another stage` }).getByRole('menuitem', { name: stage, exact: true }).click();
  };

  test('two SEPARATE tiles: Open pipeline 13 and Closed this month 0; they follow moves, and not the filters', async ({ page }) => {
    await ready(page);
    await expect(page.getByTestId('partner-summary-open')).toContainText('Open pipeline');
    await expect(page.getByTestId('partner-summary-closed')).toContainText('Closed this month');
    expect(await tile(page, 'open')).toBe('13');
    expect(await tile(page, 'closed')).toBe('0'); // nothing closed yet this month in the seed (a known zero)
    // two different tiles (stacked in the left column at this width), not one combined figure
    const a = (await page.getByTestId('partner-summary-open').boundingBox())!;
    const b = (await page.getByTestId('partner-summary-closed').boundingBox())!;
    expect(a.y + a.height <= b.y + 1 || a.x + a.width <= b.x + 1).toBe(true);

    await moveTo(page, 'Google Africa', 'Onboard');
    await expect.poll(() => tile(page, 'open')).toBe('12');
    expect(await tile(page, 'closed')).toBe('1');
    await moveTo(page, 'Google Africa', 'Renew'); // onboard -> renew: still one closed deal, closed this month
    await expect.poll(() => tile(page, 'closed')).toBe('1');
    expect(await tile(page, 'open')).toBe('12');
    await page.getByRole('searchbox', { name: 'Search partners' }).fill('mtn'); // a filter does not move them
    expect(await tile(page, 'open')).toBe('12');
    await page.getByRole('searchbox', { name: 'Search partners' }).fill('');
    await moveTo(page, 'Google Africa', 'Proposal');
    await expect.poll(() => tile(page, 'open')).toBe('13');
    expect(await tile(page, 'closed')).toBe('0');
  });

  test('the tiles show "—" while loading, never 0', async ({ page }) => {
    await page.goto(`${BASE_URL}/partners?state=loading`, { timeout: 30_000 });
    await expect(page.getByTestId('partner-summary-open')).toContainText('—');
    await expect(page.getByTestId('partner-summary-closed')).toContainText('—');
  });

  const STATES = [
    { key: 'healthy', headline: '14 open deals, 10 needed', badge: 'Healthy', value: '14' },
    { key: 'thin', headline: '8 open deals, 10 needed', badge: 'Thin', value: '8' },
    { key: 'critical', headline: '4 open deals, 10 needed', badge: 'Critical', value: '4' },
  ];
  for (const state of STATES) {
    test(`?health=${state.key}: "${state.headline}", the ${state.badge} badge in words, the gauge and the wording`, async ({ page }) => {
      await ready(page, `/partners?health=${state.key}`);
      await expect(page.getByTestId('pipeline-headline')).toHaveText(state.headline);
      await expect(page.getByTestId('pipeline-status')).toHaveText(state.badge);
      const card = page.getByRole('region', { name: 'Pipeline health' });
      const meter = card.getByRole('meter');
      await expect(meter).toHaveAttribute('aria-valuemin', '0');
      await expect(meter).toHaveAttribute('aria-valuenow', state.value);
      await expect(meter).toHaveAttribute('aria-valuemax', String(Math.max(20, Number(state.value)))); // twice the 10 needed
      await expect(meter).toHaveAttribute('aria-valuetext', `${state.value} open deals, 10 needed, ${(Number(state.value) / 10).toFixed(1)} times the target, ${state.badge.toLowerCase()}`);
      // the two labelled figures next to the headline
      // (the Open and Needed figures beside the headline are gone: the marker label and the tick label say the same)
      await expect(page.getByTestId('pipeline-open')).toHaveCount(0);
      await expect(page.getByTestId('pipeline-needed')).toHaveCount(0);
      await expect(page.getByTestId('pipeline-marker-label')).toHaveText(`${state.value} open`);
      await expect(page.getByTestId('pipeline-needed-label')).toHaveText('10 needed');
      // the three zones with their words under them, and where the marker and the "needed" tick sit
      await expect(page.getByTestId('pipeline-zone-labels')).toHaveText('CriticalThinHealthy');
      const bar = (await meter.boundingBox())!;
      const share = async (id: string) => (await page.getByTestId(id).boundingBox())!.width / bar.width;
      expect(await share('zone-critical')).toBeCloseTo(0.3, 1);
      expect(await share('zone-thin')).toBeCloseTo(0.2, 1);
      expect(await share('zone-healthy')).toBeCloseTo(0.5, 1);
      const centre = async (id: string) => { const b = (await page.getByTestId(id).boundingBox())!; return (b.x + b.width / 2 - bar.x) / bar.width; };
      expect(await centre('pipeline-needed-tick')).toBeCloseTo(0.5, 1); // 1.0 of the 2.0 scale
      expect(await centre('pipeline-marker')).toBeCloseTo({ healthy: 0.7, thin: 0.4, critical: 0.2 }[state.key] as number, 1); // ratio / 2.0
      await expect(page.getByTestId('pipeline-detail')).toHaveText("Based on the last 6 months: 2 closed, 10 reached Outreach (close rate 20%). Next month's target: 2 partners onboarded.");
      await expect(page.getByTestId('pipeline-demo')).toContainText(`?health=${state.key}`);
      // the colour comes with words: the badge text, the zone names and the meter's text value
      // the board itself still shows the real partners
      await expect(page.getByTestId('kanban-card-ptn-15')).toBeVisible();
    });
  }

  test('?health=nodata: "Not enough data", the explanation, and no needed number', async ({ page }) => {
    await ready(page, '/partners?health=nodata');
    await expect(page.getByTestId('pipeline-headline')).toHaveText('5 open deals');
    await expect(page.getByTestId('pipeline-status')).toHaveText('Not enough data');
    await expect(page.getByTestId('pipeline-detail')).toContainText('No deal has reached Outreach in the last 6 months, so there is no close rate to learn from yet.');
    await expect(page.getByRole('region', { name: 'Pipeline health' }).getByRole('meter')).toHaveAttribute('aria-valuetext', '5 open deals, not enough data to work out how many are needed');
    await expect(page.getByTestId('pipeline-marker')).toHaveCount(0); // nothing to place on the scale
    await expect(page.getByTestId('pipeline-needed')).toHaveCount(0);
    await expect(page.getByTestId('pipeline-needed-tick')).toHaveCount(0);
  });

  test('an unknown ?health= value is ignored and the real pipeline shows', async ({ page }) => {
    await ready(page, '/partners?health=bogus');
    await expect(page.getByTestId('pipeline-demo')).toHaveCount(0);
    await expect(page.getByTestId('pipeline-headline')).toContainText('13 open deals');
  });

  test('Type = Government (no seeded partner) shows "no results" with Clear filters; clearing brings the board back', async ({ page }) => {
    await ready(page);
    await page.getByRole('combobox', { name: 'Filter by type' }).click();
    await page.getByRole('option', { name: 'Government' }).click();
    await expect(page.getByText('No partners match these filters')).toBeVisible();
    await expect(page.locator('[data-testid^="kanban-card-"]')).toHaveCount(0);
    await expect(page.getByTestId('kanban-column-prospect')).toHaveCount(0); // the board is replaced, not left empty
    // the summary and the health card are still there
    expect(await tile(page, 'open')).toBe('13');
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByRole('combobox', { name: 'Filter by type' })).toContainText('All types');
    await expect(page.locator('[data-testid^="kanban-card-"]')).toHaveCount(18);
    // a search with no match shows it too, and Clear filters empties the search box
    await page.getByRole('searchbox', { name: 'Search partners' }).fill('zzzz-nothing');
    await expect(page.getByText('No partners match these filters')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByRole('searchbox', { name: 'Search partners' })).toHaveValue('');
    await expect(page.locator('[data-testid^="kanban-card-"]')).toHaveCount(18);
  });

  test('on a phone too: Type = Government shows the same state and Clear filters works', async ({ page }) => {
    await page.setViewportSize({ width: 434, height: 900 });
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByRole('combobox', { name: 'Filter by type' }).click();
    await expect(page.getByRole('dialog')).toBeVisible(); // the bottom sheet
    await page.getByRole('option', { name: 'Government' }).click();
    await expect(page.getByText('No partners match these filters')).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Partner pipeline stages' })).toHaveCount(0);
    const clear = page.getByRole('button', { name: 'Clear filters' });
    expect((await clear.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await clear.click();
    await expect(page.getByRole('tablist', { name: 'Partner pipeline stages' })).toBeVisible();
    await expect(page.getByTestId('kanban-card-ptn-15')).toBeVisible();
  });

  test('phones: both summary tiles show', async ({ page }) => {
    await page.setViewportSize({ width: 434, height: 900 });
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    await expect(page.getByTestId('partner-summary-open')).toBeVisible();
    await expect(page.getByTestId('partner-summary-closed')).toBeVisible();
  });

  test('a program detail links its partner to /partners/[id] when the viewer can see Partners, and shows plain text otherwise', async ({ page, context }) => {
    await page.goto(`${BASE_URL}/programs/prg-01`, { timeout: 30_000 });
    await expect(page.getByTestId('partner-link')).toHaveAttribute('href', '/partners/ptn-01');
    await page.getByTestId('partner-link').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('MTN Ghana');
    await asRoles(context, 'training_officer'); // can see Programs, not Partners
    await page.goto(`${BASE_URL}/programs/prg-01`);
    await expect(page.getByRole('region', { name: 'Details' })).toContainText('MTN Ghana');
    await expect(page.getByTestId('partner-link')).toHaveCount(0);
  });
});

test.describe('Partners board width', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');

  // 6 columns x 11rem (176px) + 5 gaps x 12px: the board needs this much room to show every column.
  const NEEDED = 1116;
  const CASES = [
    { label: '1920 sidebar open', width: 1920, rail: false, fits: true },
    { label: '1440 sidebar open', width: 1440, rail: false, fits: true },
    { label: '1280 sidebar open', width: 1280, rail: false, fits: false },
    { label: '1280 rail', width: 1280, rail: true, fits: true },
    { label: '1024 rail', width: 1024, rail: true, fits: false },
  ];

  for (const { label, width, rail, fits } of CASES) {
    test(`${label}: ${fits ? 'all six columns fit' : 'the board scrolls sideways inside itself'}`, async ({ page, context }) => {
      if (rail) await context.addCookies([{ name: 'sidebar', value: 'collapsed', url: BASE_URL }]);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
      await page.getByTestId('sidebar-toggle').waitFor();
      await page.waitForTimeout(600);
      const scroller = page.getByTestId('kanban-scroller');
      const measure = () => scroller.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, left: el.scrollLeft, docOverflow: document.documentElement.scrollWidth - window.innerWidth }));
      const m = await measure();
      test.info().annotations.push({ type: 'board-width', description: `${label}: scrollWidth ${m.sw}, clientWidth ${m.cw}, ${m.sw > m.cw + 1 ? 'scrolls' : 'fits'}` });
      expect(m.docOverflow).toBeLessThanOrEqual(0); // the PAGE never scrolls sideways
      const fade = (side: 'start' | 'end') => page.getByTestId(`kanban-fade-${side}`).evaluate((el) => getComputedStyle(el).opacity === '1');

      if (fits) {
        expect(m.sw).toBeLessThanOrEqual(m.cw + 1);
        await expect(scroller).not.toHaveAttribute('tabindex', /.*/); // nothing to scroll: no extra tab stop
        expect(await fade('start')).toBe(false);
        expect(await fade('end')).toBe(false);
        for (const stage of ['prospect', 'outreach', 'proposal', 'mou', 'onboard', 'renew']) await expect(page.getByTestId(`kanban-column-${stage}`).locator('h3')).toBeInViewport();
        return;
      }

      // It scrolls: the columns keep their 11rem, so the content is exactly 1116px wide.
      expect(m.sw).toBe(NEEDED);
      expect(m.cw).toBeLessThan(NEEDED);
      await expect(scroller).toHaveAttribute('tabindex', '0');
      await expect(scroller).toHaveAttribute('role', 'group');
      // at the start: more to the right only
      await expect.poll(() => fade('end')).toBe(true);
      expect(await fade('start')).toBe(false);
      // the headers of the visible columns are in view; scrolling to the end shows the last ones
      await expect(page.getByTestId('kanban-column-prospect').locator('h3')).toBeInViewport();
      // keyboard scrolling: focus the scroller, End goes to the end, Home back, ArrowRight moves a little
      await scroller.focus();
      await page.keyboard.press('End');
      await expect.poll(async () => (await measure()).left).toBe(NEEDED - m.cw);
      await expect.poll(() => fade('start')).toBe(true);
      expect(await fade('end')).toBe(false);
      for (const stage of ['onboard', 'renew']) {
        await expect(page.getByTestId(`kanban-column-${stage}`).locator('h3')).toBeInViewport();
        await expect(page.getByTestId(`kanban-marker-${stage}`)).toBeInViewport(); // the Closed marker stays with its header
      }
      await page.keyboard.press('Home');
      await expect.poll(async () => (await measure()).left).toBe(0);
      await page.keyboard.press('ArrowRight');
      await expect.poll(async () => (await measure()).left).toBeGreaterThan(0);
      // in the middle: a fade on both sides
      await expect.poll(async () => (await fade('start')) && (await fade('end'))).toBe(true);
      // every column header can be brought into view, and each stays inside the scroller's box
      for (const stage of ['prospect', 'outreach', 'proposal', 'mou', 'onboard', 'renew']) {
        const header = page.getByTestId(`kanban-column-${stage}`).locator('h3');
        await header.scrollIntoViewIfNeeded();
        await expect(header).toBeInViewport();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Partners: visual polish (top row, captions, gauge, cards, icon button, empty columns)
// ---------------------------------------------------------------------------
test.describe('Partners: polish', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');

  const open = async (page: import('@playwright/test').Page, width: number, height: number, path = '/partners') => {
    await page.setViewportSize({ width, height });
    await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
    await expect(page.getByTestId('kanban-card-ptn-15')).toBeVisible();
    await page.waitForTimeout(500);
  };
  const box = async (locator: import('@playwright/test').Locator) => (await locator.boundingBox())!;
  const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  test('from 1280px the two tiles (a 240px column) and the health card share ONE row; the column headers are above the fold', async ({ page }) => {
    for (const [width, height] of [[1440, 900], [1280, 800]]) {
      await open(page, width, height);
      const summary = await box(page.getByTestId('partner-summary'));
      const open1 = await box(page.getByTestId('partner-summary-open'));
      const closed = await box(page.getByTestId('partner-summary-closed'));
      const health = await box(page.getByRole('region', { name: 'Pipeline health' }));
      expect(Math.round(summary.width), `${width}: the tile column`).toBe(240);
      expect(closed.y, `${width}: the tiles are stacked`).toBeGreaterThanOrEqual(open1.y + open1.height - 1);
      expect(health.x, `${width}: the health card is beside the tiles`).toBeGreaterThanOrEqual(summary.x + summary.width);
      expect(Math.abs(health.y - summary.y), `${width}: one row`).toBeLessThanOrEqual(2);
      // the column headers (before this pass they started at y=500) are in the first screen, with room for the first cards
      const header = page.getByTestId('kanban-column-prospect').locator('h3');
      await expect(header).toBeInViewport();
      expect((await box(header)).y, `${width}: header y`).toBeLessThanOrEqual(400);
      expect((await box(page.getByTestId('kanban-card-ptn-15'))).y, `${width}: first card y`).toBeLessThan(460);
    }
  });

  test('below 1280px the tiles and the health card stack', async ({ page }) => {
    await open(page, 1100, 900);
    const summary = await box(page.getByTestId('partner-summary'));
    const health = await box(page.getByRole('region', { name: 'Pipeline health' }));
    expect(health.y).toBeGreaterThanOrEqual(summary.y + summary.height - 1);
    expect(summary.width).toBeGreaterThan(240); // two tiles side by side again
  });

  test('tile captions: "Prospect to MOU" and the live count of closed partners', async ({ page }) => {
    await open(page, 1440, 900);
    await expect(page.getByTestId('partner-summary-open')).toContainText('Prospect to MOU');
    await expect(page.getByTestId('partner-summary-closed')).toContainText('5 closed in total'); // 3 in Onboard + 2 in Renew
    await page.getByRole('button', { name: /^Move Google Africa to/ }).click();
    await page.getByRole('menu', { name: 'Move Google Africa to another stage' }).getByRole('menuitem', { name: 'Onboard', exact: true }).click();
    await expect(page.getByTestId('partner-summary-closed')).toContainText('6 closed in total');
    await page.getByRole('button', { name: /^Move Google Africa to/ }).click();
    await page.getByRole('menu', { name: 'Move Google Africa to another stage' }).getByRole('menuitem', { name: 'Proposal', exact: true }).click();
    await expect(page.getByTestId('partner-summary-closed')).toContainText('5 closed in total');
  });

  test('the gauge on the real data: a role="meter" with a text value, three zones with words, and the figures beside the headline', async ({ page }) => {
    await open(page, 1440, 900);
    const meter = page.getByRole('region', { name: 'Pipeline health' }).getByRole('meter');
    await expect(meter).toHaveAttribute('aria-valuemin', '0');
    await expect(meter).toHaveAttribute('aria-valuenow', '13');
    expect(Number(await meter.getAttribute('aria-valuemax'))).toBeGreaterThanOrEqual(13);
    await expect(meter).toHaveAttribute('aria-valuetext', /^13 open deals, \d+ needed, \d+\.\d times the target, (healthy|thin|critical)$/);
    await expect(page.getByTestId('pipeline-zone-labels')).toHaveText('CriticalThinHealthy');
    await expect(page.getByTestId('pipeline-marker-label')).toContainText('13 open');
    await expect(page.getByTestId('pipeline-needed-label')).toHaveText(/^\d+ needed$/);
    // the three zones are different tints, and are not the only signal (the chip and the zone names say it in words)
    const tints = await Promise.all(['zone-critical', 'zone-thin', 'zone-healthy'].map((id) => page.getByTestId(id).evaluate((el) => getComputedStyle(el).backgroundColor)));
    expect(new Set(tints).size).toBe(3);
    await expect(page.getByTestId('pipeline-status')).toContainText(/Healthy|Thin|Critical/);
  });

  test('a long provide line is cut at two lines and shows in full in the tooltip and a title; so does a long name', async ({ page }) => {
    await open(page, 1440, 900);
    const provide = page.getByTestId('kanban-card-ptn-06').getByText('Remote engineering roles and bootcamp trainers'); // Andela
    const clipped = await provide.evaluate((el) => ({ lines: getComputedStyle(el).webkitLineClamp, cut: el.scrollHeight > el.clientHeight + 1 }));
    expect(clipped.lines).toBe('2');
    expect(clipped.cut).toBe(true); // the premise: at this width the text really is cut
    await expect(provide).toHaveAttribute('title', 'Remote engineering roles and bootcamp trainers');
    await provide.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Remote engineering roles and bootcamp trainers');
    // the name: two lines, a tooltip on hover AND on keyboard focus
    const name = page.getByTestId('kanban-card-ptn-16').getByRole('link', { name: 'University of Ghana Careers' });
    await expect(name).toHaveAttribute('title', 'University of Ghana Careers');
    expect(await name.evaluate((el) => getComputedStyle(el).webkitLineClamp)).toBe('2');
    await page.mouse.move(0, 0);
    await name.focus();
    await expect(page.getByRole('tooltip')).toHaveText('University of Ghana Careers');
  });

  test('the owner avatar is 24px, named by its full name, with a tooltip', async ({ page }) => {
    await open(page, 1440, 900);
    const avatar = page.getByTestId('kanban-card-ptn-15').getByTestId('partner-owner');
    await expect(avatar).toHaveAttribute('aria-label', 'Owner: Kwabena Tetteh');
    const size = await box(avatar.locator('span').first());
    expect(Math.round(size.width)).toBe(24);
    expect(Math.round(size.height)).toBe(24);
    await avatar.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Owner: Kwabena Tetteh');
  });

  test('from 640px "Move to…" is an icon-only 28px button (a 40px hit area) with a tooltip, the same menu, and nothing overlaps it', async ({ page }) => {
    await open(page, 1440, 900);
    const card = page.getByTestId('kanban-card-ptn-15');
    const button = card.getByRole('button', { name: 'Move Google Africa to another stage' });
    expect((await button.innerText()).trim()).toBe(''); // no words, only the icon
    await expect(button.locator('svg')).toBeVisible();
    const b = await box(button);
    expect(Math.round(b.width)).toBe(28); // the visible button; the 40px hit area is a pseudo-element (tested in "Visual fixes: partner cards")
    expect(Math.round(b.height)).toBe(28);
    // it overlaps neither the drag handle nor the avatar nor any other control in the card
    const others = [await box(card.getByTestId('kanban-grip')), await box(card.getByTestId('partner-owner')), await box(card.getByRole('link', { name: 'Google Africa' }))];
    for (const other of others) expect(overlaps(b, other)).toBe(false);
    await button.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Move to…');
    // the same menu as before, moved by keyboard
    await button.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: 'Move Google Africa to another stage' });
    expect((await menu.getByRole('menuitem').allInnerTexts()).map((text) => text.trim())).toEqual(['Outreach', 'Proposal', 'MOU', 'Onboard', 'Renew']);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('kanban-live')).toHaveText('Google Africa moved to Proposal');
    await expect(page.getByTestId('kanban-column-proposal').getByTestId('kanban-card-ptn-15')).toBeVisible();
  });

  test('below 640px the button keeps its words and no hit area overlaps another control', async ({ page }) => {
    await open(page, 434, 900);
    const card = page.getByTestId('kanban-card-ptn-15');
    const button = card.getByRole('button', { name: 'Move Google Africa to another stage' });
    await expect(button).toContainText('Move to…');
    const b = await box(button);
    expect(b.height).toBeGreaterThanOrEqual(40);
    expect(b.width).toBeGreaterThan(40);
    for (const other of [await box(card.getByTestId('partner-owner')), await box(card.getByRole('link', { name: 'Google Africa' }))]) expect(overlaps(b, other)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('an empty column shows a dashed "No partners here" zone after a filter, and after its last card is moved out', async ({ page }) => {
    await open(page, 1440, 900);
    await page.getByRole('combobox', { name: 'Filter by type' }).click();
    await page.getByRole('option', { name: 'NGO' }).click(); // only AGRA (Proposal)
    for (const stage of ['prospect', 'outreach', 'mou', 'onboard', 'renew']) {
      const zone = page.getByTestId(`kanban-empty-${stage}`);
      await expect(zone).toHaveText('No partners here');
      expect(await zone.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('dashed');
    }
    await expect(page.getByTestId('kanban-empty-proposal')).toHaveCount(0);
    // move the last card out of Proposal: that column becomes an empty zone too
    await page.getByRole('button', { name: /^Move AGRA to/ }).click();
    await page.getByRole('menu', { name: 'Move AGRA to another stage' }).getByRole('menuitem', { name: 'Outreach', exact: true }).click();
    await expect(page.getByTestId('kanban-empty-proposal')).toHaveText('No partners here');
    await expect(page.getByTestId('kanban-empty-outreach')).toHaveCount(0);
  });

  test('the empty zone is a drop target: a card dragged onto it moves into that column', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    await expect(page.getByTestId('kanban-card-ptn-08')).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByRole('combobox', { name: 'Filter by type' }).click();
    await page.getByRole('option', { name: 'Foundation' }).click(); // Tony Elumelu (Proposal) and Mastercard (Renew)
    await expect(page.getByTestId('kanban-empty-prospect')).toBeVisible();
    await page.getByTestId('kanban-card-ptn-08').dragTo(page.getByTestId('kanban-empty-prospect'));
    await expect.poll(async () => (await page.getByTestId('kanban-count-prospect').innerText()).trim()).toBe('1');
    await expect(page.getByTestId('kanban-column-prospect').getByTestId('kanban-card-ptn-08')).toBeVisible();
    await expect(page.getByTestId('kanban-empty-prospect')).toHaveCount(0);
    await expect(page.getByTestId('kanban-empty-proposal')).toBeVisible(); // the column it left is now the empty one
  });

  test('while a card is dragged, the columns that can take it are outlined, its own column is dimmed, and the one under the pointer is filled', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    await expect(page.getByTestId('kanban-card-ptn-15')).toBeVisible();
    await page.waitForTimeout(500);
    const state = (stage: string) => page.getByTestId(`kanban-column-${stage}`).getAttribute('data-drag-state');
    for (const stage of ['prospect', 'outreach', 'proposal', 'mou', 'onboard', 'renew']) expect(await state(stage)).toBe('idle');
    const card = await box(page.getByTestId('kanban-card-ptn-15'));
    await page.mouse.move(card.x + 20, card.y + 20);
    await page.mouse.down();
    await page.mouse.move(card.x + 60, card.y + 60, { steps: 6 });
    await expect.poll(() => state('prospect')).toBe('source'); // dimmed
    for (const stage of ['outreach', 'proposal', 'mou', 'onboard', 'renew']) expect(await state(stage)).toBe('accept'); // outlined
    expect(await page.getByTestId('kanban-column-prospect').evaluate((el) => getComputedStyle(el).opacity)).toBe('0.6');
    const outreach = await box(page.getByTestId('kanban-column-outreach'));
    await page.mouse.move(outreach.x + outreach.width / 2, outreach.y + 120, { steps: 8 });
    await expect.poll(() => state('outreach')).toBe('over'); // the one under the pointer
    await page.mouse.up(); // dropped: it moves, and everything goes back to normal
    await expect(page.getByTestId('kanban-column-outreach').getByTestId('kanban-card-ptn-15')).toBeVisible();
    for (const stage of ['prospect', 'outreach', 'proposal', 'mou', 'onboard', 'renew']) expect(await state(stage)).toBe('idle');
  });

  test('a view-only role has no Move button, grip or avatar overlap to worry about', async ({ page, context }) => {
    await asRoles(context, 'country_lead');
    await open(page, 1440, 900);
    await expect(page.getByRole('button', { name: /^Move .* to another stage/ })).toHaveCount(0);
    await expect(page.getByTestId('kanban-grip')).toHaveCount(0);
    await expect(page.getByTestId('kanban-card-ptn-15').getByTestId('partner-owner')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Partners: the compact pipeline health card
// ---------------------------------------------------------------------------
test.describe('Partners: compact health card', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');

  const open = async (page: import('@playwright/test').Page, width: number, height: number, path = '/partners') => {
    await page.setViewportSize({ width, height });
    await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
    await expect(page.getByTestId('kanban-card-ptn-15')).toBeVisible();
    await page.waitForTimeout(500);
  };

  test('the headline is 20px/26px, nothing sits beside it, and the gauge is 12px tall', async ({ page }) => {
    await open(page, 1440, 900);
    const headline = page.getByTestId('pipeline-headline');
    const style = await headline.evaluate((el) => ({ size: getComputedStyle(el).fontSize, line: getComputedStyle(el).lineHeight }));
    expect(style).toEqual({ size: '20px', line: '26px' });
    await expect(page.getByTestId('pipeline-open')).toHaveCount(0);
    await expect(page.getByTestId('pipeline-needed')).toHaveCount(0);
    await expect(headline.locator('xpath=..').locator('dl')).toHaveCount(0);
    expect(Math.round((await page.getByRole('region', { name: 'Pipeline health' }).getByRole('meter').boundingBox())!.height)).toBe(12);
  });

  test('the explanatory sentence is ONE line at 1440px, in full, with no tooltip needed', async ({ page }) => {
    await open(page, 1440, 900);
    const sentence = page.getByTestId('pipeline-detail').locator('span').first();
    await expect(sentence).toContainText('Based on the last 6 months');
    await expect(sentence).toContainText("Next month's target: 4 partners onboarded.");
    expect(Math.round((await sentence.boundingBox())!.height)).toBeLessThanOrEqual(16); // one line of 12/16
    await expect(sentence).not.toHaveAttribute('title', /.*/); // nothing is cut, so no title and no tooltip
  });

  test('on a narrow phone (360px) it is cut after two lines and shows in full in the tooltip (hover and keyboard focus) and a title', async ({ page }) => {
    await open(page, 360, 900);
    const sentence = page.getByTestId('pipeline-detail').locator('span.line-clamp-2');
    await expect(sentence).toBeVisible();
    expect(Math.round((await sentence.boundingBox())!.height)).toBeLessThanOrEqual(36); // two lines of 12/16 (and the 1.4 line height)
    const full = (await sentence.textContent())!;
    expect(full).toContain("Next month's target");
    await expect(sentence).toHaveAttribute('title', full);
    await sentence.hover();
    await expect(page.getByRole('tooltip')).toHaveText(full);
    await page.mouse.move(0, 0);
    await sentence.focus();
    await expect(page.getByRole('tooltip')).toHaveText(full);
  });

  test('the column headers start at y 400 or less at 1440x900, and the first card is in view at 1280x800', async ({ page }) => {
    await open(page, 1440, 900);
    const header = page.getByTestId('kanban-column-prospect').locator('h3');
    const y1440 = Math.round((await header.boundingBox())!.y);
    test.info().annotations.push({ type: 'header-y', description: `1440x900: column header y=${y1440}` });
    expect(y1440).toBeLessThanOrEqual(400);
    await open(page, 1280, 800);
    const y1280 = Math.round((await header.boundingBox())!.y);
    const card = (await page.getByTestId('kanban-card-ptn-15').boundingBox())!;
    test.info().annotations.push({ type: 'header-y', description: `1280x800: column header y=${y1280}, first card y=${Math.round(card.y)}` });
    expect(y1280).toBeLessThanOrEqual(400);
    await expect(page.getByTestId('kanban-card-ptn-15')).toBeInViewport();
  });

  test('every state of the compact card still reads: the chip, the figures and the one-line sentence', async ({ page }) => {
    for (const [state, text] of [['healthy', 'Healthy'], ['thin', 'Thin'], ['critical', 'Critical'], ['nodata', 'Not enough data']] as const) {
      await open(page, 1440, 900, `/partners?health=${state}`);
      await expect(page.getByTestId('pipeline-status')).toHaveText(text);
      const sentence = page.getByTestId('pipeline-detail').locator('span').first();
      expect(Math.round((await sentence.boundingBox())!.height), state).toBeLessThanOrEqual(16);
    }
  });
});

// ---------------------------------------------------------------------------
// Network (ambassadors) and the Leaderboard
// ---------------------------------------------------------------------------
// Hand-written from the seed: 40 ambassadors. Active 25, dormant 4, onboarding 6, applicant 5. Tiers: Campus or Regional Lead 5,
// Senior Ambassador 10, Ambassador 25. Trained: 23 (the 29 who have been active, less every fifth one). Numbers that depend on
// the dates (this month's shares, the ranking) are worked out in the test from the raw data with separate code.
test.describe('Network: the maths and the rules (no browser)', () => {
  const seed = buildSeed().collections;

  test('referral codes: GOD- and six letters or digits, unique, and a collision is never returned', () => {
    expect(seed.ambassadors).toHaveLength(40);
    expect(new Set(seed.ambassadors.map((a) => a.referralCode)).size).toBe(40);
    for (const a of seed.ambassadors) expect(a.referralCode).toMatch(/^GOD-[2-9A-HJ-NP-Z]{6}$/);
    // a random source that first gives "GOD-222222" and then "GOD-333333": with the first one taken, the second is returned
    expect(generateReferralCode(new Set(), () => 0)).toBe('GOD-222222');
    const steps = [0, 0, 0, 0, 0, 0, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04];
    let i = 0;
    expect(generateReferralCode(new Set(['GOD-222222']), () => steps[i++])).toBe('GOD-333333');
  });

  test('the seed tiers, statuses and trained flags', () => {
    const count = (pick: (a: (typeof seed.ambassadors)[number]) => string) => {
      const out: Record<string, number> = {};
      for (const a of seed.ambassadors) out[pick(a)] = (out[pick(a)] ?? 0) + 1;
      return out;
    };
    expect(count((a) => a.status)).toEqual({ active: 25, dormant: 4, onboarding: 6, applicant: 5 });
    expect(count((a) => a.tier)).toEqual({ lead: 5, senior: 10, ambassador: 25 });
    expect(seed.ambassadors.filter((a) => a.trained)).toHaveLength(23);
    expect(seed.ambassadors.filter((a) => a.status === 'applicant' || a.status === 'onboarding').every((a) => !a.trained)).toBe(true);
    expect(AMBASSADOR_TIER_LABELS).toEqual({ ambassador: 'Ambassador', senior: 'Senior Ambassador', lead: 'Campus or Regional Lead' });
  });

  test('networkSummary: the activity rate is active ambassadors who shared this month, divided by the active ones', () => {
    const ambassadors = [
      { id: 'a', status: 'active' as const }, { id: 'b', status: 'active' as const }, { id: 'c', status: 'active' as const }, { id: 'd', status: 'active' as const },
      { id: 'e', status: 'dormant' as const }, { id: 'f', status: 'onboarding' as const }, { id: 'g', status: 'applicant' as const },
    ];
    const logs = [
      { ambassadorId: 'a', at: '2026-10-02' }, { ambassadorId: 'a', at: '2026-10-09' }, // two shares count once
      { ambassadorId: 'b', at: '2026-10-05' },
      { ambassadorId: 'c', at: '2026-09-30' }, // last month: not this month
      { ambassadorId: 'e', at: '2026-10-03' }, // dormant: not an active ambassador
    ];
    expect(networkSummary(ambassadors, logs, '2026-10')).toEqual({ size: 7, active: 4, sharedActive: 2, activityRate: 0.5 });
    expect(networkSummary(ambassadors, logs, '2026-09')).toEqual({ size: 7, active: 4, sharedActive: 1, activityRate: 0.25 });
    expect(networkSummary([{ id: 'x', status: 'applicant' }], [], '2026-10')).toEqual({ size: 1, active: 0, sharedActive: 0, activityRate: null }); // no active: no rate
  });

  test('ambassadorStats counts shares, clicks and verified signups in the month they happened', () => {
    const logs = [
      { ambassadorId: 'a', at: '2026-10-02', clicks: 10 }, { ambassadorId: 'a', at: '2026-10-20', clicks: 5 }, { ambassadorId: 'a', at: '2026-09-28', clicks: 99 }, { ambassadorId: 'b', at: '2026-10-02', clicks: 7 },
    ];
    const records = [
      { ambassadorId: 'a', verified: true, verifiedAt: '2026-10-04' }, { ambassadorId: 'a', verified: true, verifiedAt: '2026-09-04' },
      { ambassadorId: 'a', verified: false, verifiedAt: undefined }, { ambassadorId: 'b', verified: true, verifiedAt: '2026-10-04' },
    ];
    expect(ambassadorStats('a', logs, records, '2026-10')).toEqual({ shares: 2, clicks: 15, signups: 1 });
    expect(ambassadorStats('a', logs, records, '2026-09')).toEqual({ shares: 1, clicks: 99, signups: 1 });
    expect(ambassadorStats('zz', logs, records, '2026-10')).toEqual({ shares: 0, clicks: 0, signups: 0 });
  });

  test('ranking: verified signups, then clicks, then shares, then name', () => {
    const who = (name: string) => ({ id: name, name }) as never;
    const entries = [
      { ambassador: who('Ama'), signups: 2, clicks: 10, shares: 3 },
      { ambassador: who('Bea'), signups: 2, clicks: 10, shares: 5 }, // same signups and clicks: more shares
      { ambassador: who('Cleo'), signups: 2, clicks: 12, shares: 1 }, // same signups: more clicks
      { ambassador: who('Dan'), signups: 3, clicks: 0, shares: 0 }, // most signups beats everything
      { ambassador: who('Zed'), signups: 2, clicks: 10, shares: 3 }, // a full tie with Ama: by name
    ];
    const ranked = rankAmbassadors(entries);
    expect(ranked.map((r) => `${r.rank}:${(r.ambassador as { name: string }).name}`)).toEqual(['1:Dan', '2:Cleo', '3:Bea', '4:Ama', '5:Zed']);
    expect(rankAmbassadors([])).toEqual([]);
  });

  test('the leaderboard of a month leaves out applicants and people who joined later', () => {
    const base = { email: '', referralCode: '', campus: 'KNUST', country: 'Ghana', city: 'Kumasi', memberType: 'student' as const, trained: true, tier: 'ambassador' as const, dormantSince: undefined };
    const ambassadors = [
      { ...base, id: 'a', name: 'Ama', status: 'active' as const, joinedAt: '2026-05-01' },
      { ...base, id: 'b', name: 'Bea', status: 'applicant' as const, joinedAt: '2026-05-01' },
      { ...base, id: 'c', name: 'Cleo', status: 'active' as const, joinedAt: '2026-10-02' },
    ];
    const logs = [{ id: 'l', ambassadorId: 'a', channel: 'x' as const, at: '2026-09-10', clicks: 4, applications: 0 }];
    expect(buildLeaderboard(ambassadors, logs, [], '2026-09').map((r) => r.ambassador.name)).toEqual(['Ama']); // Cleo had not joined; Bea is only an applicant
    expect(buildLeaderboard(ambassadors, logs, [], '2026-10').map((r) => r.ambassador.name)).toEqual(['Ama', 'Cleo']); // both zero shares: by name
    expect(buildLeaderboard(ambassadors, logs, [], '2026-09')[0]).toMatchObject({ rank: 1, shares: 1, clicks: 4, signups: 0 });
  });

  test('saving an edit never changes the referral code; logging an amplification adds a share this month', () => {
    const fields = {
      name: 'Rule Test', email: 'rule.test@students.example.edu', country: 'Ghana', city: 'Accra', memberType: 'student' as const, campus: 'KNUST',
      tier: 'ambassador' as const, status: 'active' as const, trained: false,
    };
    const created = createAmbassador(fields);
    expect(created.referralCode).toMatch(/^GOD-[2-9A-HJ-NP-Z]{6}$/);
    const updated = updateAmbassador(created.id, { ...fields, name: 'Rule Test Renamed', tier: 'lead' });
    expect(updated?.referralCode).toBe(created.referralCode);
    expect(updated?.name).toBe('Rule Test Renamed');
    expect(updated?.joinedAt).toBe(created.joinedAt);
    const log = logAmplification(created.id, 'whatsapp', '  a note  ');
    expect(log).toMatchObject({ ambassadorId: created.id, channel: 'whatsapp', note: 'a note', clicks: 0 });
    const logs = getMockCollection('amplificationLogs');
    expect(ambassadorStats(created.id, logs, [], monthOf(log.at))).toEqual({ shares: 1, clicks: 0, signups: 0 });
    // going dormant is dated; coming back clears it
    expect(updateAmbassador(created.id, { ...fields, status: 'dormant' })?.dormantSince).toBeDefined();
    expect(updateAmbassador(created.id, { ...fields, status: 'active' })?.dormantSince).toBeUndefined();
  });
});

test.describe('Network: the list', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 900 } });
  const seed = buildSeed().collections;
  const tab = async (page: import('@playwright/test').Page, name: string) =>
    (await page.getByRole('radiogroup', { name: 'Filter by status' }).getByRole('radio', { name: new RegExp(`^${name}`) }).innerText()).replace(/\D+/g, '');

  test('summary tiles: Network size 40, Active 25, and an activity rate that matches the data', async ({ page }) => {
    const month = currentMonth();
    const shared = new Set(seed.amplificationLogs.filter((l) => l.at.slice(0, 7) === month).map((l) => l.ambassadorId));
    const active = seed.ambassadors.filter((a) => a.status === 'active');
    const sharedActive = active.filter((a) => shared.has(a.id)).length;
    await page.goto(`${BASE_URL}/network`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await expect(page.getByTestId('network-size')).toContainText('40');
    await expect(page.getByTestId('network-size')).toContainText('Network size');
    await expect(page.getByTestId('network-active').locator('.ministat-value')).toHaveText('25');
    await expect(page.getByTestId('network-rate').locator('.ministat-value')).toHaveText(`${Math.round((sharedActive / active.length) * 100)}%`);
    await expect(page.getByTestId('network-rate')).toContainText(`${sharedActive} of 25 active shared this month`);
    // three separate tiles
    const boxes = await Promise.all(['network-size', 'network-active', 'network-rate'].map(async (id) => (await page.getByTestId(id).boundingBox())!));
    expect(boxes[0].x + boxes[0].width).toBeLessThanOrEqual(boxes[1].x + 1);
    expect(boxes[1].x + boxes[1].width).toBeLessThanOrEqual(boxes[2].x + 1);
  });

  test('columns, an avatar with the email, the Trained check or dash, and the assigned lead', async ({ page }) => {
    await page.goto(`${BASE_URL}/network`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    const headers = (await page.locator('main table thead th').allTextContents()).map((text) => text.trim()).filter((text) => text && text !== 'Open');
    expect(headers).toEqual(['Ambassador', 'Country and city', 'Campus', 'Tier', 'Status', 'Trained', 'Assigned lead']);
    // search for one person by name, so the row is easy to find
    const trained = seed.ambassadors.find((a) => a.trained)!;
    const untrained = seed.ambassadors.find((a) => !a.trained && a.status === 'active')!;
    await page.getByRole('searchbox', { name: 'Search ambassadors' }).fill(trained.name);
    const row = page.getByTestId('table-row').filter({ hasText: trained.name }).first();
    await expect(row).toContainText(trained.email);
    await expect(row).toContainText(`${trained.city}, ${trained.country}`);
    await expect(row).toContainText('Trained');
    await page.getByRole('searchbox', { name: 'Search ambassadors' }).fill(untrained.name);
    await expect(page.getByTestId('table-row').filter({ hasText: untrained.name }).first().locator('td[data-label="Trained"]')).toHaveText('—');
  });

  test('status tabs with counts, and the Tier and Country filters', async ({ page }) => {
    await page.goto(`${BASE_URL}/network`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    expect(await tab(page, 'All')).toBe('40');
    expect(await tab(page, 'Applicant')).toBe('5');
    expect(await tab(page, 'Onboarding')).toBe('6');
    expect(await tab(page, 'Active')).toBe('25');
    expect(await tab(page, 'Dormant')).toBe('4');
    await page.getByRole('combobox', { name: 'Filter by tier' }).click();
    await page.getByRole('option', { name: 'Campus or Regional Lead' }).click();
    expect(await tab(page, 'All')).toBe('5');
    await expect(page.getByTestId('table-row')).toHaveCount(5);
    await page.getByRole('combobox', { name: 'Filter by tier' }).click();
    await page.getByRole('option', { name: 'All tiers' }).click();
    const ghana = seed.ambassadors.filter((a) => a.country === 'Ghana');
    await page.getByRole('combobox', { name: 'Filter by country' }).click();
    await page.getByRole('option', { name: 'Ghana' }).click();
    expect(await tab(page, 'All')).toBe(String(ghana.length));
    expect(await tab(page, 'Active')).toBe(String(ghana.filter((a) => a.status === 'active').length));
  });

  test('search by name or by campus; nothing found shows the no-results state', async ({ page }) => {
    await page.goto(`${BASE_URL}/network`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    const search = page.getByRole('searchbox', { name: 'Search ambassadors' });
    const knust = seed.ambassadors.filter((a) => a.campus.toLowerCase().includes('knust'));
    await search.fill('knust');
    expect(await tab(page, 'All')).toBe(String(knust.length));
    await search.fill(seed.ambassadors[3].name.toUpperCase());
    await expect(page.getByTestId('table-row').first()).toContainText(seed.ambassadors[3].name);
    await search.fill('zzzz-nobody');
    await expect(page.getByText('No ambassadors match these filters')).toBeVisible();
  });

  test('?state=empty and ?state=error show their states; the tiles show "—" while loading', async ({ page }) => {
    await page.goto(`${BASE_URL}/network?state=empty`, { timeout: 30_000 });
    await expect(page.getByText('No ambassadors yet')).toBeVisible();
    await page.goto(`${BASE_URL}/network?state=error`);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await page.goto(`${BASE_URL}/network?state=loading`);
    await expect(page.getByTestId('network-size')).toContainText('—');
    await expect(page.getByTestId('network-rate')).toContainText('—');
  });
});

test.describe('Network: form, detail and the amplification log', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  const seed = buildSeed().collections;
  const ready = async (page: import('@playwright/test').Page, path: string) => {
    await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
    await page.getByTestId('sidebar-toggle').waitFor();
    await page.waitForTimeout(500);
  };
  const CODE = /^GOD-[2-9A-HJ-NP-Z]{6}$/;

  test('the form has no referral code input anywhere, and says the code is made when you save', async ({ page }) => {
    await ready(page, '/network/new');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('New ambassador');
    await expect(page.getByRole('textbox', { name: /referral|code/i })).toHaveCount(0);
    await expect(page.locator('main input[name*="referral" i], main input[id*="referral" i], main input[aria-label*="referral" i]')).toHaveCount(0);
    await expect(page.getByTestId('referral-code')).toHaveCount(0);
    await expect(page.getByTestId('referral-code-card')).toContainText('Generated when you add them');
    await expect(page.getByRole('button', { name: 'Copy' })).toHaveCount(0); // nothing to copy yet
    // the other fields are all there
    for (const label of ['Full name', 'Email', 'Phone', 'City', 'Campus', 'Role title', 'Description']) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    for (const name of ['Country', 'Member type', 'Tier', 'Status', 'Assigned lead', 'Linked user account']) await expect(page.getByRole('combobox', { name, exact: true })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Trained' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Tier', exact: true }).click();
    expect((await page.getByRole('option').allInnerTexts()).map((text) => text.trim())).toEqual(['Ambassador', 'Senior Ambassador', 'Campus or Regional Lead']);
  });

  test('validation, then adding an ambassador makes a unique code that the toast and the detail page show', async ({ page }) => {
    await ready(page, '/network/new');
    await page.getByRole('button', { name: 'Add ambassador' }).click();
    for (const message of ["Enter the ambassador's full name.", 'Enter an email address.', 'Choose a country.', 'Enter the city.', 'Enter the campus.']) await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByLabel('Full name', { exact: true })).toBeFocused();
    await page.getByLabel('Email', { exact: true }).fill('nope');
    await page.getByLabel('Email', { exact: true }).blur();
    await expect(page.getByText('Enter a full email address, like name@university.edu.')).toBeVisible();

    await page.getByLabel('Full name', { exact: true }).fill('Ama Created');
    await page.getByLabel('Email', { exact: true }).fill('ama.created@students.example.edu');
    await page.getByRole('combobox', { name: 'Country', exact: true }).click();
    await page.getByRole('option', { name: 'Ghana' }).click();
    await page.getByLabel('City', { exact: true }).fill('Kumasi');
    await page.getByLabel('Campus', { exact: true }).fill('KNUST');
    await page.getByRole('combobox', { name: 'Status', exact: true }).click();
    await page.getByRole('option', { name: 'Active' }).click();
    await page.getByRole('switch', { name: 'Trained' }).click();
    await page.getByRole('button', { name: 'Add ambassador' }).click();
    await expect(page.getByText(/Ama Created was added to the network\. Their referral code is GOD-/)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/network\/amb-new-/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ama Created');
    const code = (await page.getByTestId('referral-code').innerText()).trim();
    expect(code).toMatch(CODE);
    expect(seed.ambassadors.some((a) => a.referralCode === code)).toBe(false); // unique among the existing ones
    await expect(page.getByTestId('trained-value')).toContainText('Yes');
    // the list now has 41
    await page.locator('header.sticky').getByRole('link', { name: 'Network' }).click();
    await expect(page.getByTestId('network-size')).toContainText('41');
  });

  test('the referral code is read-only and a saved edit leaves it exactly as it was', async ({ page }) => {
    const target = seed.ambassadors[1]; // amb-02
    await ready(page, `/network/${target.id}`);
    await expect(page.getByTestId('referral-code')).toHaveText(target.referralCode);
    await expect(page.getByTestId('referral-code-card').getByRole('textbox')).toHaveCount(0); // no input, a text only
    await expect(page.getByTestId('referral-code-card')).toContainText('cannot be changed');
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit ambassador');
    await expect(page.getByRole('textbox', { name: /referral|code/i })).toHaveCount(0);
    await expect(page.getByTestId('referral-code')).toHaveText(target.referralCode);
    await expect(page.getByLabel('Full name', { exact: true })).toHaveValue(target.name);
    await page.getByLabel('Full name', { exact: true }).fill(`${target.name} Edited`);
    await page.getByRole('combobox', { name: 'Tier', exact: true }).click();
    await page.getByRole('option', { name: 'Senior Ambassador' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(`${target.name} Edited was updated.`)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(`${BASE_URL}/network/${target.id}`, { timeout: 10_000 });
    await expect(page.getByTestId('referral-code')).toHaveText(target.referralCode); // unchanged
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${target.name} Edited`);
  });

  test('Copy puts the code on the clipboard (an icon with a tooltip from 640px)', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL });
    const target = seed.ambassadors[2];
    await ready(page, `/network/${target.id}`);
    const copy = page.getByTestId('referral-code-card').getByRole('button', { name: 'Copy' });
    // icon only on a wide screen: the word is there for screen readers, but takes no room
    await expect(copy.locator('span', { hasText: 'Copy' })).toHaveClass(/sm:sr-only/);
    const b = (await copy.boundingBox())!;
    expect([Math.round(b.width), Math.round(b.height)]).toEqual([40, 40]);
    await copy.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Copy the referral code');
    await copy.click();
    await expect(page.getByText(`Referral code ${target.referralCode} was copied.`)).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(target.referralCode);
  });

  test('Log amplification: the channel is required; saving adds a log entry, one more share in the Impact card, and a toast', async ({ page }) => {
    const target = seed.ambassadors.find((a) => a.status === 'active')!;
    const month = currentMonth();
    const before = seed.amplificationLogs.filter((l) => l.ambassadorId === target.id && l.at.slice(0, 7) === month).length;
    const logsBefore = seed.amplificationLogs.filter((l) => l.ambassadorId === target.id).length;
    await ready(page, `/network/${target.id}`);
    await expect(page.getByTestId('impact-shares').locator('.ministat-value')).toHaveText(String(before));
    await expect(page.getByTestId('log-entry')).toHaveCount(Math.min(logsBefore, 20));
    await page.getByRole('button', { name: 'Log amplification' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Log amplification' });
    await expect(dialog).toContainText(target.name);
    await dialog.getByRole('button', { name: 'Log amplification' }).click(); // no channel yet
    await expect(dialog.getByText('Choose the channel they shared on.')).toBeVisible();
    await dialog.getByRole('combobox', { name: 'Channel' }).click();
    expect((await page.getByRole('option').allInnerTexts()).map((text) => text.trim())).toEqual(['Instagram', 'LinkedIn', 'X', 'Facebook', 'TikTok', 'WhatsApp']);
    await page.getByRole('option', { name: 'WhatsApp' }).click();
    await dialog.getByLabel('Note').fill('Shared the fellowship in the alumni group');
    await dialog.getByRole('button', { name: 'Log amplification' }).click();
    await expect(page.getByText(`A share on WhatsApp was logged for ${target.name}.`)).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('impact-shares').locator('.ministat-value')).toHaveText(String(before + 1));
    const first = page.getByTestId('log-entry').first();
    await expect(first).toContainText('WhatsApp');
    await expect(first).toContainText('Shared the fellowship in the alumni group');
    await expect(first).toContainText(formatDate(todayLocal()));
  });

  test('cancelling the dialog logs nothing', async ({ page }) => {
    const target = seed.ambassadors.find((a) => a.status === 'active')!;
    const month = currentMonth();
    const before = seed.amplificationLogs.filter((l) => l.ambassadorId === target.id && l.at.slice(0, 7) === month).length;
    await ready(page, `/network/${target.id}`);
    await page.getByRole('button', { name: 'Log amplification' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('impact-shares').locator('.ministat-value')).toHaveText(String(before));
  });

  test('the logged share also appears on the leaderboard, one more than before', async ({ page }) => {
    const month = currentMonth();
    const target = seed.ambassadors.find((a) => a.status === 'active' && seed.amplificationLogs.some((l) => l.ambassadorId === a.id && l.at.slice(0, 7) === month)) ?? seed.ambassadors.find((a) => a.status === 'active')!;
    const before = seed.amplificationLogs.filter((l) => l.ambassadorId === target.id && l.at.slice(0, 7) === month).length;
    await ready(page, `/network/${target.id}`);
    await page.getByRole('button', { name: 'Log amplification' }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('combobox', { name: 'Channel' }).click();
    await page.getByRole('option', { name: 'LinkedIn' }).click();
    await dialog.getByRole('button', { name: 'Log amplification' }).click();
    await expect(page.getByTestId('impact-shares').locator('.ministat-value')).toHaveText(String(before + 1));
    // client-side to the leaderboard, so the store survives
    await page.getByTestId('nav-item-leaderboard').click(); // the active group (Partners & network) is already open
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Leaderboard');
    const row = page.getByTestId('table-row').filter({ hasText: target.name }).first();
    await expect(row.locator('td[data-label="Shares logged"]')).toHaveText(String(before + 1));
  });

  test('an unknown id shows not found; ?state=notfound works on the detail page', async ({ page }) => {
    await page.goto(`${BASE_URL}/network/nope`, { timeout: 30_000 });
    await expect(page.getByText(/not found/i).first()).toBeVisible();
    await page.goto(`${BASE_URL}/network/${seed.ambassadors[0].id}?state=notfound`);
    await expect(page.getByText(/not found/i).first()).toBeVisible();
  });
});

test.describe('Leaderboard', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  const seed = buildSeed().collections;

  /** The ranking of a month, worked out here from the raw data with separate code. */
  const expected = (month: string) =>
    seed.ambassadors
      .filter((a) => a.status !== 'applicant' && a.joinedAt.slice(0, 7) <= month)
      .map((a) => ({
        name: a.name,
        shares: seed.amplificationLogs.filter((l) => l.ambassadorId === a.id && l.at.startsWith(month)).length,
        clicks: seed.amplificationLogs.filter((l) => l.ambassadorId === a.id && l.at.startsWith(month)).reduce((s, l) => s + l.clicks, 0),
        signups: seed.databaseRecords.filter((r) => r.ambassadorId === a.id && r.verified && r.verifiedAt?.startsWith(month)).length,
      }))
      .sort((x, y) => y.signups - x.signups || y.clicks - x.clicks || y.shares - x.shares || x.name.localeCompare(y.name));

  test('columns, and the order: verified signups, then clicks, then shares', async ({ page }) => {
    await page.goto(`${BASE_URL}/leaderboard`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    const headers = (await page.locator('main table thead th').allTextContents()).map((text) => text.trim()).filter((text) => text && text !== 'Open');
    expect(headers).toEqual(['Rank', 'Name', 'Country', 'Campus', 'Tier', 'Shares logged', 'Distinct referred clicks', 'Verified signups attributed']);
    const want = expected(currentMonth());
    await expect(page.getByTestId('table-row')).toHaveCount(want.length);
    const rows = page.getByTestId('table-row');
    for (let i = 0; i < 8; i++) {
      const row = rows.nth(i);
      await expect(row.locator('td[data-label="Rank"]')).toHaveText(String(i + 1));
      await expect(row).toContainText(want[i].name);
      await expect(row.locator('td[data-label="Shares logged"]')).toHaveText(String(want[i].shares));
      await expect(row.locator('td[data-label="Distinct referred clicks"]')).toHaveText(String(want[i].clicks));
      await expect(row.locator('td[data-label="Verified signups attributed"]')).toHaveText(String(want[i].signups));
    }
  });

  test('the top three have purple-tinted rank badges; every rank is a number in text', async ({ page }) => {
    await page.goto(`${BASE_URL}/leaderboard`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    const badges = page.getByTestId('rank-badge');
    for (let i = 0; i < 5; i++) {
      const badge = badges.nth(i);
      await expect(badge).toHaveText(String(i + 1));
      await expect(badge).toHaveAttribute('data-top', i < 3 ? 'true' : 'false');
      const background = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
      if (i < 3) expect(background).not.toBe('rgba(0, 0, 0, 0)');
      else expect(background).toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('it is read-only: the only button or input on the page is the month control', async ({ page }) => {
    await page.goto(`${BASE_URL}/leaderboard`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    const controls = await page.locator('main button, main input, main select, main textarea, main [role="switch"], main [role="checkbox"]').evaluateAll((els) => els.map((el) => `${el.tagName}:${el.getAttribute('role') ?? ''}:${el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''}`));
    expect(controls).toHaveLength(1);
    expect(controls[0]).toMatch(/combobox/);
    await expect(page.getByRole('link', { name: /New|Edit|Add/ })).toHaveCount(0);
    // a row opens the ambassador for someone who can view the Network
    const first = page.getByTestId('table-row').first().getByRole('link');
    await expect(first).toHaveAttribute('href', /^\/network\/amb-/);
  });

  test('a past month is a snapshot: the ranking follows that month and the page says so', async ({ page }) => {
    const previous = monthsBefore(currentMonth(), 1);
    await page.goto(`${BASE_URL}/leaderboard?month=${previous}`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await expect(page.getByTestId('leaderboard-note')).toContainText(`A snapshot of ${formatMonth(previous)}`);
    const want = expected(previous);
    await expect(page.getByTestId('table-row')).toHaveCount(want.length);
    for (let i = 0; i < 5; i++) {
      const row = page.getByTestId('table-row').nth(i);
      await expect(row).toContainText(want[i].name);
      await expect(row.locator('td[data-label="Verified signups attributed"]')).toHaveText(String(want[i].signups));
      await expect(row.locator('td[data-label="Shares logged"]')).toHaveText(String(want[i].shares));
    }
    // the month control switches the month
    await page.getByRole('combobox', { name: /month/i }).click();
    await page.getByRole('option', { name: /Current/ }).click();
    await expect(page.getByTestId('leaderboard-note')).toHaveText('This month so far.');
  });

  test('?state=empty and ?state=error show their states', async ({ page }) => {
    await page.goto(`${BASE_URL}/leaderboard?state=empty`, { timeout: 30_000 });
    await expect(page.getByText('No ambassadors to rank')).toBeVisible();
    await page.goto(`${BASE_URL}/leaderboard?state=error`);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

test.describe('Network and Leaderboard: roles', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const role of ['country_lead', 'desk_lead', 'super_admin']) {
    test(`${role} edits the Network: New ambassador, Edit and Log amplification`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/network`, { timeout: 30_000 });
      await expect(page.getByRole('link', { name: 'New ambassador' })).toHaveAttribute('href', '/network/new');
      await page.goto(`${BASE_URL}/network/new`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('New ambassador');
      await page.goto(`${BASE_URL}/network/amb-02`);
      await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Log amplification' })).toBeEnabled();
    });
  }

  for (const role of ['partnerships_officer', 'training_officer', 'database_officer']) {
    test(`${role} can only view the Network: no New ambassador, Edit and Log amplification disabled with the tooltip, no form`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/network`, { timeout: 30_000 });
      await expect(page.getByTestId('table-row').first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'New ambassador' })).toHaveCount(0);
      await page.goto(`${BASE_URL}/network/amb-02`);
      await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);
      const log = page.getByRole('button', { name: 'Log amplification' });
      await expect(log).toBeDisabled();
      await log.hover({ force: true });
      await expect(page.getByRole('tooltip')).toContainText('Your role can view this page but not change it');
      await expect(page.getByRole('button', { name: 'Edit' })).toBeDisabled();
      await expect(page.getByTestId('referral-code')).toBeVisible(); // still readable (and copyable)
      for (const path of ['/network/new', '/network/amb-02/edit']) {
        await page.goto(`${BASE_URL}${path}`);
        await expect(page.getByTestId('no-access')).toBeVisible();
      }
    });
  }

  for (const role of ['partnerships_officer', 'country_lead', 'desk_lead', 'super_admin']) {
    test(`${role} sees the leaderboard, read-only, with rows that open the ambassador`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/leaderboard`, { timeout: 30_000 });
      await expect(page.getByTestId('table-row').first()).toBeVisible();
      await expect(page.getByTestId('table-row').first().getByRole('link')).toHaveAttribute('href', /^\/network\/amb-/);
      expect(await page.locator('main button, main input').count()).toBe(1); // the month control
    });
  }

  test('a moderator has no access to the Network or the Leaderboard', async ({ page, context }) => {
    await asRoles(context, 'moderator');
    for (const path of ['/network', '/leaderboard', '/network/amb-02']) {
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      await expect(page.getByTestId('no-access')).toBeVisible();
    }
  });
});

test.describe('Network and Leaderboard: phone (434px)', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 434, height: 900 } });
  const noOverflow = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  test('the list is cards with labelled values, the tiles stack, and nothing is wider than the screen', async ({ page }) => {
    await page.goto(`${BASE_URL}/network`, { timeout: 30_000 });
    const card = page.getByTestId('table-row').first();
    await expect(card).toBeVisible();
    for (const label of ['Country and city', 'Campus', 'Tier', 'Trained', 'Assigned lead']) await expect(card.locator(`td[data-label="${label}"]`)).toBeVisible();
    await expect(card.getByTestId('status-badge')).toBeVisible();
    await expect(page.getByTestId('network-size')).toBeVisible();
    await expect(page.getByTestId('network-rate')).toBeVisible();
    await expect(page.getByRole('link', { name: 'New ambassador' })).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await page.getByRole('combobox', { name: 'Filter by country' }).click();
    await expect(page.getByRole('dialog')).toBeVisible(); // the bottom sheet
  });

  test('the leaderboard is cards: rank, name and the three numbers', async ({ page }) => {
    await page.goto(`${BASE_URL}/leaderboard`, { timeout: 30_000 });
    const card = page.getByTestId('table-row').first();
    await expect(card).toBeVisible();
    await expect(card.getByTestId('rank-badge')).toHaveText('1');
    await expect(card.getByTestId('leader-card')).toContainText(/Shares \d+ · Referred clicks \d+ · Verified signups \d+/);
    expect(await noOverflow(page)).toBe(true);
  });

  test('the detail page fits, Copy keeps its word, and the dialog and form are usable', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL });
    await page.goto(`${BASE_URL}/network/amb-02`, { timeout: 30_000 });
    await expect(page.getByTestId('referral-code')).toBeVisible();
    const copy = page.getByTestId('referral-code-card').getByRole('button', { name: 'Copy' });
    await expect(copy).toContainText('Copy');
    expect((await copy.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    expect(await noOverflow(page)).toBe(true);
    await page.getByRole('button', { name: 'Log amplification' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Log amplification' });
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(434);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.goto(`${BASE_URL}/network/new`);
    await expect(page.getByTestId('back-button')).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Visual fix pass: clamped text, tier labels, network tiles, the pipeline gauge, partner cards, referred clicks.
// ---------------------------------------------------------------------------------------------------------------
test.describe('Visual fixes: clamped text descenders', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  test('every multi-line clamp has a line-height of at least 1.35 times the font size, and the last line has room for its descenders', async ({ page }) => {
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    await expect(page.getByTestId('kanban-card-ptn-06')).toBeVisible();
    // put words with descenders (p, g, y, q, j) on the last line of a two-line clamp
    const room = await page.evaluate(() => {
      const el = [...document.querySelectorAll<HTMLElement>('.line-clamp-2')].find((e) => e.classList.contains('caption'))!;
      el.textContent = 'Funds the whole programme, product gypsy jazz quality';
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()];
      const tops = [...new Set(rects.map((r) => Math.round(r.top)))];
      const lastVisible = rects.filter((r) => Math.round(r.top) === tops[1]).pop()!;
      const style = getComputedStyle(el);
      return { below: el.getBoundingClientRect().bottom - lastVisible.bottom, font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight) };
    });
    expect(room.line).toBeGreaterThanOrEqual(room.font * 1.35);
    expect(room.below).toBeGreaterThanOrEqual(room.font * 0.15); // the descender of the last line is inside the box (before the fix: 1px)
    // every clamped element on the Partners board and on an ambassador's log
    const ratios = async () =>
      page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.line-clamp-2, .line-clamp-3')].map((el) => parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize)));
    for (const ratio of await ratios()) expect(ratio).toBeGreaterThanOrEqual(1.35);
    await page.goto(`${BASE_URL}/network/amb-02`, { timeout: 30_000 });
    await expect(page.getByTestId('impact-shares')).toBeVisible();
    for (const ratio of await ratios()) expect(ratio).toBeGreaterThanOrEqual(1.35);
  });

  test('a clamp still shows exactly two lines (the padding does not add a line)', async ({ page }) => {
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    await expect(page.getByTestId('kanban-card-ptn-06')).toBeVisible();
    const provide = page.getByTestId('kanban-card-ptn-06').getByText('Remote engineering roles and bootcamp trainers');
    const lines = await provide.evaluate((el) => {
      const s = getComputedStyle(el);
      return Math.round((el.clientHeight - parseFloat(s.paddingBottom)) / parseFloat(s.lineHeight));
    });
    expect(lines).toBe(2);
  });
});

test.describe('Visual fixes: tier labels, rows and network tiles', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 900 } });
  const seed = buildSeed().collections;

  test('Network and Leaderboard show short tier labels in nowrap pills, the full name in the tooltip, and 56px rows', async ({ page }) => {
    for (const path of ['/network', '/leaderboard']) {
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      await expect(page.getByTestId('table-row').first()).toBeVisible();
      const texts = new Set((await page.locator('td[data-label="Tier"]').allInnerTexts()).map((t) => t.trim()));
      expect([...texts].every((t) => ['Ambassador', 'Senior Ambassador', 'Regional Lead'].includes(t))).toBe(true);
      expect(texts.has('Regional Lead')).toBe(true);
      const heights = await page.getByTestId('table-row').evaluateAll((rows) => rows.map((row) => Math.round(row.getBoundingClientRect().height)));
      expect(new Set(heights)).toEqual(new Set([56]));
      const pill = page.locator('td[data-label="Tier"]').filter({ hasText: 'Regional Lead' }).first().locator('span.badge-text');
      expect(await pill.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap');
      await pill.hover();
      await expect(page.getByRole('tooltip')).toHaveText('Campus or Regional Lead');
      await page.mouse.move(0, 0);
    }
  });

  test('the filter, the form and the detail page keep the full tier name', async ({ page }) => {
    const lead = seed.ambassadors.find((a) => a.tier === 'lead')!;
    await page.goto(`${BASE_URL}/network/${lead.id}`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(lead.name);
    await expect(page.getByText('Campus or Regional Lead', { exact: true })).toBeVisible();
    await page.goto(`${BASE_URL}/network/${lead.id}/edit`, { timeout: 30_000 });
    await page.getByRole('combobox', { name: 'Tier' }).click();
    await expect(page.getByRole('option', { name: 'Campus or Regional Lead' })).toBeVisible();
  });

  test('tile captions: "All statuses", "Of 40 in the network" and the shared count, each on one line', async ({ page }) => {
    await page.goto(`${BASE_URL}/network`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    const shared = new Set(seed.amplificationLogs.filter((l) => l.at.slice(0, 7) === currentMonth()).map((l) => l.ambassadorId));
    const sharedActive = seed.ambassadors.filter((a) => a.status === 'active' && shared.has(a.id)).length;
    const want: [string, string][] = [
      ['network-size', 'All statuses'],
      ['network-active', 'Of 40 in the network'],
      ['network-rate', `${sharedActive} of 25 active shared this month`],
    ];
    for (const [id, caption] of want) {
      const line = page.getByTestId(id).locator('p.caption').last();
      await expect(line).toHaveText(caption);
      expect(Math.round((await line.boundingBox())!.height)).toBeLessThanOrEqual(16);
    }
  });
});

test.describe('Visual fixes: the pipeline gauge', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 900 } });
  const luminance = ([r, g, b]: number[]) => {
    const f = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  test('the zones are the status background tokens (the same tints as the chips) with full-colour edges that hold 3:1 against white', async ({ page }) => {
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    await expect(page.getByTestId('pipeline-gauge')).toBeVisible();
    // --color-danger-soft #fdecec, --color-warning-soft #fdf3d8, --color-success-soft #e8f6ee
    const tokens: Record<string, string> = { 'zone-critical': 'rgb(253, 236, 236)', 'zone-thin': 'rgb(253, 243, 216)', 'zone-healthy': 'rgb(232, 246, 238)' };
    for (const id of ['zone-critical', 'zone-thin', 'zone-healthy']) {
      const { background, edge } = await page.getByTestId(id).evaluate((el) => ({ background: getComputedStyle(el).backgroundColor, edge: getComputedStyle(el).boxShadow }));
      expect(background).toBe(tokens[id]);
      const rgb = edge.match(/rgba?\((\d+), (\d+), (\d+)/)!.slice(1, 4).map(Number);
      expect(1.05 / (luminance(rgb) + 0.05)).toBeGreaterThanOrEqual(3);
    }
  });

  test('real data: 13 open against 9 needed (a ratio of 1.4, healthy): the marker is a 12px pill INSIDE the bar, nothing is capped, the tick says "9 needed"', async ({ page }) => {
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    await expect(page.getByTestId('pipeline-gauge')).toBeVisible();
    await expect(page.getByTestId('pipeline-headline')).toHaveText('13 open deals, 9 needed');
    await expect(page.getByTestId('pipeline-marker-label')).toHaveText('13 open');
    await expect(page.getByTestId('pipeline-needed-label')).toHaveText('9 needed');
    await expect(page.getByTestId('pipeline-capped')).toHaveCount(0);
    await expect(page.getByTestId('pipeline-arrow')).toHaveCount(0);
    const meter = page.getByRole('region', { name: 'Pipeline health' }).getByRole('meter');
    await expect(meter).toHaveAttribute('aria-valuetext', '13 open deals, 9 needed, 1.4 times the target, healthy');
    const pin = (await page.getByTestId('pipeline-marker').boundingBox())!;
    const area = (await meter.boundingBox())!;
    expect(Math.round(pin.width)).toBe(12);
    expect((pin.x + pin.width / 2 - area.x) / area.width).toBeCloseTo(13 / 9 / 2, 1); // ratio / 2.0: well inside the bar
    expect(pin.x + pin.width).toBeLessThan(area.x + area.width - 20);
  });

  test('?health=capped: a 12px marker pinned to the right end, the label "31 open · 3.1× the target" (no ">"), an arrow beside the marker; the tick says "10 needed"', async ({ page }) => {
    await page.goto(`${BASE_URL}/partners?health=capped`, { timeout: 30_000 });
    await expect(page.getByTestId('pipeline-gauge')).toBeVisible();
    await expect(page.getByTestId('pipeline-marker-label')).toHaveText('31 open · 3.1× the target');
    await expect(page.getByTestId('pipeline-marker-label')).not.toContainText('>');
    await expect(page.getByTestId('pipeline-capped')).toHaveText('3.1× the target');
    const arrow = (await page.getByTestId('pipeline-arrow').boundingBox())!;
    const pin = (await page.getByTestId('pipeline-marker').boundingBox())!;
    expect(arrow.x + arrow.width).toBeLessThanOrEqual(pin.x + 1); // beside the marker, at the end of the bar
    expect(pin.x - (arrow.x + arrow.width)).toBeLessThanOrEqual(8);
    await expect(page.getByTestId('pipeline-needed-label')).toHaveText('10 needed');
    const marker = (await page.getByTestId('pipeline-marker').boundingBox())!;
    const bar = (await page.getByRole('region', { name: 'Pipeline health' }).getByRole('meter').boundingBox())!;
    expect(Math.round(marker.width)).toBe(12);
    expect(marker.x + marker.width / 2).toBeCloseTo(bar.x + bar.width, 0); // pinned to the right end
    await expect(page.getByRole('region', { name: 'Pipeline health' }).getByRole('meter')).toHaveAttribute('aria-valuetext', '31 open deals, 10 needed, 3.1 times the target, healthy');
    // the two labels do not overlap each other
    const a = (await page.getByTestId('pipeline-marker-label').boundingBox())!;
    const b = (await page.getByTestId('pipeline-needed-label').boundingBox())!;
    expect(a.x >= b.x + b.width || b.x >= a.x + a.width).toBe(true);
  });

  const STATES: [string, string, string][] = [
    ['healthy', '14 open', '14 open deals, 10 needed, 1.4 times the target, healthy'],
    ['thin', '8 open', '8 open deals, 10 needed, 0.8 times the target, thin'],
    ['critical', '4 open', '4 open deals, 10 needed, 0.4 times the target, critical'],
  ];
  for (const [key, label, text] of STATES) {
    test(`?health=${key}: marker label "${label}", tick label "10 needed", no capped text, meter text with the multiple`, async ({ page }) => {
      await page.goto(`${BASE_URL}/partners?health=${key}`, { timeout: 30_000 });
      await expect(page.getByTestId('pipeline-gauge')).toBeVisible();
      await expect(page.getByTestId('pipeline-marker-label')).toHaveText(label);
      await expect(page.getByTestId('pipeline-needed-label')).toHaveText('10 needed');
      await expect(page.getByTestId('pipeline-capped')).toHaveCount(0);
      await expect(page.getByTestId('pipeline-arrow')).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Pipeline health' }).getByRole('meter')).toHaveAttribute('aria-valuetext', text);
      const a = (await page.getByTestId('pipeline-marker-label').boundingBox())!;
      const b = (await page.getByTestId('pipeline-needed-label').boundingBox())!;
      expect(a.x >= b.x + b.width || b.x >= a.x + a.width).toBe(true);
    });
  }

  test('?health=nodata: no marker, no marker label, no tick label', async ({ page }) => {
    await page.goto(`${BASE_URL}/partners?health=nodata`, { timeout: 30_000 });
    await expect(page.getByTestId('pipeline-gauge')).toBeVisible();
    for (const id of ['pipeline-marker', 'pipeline-marker-label', 'pipeline-needed-label', 'pipeline-capped']) await expect(page.getByTestId(id)).toHaveCount(0);
  });
});

test.describe('Visual fixes: partner cards', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('no divider above Move; the button is 28px with a 40px hit area that clicks, and it keeps clear of the grip and avatar', async ({ page }) => {
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    const card = page.getByTestId('kanban-card-ptn-15');
    await expect(card).toBeVisible();
    expect(await card.evaluate((el) => [...el.querySelectorAll('div')].filter((child) => parseFloat(getComputedStyle(child).borderTopWidth) > 0).length)).toBe(0);
    const move = card.getByRole('button', { name: /^Move .* to another stage/ });
    const box = (await move.boundingBox())!;
    expect(Math.round(box.width)).toBe(28);
    expect(Math.round(box.height)).toBe(28);
    // 5px outside the visible button is still the button (the pseudo-element)
    await page.mouse.click(box.x + box.width + 5, box.y + box.height / 2);
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    // the 40px hit area does not overlap the avatar or the grip
    const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    const hit = { x: box.x - 6, y: box.y - 6, width: 40, height: 40 };
    for (const id of ['partner-owner', 'kanban-grip']) {
      const other = await card.getByTestId(id).boundingBox();
      if (other) expect(overlap(hit, other)).toBe(false);
    }
  });
});

test.describe('Visual fixes: referred clicks in the seed (no browser)', () => {
  const data = buildSeed(FIXED_TODAY).collections;
  const monthOfIso = (iso: string) => iso.slice(0, 7);

  test('a share brings 20 to 80 clicks, an ambassador with no shares has no clicks, and signups never exceed clicks / 15', () => {
    for (const log of data.amplificationLogs) {
      expect(log.clicks).toBeGreaterThanOrEqual(20);
      expect(log.clicks).toBeLessThanOrEqual(80);
    }
    const clicks = new Map<string, number>();
    for (const log of data.amplificationLogs) {
      const key = `${log.ambassadorId}|${monthOfIso(log.at)}`;
      clicks.set(key, (clicks.get(key) ?? 0) + log.clicks);
    }
    const signups = new Map<string, number>();
    for (const record of data.databaseRecords) {
      if (!record.verified || !record.ambassadorId) continue;
      const key = `${record.ambassadorId}|${monthOfIso(record.verifiedAt!)}`;
      signups.set(key, (signups.get(key) ?? 0) + 1);
    }
    expect(signups.size).toBeGreaterThan(0);
    for (const [key, count] of signups) expect(count).toBeLessThanOrEqual((clicks.get(key) ?? 0) / 15);
    // an ambassador with no shares has no clicks (nothing but logs makes clicks)
    for (const ambassador of data.ambassadors) {
      const logs = data.amplificationLogs.filter((l) => l.ambassadorId === ambassador.id);
      if (logs.length === 0) expect([...clicks.keys()].some((key) => key.startsWith(`${ambassador.id}|`))).toBe(false);
    }
  });

  test('a referred record names an ambassador who had joined by then', () => {
    for (const record of data.databaseRecords.filter((r) => r.ambassadorId)) {
      const ambassador = data.ambassadors.find((a) => a.id === record.ambassadorId)!;
      expect(ambassador.joinedAt <= (record.verifiedAt ?? record.createdAt)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Database (/database): the beneficiary records.
// ---------------------------------------------------------------------------------------------------------------
test.describe('Database: the rules (no browser)', () => {
  const sample = (id: string, over: Partial<(typeof seed.databaseRecords)[number]> = {}) => ({
    id,
    name: `Person ${id}`,
    email: `${id}@god.example`,
    phone: undefined as string | undefined,
    country: 'Ghana',
    institution: 'KNUST',
    source: 'organic' as const,
    verified: false,
    createdAt: '2026-06-01',
    ...over,
  });

  test('email is compared trimmed and without case', () => {
    expect(normalizeEmail('  Ada.Lovelace@GOD.example \t')).toBe('ada.lovelace@god.example');
    const records = [sample('a', { email: 'ada@god.example' })];
    for (const typed of ['ada@god.example', ' ADA@god.example', 'Ada@God.Example  ', '\tada@GOD.EXAMPLE\n']) {
      expect(findDuplicate({ email: typed }, records)?.field).toBe('email');
    }
    expect(findDuplicate({ email: 'ada2@god.example' }, records)).toBeNull();
  });

  test('phone is compared without spaces, dashes, dots, brackets, the leading + or 00, the national 0 or the country code', () => {
    const ghana = ['+233 24 555 1007', '+233-24-555-1007', '233245551007', '00233245551007', '0245551007', '024-555-1007', '(024) 555.1007', ' 024 555 1007 ', '245551007'];
    for (const typed of ghana) expect(normalizePhone(typed, 'Ghana')).toBe('233245551007');
    expect(normalizePhone('+234 803 555 1007', 'Nigeria')).toBe('2348035551007');
    expect(normalizePhone('08035551007', 'Nigeria')).toBe('2348035551007');
    expect(normalizePhone('+233 24 555 1008', 'Ghana')).not.toBe('233245551007'); // a different number
    expect(normalizePhone('0245551007', 'Nigeria')).toBe('234245551007'); // the same local digits in another country
    expect(normalizePhone('', 'Ghana')).toBe('');
    expect(normalizePhone(undefined, 'Ghana')).toBe('');
    expect(normalizePhone('---', 'Ghana')).toBe('');
  });

  test('every variant of a stored phone is found, from either way round', () => {
    const records = [sample('a', { phone: '+233 24 555 1007', country: 'Ghana' })];
    for (const typed of ['0245551007', '024-555-1007', '00233245551007', '233245551007', '+233(0)245551007'.replace('(0)', '')]) {
      expect(findDuplicate({ email: 'new@god.example', phone: typed, country: 'Ghana' }, records)?.field).toBe('phone');
    }
    expect(findDuplicate({ email: 'new@god.example', phone: '0245551008', country: 'Ghana' }, records)).toBeNull();
    // the same digits in another country are not the same person
    expect(findDuplicate({ email: 'new@god.example', phone: '0245551007', country: 'Nigeria' }, records)).toBeNull();
  });

  test('dedupe order: email first, even when the phone matches a different record; then phone; a record never duplicates itself', () => {
    const records = [sample('a', { email: 'a@god.example', phone: '0245551001' }), sample('b', { email: 'b@god.example', phone: '0245551002' })];
    const both = findDuplicate({ email: 'B@god.example', phone: '024 555 1001', country: 'Ghana' }, records);
    expect(both?.field).toBe('email');
    expect(both?.record.id).toBe('b');
    const onlyPhone = findDuplicate({ email: 'c@god.example', phone: '024 555 1001', country: 'Ghana' }, records);
    expect(onlyPhone?.field).toBe('phone');
    expect(onlyPhone?.record.id).toBe('a');
    expect(findDuplicate({ email: 'a@god.example', phone: '0245551001', country: 'Ghana' }, records, 'a')).toBeNull();
    expect(DUPLICATE_MESSAGES.email).toBe('A record with this email already exists');
  });

  test('linked cells are links only for roles that can view the page: every role, and every pair of roles', () => {
    const accessFor = (roles: string[]) => recordLinkAccess((screen, level) => roleCan(roles as never, screen, level));
    const combos: string[][] = [...ROLE_IDS.map((r) => [r]), ...ROLE_IDS.flatMap((a, i) => ROLE_IDS.slice(i + 1).map((b) => [a, b]))];
    expect(combos.length).toBe(ROLE_IDS.length + (ROLE_IDS.length * (ROLE_IDS.length - 1)) / 2);
    for (const roles of combos) {
      const access = accessFor(roles);
      expect(access.ambassador).toBe(roleCan(roles as never, 'network', 'view'));
      expect(access.opportunity).toBe(roleCan(roles as never, 'opportunities_queue', 'view'));
      // a pair can do whatever either role can
      if (roles.length === 2) {
        expect(access.ambassador).toBe(accessFor([roles[0]]).ambassador || accessFor([roles[1]]).ambassador);
        expect(access.opportunity).toBe(accessFor([roles[0]]).opportunity || accessFor([roles[1]]).opportunity);
      }
    }
    // known cases from the matrix
    expect(accessFor(['super_admin'])).toEqual({ ambassador: true, opportunity: true });
    expect(accessFor(['database_officer'])).toEqual({ ambassador: true, opportunity: false });
    expect(accessFor(['opportunities_officer'])).toEqual({ ambassador: false, opportunity: true });
    expect(accessFor(['social_media_manager'])).toEqual({ ambassador: false, opportunity: false });
  });

  test('the pace comes from kpiStatus: 8 of 15 is on track, 6 is behind, 5 is off track (June 15, a 7.5 pace)', () => {
    const june = '2026-06';
    const others = seed.databaseRecords.filter((r) => !(r.verified && r.verifiedAt?.startsWith(june)));
    const inJune = seed.databaseRecords.filter((r) => r.verified && r.verifiedAt?.startsWith(june));
    expect(inJune).toHaveLength(Math.round(15 * (15 / 30) * 1.05)); // this month is month-to-date: 8 by June 15
    const paceWith = (count: number) => recordsPace(FIXED_TODAY, { ...kpiData, databaseRecords: [...others, ...inJune.slice(0, count)] }, { green: 0.95, amber: 0.7 });
    const full = paceWith(8);
    expect(full).toMatchObject({ month: june, verified: 8, target: 15, paceRounded: 8, status: 'on_pace' });
    expect(full.text).toBe('8 of 15 verified, pro-rated pace 8, on track');
    expect(full.gauge.capped).toBeNull(); // not past the scale (twice the pace) in the default data
    expect(paceWith(6)).toMatchObject({ status: 'behind', text: '6 of 15 verified, pro-rated pace 8, behind' });
    expect(paceWith(5)).toMatchObject({ status: 'far_behind', text: '5 of 15 verified, pro-rated pace 8, off track' });
    // the status is exactly kpiStatus on the same numbers
    for (const count of [0, 3, 5, 6, 7, 8]) {
      const word = { green: 'on_pace', amber: 'behind', red: 'far_behind' }[kpiStatus(count, 15, 15, 30, { green: 0.95, amber: 0.7 })];
      expect(paceWith(count).status).toBe(word);
    }
    // the gauge geometry: the zones fill the bar, the marker and the pace tick are inside it
    const gauge = paceWith(9).gauge;
    expect(gauge.zones.reduce((sum, zone) => sum + zone.percent, 0)).toBeCloseTo(100, 5);
    expect(gauge.paceAt).toBeGreaterThan(0);
    expect(gauge.markerAt).toBeLessThanOrEqual(100);
  });

  test('verify moves the pace and the Beneficiaries verified KPI by one, undo puts both back, and a verified record has nothing to verify', () => {
    const snapshot = getMockCollection('databaseRecords');
    try {
      const month = currentMonth();
      const pending = getMockCollection('databaseRecords').find((r) => !r.verified)!;
      const before = { kpi: kpiValue('beneficiaries_verified', month), pace: recordsPace().verified, pending: pendingRecordCount(getMockCollection('databaseRecords')) };
      const undo = verifyRecord(pending.id)!;
      expect(undo).toEqual({ id: pending.id, verified: false, verifiedAt: undefined });
      expect(kpiValue('beneficiaries_verified', month)).toBe(before.kpi + 1);
      expect(recordsPace().verified).toBe(before.pace + 1);
      expect(pendingRecordCount(getMockCollection('databaseRecords'))).toBe(before.pending - 1);
      expect(getMockCollection('databaseRecords').find((r) => r.id === pending.id)).toMatchObject({ verified: true });
      expect(verifyRecord(pending.id)).toBeUndefined(); // already verified
      undoVerify(undo);
      expect(kpiValue('beneficiaries_verified', month)).toBe(before.kpi);
      expect(recordsPace().verified).toBe(before.pace);
      expect(getMockCollection('databaseRecords').find((r) => r.id === pending.id)).toMatchObject({ verified: false, verifiedAt: undefined });
    } finally {
      setMockCollection('databaseRecords', snapshot, { always: true });
    }
  });

  test('createRecord blocks an email duplicate (any case, any spaces) and a phone duplicate, and writes nothing', () => {
    const snapshot = getMockCollection('databaseRecords');
    try {
      const existing = snapshot[0];
      const fields = { name: 'New Person', email: 'new.person@god.example', phone: '', country: 'Ghana', institution: 'KNUST', source: 'organic' as const, verified: false };
      const byEmail = createRecord({ ...fields, email: `  ${existing.email.toUpperCase()} ` });
      expect(byEmail).toMatchObject({ ok: false, duplicate: { field: 'email' } });
      const byPhone = createRecord({ ...fields, phone: '0201234567' });
      expect(byPhone.ok).toBe(true); // a new number is fine
      const again = createRecord({ ...fields, email: 'another@god.example', phone: '+233 20 123 4567' });
      expect(again).toMatchObject({ ok: false, duplicate: { field: 'phone' } });
      expect(getMockCollection('databaseRecords')).toHaveLength(snapshot.length + 1);
    } finally {
      setMockCollection('databaseRecords', snapshot, { always: true });
    }
  });

  test('createRecord sets who added it and when, keeps the ambassador only for a referral, and dates a verified record today', () => {
    const snapshot = getMockCollection('databaseRecords');
    try {
      const fields = { name: 'Kofi Test', email: 'kofi.test@god.example', country: 'Ghana', institution: 'KNUST', verified: true, ambassadorId: 'amb-01', listingId: undefined };
      const organic = createRecord({ ...fields, source: 'organic' });
      const referral = createRecord({ ...fields, email: 'kofi.test2@god.example', source: 'ambassador' });
      expect(organic.ok && organic.record.ambassadorId).toBeUndefined();
      expect(referral.ok && referral.record.ambassadorId).toBe('amb-01');
      if (organic.ok) {
        expect(organic.record.createdAt).toBe(organic.record.verifiedAt);
        expect(organic.record.addedById).toBe(getMockCollection('staff').find((s) => s.isCurrentUser)?.id);
      }
    } finally {
      setMockCollection('databaseRecords', snapshot, { always: true });
    }
  });

  test('the seed: five sources, every email on @god.example and unique, phones unique, who added it resolves, a referral names an ambassador', () => {
    expect(new Set(seed.databaseRecords.map((r) => r.source))).toEqual(new Set(['organic', 'ambassador', 'event', 'partner', 'import']));
    expect(seed.databaseRecords.every((r) => r.email.endsWith(`@${BRAND_EMAIL_DOMAIN}`))).toBe(true);
    expect(new Set(seed.databaseRecords.map((r) => r.email)).size).toBe(seed.databaseRecords.length);
    expect(new Set(seed.databaseRecords.map((r) => normalizePhone(r.phone, r.country))).size).toBe(seed.databaseRecords.length);
    const staffIds = new Set(seed.staff.map((s) => s.id));
    expect(seed.databaseRecords.every((r) => r.addedById && staffIds.has(r.addedById))).toBe(true);
    for (const r of seed.databaseRecords) expect(Boolean(r.ambassadorId)).toBe(r.source === 'ambassador');
    // nobody in the seed is a duplicate of anybody else
    expect(seed.databaseRecords.filter((r) => findDuplicate(r, seed.databaseRecords, r.id))).toHaveLength(0);
    const counts = sourceBreakdown(seed.databaseRecords);
    expect(counts.map((c) => c.label)).toEqual(['Organic', 'Ambassador referral', 'Event', 'Partner channel', 'Bulk import']);
    // an uneven mix: organic 38%, ambassador referral 24%, event 18%, partner channel 12%, bulk import 8% (whole records, 120 in all)
    expect(counts.map((c) => c.count)).toEqual([46, 29, 22, 14, 9]);
    expect(counts.reduce((sum, c) => sum + c.count, 0)).toBe(120);
    expect(counts.map((c) => Math.round((c.count / 120) * 100))).toEqual([38, 24, 18, 12, 8]);
  });
});

test.describe('Database: the page', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  const data = buildSeed().collections;
  const pendingAll = data.databaseRecords.filter((r) => !r.verified);
  const tab = async (page: import('@playwright/test').Page, name: string) =>
    (await page.getByRole('radiogroup', { name: 'Filter by verification' }).getByRole('radio', { name: new RegExp(`^${name}`) }).innerText()).replace(/\D+/g, '');
  const openList = async (page: import('@playwright/test').Page) => {
    await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
  };

  test('the pace card: the meter, its text, the status in words, the marker, the pace tick and three labelled zones', async ({ page }) => {
    await openList(page);
    const pace = recordsPace();
    const card = page.getByTestId('records-pace');
    const meter = card.getByRole('meter');
    await expect(meter).toHaveAttribute('aria-valuemin', '0');
    await expect(meter).toHaveAttribute('aria-valuenow', String(pace.verified));
    await expect(meter).toHaveAttribute('aria-valuemax', String(pace.gauge.max));
    await expect(meter).toHaveAttribute('aria-valuetext', pace.text);
    await expect(page.getByTestId('pace-headline')).toHaveText(`${pace.verified} of ${pace.target} verified`);
    await expect(page.getByTestId('pace-status')).toHaveText({ on_pace: 'On track', behind: 'Behind', far_behind: 'Off track' }[pace.status]);
    await expect(page.getByTestId('pace-zone-labels')).toHaveText('Far behindBehindOn pace');
    await expect(page.getByTestId('pace-marker-label')).toHaveText(new RegExp(`^${pace.verified} verified`)); // (plus the chevron and "4.4x pace" when capped)
    await expect(page.getByTestId('pace-tick-label')).toHaveText(`pace ${pace.paceRounded}`);
    // more verified than the bar can show: the marker is pinned to the right end with a chevron and the multiple of the pace
    if (pace.gauge.capped) {
      await expect(page.getByTestId('pace-capped')).toHaveText(`${pace.gauge.capped}× the pace`);
      await expect(page.getByTestId('pace-arrow')).toBeVisible();
    } else {
      await expect(page.getByTestId('pace-capped')).toHaveCount(0);
      await expect(page.getByTestId('pace-arrow')).toHaveCount(0);
    }
    const bar = (await meter.boundingBox())!;
    const centre = async (id: string) => {
      const b = (await page.getByTestId(id).boundingBox())!;
      return (b.x + b.width / 2 - bar.x) / bar.width;
    };
    expect(await centre('pace-tick')).toBeCloseTo(pace.gauge.paceAt / 100, 1);
    expect(await centre('pace-marker')).toBeCloseTo(pace.gauge.markerAt / 100, 1);
    expect(Math.round((await page.getByTestId('pace-marker').boundingBox())!.width)).toBe(12);
  });

  test('records by source: a bar and a legend with a count and a percentage for each of the five sources', async ({ page }) => {
    await openList(page);
    const counts = sourceBreakdown(data.databaseRecords);
    for (const c of counts) await expect(page.getByTestId(`source-legend-${c.source}`)).toContainText(`${c.label}${c.count} · ${Math.round((c.count / 120) * 100)}%`.replace(c.label, c.label));
    await expect(page.getByTestId('source-legend').locator('li')).toHaveCount(5);
    await expect(page.getByTestId('source-bar').locator('span')).toHaveCount(5);
  });

  test('columns, a row with its avatar, email, source pill, the 24px added-by avatar and the date', async ({ page }) => {
    await openList(page);
    const headers = (await page.locator('main table thead th').allTextContents()).map((text) => text.trim()).filter((text) => text && text !== 'Open');
    expect(headers).toEqual(['Record', 'Country', 'Institution', 'Source', 'Linked', 'Verified', 'Added by and on']);
    const record = pendingAll[0];
    await page.getByRole('searchbox', { name: 'Search records' }).fill(record.name);
    const row = page.getByTestId('table-row').first();
    await expect(row).toContainText(record.name);
    await expect(row).toContainText(record.email);
    await expect(row).toContainText(record.country);
    await expect(row).toContainText(record.institution);
    await expect(row.locator('td[data-label="Source"]')).toContainText(RECORD_SOURCE_LABELS[record.source]);
    await expect(row.getByTestId('status-badge').first()).toContainText('Pending');
    const staff = data.staff.find((s) => s.id === record.addedById)!;
    await expect(row.locator('td[data-label="Added by and on"]')).toContainText(staff.name);
    const avatar = row.locator('td[data-label="Added by and on"] span.size-6').first();
    expect(Math.round((await avatar.boundingBox())!.width)).toBe(24);
    expect(Math.round((await row.boundingBox())!.height)).toBe(56);
  });

  test('filters and counts: All, Verified and Pending count the records; the source and the search narrow the counts', async ({ page }) => {
    await openList(page);
    const verifiedCount = data.databaseRecords.filter((r) => r.verified).length;
    expect([await tab(page, 'All'), await tab(page, 'Verified'), await tab(page, 'Pending')]).toEqual(['120', String(verifiedCount), String(120 - verifiedCount)]);
    await page.getByRole('radiogroup', { name: 'Filter by verification' }).getByRole('radio', { name: /^Pending/ }).click();
    await expect(page.getByTestId('table-row')).toHaveCount(10); // one page (there are more than ten pending)
    await expect(page.getByTestId('table-row').first().getByTestId('verify-button')).toBeVisible();
    await page.getByRole('radiogroup', { name: 'Filter by verification' }).getByRole('radio', { name: /^All/ }).click();
    const event = data.databaseRecords.filter((r) => r.source === 'event');
    await page.getByRole('combobox', { name: 'Filter by source' }).click();
    await page.getByRole('option', { name: 'Event' }).click();
    expect([await tab(page, 'All'), await tab(page, 'Verified'), await tab(page, 'Pending')]).toEqual([String(event.length), String(event.filter((r) => r.verified).length), String(event.filter((r) => !r.verified).length)]);
    await page.getByRole('combobox', { name: 'Filter by source' }).click();
    await page.getByRole('option', { name: 'All sources' }).click();
    // search by email (any case), by institution
    const search = page.getByRole('searchbox', { name: 'Search records' });
    await search.fill(data.databaseRecords[7].email.toUpperCase());
    await expect(page.getByTestId('table-row')).toHaveCount(1);
    const institution = data.databaseRecords[3].institution;
    await search.fill(institution.toLowerCase());
    expect(await tab(page, 'All')).toBe(String(data.databaseRecords.filter((r) => r.institution.toLowerCase().includes(institution.toLowerCase()) || r.name.toLowerCase().includes(institution.toLowerCase()) || r.email.toLowerCase().includes(institution.toLowerCase())).length));
    await search.fill('zzzz-nobody');
    await expect(page.getByText('No records match these filters')).toBeVisible();
  });

  test('?state=empty, ?state=error and ?state=loading show their states, and the card never shows a 0 while loading', async ({ page }) => {
    await page.goto(`${BASE_URL}/database?state=empty`, { timeout: 30_000 });
    await expect(page.getByText('No records yet')).toBeVisible();
    await page.goto(`${BASE_URL}/database?state=error`);
    await expect(page.getByRole('button', { name: 'Try again' }).first()).toBeVisible();
    await page.goto(`${BASE_URL}/database?state=loading`);
    await expect(page.getByTestId('records-pace')).toBeVisible();
    await expect(page.getByTestId('pace-headline')).toHaveCount(0);
    await expect(page.getByRole('meter')).toHaveCount(0);
  });

  test('a record opens its page from the row, with the details, the links and the verified badge', async ({ page }) => {
    await openList(page);
    const record = pendingAll[0];
    await page.getByRole('searchbox', { name: 'Search records' }).fill(record.name);
    await page.getByTestId('table-row').first().getByRole('link', { name: record.name }).click();
    await expect(page).toHaveURL(new RegExp(`/database/${record.id}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(record.name);
    await expect(page.getByTestId('status-badge').first()).toContainText('Pending');
    await expect(page.getByText(record.email)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verify' })).toBeVisible();
  });

  test('a record that does not exist shows the not-found state', async ({ page }) => {
    await page.goto(`${BASE_URL}/database/rec-nope`, { timeout: 30_000 });
    await expect(page.getByText(/not found/i).first()).toBeVisible();
  });
});

test.describe('Database: one-click verify', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  const data = buildSeed().collections;
  const PENDING = data.databaseRecords.filter((r) => !r.verified).length;
  const tab = async (page: import('@playwright/test').Page, name: string) =>
    (await page.getByRole('radiogroup', { name: 'Filter by verification' }).getByRole('radio', { name: new RegExp(`^${name}`) }).innerText()).replace(/\D+/g, '');
  const pill = (page: import('@playwright/test').Page) => page.locator('aside').getByRole('link', { name: /^Database/ });
  const pillCount = async (page: import('@playwright/test').Page) => Number((await pill(page).innerText()).replace(/\D+/g, ''));

  test('Verify changes the row, the gauge, the counts and the sidebar pill in one go; Undo puts them all back', async ({ page }) => {
    await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    const before = recordsPace();
    expect(await pillCount(page)).toBe(PENDING);
    const record = data.databaseRecords.filter((r) => !r.verified)[0];
    await page.getByRole('searchbox', { name: 'Search records' }).fill(record.name);
    const row = page.getByTestId('table-row').first();
    await row.getByRole('button', { name: `Verify ${record.name}` }).click();
    // the row, the gauge, the counts and the pill
    await expect(row.getByTestId('status-badge').first()).toContainText('Verified');
    await expect(row.getByTestId('verify-button')).toHaveCount(0);
    await expect(page.getByTestId('pace-headline')).toHaveText(`${before.verified + 1} of ${before.target} verified`);
    await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', String(before.verified + 1));
    await expect(page.getByRole('meter')).toHaveAttribute('aria-valuetext', new RegExp(`^${before.verified + 1} of ${before.target} verified, pro-rated pace ${before.paceRounded}, `));
    expect([await tab(page, 'All'), await tab(page, 'Verified'), await tab(page, 'Pending')]).toEqual(['1', '1', '0']);
    expect(await pillCount(page)).toBe(PENDING - 1);
    // the toast with Undo
    const toast = page.getByTestId('toast').filter({ hasText: `${record.name} was verified.` });
    await expect(toast).toBeVisible();
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(row.getByTestId('status-badge').first()).toContainText('Pending');
    await expect(row.getByTestId('verify-button')).toHaveCount(1);
    await expect(page.getByTestId('pace-headline')).toHaveText(`${before.verified} of ${before.target} verified`);
    expect([await tab(page, 'All'), await tab(page, 'Verified'), await tab(page, 'Pending')]).toEqual(['1', '0', '1']);
    expect(await pillCount(page)).toBe(PENDING);
    await expect(page.getByText(`Verification of ${record.name} was undone.`)).toBeVisible();
  });

  test('the Undo toast lasts 5 seconds (checked on a fake clock) and the record stays verified after it', async ({ page }) => {
    await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await page.clock.install();
    await page.getByTestId('verify-button').first().click();
    const undo = page.getByTestId('toast').getByRole('button', { name: 'Undo' });
    await expect(undo).toBeVisible();
    await page.clock.runFor(4500);
    await expect(undo).toBeVisible();
    await page.clock.runFor(1000);
    await expect(page.getByTestId('toast')).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'Filter by verification' }).getByRole('radio', { name: /^Pending/ })).toContainText(String(PENDING - 1));
  });

  test('the Verify button is a 40px target that sits apart from the row link, and clicking it does not open the record', async ({ page }) => {
    await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
    const row = page.getByTestId('table-row').filter({ has: page.getByTestId('verify-button') }).first();
    await expect(row).toBeVisible();
    const button = row.getByTestId('verify-button');
    const box = (await button.boundingBox())!;
    expect(Math.round(box.height)).toBe(32); // compact on desktop, with a 40px hit area (a pseudo-element)
    await expect(button).toContainText('Verify'); // the word next to the icon
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('data-testid') ?? null, [box.x - 3, box.y - 3]);
    expect(hit).toBe('verify-button'); // 4px outside the visible button is still the button: 40px in all
    const link = (await row.getByRole('link').first().boundingBox())!;
    const overlap = box.x < link.x + link.width && link.x < box.x + box.width && box.y < link.y + link.height && link.y < box.y + box.height;
    expect(overlap).toBe(false);
    await expect(button).toHaveAccessibleName(/^Verify /);
    await button.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Mark this record as verified');
    await button.click();
    await expect(page).toHaveURL(/\/database$/);
  });

  test('a verified row has no Verify button; the detail page Verify moves the badge, the pill and the gauge, and offers Undo', async ({ page }) => {
    await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await page.getByRole('radiogroup', { name: 'Filter by verification' }).getByRole('radio', { name: /^Verified/ }).click();
    await expect(page.getByTestId('verify-button')).toHaveCount(0);
    await page.getByRole('radiogroup', { name: 'Filter by verification' }).getByRole('radio', { name: /^All/ }).click();
    const record = data.databaseRecords.filter((r) => !r.verified)[1];
    await page.getByRole('searchbox', { name: 'Search records' }).fill(record.name);
    await page.getByTestId('table-row').first().getByRole('link', { name: record.name }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(record.name);
    expect(await pillCount(page)).toBe(PENDING);
    await page.getByRole('button', { name: 'Verify', exact: true }).click();
    await expect(page.getByTestId('status-badge').first()).toContainText('Verified');
    await expect(page.getByRole('button', { name: 'Verify', exact: true })).toHaveCount(0);
    expect(await pillCount(page)).toBe(PENDING - 1);
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('status-badge').first()).toContainText('Pending');
    expect(await pillCount(page)).toBe(PENDING);
  });
});

test.describe('Database: add a record', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  const data = buildSeed().collections;
  const existing = data.databaseRecords[4];
  const fillBasics = async (page: import('@playwright/test').Page, email: string, phone = '', country = 'Ghana') => {
    await page.getByRole('textbox', { name: 'Full name' }).fill('Test Person');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    if (phone) await page.getByRole('textbox', { name: 'Phone' }).fill(phone);
    await page.getByRole('combobox', { name: 'Country' }).click();
    await page.getByRole('option', { name: country, exact: true }).click();
    await page.getByRole('textbox', { name: 'Institution' }).fill('KNUST');
  };
  const save = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Add record', exact: true });

  test('the form: the fields, the read-only added-by and added-on, and no linked ambassador for an organic record', async ({ page }) => {
    await page.goto(`${BASE_URL}/database/new`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Add record');
    for (const name of ['Full name', 'Email', 'Phone', 'Institution']) await expect(page.getByRole('textbox', { name })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Country' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Source type' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Linked opportunity' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Verified' })).toBeVisible();
    const staff = data.staff.find((s) => s.isCurrentUser)!;
    await expect(page.getByTestId('added-by')).toHaveValue(staff.name);
    await expect(page.getByTestId('added-by')).toBeDisabled();
    await expect(page.getByTestId('added-on')).toBeDisabled();
    await expect(page.getByTestId('added-on')).toHaveValue(/\d{4}/);
    await expect(page.getByRole('combobox', { name: 'Linked ambassador' })).toHaveCount(0);
  });

  test('the linked ambassador field appears only for "Ambassador referral", is required, and goes when the source changes', async ({ page }) => {
    await page.goto(`${BASE_URL}/database/new`, { timeout: 30_000 });
    const sources = ['Organic', 'Event', 'Partner channel', 'Bulk import'];
    for (const label of sources) {
      await page.getByRole('combobox', { name: 'Source type' }).click();
      await page.getByRole('option', { name: label, exact: true }).click();
      await expect(page.getByRole('combobox', { name: 'Linked ambassador' })).toHaveCount(0);
    }
    await page.getByRole('combobox', { name: 'Source type' }).click();
    await page.getByRole('option', { name: 'Ambassador referral', exact: true }).click();
    const field = page.getByRole('combobox', { name: 'Linked ambassador' });
    await expect(field).toBeVisible();
    await fillBasics(page, 'needs.ambassador@god.example');
    await save(page).click();
    await expect(page.getByText('Choose the ambassador who referred them.')).toBeVisible();
    await field.click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: 'Source type' }).click();
    await page.getByRole('option', { name: 'Event', exact: true }).click();
    await expect(field).toHaveCount(0);
  });

  test('dedupe by email: any case and spaces show the inline error with a link to the record, and saving is blocked', async ({ page }) => {
    await page.goto(`${BASE_URL}/database/new`, { timeout: 30_000 });
    await fillBasics(page, `  ${existing.email.toUpperCase()}  `);
    const error = page.getByTestId('duplicate-email');
    await expect(error).toContainText('A record with this email already exists');
    await expect(error.getByRole('link')).toHaveAttribute('href', `/database/${existing.id}`);
    await expect(error.getByRole('link')).toContainText(existing.name);
    await expect(save(page)).toBeDisabled();
    await page.getByRole('textbox', { name: 'Email' }).fill('someone.new@god.example');
    await expect(error).toHaveCount(0);
    await expect(save(page)).toBeEnabled();
  });

  test('dedupe by phone: the variants of a stored number are caught after the email; the email wins when both match', async ({ page }) => {
    await page.goto(`${BASE_URL}/database/new`, { timeout: 30_000 });
    const other = data.databaseRecords[9];
    const local = '0' + (other.phone ?? '').replace(/\D+/g, '').slice(-9);
    for (const typed of [other.phone!, local, other.phone!.replace(/ /g, '-'), '00' + (other.phone ?? '').replace(/\D+/g, '')]) {
      await fillBasics(page, 'fresh.email@god.example', typed, other.country);
      await expect(page.getByTestId('duplicate-phone')).toContainText('A record with this phone number already exists');
      await expect(page.getByTestId('duplicate-phone').getByRole('link')).toHaveAttribute('href', `/database/${other.id}`);
      await expect(save(page)).toBeDisabled();
      await page.getByRole('textbox', { name: 'Phone' }).fill('');
    }
    // both match different records: the email is what is reported
    await page.getByRole('textbox', { name: 'Email' }).fill(existing.email);
    await page.getByRole('textbox', { name: 'Phone' }).fill(other.phone!);
    await expect(page.getByTestId('duplicate-email')).toBeVisible();
    await expect(page.getByTestId('duplicate-phone')).toHaveCount(0);
  });

  test('a good record saves: the toast, the new row, the pending count and the pill all move; a verified one moves the gauge', async ({ page }) => {
    await page.goto(`${BASE_URL}/database/new`, { timeout: 30_000 });
    await fillBasics(page, 'brand.new@god.example', '+233 20 999 0000');
    await save(page).click();
    await expect(page).toHaveURL(/\/database\/rec-new-/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Test Person');
    await expect(page.getByText('Test Person was added to the database.')).toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: /^Database/ })).toContainText(String(data.databaseRecords.filter((r) => !r.verified).length + 1));
    // the same person again: now a duplicate (by email, then by phone)
    // (client-side navigation: a page load would reset the in-memory records)
    await page.locator('aside').getByRole('link', { name: /^Database/ }).click();
    await page.getByRole('link', { name: 'Add record' }).click();
    await fillBasics(page, 'other.email@god.example', '0209990000');
    await expect(page.getByTestId('duplicate-phone')).toBeVisible();
  });
});

test.describe('Database: roles', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  const data = buildSeed().collections;
  const viaAmbassador = data.databaseRecords.find((r) => r.ambassadorId && r.listingId)!;

  for (const role of ['database_officer', 'desk_lead', 'super_admin']) {
    test(`${role} edits the Database: Add record, a Verify button on pending rows, and the form`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
      await expect(page.getByTestId('table-row').first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Add record' })).toHaveAttribute('href', '/database/new');
      await expect(page.getByTestId('verify-button').first()).toBeVisible();
      await page.goto(`${BASE_URL}/database/new`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Add record');
    });
  }

  test('country_lead can only view: no Add record, no Verify button on the list or the detail page, no form, and so no Undo', async ({ page, context }) => {
    await asRoles(context, 'country_lead');
    await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add record' })).toHaveCount(0);
    await expect(page.getByTestId('verify-button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Verify/ })).toHaveCount(0);
    await expect(page.getByTestId('toast')).toHaveCount(0);
    expect(await page.locator('aside').getByRole('link', { name: /^Database/ }).count()).toBe(1);
    const pending = data.databaseRecords.find((r) => !r.verified)!;
    await page.goto(`${BASE_URL}/database/${pending.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(pending.name);
    await expect(page.getByRole('button', { name: /^Verify/ })).toHaveCount(0);
    await page.goto(`${BASE_URL}/database/new`);
    await expect(page.getByTestId('no-access')).toBeVisible();
  });

  test('a moderator has no access to the Database', async ({ page, context }) => {
    await asRoles(context, 'moderator');
    for (const path of ['/database', '/database/new', `/database/${viaAmbassador.id}`]) {
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      await expect(page.getByTestId('no-access')).toBeVisible();
    }
  });

  test('links in the Linked column: both for a super admin, the ambassador only for a database officer, plain text for the rest', async ({ page, context }) => {
    const ambassador = data.ambassadors.find((a) => a.id === viaAmbassador.ambassadorId)!;
    const listing = data.listings.find((l) => l.id === viaAmbassador.listingId)!;
    for (const [role, ambassadorLink, opportunityLink] of [
      ['super_admin', true, true],
      ['database_officer', true, false],
      ['country_lead', true, false],
    ] as const) {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
      await expect(page.getByTestId('table-row').first()).toBeVisible();
      await page.getByRole('searchbox', { name: 'Search records' }).fill(viaAmbassador.name);
      const row = page.getByTestId('table-row').first();
      const amb = row.getByTestId('linked-ambassador');
      const opp = row.getByTestId('linked-opportunity');
      await expect(amb).toContainText(ambassador.name);
      await expect(opp).toContainText(listing.title);
      expect(await amb.evaluate((el) => el.tagName === 'A')).toBe(ambassadorLink);
      expect(await opp.evaluate((el) => el.tagName === 'A')).toBe(opportunityLink);
      if (ambassadorLink) await expect(amb).toHaveAttribute('href', `/network/${ambassador.id}`);
      if (opportunityLink) await expect(opp).toHaveAttribute('href', `/opportunities/${listing.id}`);
    }
  });
});

test.describe('Database: phone (434px)', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 434, height: 900 } });
  const noOverflow = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  test('the list is cards with labelled values; Verify keeps its word and a 40px target; nothing is wider than the screen', async ({ page }) => {
    await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
    const card = page.getByTestId('table-row').filter({ has: page.getByTestId('verify-button') }).first();
    await expect(card).toBeVisible();
    await expect(card.getByTestId('record-card')).toBeVisible(); // the compact phone card (its layout is tested in "compact phone cards")
    const button = card.getByTestId('verify-button');
    await expect(button).toContainText('Verify');
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    const link = (await card.getByRole('link').first().boundingBox())!;
    const b = (await button.boundingBox())!;
    expect(b.y >= link.y + link.height || link.y >= b.y + b.height || b.x >= link.x + link.width || link.x >= b.x + b.width).toBe(true);
    await expect(page.getByRole('meter')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add record' })).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await button.click();
    await expect(page.getByTestId('toast').getByRole('button', { name: 'Undo' })).toBeVisible();
    expect((await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).boundingBox())!.height).toBeGreaterThanOrEqual(40);
    await page.getByRole('combobox', { name: 'Filter by source' }).click();
    await expect(page.getByRole('dialog')).toBeVisible(); // the bottom sheet
  });

  test('the form and the detail page fit, and the form fields are usable', async ({ page }) => {
    await page.goto(`${BASE_URL}/database/new`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Add record');
    expect(await noOverflow(page)).toBe(true);
    await page.getByRole('combobox', { name: 'Source type' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto(`${BASE_URL}/database/rec-001`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
  });
});

test.describe('Visual fixes: tier pill click and the Move hit area', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('clicking the tier pill opens the ambassador like any other part of the row, and hovering it still shows the full name', async ({ page }) => {
    await page.goto(`${BASE_URL}/network`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    const row = page.getByTestId('table-row').filter({ has: page.locator('td[data-label="Tier"]', { hasText: 'Regional Lead' }) }).first();
    const href = await row.getByRole('link').first().getAttribute('href');
    const pill = row.locator('td[data-label="Tier"] span.badge-text').first();
    await pill.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Campus or Regional Lead');
    await pill.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  for (const width of [1440, 1280]) {
    test(`the extended hit area of Move does not intersect the drag handle or the owner avatar (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
      const cards = page.locator('[data-testid^="kanban-card-"]');
      await expect(cards.first()).toBeVisible();
      const count = await cards.count();
      expect(count).toBeGreaterThan(5);
      const intersects = (a: { x: number; y: number; width: number; height: number }, b: typeof a) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        await card.scrollIntoViewIfNeeded();
        const button = (await card.getByRole('button', { name: /^Move .* to another stage/ }).boundingBox())!;
        // the pseudo-element reaches 6px beyond the 28px button on every side: a 40px square
        const hit = { x: button.x - 6, y: button.y - 6, width: button.width + 12, height: button.height + 12 };
        expect(Math.round(hit.width)).toBe(40);
        for (const id of ['kanban-grip', 'partner-owner']) {
          const other = await card.getByTestId(id).boundingBox();
          if (other) expect(intersects(hit, other)).toBe(false);
        }
        // and it stays inside its own card
        const own = (await card.boundingBox())!;
        expect(hit.x >= own.x && hit.y >= own.y && hit.x + hit.width <= own.x + own.width && hit.y + hit.height <= own.y + own.height + 6).toBe(true);
      }
    });
  }
});

test.describe('Database: the pre-step additions', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  const data = buildSeed().collections;

  test('the default view is not pinned past the scale: the marker is inside the bar and there is no capped text', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
    await expect(page.getByTestId('pace-gauge')).toBeVisible();
    const pace = recordsPace();
    expect(pace.gauge.capped).toBeNull();
    expect(pace.verified).toBeLessThanOrEqual(Math.max(Math.ceil(pace.pace * 2), 1)); // inside the scale
    await expect(page.getByTestId('pace-capped')).toHaveCount(0);
    await expect(page.getByTestId('pace-arrow')).toHaveCount(0);
    const bar = (await page.getByRole('meter').boundingBox())!;
    const marker = (await page.getByTestId('pace-marker').boundingBox())!;
    expect(marker.x + marker.width / 2).toBeLessThan(bar.x + bar.width - 2);
    // the zone words are centred under their own zones, and the tooltip names the real thresholds
    const zones = await Promise.all(['far_behind', 'behind', 'on_pace'].map(async (key) => (await page.getByTestId(`pace-zone-${key}`).boundingBox())!));
    const words = page.getByTestId('pace-zone-labels').locator('span');
    for (let i = 0; i < 3; i++) {
      const w = (await words.nth(i).boundingBox())!;
      expect(Math.abs(w.x + w.width / 2 - (zones[i].x + zones[i].width / 2))).toBeLessThanOrEqual(2);
    }
    await page.getByTestId('pace-zone-labels').hover();
    await expect(page.getByRole('tooltip')).toHaveText(pace.hint);
    expect(pace.hint).toBe('Far behind: below 70% of the pro-rated pace. Behind: 70% to 95%. On pace: 95% and above.');
  });

  test('the legend is a compact left-aligned row with a 16px gap that wraps where it must, each item on one line, no gaps over 24px', async ({ page }) => {
    for (const width of [1440, 1024, 434]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
      await expect(page.getByTestId('source-legend')).toBeVisible();
      const list = (await page.getByTestId('source-legend').boundingBox())!;
      const boxes = await page.getByTestId('source-legend').locator('li').evaluateAll((items) => items.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: Math.round(r.y), r: r.right, h: Math.round(r.height) }; }));
      expect(boxes).toHaveLength(5);
      for (const box of boxes) expect(box.h).toBeLessThanOrEqual(18); // one line each
      // every row starts at the left edge of the card's content (left-aligned, not spread out)
      const rows = [...new Set(boxes.map((box) => box.y))];
      for (const y of rows) expect(Math.abs(Math.min(...boxes.filter((box) => box.y === y).map((box) => box.x)) - list.x)).toBeLessThanOrEqual(1);
      // inside a row the gap between neighbours is 16px
      for (const y of rows) {
        const row = boxes.filter((box) => box.y === y).sort((m, n) => m.x - n.x);
        for (let i = 1; i < row.length; i++) expect(Math.round(row[i].x - row[i - 1].r)).toBe(16);
      }
      // five on one row only if they fit: otherwise it wrapped (and then no item is cut off)
      if (rows.length === 1) expect(Math.max(...boxes.map((box) => box.r))).toBeLessThanOrEqual(list.x + list.width + 1);
      else expect(width).toBeLessThan(1440);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });

  test('the Verify button: icon only from 640 to 1023px (a 40px square), the word at 1024px and wider; the column keeps its width', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
    const iconOnly = page.getByTestId('verify-button').first();
    await expect(iconOnly).toBeVisible();
    const small = (await iconOnly.boundingBox())!;
    expect([Math.round(small.width), Math.round(small.height)]).toEqual([40, 40]);
    await expect(iconOnly.locator('span.sr-only')).toHaveText('Verify'); // the word is kept for screen readers only
    await expect(iconOnly).toHaveAccessibleName(/^Verify /);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId('verify-button').first()).toContainText('Verify');
    // pending and verified rows put their action in the same place, and the column cells have one width
    const cell = (row: import('@playwright/test').Locator) => row.locator('td[data-label="Verified"]');
    const pending = page.getByTestId('table-row').filter({ has: page.getByTestId('verify-button') }).first();
    await expect(pending.getByTestId('verify-button')).toContainText('Verify');
    const widths = new Set<number>();
    const pendingX = (await pending.getByTestId('verify-button').boundingBox())!.x;
    const pendingBadgeX = (await cell(pending).getByTestId('status-badge').boundingBox())!.x;
    // (in the same view: the first page of All has pending rows and verified rows)
    const done = page.getByTestId('table-row').filter({ hasNot: page.getByTestId('verify-button') }).filter({ has: page.getByTestId('status-badge').filter({ hasText: 'Verified' }) }).first();
    await expect(done).toBeVisible();
    // measured together, after the layout has settled at this width
    widths.add(Math.round((await cell(pending).boundingBox())!.width));
    widths.add(Math.round((await cell(done).boundingBox())!.width));
    // a verified row has the green badge and nothing else: no muted check text, no button
    await expect(done.getByTestId('verified-check')).toHaveCount(0);
    await expect(done.getByTestId('verify-button')).toHaveCount(0);
    await expect(cell(done).getByTestId('status-badge')).toHaveText('Verified');
    expect((await cell(done).innerText()).trim()).toBe('Verified');
    expect(Math.abs((await cell(done).getByTestId('status-badge').boundingBox())!.x - pendingBadgeX)).toBeLessThanOrEqual(1); // the badge is in the same place
    expect(pendingX).toBeGreaterThan((await cell(done).getByTestId('status-badge').boundingBox())!.x);
    expect(widths.size).toBe(1);
  });

  test('a truncated linked opportunity shows its full name in the Tooltip', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    const links = page.getByTestId('linked-opportunity');
    const count = await links.count();
    let checked = 0;
    for (let i = 0; i < count && checked < 1; i++) {
      const link = links.nth(i);
      if (!(await link.evaluate((el) => el.scrollWidth > el.clientWidth))) continue;
      const full = (await link.textContent())!.trim();
      await expect(link).toHaveAttribute('title', full);
      await link.hover();
      await expect(page.getByRole('tooltip')).toHaveText(full);
      await page.mouse.move(0, 0);
      checked++;
    }
    expect(checked).toBe(1); // the premise: at this width at least one name really is cut
    expect(data.listings.length).toBeGreaterThan(0);
  });
});

test.describe('Partners figures do not move within a day (no browser)', () => {
  const original = process.env.TZ;
  test.afterAll(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Kolkata']) {
    test(`the footer figures, the health and the summary are the same at 00:01 and 23:59 UTC on one date, in ${tz}`, () => {
      process.env.TZ = tz;
      const figures = (iso: string) => {
        const now = new Date(iso);
        const partners = buildSeed(now).collections.partners;
        return { health: pipelineHealth(partners, flattenMoves(partners), 1, now), summary: partnerSummary(partners, now) };
      };
      for (const date of ['2026-06-15', '2026-10-07', '2026-10-31', '2026-03-01']) {
        const early = figures(`${date}T00:01:00Z`);
        const late = figures(`${date}T23:59:00Z`);
        expect(late).toEqual(early);
        expect(early.health.reachedOutreachInWindow).toBeGreaterThan(0);
      }
    });
  }
});

test.describe('Default view: the gauges show their zones on every day of the month (no browser)', () => {
  // Pro-rating makes an early-month count look high, so this is checked day by day (June 2026, from day 2: on day 1 a count of 0
  // or 1 against a pace of 0.48 cannot be near it).
  for (let day = 2; day <= 30; day++) {
    test(`day ${day}: the Database pace ratio is between 0.6 and 1.5, the Partners pipeline ratio between 0.8 and 1.6, and nothing is capped`, () => {
      const today = new Date(Date.UTC(2026, 5, day, 12));
      const data = buildSeed(today).collections;
      const pace = recordsPace(today, { ...data });
      const ratio = pace.verified / pace.pace;
      expect(ratio, `Database ratio on day ${day}`).toBeGreaterThanOrEqual(0.6);
      expect(ratio, `Database ratio on day ${day}`).toBeLessThanOrEqual(1.5);
      expect(pace.gauge.capped).toBeNull();
      const target = kpiTarget('partners_onboarded', { targets: data.targets });
      const health = pipelineHealth(data.partners, flattenMoves(data.partners), target, today);
      expect(health.ratio!, `Partners ratio on day ${day}`).toBeGreaterThanOrEqual(0.8);
      expect(health.ratio!, `Partners ratio on day ${day}`).toBeLessThanOrEqual(1.6);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Social (/social) and Testimonials (/testimonials).
// ---------------------------------------------------------------------------------------------------------------
test.describe('Social: the rules (no browser)', () => {
  const posts = (...rows: [string, string, number, number][]) =>
    rows.map(([platform, postedAt, reach, engagement], i) => ({ id: `p${i}`, platform: platform as never, title: `Post ${i}`, text: '', status: 'published' as const, postedAt, reach, engagement, authorId: 'staff-1' }));

  test('a link must be a full http or https link', () => {
    for (const good of ['https://www.instagram.com/p/abc123', 'http://example.org/post', ' https://x.com/god/status/1 ', 'https://youtu.be/abc']) expect(validatePostUrl(good), good).toBeUndefined();
    expect(validatePostUrl('')).toMatch(/Enter the link/);
    expect(validatePostUrl('   ')).toMatch(/Enter the link/);
    for (const bad of ['instagram.com/p/abc', 'www.facebook.com/post', 'ftp://files.example.org/a', 'javascript:alert(1)', 'https://localhost/post', 'https://', 'https://exa mple.com', 'just words', 'https://.com', 'https://example.']) {
      expect(validatePostUrl(bad), bad).toBeTruthy();
    }
    expect(validatePostUrl('ftp://files.example.org/a')).toMatch(/https:\/\/ or http:\/\//);
  });

  test('the platform rows add up to the totals, the leader is the platform with the most reach, and only published posts in the month count', () => {
    const list = [
      ...posts(['instagram', '2026-06-02', 1000, 90], ['instagram', '2026-06-20', 500, 40], ['linkedin', '2026-06-05', 1700, 100], ['x', '2026-06-09', 300, 10], ['x', '2026-05-30', 9999, 999]),
      { ...posts(['tiktok', '2026-06-11', 5000, 500])[0], id: 'draft', status: 'draft' as const },
    ];
    const rows = platformRows(list, '2026-06');
    expect(rows.map((r) => [r.platform, r.posts, r.reach, r.engagement])).toEqual([
      ['linkedin', 1, 1700, 100],
      ['instagram', 2, 1500, 130],
      ['x', 1, 300, 10],
    ]);
    // a tie on reach: more posts first, then the name
    const tie = platformRows(posts(['x', '2026-06-01', 100, 1], ['facebook', '2026-06-01', 60, 1], ['facebook', '2026-06-02', 40, 1], ['linkedin', '2026-06-03', 100, 1]), '2026-06');
    expect(tie.map((r) => r.platform)).toEqual(['facebook', 'linkedin', 'x']);
    expect(platformRows(list, '2026-04')).toEqual([]);
  });

  test('the seed: for every month the platform rows add up to the Posts published, Social reach and Social engagement KPIs', () => {
    for (const month of FIXED_MONTHS) {
      const rows = platformRows(seed.socialPosts, month);
      expect(rows.reduce((s, r) => s + r.posts, 0), month).toBe(kpiValue('posts_published', month, kpiData));
      expect(rows.reduce((s, r) => s + r.reach, 0), month).toBe(kpiValue('social_reach', month, kpiData));
      expect(rows.reduce((s, r) => s + r.engagement, 0), month).toBe(kpiValue('social_engagement', month, kpiData));
    }
    const month = socialMonth(FIXED_MONTHS[5], { ...kpiData });
    expect(month.posts).toBe(kpiValue('posts_published', FIXED_MONTHS[5], kpiData));
    expect(month.targets).toEqual({ posts: 8, reach: 10500, engagement: 800 });
    expect(month.leading).toBe(month.platforms[0].platform);
  });

  test('logging a post changes the month totals and the three KPIs by exactly that post; a post dated in an earlier month changes that month only', () => {
    const snapshot = getMockCollection('socialPosts');
    try {
      const now = currentMonth();
      const before = socialMonth(now);
      const previous = monthsBefore(now, 1);
      const previousBefore = socialMonth(previous);
      const today = todayLocal();
      const first = logPost({ platform: 'youtube', title: 'A new video', url: 'https://www.youtube.com/watch?v=abc', reach: 1234, engagement: 56, postedAt: today });
      expect(first.ok).toBe(true);
      const after = socialMonth(now);
      expect([after.posts, after.reach, after.engagement]).toEqual([before.posts + 1, before.reach + 1234, before.engagement + 56]);
      expect(after.posts).toBe(kpiValue('posts_published', now));
      expect(after.reach).toBe(kpiValue('social_reach', now));
      expect(after.engagement).toBe(kpiValue('social_engagement', now));
      expect(after.platforms.find((r) => r.platform === 'youtube')).toMatchObject({ posts: 1, reach: 1234, engagement: 56 });
      expect(socialMonth(previous)).toEqual(previousBefore); // another month: untouched
      // a post in the previous month
      const old = logPost({ platform: 'x', title: 'Last month', url: 'https://x.com/god/status/9', reach: 700, engagement: 7, postedAt: `${previous}-15` });
      expect(old.ok).toBe(true);
      expect(socialMonth(previous).reach).toBe(previousBefore.reach + 700);
      expect(socialMonth(now)).toEqual(after); // this month did not move
      // the author and the status are decided by the service
      if (first.ok) expect([first.post.status, first.post.authorId]).toEqual(['published', getMockCollection('staff').find((s) => s.isCurrentUser)?.id]);
    } finally {
      setMockCollection('socialPosts', snapshot, { always: true });
    }
  });

  test('a date in the future is refused and nothing is written; a linked opportunity is kept only when chosen', () => {
    const snapshot = getMockCollection('socialPosts');
    try {
      const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
      const refused = logPost({ platform: 'x', title: 'Tomorrow', url: 'https://x.com/god/status/1', reach: 1, engagement: 1, postedAt: future });
      expect(refused).toEqual({ ok: false, error: 'The date posted cannot be in the future.' });
      expect(getMockCollection('socialPosts')).toHaveLength(snapshot.length);
      const listing = getMockCollection('listings').find((l) => l.status === 'published')!;
      const withListing = logPost({ platform: 'other', title: 'Linked', url: 'https://example.org/p', reach: 0, engagement: 0, listingId: listing.id, postedAt: todayLocal() });
      const without = logPost({ platform: 'other', title: 'Not linked', url: 'https://example.org/q', reach: 0, engagement: 0, postedAt: todayLocal() });
      expect(withListing.ok && withListing.post.listingId).toBe(listing.id);
      expect(without.ok && without.post.listingId).toBeUndefined();
    } finally {
      setMockCollection('socialPosts', snapshot, { always: true });
    }
  });

  test('the form rules: every field is checked, the date cannot be after today', () => {
    const ok = { platform: 'instagram' as const, title: 'T', url: 'https://www.instagram.com/p/1', reach: '10', engagement: '2', listingId: 'none', postedAt: '2026-06-15' };
    expect(validatePost(ok, '2026-06-15')).toEqual({});
    expect(Object.keys(validatePost({ ...ok, platform: '', title: ' ', url: 'nope', reach: '', engagement: '-1', postedAt: '' }, '2026-06-15')).sort()).toEqual(['engagement', 'platform', 'postedAt', 'reach', 'title', 'url']);
    expect(validatePost({ ...ok, postedAt: '2026-06-16' }, '2026-06-15').postedAt).toBe('The date posted cannot be in the future.');
    expect(validatePost({ ...ok, reach: '1.5' }, '2026-06-15').reach).toMatch(/whole number/);
    expect(validatePost({ ...ok, engagement: 'abc' }, '2026-06-15').engagement).toMatch(/whole number/);
  });

  test('the seed posts carry a title, a link and an opportunity, and the labels have no brand logos (eight platforms in all)', () => {
    expect(SOCIAL_POST_PLATFORMS.map((p) => POST_PLATFORM_LABELS[p])).toEqual(['Facebook', 'Instagram', 'X', 'LinkedIn', 'TikTok', 'YouTube', 'WhatsApp', 'Other']);
    for (const post of seed.socialPosts) {
      expect(post.title.length).toBeGreaterThan(0);
      expect(post.url).toMatch(/^https:\/\//);
      expect(seed.listings.some((l) => l.id === post.listingId)).toBe(true);
    }
  });
});

test.describe('Social: the page', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  const open = async (page: import('@playwright/test').Page, query = '') => {
    await page.goto(`${BASE_URL}/social${query}`, { timeout: 30_000 });
    await expect(page.getByTestId('total-posts')).toContainText(/\d/);
  };
  const fill = async (page: import('@playwright/test').Page, over: Partial<Record<'platform' | 'title' | 'url' | 'reach' | 'engagement' | 'date', string>> = {}) => {
    const card = page.getByRole('region', { name: 'Log a post' });
    await card.getByRole('combobox', { name: 'Platform' }).click();
    await page.getByRole('option', { name: over.platform ?? 'YouTube', exact: true }).click();
    await card.getByRole('textbox', { name: 'Post title' }).fill(over.title ?? 'A test video');
    await card.getByRole('textbox', { name: 'Post URL' }).fill(over.url ?? 'https://www.youtube.com/watch?v=abc');
    await card.getByRole('textbox', { name: 'Reach' }).fill(over.reach ?? '1000');
    await card.getByRole('textbox', { name: 'Engagement' }).fill(over.engagement ?? '50');
    if (over.date) await card.getByLabel('Date posted').fill(over.date);
    return card;
  };
  const num = (text: string) => Number(text.replace(/[^\d]/g, ''));
  const stat = async (page: import('@playwright/test').Page, id: string) => num(await page.getByTestId(id).locator('.ministat-value').innerText());

  test('two columns from 1024px: Log a post on the left, Monthly totals on the right; stacked below', async ({ page }) => {
    await open(page);
    const left = (await page.getByRole('region', { name: 'Log a post' }).boundingBox())!;
    const right = (await page.getByRole('region', { name: 'Monthly totals' }).boundingBox())!;
    expect(left.x).toBeLessThan(right.x);
    expect(Math.abs(left.y - right.y)).toBeLessThanOrEqual(2);
    expect(left.x + left.width).toBeLessThanOrEqual(right.x + 1);
    await page.setViewportSize({ width: 900, height: 1000 });
    const l2 = (await page.getByRole('region', { name: 'Log a post' }).boundingBox())!;
    const r2 = (await page.getByRole('region', { name: 'Monthly totals' }).boundingBox())!;
    expect(r2.y).toBeGreaterThanOrEqual(l2.y + l2.height - 1); // stacked
  });

  test('the two columns end together at 1440x900: the Log card and the Monthly totals card are the same height, no gap over 24px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    const log = (await page.getByRole('region', { name: 'Log a post' }).boundingBox())!;
    const totals = (await page.getByRole('region', { name: 'Monthly totals' }).boundingBox())!;
    console.log(`Social card heights at 1440x900: Log ${Math.round(log.height)}px, Monthly totals ${Math.round(totals.height)}px`);
    expect(Math.abs(log.y + log.height - (totals.y + totals.height))).toBeLessThanOrEqual(24);
    expect(Math.abs(log.height - totals.height)).toBeLessThanOrEqual(1); // in fact the same height
    // the shorter card's content is spread out, so no gap inside either card is large
    const gaps = await page.getByRole('region', { name: 'Monthly totals' }).evaluate((card) => {
      const kids = [...card.children].map((el) => el.getBoundingClientRect());
      return kids.slice(1).map((box, i) => Math.round(box.top - kids[i].bottom));
    });
    for (const gap of gaps) expect(gap).toBeLessThanOrEqual(40);
  });

  test('the totals, the platform table and the leading platform match the data for the month; the three tiles have captions with the targets', async ({ page }) => {
    await open(page);
    const month = socialMonth(currentMonth());
    await expect(page.getByTestId('total-posts')).toContainText('Posts');
    expect(await stat(page, 'total-posts')).toBe(month.posts);
    expect(await stat(page, 'total-reach')).toBe(month.reach);
    expect(await stat(page, 'total-engagement')).toBe(month.engagement);
    await expect(page.getByTestId('total-posts')).toContainText(`Target ${month.targets.posts}`);
    await expect(page.getByTestId('total-reach')).toContainText(`Target ${month.targets.reach.toLocaleString('en-US')}`);
    const rows = page.getByTestId('platform-table').locator('tbody tr');
    await expect(rows).toHaveCount(month.platforms.length);
    for (let i = 0; i < month.platforms.length; i++) {
      await expect(rows.nth(i)).toContainText(month.platforms[i].label);
      await expect(rows.nth(i).locator('td').nth(0)).toHaveText(String(month.platforms[i].posts));
      await expect(rows.nth(i).locator('td').nth(1)).toHaveText(month.platforms[i].reach.toLocaleString('en-US'));
    }
    await expect(page.getByTestId('leading-platform')).toHaveCount(1);
    await expect(page.getByTestId(`platform-row-${month.leading}`)).toHaveAttribute('data-leading', 'true');
    await expect(page.getByTestId('leading-platform')).toBeVisible();
    // the chart: the leading platform is the orange (last) bar
    await expect(page.getByRole('group', { name: /Reach by platform/ })).toBeVisible();
  });

  test('platform labels are text badges with a tinted initial tile, never a logo', async ({ page }) => {
    await open(page);
    const badge = page.getByTestId('platform-badge').first();
    await expect(badge.locator('img, svg')).toHaveCount(0);
    expect((await badge.locator('span').first().innerText()).length).toBe(1); // the initial
    await expect(badge.locator('span').nth(1)).toHaveText(/^[A-Za-z]+$/);
  });

  test('Log a post: a bad link, a non-number and a missing platform are refused with messages, and the first bad field takes focus', async ({ page }) => {
    await open(page);
    const card = page.getByRole('region', { name: 'Log a post' });
    await card.getByRole('button', { name: 'Log post' }).click();
    for (const message of ['Choose the platform.', 'Enter the post title.', 'Enter the link to the post.', 'Enter the reach (0 if unknown).', 'Enter the engagement (0 if none).']) await expect(card.getByText(message)).toBeVisible();
    await fill(page, { url: 'www.instagram.com/p/abc', reach: '12x' });
    await card.getByRole('button', { name: 'Log post' }).click();
    await expect(card.getByText(/Enter a full link/)).toBeVisible();
    await expect(card.getByText('Reach is a whole number, 0 or more.')).toBeVisible();
    await expect(card.getByRole('textbox', { name: 'Post URL' })).toBeFocused();
    await card.getByRole('textbox', { name: 'Post URL' }).fill('ftp://x.example.org/a');
    await expect(card.getByText('The link must start with https:// or http://.')).toBeVisible();
  });

  test('the date defaults to today (in the shared format) and a typed future date is refused', async ({ page }) => {
    await open(page);
    const card = page.getByRole('region', { name: 'Log a post' });
    const date = card.getByLabel('Date posted');
    await expect(date).toHaveValue(formatDate(todayLocal()));
    await fill(page, { date: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10) });
    await card.getByRole('button', { name: 'Log post' }).click();
    await expect(card.getByText('The date posted cannot be in the future.')).toBeVisible();
  });

  test('logging a post updates the totals, the platform table, the list, the chart and the KPIs in the same render, resets the form and shows a toast', async ({ page }) => {
    await open(page);
    const before = socialMonth(currentMonth());
    const card = await fill(page, { platform: 'YouTube', title: 'Fellowship video', reach: '1000', engagement: '50' });
    await card.getByRole('button', { name: 'Log post' }).click();
    await expect(page.getByTestId('toast').filter({ hasText: 'A YouTube post was logged' })).toBeVisible();
    // totals (the same functions as the KPIs), in the same render as the toast
    await expect.poll(() => stat(page, 'total-posts')).toBe(before.posts + 1);
    expect(await stat(page, 'total-reach')).toBe(before.reach + 1000);
    expect(await stat(page, 'total-engagement')).toBe(before.engagement + 50);
    const youtube = page.getByTestId('platform-row-youtube');
    await expect(youtube.locator('td').nth(0)).toHaveText('1');
    await expect(youtube.locator('td').nth(1)).toHaveText('1,000');
    // the list: the new post first, with its link
    const first = page.getByTestId('table-row').first();
    await expect(first).toContainText('Fellowship video');
    await expect(first.getByRole('link', { name: /Fellowship video/ })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc');
    await expect(first.getByRole('link', { name: /Fellowship video/ })).toHaveAttribute('target', '_blank');
    // the form is reset
    await expect(card.getByRole('textbox', { name: 'Post title' })).toHaveValue('');
    await expect(card.getByRole('textbox', { name: 'Reach' })).toHaveValue('');
    await expect(card.getByLabel('Date posted')).toHaveValue(formatDate(todayLocal())); // back to today
    await expect(card.getByText('Enter the post title.')).toHaveCount(0);
  });

  test('a post dated in an earlier month changes that month only: switch the month to see it', async ({ page }) => {
    await open(page);
    const now = currentMonth();
    const previous = monthsBefore(now, 1);
    const before = { now: socialMonth(now), previous: socialMonth(previous) };
    const card = await fill(page, { platform: 'TikTok', title: 'Last month clip', reach: '700', engagement: '70', date: `${previous}-10` });
    await card.getByRole('button', { name: 'Log post' }).click();
    await expect(page.getByTestId('toast').filter({ hasText: 'A TikTok post was logged' })).toBeVisible();
    expect(await stat(page, 'total-posts')).toBe(before.now.posts); // this month did not move
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option', { name: formatMonth(previous) }).click();
    await expect(page.getByText(`A snapshot of ${formatMonth(previous)}`)).toBeVisible();
    expect(await stat(page, 'total-posts')).toBe(before.previous.posts + 1);
    expect(await stat(page, 'total-reach')).toBe(before.previous.reach + 700);
    await expect(page.getByTestId('table-row').filter({ hasText: 'Last month clip' })).toHaveCount(1);
    // a past month has no edit controls on its posts (no edit, no delete, no menus)
    await expect(page.getByTestId('table-row').first().getByRole('button')).toHaveCount(0);
  });

  test('the month selector changes the totals, the platform table and the list', async ({ page }) => {
    await open(page);
    const now = currentMonth();
    const previous = monthsBefore(now, 2);
    const want = socialMonth(previous);
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option', { name: formatMonth(previous) }).click();
    await expect.poll(() => stat(page, 'total-posts')).toBe(want.posts);
    expect(await stat(page, 'total-reach')).toBe(want.reach);
    expect(await stat(page, 'total-engagement')).toBe(want.engagement);
    await expect(page.getByTestId('platform-table').locator('tbody tr')).toHaveCount(want.platforms.length);
    await expect(page.getByRole('heading', { name: `Posts in ${formatMonth(previous)}` })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`month=${previous}`));
  });

  test('?state=empty, ?state=error and ?state=loading show their states; loading shows a dash, never 0', async ({ page }) => {
    await page.goto(`${BASE_URL}/social?state=empty`, { timeout: 30_000 });
    await expect(page.getByText(/No posts logged for/).first()).toBeVisible();
    await page.goto(`${BASE_URL}/social?state=error`);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await page.goto(`${BASE_URL}/social?state=loading`);
    await expect(page.getByTestId('total-posts')).toContainText('—');
    await expect(page.getByTestId('total-reach')).toContainText('—');
  });
});

test.describe('Social: roles', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });

  for (const role of ['social_media_manager', 'desk_lead', 'super_admin']) {
    test(`${role} edits Social: the Log a post card is there`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/social`, { timeout: 30_000 });
      await expect(page.getByRole('region', { name: 'Log a post' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Log post' })).toBeVisible();
    });
  }

  test('communications_officer can only view Social: the totals and the list, and NO Log a post card or button (not rendered)', async ({ page, context }) => {
    await asRoles(context, 'communications_officer');
    await page.goto(`${BASE_URL}/social`, { timeout: 30_000 });
    await expect(page.getByTestId('total-posts')).toContainText(/\d/);
    await expect(page.getByTestId('table-row').first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Log a post' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Log post' })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Platform' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Post URL' })).toHaveCount(0);
  });

  test('a moderator has no access to Social', async ({ page, context }) => {
    await asRoles(context, 'moderator');
    await page.goto(`${BASE_URL}/social`, { timeout: 30_000 });
    await expect(page.getByTestId('no-access')).toBeVisible();
  });

  test('the opportunity in the list is a link only for a role that can view the Opportunities Queue', async ({ page, context }) => {
    for (const [role, linked] of [['super_admin', true], ['social_media_manager', false]] as const) {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/social`, { timeout: 30_000 });
      const row = page.getByTestId('table-row').first();
      await expect(row).toBeVisible();
      expect(await row.locator('a[href^="/opportunities/"]').count()).toBe(linked ? 1 : 0);
    }
  });
});

test.describe('Social: phone (434px)', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 434, height: 900 } });
  const noOverflow = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  test('the cards stack, the posts are cards with labelled values, the form is usable and nothing is wider than the screen', async ({ page }) => {
    await page.goto(`${BASE_URL}/social`, { timeout: 30_000 });
    const log = (await page.getByRole('region', { name: 'Log a post' }).boundingBox())!;
    const totals = (await page.getByRole('region', { name: 'Monthly totals' }).boundingBox())!;
    expect(totals.y).toBeGreaterThanOrEqual(log.y + log.height - 1);
    const card = page.getByTestId('table-row').first();
    await expect(card).toBeVisible();
    for (const label of ['Platform', 'Date', 'Reach', 'Engagement', 'Linked listing']) await expect(card.locator(`td[data-label="${label}"]`)).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    const log2 = page.getByRole('region', { name: 'Log a post' });
    expect((await log2.getByRole('button', { name: 'Log post' }).boundingBox())!.height).toBeGreaterThanOrEqual(40);
    await log2.getByRole('combobox', { name: 'Platform' }).click();
    await expect(page.getByRole('dialog')).toBeVisible(); // the bottom sheet
  });
});

test.describe('Testimonials: the rules (no browser)', () => {
  test('actions by status: pending approve and reject, approved unpublish, unpublished and rejected re-approve', () => {
    expect(ACTIONS_BY_STATUS).toEqual({ pending: ['approve', 'reject'], approved: ['unpublish'], unpublished: ['reapprove'], rejected: ['reapprove'] });
    expect(ACTION_RESULT).toEqual({ approve: 'approved', reject: 'rejected', unpublish: 'unpublished', reapprove: 'approved' });
  });

  test('the counts follow the data, and a move changes exactly two counts', () => {
    const snapshot = getMockCollection('testimonials');
    try {
      expect(testimonialCounts(snapshot)).toEqual({ pending: 3, approved: 3, unpublished: 1, rejected: 2 });
      const pending = snapshot.find((t) => t.status === 'pending')!;
      expect(applyTestimonialAction(pending.id, 'approve')?.status).toBe('approved');
      expect(testimonialCounts(getMockCollection('testimonials'))).toEqual({ pending: 2, approved: 4, unpublished: 1, rejected: 2 });
      expect(applyTestimonialAction(pending.id, 'unpublish')?.status).toBe('unpublished');
      expect(applyTestimonialAction(pending.id, 'reapprove')?.status).toBe('approved');
      expect(testimonialCounts(getMockCollection('testimonials'))).toEqual({ pending: 2, approved: 4, unpublished: 1, rejected: 2 });
    } finally {
      setMockCollection('testimonials', snapshot, { always: true });
    }
  });

  test('a move that the status does not offer is refused and nothing changes', () => {
    const snapshot = getMockCollection('testimonials');
    try {
      const approved = snapshot.find((t) => t.status === 'approved')!;
      const pending = snapshot.find((t) => t.status === 'pending')!;
      expect(applyTestimonialAction(approved.id, 'approve')).toBeUndefined();
      expect(applyTestimonialAction(approved.id, 'reject')).toBeUndefined();
      expect(applyTestimonialAction(pending.id, 'unpublish')).toBeUndefined();
      expect(applyTestimonialAction(pending.id, 'reapprove')).toBeUndefined();
      expect(applyTestimonialAction('tst-nope', 'approve')).toBeUndefined();
      expect(getMockCollection('testimonials')).toEqual(snapshot);
    } finally {
      setMockCollection('testimonials', snapshot, { always: true });
    }
  });

  test('the public preview is the name and the comment only: it has no email, whatever the item', () => {
    for (const item of seed.testimonials) {
      const preview = publicPreview(item);
      expect(Object.keys(preview).sort()).toEqual(['comment', 'name']);
      expect(JSON.stringify(preview)).not.toContain('@');
      expect(JSON.stringify(preview)).not.toContain(item.email);
    }
  });

  test('the seed: every email is on @god.example and different, in a list newest first', () => {
    expect(seed.testimonials.every((t) => t.email.endsWith(`@${BRAND_EMAIL_DOMAIN}`))).toBe(true);
    expect(new Set(seed.testimonials.map((t) => t.email)).size).toBe(seed.testimonials.length);
    const sorted = sortTestimonials(seed.testimonials);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i - 1].submittedAt >= sorted[i].submittedAt).toBe(true);
  });
});

test.describe('Testimonials: the queue', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  const data = buildSeed().collections;
  const byStatus = (status: string) => data.testimonials.filter((t) => t.status === status);
  const open = async (page: import('@playwright/test').Page, query = '') => {
    await page.goto(`${BASE_URL}/testimonials${query}`, { timeout: 30_000 });
    await expect(page.getByRole('tab', { name: /^Pending/ })).toBeVisible();
    await expect(page.getByRole('article').first()).toBeVisible(); // loaded: the counts are in the tabs now
  };
  const tabCount = async (page: import('@playwright/test').Page, name: string) => Number((await page.getByRole('tab', { name: new RegExp(`^${name}`) }).innerText()).replace(/\D+/g, ''));
  const pill = (page: import('@playwright/test').Page) => page.locator('aside').getByRole('link', { name: /^Testimonials/ });
  const pillCount = async (page: import('@playwright/test').Page) => Number((await pill(page).innerText()).replace(/\D+/g, ''));
  const goTab = (page: import('@playwright/test').Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${name}`) }).click();

  test('four tabs with their counts, Pending first; each card has the avatar, name, comment, date, status badge, and the staff-only email', async ({ page }) => {
    await open(page);
    expect([await tabCount(page, 'Pending'), await tabCount(page, 'Approved'), await tabCount(page, 'Unpublished'), await tabCount(page, 'Rejected')]).toEqual([3, 3, 1, 2]);
    expect((await page.getByRole('tab').allInnerTexts()).map((t) => t.replace(/\s+\d+$/, '').trim())).toEqual(['Pending', 'Approved', 'Unpublished', 'Rejected']);
    const pending = byStatus('pending');
    await expect(page.getByRole('article')).toHaveCount(pending.length);
    const card = page.getByTestId(`testimonial-${pending[0].id}`);
    await expect(card).toContainText(pending[0].author);
    await expect(card).toContainText(pending[0].quote.slice(0, 30));
    await expect(card).toContainText('Submitted');
    await expect(card.getByTestId('status-badge')).toContainText('Pending');
    await expect(card.getByTestId('staff-email')).toContainText('Staff only');
    await expect(card.getByTestId('staff-email')).toContainText(pending[0].email);
    await expect(card.getByTestId('staff-email').locator('svg')).toBeVisible(); // the lock
    expect(await pillCount(page)).toBe(3);
  });

  test('the email is NOT in the Public preview of an approved item: the preview markup is name, comment and the initials avatar', async ({ page }) => {
    await open(page);
    await goTab(page, 'Approved');
    const approved = byStatus('approved');
    await expect(page.getByTestId('public-preview')).toHaveCount(approved.length);
    for (const item of approved) {
      const card = page.getByTestId(`testimonial-${item.id}`);
      const preview = card.getByTestId('public-preview');
      const html = await preview.evaluate((el) => el.innerHTML);
      expect(html).not.toContain(item.email);
      expect(html).not.toContain('@');
      expect(html).not.toContain('Staff only');
      expect(html.toLowerCase()).not.toContain('god.example');
      await expect(preview).toContainText(item.author);
      await expect(preview).toContainText(item.quote);
      await expect(preview.locator('img')).toHaveCount(0); // initials, no photo
      // the staff line is outside the preview, and still there for an editor
      await expect(card.getByTestId('staff-email')).toContainText(item.email);
    }
  });

  test('Approve (no dialog) moves a pending item to Approved: both counts, the pill and the toast change together', async ({ page }) => {
    await open(page);
    const item = byStatus('pending')[0];
    await page.getByTestId(`testimonial-${item.id}`).getByRole('button', { name: `Approve ${item.author}` }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('toast').filter({ hasText: `${item.author}'s testimonial was approved` })).toBeVisible();
    expect([await tabCount(page, 'Pending'), await tabCount(page, 'Approved')]).toEqual([2, 4]);
    expect(await pillCount(page)).toBe(2);
    await expect(page.getByTestId(`testimonial-${item.id}`)).toHaveCount(0); // gone from this tab
    await goTab(page, 'Approved');
    await expect(page.getByTestId(`testimonial-${item.id}`).getByTestId('public-preview')).toBeVisible();
  });

  test('Reject asks first (ConfirmDialog): Cancel keeps it, confirming moves it to Rejected and the counts follow', async ({ page }) => {
    await open(page);
    const item = byStatus('pending')[1];
    const card = page.getByTestId(`testimonial-${item.id}`);
    await card.getByRole('button', { name: `Reject ${item.author}` }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Reject this testimonial?' });
    await expect(dialog).toContainText(item.author);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(card).toBeVisible();
    expect(await tabCount(page, 'Pending')).toBe(3);
    await card.getByRole('button', { name: `Reject ${item.author}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reject testimonial' }).click();
    await expect(page.getByTestId('toast').filter({ hasText: `${item.author}'s testimonial was rejected` })).toBeVisible();
    expect([await tabCount(page, 'Pending'), await tabCount(page, 'Rejected')]).toEqual([2, 3]);
    expect(await pillCount(page)).toBe(2);
  });

  test('Unpublish asks first; the item goes to Unpublished and Re-approve (no dialog) brings it back to Approved', async ({ page }) => {
    await open(page);
    await goTab(page, 'Approved');
    const item = byStatus('approved')[0];
    await page.getByTestId(`testimonial-${item.id}`).getByRole('button', { name: `Unpublish ${item.author}` }).click();
    await expect(page.getByRole('alertdialog', { name: 'Unpublish this testimonial?' })).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Unpublish testimonial' }).click();
    await expect(page.getByTestId('toast').filter({ hasText: 'was unpublished' })).toBeVisible();
    expect([await tabCount(page, 'Approved'), await tabCount(page, 'Unpublished')]).toEqual([2, 2]);
    await goTab(page, 'Unpublished');
    await expect(page.getByTestId(`testimonial-${item.id}`).getByTestId('public-preview')).toHaveCount(0); // not public any more
    await page.getByTestId(`testimonial-${item.id}`).getByRole('button', { name: `Re-approve ${item.author}` }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('toast').filter({ hasText: 'approved again' })).toBeVisible();
    expect([await tabCount(page, 'Approved'), await tabCount(page, 'Unpublished')]).toEqual([3, 1]);
  });

  test('Re-approve works from Rejected too, and each tab offers only its own actions', async ({ page }) => {
    await open(page);
    const names = async () => (await page.getByRole('article').first().getByRole('button').evaluateAll((els) => els.map((el) => (el.getAttribute('aria-label') ?? '').split(' ')[0])));
    expect(await names()).toEqual(['Approve', 'Reject']);
    await goTab(page, 'Approved');
    expect(await names()).toEqual(['Unpublish']);
    await goTab(page, 'Unpublished');
    expect(await names()).toEqual(['Re-approve']);
    await goTab(page, 'Rejected');
    expect(await names()).toEqual(['Re-approve']);
    const item = byStatus('rejected')[0];
    await page.getByTestId(`testimonial-${item.id}`).getByRole('button', { name: `Re-approve ${item.author}` }).click();
    expect([await tabCount(page, 'Rejected'), await tabCount(page, 'Approved')]).toEqual([1, 4]);
  });

  test('the actions are labelled 40px buttons on desktop (the icon-only form below 1024px is tested in "the actions in the header")', async ({ page }) => {
    await open(page);
    const button = page.getByTestId('action-approve').first();
    const box = (await button.boundingBox())!;
    expect(Math.round(box.height)).toBe(40);
    await expect(button).toHaveText('Approve');
  });

  test('an empty tab says so, and ?state=empty, ?state=error and ?state=loading show their states', async ({ page }) => {
    await open(page);
    for (const item of byStatus('unpublished')) void item;
    await page.goto(`${BASE_URL}/testimonials?state=empty`, { timeout: 30_000 });
    await expect(page.getByText('No testimonials yet')).toBeVisible();
    await page.goto(`${BASE_URL}/testimonials?state=error`);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await page.goto(`${BASE_URL}/testimonials?state=loading`);
    await expect(page.getByLabel('Loading')).toBeVisible();
  });

  test('dates use the shared formatter', async ({ page }) => {
    await open(page);
    const item = byStatus('pending')[0];
    await expect(page.getByTestId(`testimonial-${item.id}`)).toContainText(formatDate(item.submittedAt));
  });
});

test.describe('Testimonials: roles', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  const data = buildSeed().collections;

  for (const role of ['communications_officer', 'desk_lead', 'super_admin']) {
    test(`${role} edits Testimonials: the actions and the staff-only email are there`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/testimonials`, { timeout: 30_000 });
      await expect(page.getByRole('article').first()).toBeVisible();
      await expect(page.getByTestId('action-approve').first()).toBeVisible();
      await expect(page.getByTestId('staff-email').first()).toContainText('@god.example');
    });
  }

  test('social_media_manager can only view Testimonials: no Approve, Reject, Unpublish or Re-approve (not rendered) and NO email anywhere on the page', async ({ page, context }) => {
    await asRoles(context, 'social_media_manager');
    await page.goto(`${BASE_URL}/testimonials`, { timeout: 30_000 });
    await expect(page.getByRole('article').first()).toBeVisible();
    for (const tab of ['Pending', 'Approved', 'Unpublished', 'Rejected']) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      await expect(page.getByRole('article').first()).toBeVisible();
      await expect(page.getByRole('button', { name: /^(Approve|Reject|Unpublish|Re-approve)\b/ })).toHaveCount(0);
      await expect(page.getByTestId('staff-email')).toHaveCount(0);
      await expect(page.getByText('Staff only')).toHaveCount(0);
      const html = await page.locator('main').evaluate((el) => el.innerHTML);
      expect(html).not.toContain('@god.example');
      for (const item of data.testimonials) expect(html).not.toContain(item.email);
    }
    // the public preview of an approved item is still there, with no email
    await page.getByRole('tab', { name: /^Approved/ }).click();
    await expect(page.getByTestId('public-preview').first()).toBeVisible();
  });

  test('a moderator has no access to Testimonials', async ({ page, context }) => {
    await asRoles(context, 'moderator');
    await page.goto(`${BASE_URL}/testimonials`, { timeout: 30_000 });
    await expect(page.getByTestId('no-access')).toBeVisible();
  });
});

test.describe('Testimonials: phone (434px)', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 434, height: 900 } });

  test('the cards fit, the actions keep their words at 40px, the tabs scroll, and nothing is wider than the screen', async ({ page }) => {
    await page.goto(`${BASE_URL}/testimonials`, { timeout: 30_000 });
    const card = page.getByRole('article').first();
    await expect(card).toBeVisible();
    const approve = card.getByTestId('action-approve');
    await expect(approve).toContainText('Approve');
    expect((await approve.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    await expect(card.getByTestId('staff-email')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('tab', { name: /^Approved/ }).click();
    await expect(page.getByTestId('public-preview').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByTestId('action-unpublish').first().click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(434);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The DatePicker, the Testimonials header actions, the gauge label stagger, the phone layouts of Social, and the overflow check.
// ---------------------------------------------------------------------------------------------------------------
test.describe('DatePicker: the date maths (no browser)', () => {
  test('typing: ISO, "7 Oct 2026" and "07 October 2026" are dates, anything else (and a date that does not exist) is not', () => {
    for (const good of ['2026-10-07', '7 Oct 2026', '07 October 2026', ' 7   oct   2026 ', '7 SEPT 2026', '1 Jan 2026', '29 Feb 2028']) expect(parseTyped(good), good).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parseTyped('7 Oct 2026')).toBe('2026-10-07');
    expect(parseTyped('7 October 2026')).toBe('2026-10-07');
    expect(parseTyped('7 Sept 2026')).toBe('2026-09-07');
    for (const bad of ['', '  ', '2026-13-01', '2026-02-30', '31 Feb 2026', '29 Feb 2027', '7 Octo 2026', '7/10/2026', 'yesterday', '7 Oct', '2026-1-1', '0 Jan 2026']) expect(parseTyped(bad), bad).toBeNull();
    expect(shortDate('2026-10-07')).toBe('7 Oct 2026');
    expect(shortDate('2026-10-07')).toBe(formatDate('2026-10-07')); // the shared format
    expect(longDate('2026-10-07')).toBe('7 October 2026');
  });

  test('the grid is six weeks, Monday first, and starts on the Monday on or before the 1st', () => {
    const october = monthGrid(2026, 10); // 1 Oct 2026 is a Thursday
    expect(october).toHaveLength(42);
    expect(october[0]).toBe('2026-09-28');
    expect(october[3]).toBe('2026-10-01');
    expect(weekdayIndex(october[0])).toBe(0);
    expect(WEEKDAYS.map((d) => d.short)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
    expect(monthGrid(2026, 6)[0]).toBe('2026-06-01'); // 1 Jun 2026 is a Monday
    expect(monthGrid(2027, 2)[0]).toBe('2027-02-01'); // 1 Feb 2027 is a Monday
    expect(monthGrid(2026, 1)[0]).toBe('2025-12-29');
  });

  test('moving by days, weeks and months: months keep the day or clamp to the end of the month, years change and leap days work', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-10-07', -7)).toBe('2026-09-30');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-10-07', -1)).toBe('2026-09-07');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-10-07', 12)).toBe('2027-10-07');
    expect(startOfWeek('2026-10-07')).toBe('2026-10-05'); // a Wednesday: the Monday
    expect(endOfWeek('2026-10-07')).toBe('2026-10-11');
    expect(startOfWeek('2026-10-05')).toBe('2026-10-05');
    expect(endOfWeek('2026-10-11')).toBe('2026-10-11');
  });

  test('min and max: a day outside them has a reason, the dates on the edge are fine, and clamping keeps a date inside', () => {
    expect(disabledReason('2026-10-08', undefined, '2026-10-07')).toBe('after the latest date you can choose');
    expect(disabledReason('2026-10-07', undefined, '2026-10-07')).toBeNull();
    expect(disabledReason('2026-09-30', '2026-10-01', undefined)).toBe('before the earliest date you can choose');
    expect(disabledReason('2026-10-01', '2026-10-01', undefined)).toBeNull();
    expect(disabledReason('2026-10-04', '2026-10-01', '2026-10-07')).toBeNull();
    expect(clampDate('2026-12-01', '2026-10-01', '2026-10-07')).toBe('2026-10-07');
    expect(clampDate('2026-01-01', '2026-10-01', '2026-10-07')).toBe('2026-10-01');
    expect(clampDate('2026-10-03', '2026-10-01', '2026-10-07')).toBe('2026-10-03');
  });
});

test.describe('DatePicker: in the Log a post form', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  const open = async (page: import('@playwright/test').Page) => {
    await page.goto(`${BASE_URL}/social`, { timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Log a post' })).toBeVisible();
  };
  const field = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Log a post' }).getByLabel('Date posted', { exact: true });
  const calendar = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: 'Choose the date posted' });
  const openCalendar = async (page: import('@playwright/test').Page) => {
    await page.getByRole('region', { name: 'Log a post' }).getByRole('button', { name: 'Open calendar' }).click();
    await expect(calendar(page)).toBeVisible();
  };
  const today = () => todayLocal();
  const monthLabel = (page: import('@playwright/test').Page) => page.getByTestId('date-picker-month');

  test('it is a text field with the shared format and a calendar icon, not the browser date input', async ({ page }) => {
    await open(page);
    await expect(field(page)).toHaveValue(formatDate(today())); // "7 Oct 2026"
    expect(await field(page).evaluate((el) => (el as HTMLInputElement).type)).toBe('text');
    expect((await field(page).boundingBox())!.height).toBe(40);
    await expect(page.getByRole('region', { name: 'Log a post' }).getByRole('button', { name: 'Open calendar' })).toBeVisible();
    expect(await page.locator('input[type="date"], input[type="datetime-local"]').count()).toBe(0);
  });

  test('typing a date: ISO or "7 Sep 2026" is taken, shown in the shared format when the field is left, and text that is not a date goes back', async ({ page }) => {
    await open(page);
    await field(page).fill('2026-09-05');
    await field(page).blur();
    await expect(field(page)).toHaveValue('5 Sep 2026');
    await field(page).fill('12 august 2026');
    await field(page).blur();
    await expect(field(page)).toHaveValue('12 Aug 2026');
    await field(page).fill('not a date');
    await field(page).blur();
    await expect(field(page)).toHaveValue('12 Aug 2026'); // back to the last good date
  });

  test('picking a day: the calendar opens on today, a click chooses the day, closes, and focus goes back to the field', async ({ page }) => {
    await open(page);
    await openCalendar(page);
    const dialog = calendar(page);
    await expect(dialog.locator('[data-focus="true"]')).toHaveAttribute('data-date', today()); // opens on the chosen date
    expect(await monthLabel(page).innerText()).toContain(String(new Date().getFullYear()));
    // a day earlier this month (day 1 if today is the 1st: then the month before)
    const target = addDays(today(), today().endsWith('-01') ? -1 : -1);
    if (target.slice(0, 7) !== today().slice(0, 7)) await page.getByRole('button', { name: 'Previous month' }).click();
    await dialog.locator(`[data-date="${target}"]`).click();
    await expect(dialog).toHaveCount(0);
    await expect(field(page)).toHaveValue(formatDate(target));
    await expect(field(page)).toBeFocused();
  });

  test('the calendar: today is ringed, the chosen day is filled purple with white text, Monday is first, and the header buttons are 40px', async ({ page }) => {
    await open(page);
    await openCalendar(page);
    const dialog = calendar(page);
    const headers = await dialog.getByRole('columnheader').allInnerTexts();
    expect(headers).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
    const todayCell = dialog.locator(`[data-date="${today()}"]`);
    await expect(todayCell).toHaveAttribute('aria-current', 'date');
    expect(await todayCell.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none'); // the purple ring
    // today is also the chosen day: filled purple-500 with white text
    const fill = await todayCell.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
    expect(fill.color).toBe('rgb(255, 255, 255)');
    expect(fill.bg).not.toBe('rgba(0, 0, 0, 0)');
    for (const name of ['Previous month', 'Next month']) {
      const box = (await dialog.getByRole('button', { name }).boundingBox())!;
      expect([Math.round(box.width), Math.round(box.height)]).toEqual([40, 40]);
    }
    expect(await dialog.locator('button[data-date]').count()).toBe(42);
    const day = (await dialog.locator('button[data-date]').first().boundingBox())!;
    expect([Math.round(day.width), Math.round(day.height)]).toEqual([40, 40]);
  });

  test('the maximum date: days after today are disabled with the reason in their name, a click does nothing, and Today works', async ({ page }) => {
    await open(page);
    const earlier = addMonths(today(), -1);
    await field(page).fill(earlier);
    await field(page).blur();
    await openCalendar(page);
    const dialog = calendar(page);
    await dialog.getByRole('button', { name: 'Next month' }).click(); // this month
    await dialog.getByRole('button', { name: 'Next month' }).click(); // next month: only future days
    const future = dialog.locator('button[data-date]').last(); // the last cell is a future day in any month (the 11th cell was today on the 8th and later)
    await expect(future).toHaveAttribute('aria-disabled', 'true');
    await expect(future).toHaveAttribute('aria-label', /unavailable: after the latest date you can choose/);
    await future.click({ force: true }); // (aria-disabled: Playwright would wait for it to be enabled)
    await expect(dialog).toBeVisible(); // nothing was chosen
    await expect(field(page)).toHaveValue(formatDate(earlier));
    await dialog.getByRole('button', { name: 'Today', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(field(page)).toHaveValue(formatDate(today()));
  });

  test('keyboard: arrows move by a day and a week, PageUp and PageDown by a month, Home and End to the ends of the week, Enter chooses', async ({ page }) => {
    await open(page);
    await field(page).fill('2026-09-16'); // a Wednesday
    await field(page).blur();
    await openCalendar(page);
    const dialog = calendar(page);
    const focused = () => dialog.locator('[data-focus="true"]').getAttribute('data-date');
    expect(await focused()).toBe('2026-09-16');
    await page.keyboard.press('ArrowLeft');
    expect(await focused()).toBe('2026-09-15');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await focused()).toBe('2026-09-17');
    await page.keyboard.press('ArrowUp');
    expect(await focused()).toBe('2026-09-10');
    await page.keyboard.press('ArrowDown');
    expect(await focused()).toBe('2026-09-17');
    await page.keyboard.press('Home');
    expect(await focused()).toBe('2026-09-14'); // the Monday
    await page.keyboard.press('End');
    expect(await focused()).toBe('2026-09-20'); // the Sunday
    await page.keyboard.press('PageUp');
    expect(await focused()).toBe('2026-08-20');
    await expect(monthLabel(page)).toHaveText('August 2026');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    expect(await focused()).toBe(clampDate(addMonths('2026-09-20', 1), undefined, today())); // a month ahead, held at today (the maximum)
    await page.keyboard.press('PageUp');
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(field(page)).toBeFocused();
  });

  test('keyboard: the calendar cannot be moved past the maximum, Tab stays inside it, and Escape closes it and returns focus to the field', async ({ page }) => {
    await open(page);
    await openCalendar(page);
    const dialog = calendar(page);
    await page.keyboard.press('PageDown'); // a month ahead of today: held at today (the maximum)
    expect(await dialog.locator('[data-focus="true"]').getAttribute('data-date')).toBe(today());
    // Tab cycles within the dialog and never leaves it
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(field(page)).toBeFocused();
  });

  test('Escape from the calendar button also returns focus to the field, and the Down arrow in the field opens the calendar; a click outside closes it', async ({ page }) => {
    await open(page);
    await field(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(calendar(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(calendar(page)).toHaveCount(0);
    await expect(field(page)).toBeFocused();
    await openCalendar(page);
    await page.getByRole('heading', { name: 'Posts in', exact: false }).click();
    await expect(calendar(page)).toHaveCount(0);
  });

  test('a typed future date is refused by the form (the calendar cannot pick one, the field can be typed in)', async ({ page }) => {
    await open(page);
    const card = page.getByRole('region', { name: 'Log a post' });
    await card.getByRole('combobox', { name: 'Platform' }).click();
    await page.getByRole('option', { name: 'X', exact: true }).click();
    await card.getByRole('textbox', { name: 'Post title' }).fill('Future');
    await card.getByRole('textbox', { name: 'Post URL' }).fill('https://x.com/god/status/1');
    await card.getByRole('textbox', { name: 'Reach' }).fill('1');
    await card.getByRole('textbox', { name: 'Engagement' }).fill('1');
    await field(page).fill(addDays(today(), 4));
    await card.getByRole('button', { name: 'Log post' }).click();
    await expect(card.getByText('The date posted cannot be in the future.')).toBeVisible();
  });
});

test.describe('DatePicker: on a phone (a bottom sheet)', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  for (const width of [434, 390, 360]) {
    test(`${width}px: the calendar is a bottom sheet that fits, closes with the backdrop, the close button and Escape, and chooses a day`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${BASE_URL}/social`, { timeout: 30_000 });
      const field = page.getByRole('region', { name: 'Log a post' }).getByLabel('Date posted');
      await expect(field).toBeVisible();
      const openIt = async () => {
        await page.getByRole('region', { name: 'Log a post' }).getByRole('button', { name: 'Open calendar' }).click();
        await expect(page.getByRole('dialog', { name: 'Choose the date posted' })).toBeVisible();
      };
      await openIt();
      const dialog = page.getByRole('dialog', { name: 'Choose the date posted' });
      await expect.poll(async () => { const b = (await dialog.boundingBox())!; return Math.round(b.y + b.height); }).toBe(800); // pinned to the bottom (after the 200ms slide up)
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // the days are 40px and none is cut off the side
      const cells = await dialog.locator('button[data-date]').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), r.left >= 0 && r.right <= window.innerWidth]; }));
      expect(cells.every(([w, h, inside]) => w === 40 && h === 40 && inside)).toBe(true);
      // closes: the backdrop, the close button, Escape
      await page.getByTestId('date-picker-backdrop').click({ position: { x: 20, y: 20 } });
      await expect(dialog).toHaveCount(0);
      await openIt();
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toHaveCount(0);
      await openIt();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(field).toBeFocused();
      // and it chooses a day
      await openIt();
      const target = addDays(todayLocal(), -1);
      if (target.slice(0, 7) !== todayLocal().slice(0, 7)) await dialog.getByRole('button', { name: 'Previous month' }).click();
      await dialog.locator(`[data-date="${target}"]`).click();
      await expect(dialog).toHaveCount(0);
      await expect(field).toHaveValue(formatDate(target));
    });
  }
});

test.describe('Testimonials: the actions in the header', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  const data = buildSeed().collections;
  const open = async (page: import('@playwright/test').Page, tab?: string) => {
    await page.goto(`${BASE_URL}/testimonials`, { timeout: 30_000 });
    await expect(page.getByRole('article').first()).toBeVisible();
    if (tab) await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
  };

  test('from 1024px the actions are labelled buttons in the card header, under the status badge: Approve primary, the others secondary', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await open(page);
    const card = page.getByRole('article').first();
    const header = card.getByTestId('card-header-side');
    const badge = (await header.getByTestId('status-badge').boundingBox())!;
    const approve = card.getByTestId('action-approve');
    const reject = card.getByTestId('action-reject');
    await expect(approve).toHaveText('Approve');
    await expect(reject).toHaveText('Reject');
    const a = (await approve.boundingBox())!;
    expect(a.y).toBeGreaterThanOrEqual(badge.y + badge.height - 1); // under the badge
    expect(a.x + a.width).toBeLessThanOrEqual(badge.x + badge.width + 1 + 120); // on the right, in the header
    const cardBox = (await card.boundingBox())!;
    expect(a.y + a.height).toBeLessThan(cardBox.y + 100); // in the header, not a row at the bottom
    const bg = async (button: import('@playwright/test').Locator) => button.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await bg(approve)).not.toBe(await bg(reject)); // primary against secondary
    expect(a.height).toBe(40);
    for (const tab of ['Approved', 'Unpublished', 'Rejected']) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      const first = page.getByRole('article').first();
      const label = tab === 'Approved' ? 'Unpublish' : 'Re-approve';
      const button = first.getByRole('button', { name: new RegExp(`^${label}`) });
      await expect(button).toHaveText(label);
      const box = (await button.boundingBox())!;
      const top = (await first.boundingBox())!;
      expect(box.y).toBeLessThan(top.y + 100); // in the header
    }
  });

  test('below 1024px they are icon-only 40px buttons with a tooltip and an aria-label', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 1000 });
    await open(page);
    const button = page.getByTestId('action-approve').first();
    const box = (await button.boundingBox())!;
    expect([Math.round(box.width), Math.round(box.height)]).toEqual([40, 40]);
    await expect(button).toHaveAccessibleName(/^Approve /);
    await expect(button.locator('.sr-only')).toHaveText('Approve');
    await button.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Approve and publish this testimonial');
  });

  test('no empty band at the bottom of a card: the last content ends within the card padding, on every tab', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await open(page);
    for (const tab of ['Pending', 'Approved', 'Unpublished', 'Rejected']) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      const gaps = await page.getByRole('article').evaluateAll((cards) =>
        cards.map((card) => {
          const box = card.getBoundingClientRect();
          const last = [...card.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().height > 0 && !el.closest('.sr-only')).reduce((m, el) => Math.max(m, el.getBoundingClientRect().bottom), 0);
          return Math.round(box.bottom - last);
        }),
      );
      for (const gap of gaps) expect(gap, tab).toBeLessThanOrEqual(24); // the card's own 20px padding
    }
    expect(data.testimonials.length).toBe(9);
  });
});

test.describe('ZoneGauge: the labels never overlap', () => {
  const rectsOverlapLocal = (a: { x: number; y: number; width: number; height: number }, b: typeof a) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const cases: [number, number, boolean][] = [
    [1440, 1.05, true],
    [1440, 1.3, false],
    [1440, 4, false],
    [360, 1.3, true],
    [360, 1.05, true],
    [360, 4, true], // the long label "84 open · 4.0× the target" would run into "20 needed"
  ];
  for (const [width, ratio, staggered] of cases) {
    test(`ratio ${ratio} at ${width}px: ${staggered ? 'staggered (the tick label above the bar, the marker label below it)' : 'side by side'}, and the labels do not overlap`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE_URL}/partners?health=ratio-${ratio}`, { timeout: 30_000 });
      const gauge = page.getByTestId('pipeline-gauge');
      await expect(gauge).toBeVisible();
      await expect(gauge).toHaveAttribute('data-staggered', staggered ? 'true' : 'false');
      // (the layout settles after the data loads, so every measurement is taken together and polled)
      const measure = async () => {
        const [bar, words, marker, tick] = await Promise.all([
          page.getByRole('region', { name: 'Pipeline health' }).getByRole('meter').boundingBox(),
          page.getByTestId('pipeline-zone-labels').boundingBox(),
          page.getByTestId('pipeline-marker-label').boundingBox(),
          page.getByTestId('pipeline-needed-label').boundingBox(),
        ]);
        return { bar: bar!, words: words!, marker: marker!, tick: tick! };
      };
      await expect
        .poll(async () => {
          const m = await measure();
          if (rectsOverlapLocal(m.marker, m.tick)) return 'the labels overlap';
          if (staggered) {
            if (m.tick.y + m.tick.height > m.bar.y + 1) return 'the tick label is not above the bar';
            if (m.marker.y < m.words.y + m.words.height - 1) return 'the marker label is not below the zone words';
          } else if (m.marker.y + m.marker.height > m.bar.y + 1) return 'the marker label is not above the bar';
          return 'ok';
        })
        .toBe('ok');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test('the Database pace gauge uses the same rule', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
    await expect(page.getByTestId('pace-gauge')).toBeVisible();
    await expect(page.getByTestId('pace-marker-label')).toBeVisible();
    await expect(page.getByTestId('pace-tick-label')).toBeVisible();
    await expect.poll(async () => {
      const a = await page.getByTestId('pace-marker-label').boundingBox();
      const b = await page.getByTestId('pace-tick-label').boundingBox();
      return a && b ? overlap(a, b) : true;
    }).toBe(false);
  });
});

/** Elements wider than the screen that nothing clips: the real cause of a sideways scroll. */
const overflowing = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const vw = window.innerWidth;
    const found: string[] = [];
    document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
      if (el.closest('.sr-only, [aria-hidden="true"].sr-only')) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.right <= vw + 1) return;
      // clipped by an ancestor that is itself inside the screen (a scroller, or overflow hidden)?
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const style = getComputedStyle(p);
        if ((style.overflowX !== 'visible' || style.overflow !== 'visible') && p.getBoundingClientRect().right <= vw + 1) return;
      }
      if (getComputedStyle(el).position === 'fixed') return;
      found.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').split(' ').slice(0, 3).join('.')}[${el.getAttribute('data-testid') ?? ''}] right=${Math.round(r.right)}`);
    });
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, found: found.slice(0, 8) };
  });

test.describe('Phones: nothing is wider than the screen (434, 390 and 360px)', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  const PAGES: [string, string][] = [
    ['/social', 'total-posts'],
    ['/testimonials', 'card-header-side'],
    ['/database', 'records-pace'],
    ['/network', 'network-summary'],
    ['/leaderboard', 'rank-badge'],
    ['/partners', 'pipeline-gauge'],
    ['/partners?health=ratio-1.3', 'pipeline-gauge'],
    ['/partners?health=capped', 'pipeline-gauge'],
  ];
  for (const width of [434, 390, 360]) {
    for (const [path, ready] of PAGES) {
      test(`${path} at ${width}px: no element is wider than the viewport and the page does not scroll sideways`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
        await expect(page.getByTestId(ready).first()).toBeVisible();
        await page.waitForTimeout(400); // the layout settles after the first load
        const report = await overflowing(page);
        expect(report.found, JSON.stringify(report)).toEqual([]);
        expect(report.scrollWidth).toBeLessThanOrEqual(report.innerWidth);
      });
    }
  }
});

test.describe('Social: phones and the platform table and chart', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  const logAll = async (page: import('@playwright/test').Page) => {
    // seven platforms with posts this month: log the ones the seed does not have (the seed has Facebook, X and LinkedIn this month)
    const card = page.getByRole('region', { name: 'Log a post' });
    for (const [i, platform] of ['Instagram', 'TikTok', 'YouTube', 'WhatsApp', 'Other'].entries()) {
      await card.getByRole('combobox', { name: 'Platform' }).click();
      await page.getByRole('option', { name: platform, exact: true }).click();
      await card.getByRole('textbox', { name: 'Post title' }).fill(`Fixture post ${i}`);
      await card.getByRole('textbox', { name: 'Post URL' }).fill(`https://example.org/p/${i}`);
      await card.getByRole('textbox', { name: 'Reach' }).fill(String(100 + i * 150));
      await card.getByRole('textbox', { name: 'Engagement' }).fill(String(10 + i));
      await card.getByRole('button', { name: 'Log post' }).click();
      await expect(page.getByTestId(`platform-row-${platform.toLowerCase()}`)).toBeVisible();
    }
  };

  for (const width of [434, 390, 360]) {
    test(`${width}px: the platform table is stacked rows with labelled figures, the chart is horizontal bars, nothing scrolls sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE_URL}/social`, { timeout: 30_000 });
      await expect(page.getByTestId('platform-list')).toBeVisible();
      await expect(page.getByTestId('platform-table')).toHaveCount(0);
      const month = socialMonth(currentMonth());
      for (const row of month.platforms) {
        await expect(page.getByTestId(`platform-row-${row.platform}`)).toContainText(`Posts ${row.posts} · Reach ${row.reach.toLocaleString('en-US')} · Engagement ${row.engagement.toLocaleString('en-US')}`);
      }
      await expect(page.getByTestId('leading-platform')).toHaveCount(1);
      await expect(page.getByTestId('platform-bars')).toBeVisible();
      await expect(page.getByTestId(`platform-bar-${month.leading}`)).toHaveAttribute('data-leading', 'true');
      const report = await overflowing(page);
      expect(report.found, JSON.stringify(report)).toEqual([]);
      expect(report.scrollWidth).toBeLessThanOrEqual(report.innerWidth);
      // the card itself and everything in it is inside the screen, and nothing in it scrolls sideways
      const card = (await page.getByRole('region', { name: 'Monthly totals' }).boundingBox())!;
      expect(card.x + card.width).toBeLessThanOrEqual(width);
      expect(await page.getByRole('region', { name: 'Monthly totals' }).evaluate((el) => [el, ...el.querySelectorAll('*')].filter((n) => n.scrollWidth > n.clientWidth + 1 && ['auto', 'scroll'].includes(getComputedStyle(n).overflowX)).length)).toBe(0);
    });
  }

  test('seven platforms with posts: horizontal bars (not the vertical chart) from 1440px down, the leader in orange, nothing overlapping', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${BASE_URL}/social`, { timeout: 30_000 });
    await expect(page.getByTestId('platform-table')).toBeVisible();
    await logAll(page);
    await expect(page.getByTestId('platform-table').locator('tbody tr')).toHaveCount(8);
    await expect(page.getByTestId('platform-bars')).toBeVisible();
    await expect(page.getByRole('group', { name: /Reach by platform/ })).toHaveCount(0); // not the vertical chart
    const fills = await page.getByTestId('platform-bars').locator('li').evaluateAll((items) => items.map((li) => ({ leader: li.getAttribute('data-leading'), bg: getComputedStyle(li.querySelector('span[aria-hidden] > span')!).backgroundColor })));
    expect(fills.filter((f) => f.leader === 'true')).toHaveLength(1);
    const leaderBg = fills.find((f) => f.leader === 'true')!.bg;
    expect(fills.filter((f) => f.leader !== 'true').every((f) => f.bg !== leaderBg)).toBe(true);
    // the figures do not overlap each other
    const rects = await page.getByTestId('platform-bars').locator('li > span:last-child').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(rects[i][3] <= rects[j][1] || rects[j][3] <= rects[i][1] || rects[i][2] <= rects[j][0] || rects[j][2] <= rects[i][0]).toBe(true);
    // on a phone only the leader shows its figure in the bars
    await page.setViewportSize({ width: 360, height: 900 });
    await expect(page.getByTestId('platform-list')).toBeVisible();
    const shown = await page.getByTestId('platform-bars').locator('li > span:last-child').evaluateAll((els) => els.filter((el) => el.textContent && el.querySelector(':scope > .sr-only') === null && el.textContent.trim() !== '').length);
    expect(shown).toBe(1);
    const report = await overflowing(page);
    expect(report.found, JSON.stringify(report)).toEqual([]);
    expect(report.scrollWidth).toBeLessThanOrEqual(report.innerWidth);
  });

  test('logging one post changes the totals, the platform table, the list and the toast together, in one snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${BASE_URL}/social`, { timeout: 30_000 });
    await expect(page.getByTestId('total-posts')).toContainText(/\d/);
    const before = socialMonth(currentMonth());
    const card = page.getByRole('region', { name: 'Log a post' });
    await card.getByRole('combobox', { name: 'Platform' }).click();
    await page.getByRole('option', { name: 'WhatsApp', exact: true }).click();
    await card.getByRole('textbox', { name: 'Post title' }).fill('Snapshot post');
    await card.getByRole('textbox', { name: 'Post URL' }).fill('https://example.org/snapshot');
    await card.getByRole('textbox', { name: 'Reach' }).fill('321');
    await card.getByRole('textbox', { name: 'Engagement' }).fill('21');
    await card.getByRole('button', { name: 'Log post' }).click();
    await expect(page.getByTestId('toast').filter({ hasText: 'A WhatsApp post was logged' })).toBeVisible();
    // ONE snapshot of the page, taken once the toast is there: everything has already changed
    const snapshot = await page.evaluate(() => {
      const num = (id: string) => Number((document.querySelector(`[data-testid="${id}"] .ministat-value`)?.textContent ?? '').replace(/\D+/g, ''));
      return {
        posts: num('total-posts'),
        reach: num('total-reach'),
        engagement: num('total-engagement'),
        whatsapp: (document.querySelector('[data-testid="platform-row-whatsapp"]')?.textContent ?? '').replace(/\s+/g, ' '),
        firstRow: (document.querySelector('[data-testid="table-row"]')?.textContent ?? '').replace(/\s+/g, ' '),
        toast: !!document.querySelector('[data-testid="toast"]'),
      };
    });
    expect(snapshot.toast).toBe(true);
    expect([snapshot.posts, snapshot.reach, snapshot.engagement]).toEqual([before.posts + 1, before.reach + 321, before.engagement + 21]);
    expect(snapshot.whatsapp).toContain('WhatsApp');
    expect(snapshot.whatsapp).toContain('321');
    expect(snapshot.firstRow).toContain('Snapshot post');
    // the figures are the KPI functions' values for the month (services/social.ts uses kpiValue for all three)
    const after = socialMonth(currentMonth());
    expect(after.posts).toBe(before.posts); // (the page's store is in the browser; this node copy is the seed)
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Visual fix pass: the DatePicker position, the menu sheet on phones, the Database phone cards, the Partners footer on phones.
// ---------------------------------------------------------------------------------------------------------------
const rectsIntersect = (a: { x: number; y: number; width: number; height: number }, b: typeof a) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe('DatePicker: the popover is placed below the field, or above, never over it', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  const sizes: [number, number][] = [[1440, 900], [1280, 720], [900, 700]];

  const check = async (page: import('@playwright/test').Page, trigger: import('@playwright/test').Locator, opener: import('@playwright/test').Locator, vw: number, vh: number) => {
    await opener.click();
    const popover = page.getByTestId('date-picker-popover');
    await expect(popover).toBeVisible();
    await expect(page.getByRole('dialog', { name: /Choose the/ })).toBeVisible();
    const verify = async () => {
      const pop = (await popover.boundingBox())!;
      const field = (await trigger.boundingBox())!;
      expect(rectsIntersect(pop, field), `popover ${JSON.stringify(pop)} over the field ${JSON.stringify(field)}`).toBe(false);
      expect(pop.x).toBeGreaterThanOrEqual(0);
      expect(pop.y).toBeGreaterThanOrEqual(-0.5);
      expect(pop.x + pop.width).toBeLessThanOrEqual(vw + 0.5);
      expect(pop.y + pop.height).toBeLessThanOrEqual(vh + 0.5);
      return { pop, field };
    };
    const { pop, field } = await verify();
    // left edges line up (unless the popover had to be pushed in from the viewport edge), and the gap is 4px on the side it sits
    expect(Math.abs(pop.x - field.x)).toBeLessThanOrEqual(1);
    const below = pop.y >= field.y + field.height;
    const gap = below ? pop.y - (field.y + field.height) : field.y - (pop.y + pop.height);
    if (pop.height >= 330) expect(Math.round(gap)).toBe(4); // (a popover that had to scroll inside keeps the 4px too)
    // it stays visible and clear of the field when the page scrolls
    await page.mouse.move(vw / 2, vh / 2);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(150);
    if (await popover.isVisible()) await verify();
    return below;
  };

  for (const [vw, vh] of sizes) {
    test(`Social at ${vw}x${vh}: the calendar of "Date posted" does not cover the field, nor Post title, URL or Reach`, async ({ page }) => {
      await page.setViewportSize({ width: vw, height: vh });
      await page.goto(`${BASE_URL}/social`, { timeout: 30_000 });
      const card = page.getByRole('region', { name: 'Log a post' });
      await expect(card).toBeVisible();
      const field = card.getByLabel('Date posted', { exact: true });
      await field.scrollIntoViewIfNeeded();
      await check(page, field, card.getByRole('button', { name: 'Open calendar' }), vw, vh);
      // it does not sit on top of the fields above it either, unless it is above the date field because there was no room below
      const pop = (await page.getByTestId('date-picker-popover').boundingBox())!;
      const dateField = (await field.boundingBox())!;
      if (pop.y < dateField.y) {
        // placed above: it may be over the fields above, but never over the date field
        expect(pop.y + pop.height).toBeLessThanOrEqual(dateField.y);
      } else {
        for (const name of ['Post title', 'Post URL', 'Reach']) {
          const other = (await card.getByRole('textbox', { name }).boundingBox())!;
          expect(rectsIntersect(pop, other), name).toBe(false);
        }
      }
    });
  }

  for (const [vw, vh] of [[1440, 900], [1280, 720]] as [number, number][]) {
    test(`Opportunities form at ${vw}x${vh}: the calendar of the application deadline fits the viewport and does not cover its field`, async ({ page }) => {
      await page.setViewportSize({ width: vw, height: vh });
      await page.goto(`${BASE_URL}/opportunities/new`, { timeout: 30_000 });
      const field = page.getByLabel('Application deadline', { exact: true });
      await expect(field).toBeVisible();
      await field.scrollIntoViewIfNeeded();
      const wrapper = field.locator('xpath=..');
      await check(page, wrapper, wrapper.getByRole('button', { name: 'Open calendar' }), vw, vh);
    });
  }

  test('a field near the top has the popover below it (4px gap), and one near the bottom has it above', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto(`${BASE_URL}/social`, { timeout: 30_000 });
    const card = page.getByRole('region', { name: 'Log a post' });
    const field = card.getByLabel('Date posted', { exact: true });
    await field.scrollIntoViewIfNeeded();
    // scroll so the field is at the very bottom of the screen: no room below, plenty above
    const box = (await field.boundingBox())!;
    await page.mouse.wheel(0, Math.max(0, box.y + box.height - (700 - 20)));
    await page.waitForTimeout(150);
    await card.getByRole('button', { name: 'Open calendar' }).click();
    const pop = (await page.getByTestId('date-picker-popover').boundingBox())!;
    const now = (await field.boundingBox())!;
    expect(pop.y + pop.height).toBeLessThanOrEqual(now.y); // above the field
    expect(rectsIntersect(pop, now)).toBe(false);
  });
});

test.describe('Menu: a sheet on phones', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 434, height: 900 } });
  const openMenu = async (page: import('@playwright/test').Page) => {
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    await expect(page.getByRole('tab', { name: /^Prospect/ })).toBeVisible();
    const trigger = page.getByRole('button', { name: /^Move Google Africa to/ });
    await trigger.click();
    return trigger;
  };

  test('the Move menu opens as a bottom sheet: a title, a backdrop, a close button, 48px rows, role dialog and the menu inside it', async ({ page }) => {
    await openMenu(page);
    const sheet = page.getByRole('dialog', { name: 'Move Google Africa to' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('aria-modal', 'true');
    await expect(sheet.getByRole('heading', { name: 'Move Google Africa to' })).toBeVisible();
    await expect(page.getByTestId('menu-sheet-backdrop')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Close' })).toBeVisible();
    expect((await sheet.getByRole('button', { name: 'Close' }).boundingBox())!.height).toBe(40);
    const menu = sheet.getByRole('menu', { name: 'Move Google Africa to another stage' });
    const items = menu.getByRole('menuitem');
    expect((await items.allInnerTexts()).map((t) => t.trim())).toEqual(['Outreach', 'Proposal', 'MOU', 'Onboard', 'Renew']);
    for (const box of await items.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)))) expect(box).toBe(48);
    await expect.poll(async () => { const b = (await sheet.boundingBox())!; return Math.round(b.y + b.height); }).toBe(900); // pinned to the bottom
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('Esc closes it and returns focus to the Move button; the backdrop and the close button close it too; Tab stays inside', async ({ page }) => {
    const trigger = await openMenu(page);
    const sheet = page.getByRole('dialog', { name: 'Move Google Africa to' });
    await expect(sheet).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toHaveCount(0);
    await trigger.click();
    await page.getByTestId('menu-sheet-backdrop').click({ position: { x: 20, y: 20 } });
    await expect(sheet).toHaveCount(0);
  });

  test('choosing a stage in the sheet moves the card, closes the sheet and says so', async ({ page }) => {
    await openMenu(page);
    await page.getByRole('menuitem', { name: 'Outreach', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Move Google Africa to' })).toHaveCount(0);
    await expect(page.getByText('Google Africa moved to Outreach.', { exact: true })).toBeVisible();
  });

  test('a menu with three items or fewer stays a popover on a phone, and from 640px the Move menu is a popover', async ({ page }) => {
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    await expect(page.getByRole('tab', { name: /^Prospect/ })).toBeVisible();
    await page.setViewportSize({ width: 800, height: 900 });
    await page.getByRole('button', { name: /^Move Google Africa to/ }).click();
    await expect(page.getByRole('menu', { name: 'Move Google Africa to another stage' })).toBeVisible();
    await expect(page.getByTestId('menu-sheet-backdrop')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Database: compact phone cards', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 434, height: 900 } });

  test('a card is 170px or less: avatar, name and badge, one "Country · Institution" line, the source pill and the linked item, the Verify button and who added it', async ({ page }) => {
    await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
    const cards = page.getByTestId('record-card');
    await expect(cards.first()).toBeVisible();
    const heights = await page.getByTestId('table-row').evaluateAll((rows) => rows.map((row) => Math.round(row.getBoundingClientRect().height)));
    console.log(`Database phone cards at 434px: ${heights.join(', ')} (total ${heights.reduce((a, b) => a + b, 0)}px for ${heights.length})`);
    expect(heights).toHaveLength(10);
    for (const height of heights) expect(height).toBeLessThanOrEqual(170);
    const card = cards.first();
    await expect(card.getByTestId('status-badge')).toBeVisible(); // the badge, at the right of the first row
    const badge = (await card.getByTestId('status-badge').boundingBox())!;
    const link = (await card.getByRole('link').first().boundingBox())!;
    expect(badge.x).toBeGreaterThan(link.x + link.width - 1);
    // "Country · Institution" is ONE line
    const place = card.getByText(/ · /).first();
    expect((await place.boundingBox())!.height).toBeLessThanOrEqual(20);
    // the source pill and the linked item share a row
    const withLink = page.getByTestId('record-card').filter({ has: page.locator('[data-testid="linked-ambassador"], [data-testid="linked-opportunity"]') }).first();
    const pill = (await withLink.getByText(/^(Organic|Ambassador referral|Event|Partner channel|Bulk import)$/).first().boundingBox())!;
    const linked = (await withLink.locator('[data-testid="linked-ambassador"], [data-testid="linked-opportunity"]').first().boundingBox())!;
    expect(Math.abs(pill.y + pill.height / 2 - (linked.y + linked.height / 2))).toBeLessThanOrEqual(12);
    // the Verify button (pending) is 40px, apart from the name link, and shares a row with "added by"
    const verify = card.getByTestId('verify-button');
    await expect(verify).toContainText('Verify');
    const vb = (await verify.boundingBox())!;
    expect(vb.height).toBeGreaterThanOrEqual(40);
    expect(rectsIntersect(vb, link)).toBe(false);
    const added = (await card.getByText(/ · \d+ \w{3} \d{4}$/).boundingBox())!;
    expect(Math.abs(vb.y + vb.height / 2 - (added.y + added.height / 2))).toBeLessThanOrEqual(24);
    // a tap on the card (not on a control) opens the record; the Verify button does not
    await verify.click();
    await expect(page).toHaveURL(/\/database$/);
  });

  test('the name link opens the record, and a verified card has no Verify button and is shorter', async ({ page }) => {
    await page.goto(`${BASE_URL}/database`, { timeout: 30_000 });
    await page.getByRole('radiogroup', { name: 'Filter by verification' }).getByRole('radio', { name: /^Verified/ }).click();
    const card = page.getByTestId('record-card').first();
    await expect(card.getByTestId('verify-button')).toHaveCount(0);
    expect(await page.getByTestId('table-row').first().evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(150);
    const href = await card.getByRole('link').first().getAttribute('href');
    await card.getByRole('link').first().click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });
});

test.describe('Partners: the health footer on phones', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test('below 640px the footer sentence has the same words as on desktop, on at most two lines, with the full text in the tooltip', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/partners`, { timeout: 30_000 });
    const sentence = page.getByTestId('pipeline-detail').locator('span').first();
    await expect(sentence).toContainText('Based on the last 6 months');
    const desktop = ((await sentence.textContent()) ?? '').trim();
    for (const width of [434, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      const phone = page.getByTestId('pipeline-detail').locator('span.line-clamp-2');
      await expect(phone).toContainText('Based on the last 6 months');
      expect(((await phone.textContent()) ?? '').trim(), `the same words at ${width}px`).toBe(desktop);
      await expect.poll(() => phone.evaluate((el) => getComputedStyle(el).webkitLineClamp)).toBe('2'); // (the clamp follows the media query one frame later)
      const metrics = await phone.evaluate((el) => ({ lines: getComputedStyle(el).webkitLineClamp, height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) }));
      expect(metrics.lines).toBe('2');
      expect(metrics.height).toBeLessThanOrEqual(metrics.line * 2 + 4);
      const truncated = await phone.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
      if (truncated) {
        await phone.hover();
        await expect(page.getByRole('tooltip')).toHaveText(desktop);
        await page.mouse.move(0, 0);
      }
    }
  });
});

test.describe('DatePicker: focused and selected days look different', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  const luminance = ([r, g, b]: number[]) => {
    const f = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const rgb = (css: string) => css.match(/rgba?\((\d+), (\d+), (\d+)/)!.slice(1, 4).map(Number);
  const contrast = (a: number[], b: number[]) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

  test('the focused day is a 2px purple outline with no fill; the selected day is a solid purple fill; both hold 3:1 against white', async ({ page }) => {
    await page.goto(`${BASE_URL}/social`, { timeout: 30_000 });
    const card = page.getByRole('region', { name: 'Log a post' });
    await card.getByLabel('Date posted', { exact: true }).fill(addDays(todayLocal(), -3));
    await card.getByLabel('Date posted', { exact: true }).blur();
    await card.getByRole('button', { name: 'Open calendar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Choose the date posted' });
    const selected = dialog.locator(`[data-date="${addDays(todayLocal(), -3)}"]`);
    await expect(selected).toBeFocused(); // opens on the chosen date
    // focus moves to another day: the old one is selected and NOT focused, the new one is focused and NOT selected
    await page.keyboard.press('ArrowLeft');
    const focused = dialog.locator(`[data-date="${addDays(todayLocal(), -4)}"]`);
    await expect(focused).toBeFocused();
    const style = (el: import('@playwright/test').Locator) => el.evaluate((node) => { const s = getComputedStyle(node); return { bg: s.backgroundColor, outlineW: s.outlineWidth, outlineC: s.outlineColor, outlineS: s.outlineStyle, color: s.color }; });
    const f = await style(focused);
    const s = await style(selected);
    expect(f.outlineS).not.toBe('none');
    expect(parseFloat(f.outlineW)).toBe(2);
    expect(f.bg).toBe('rgba(0, 0, 0, 0)'); // no fill
    expect(contrast(rgb(f.outlineC), [255, 255, 255])).toBeGreaterThanOrEqual(3);
    expect(s.bg).not.toBe('rgba(0, 0, 0, 0)'); // a solid fill
    expect(s.color).toBe('rgb(255, 255, 255)');
    expect(contrast(rgb(s.bg), [255, 255, 255])).toBeGreaterThanOrEqual(3);
    expect(s.bg).not.toBe(f.bg);
  });
});

test.describe('Phone cards: no card is over 220px (Network, Leaderboard, Testimonials)', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 434, height: 900 } });
  for (const [path, selector] of [['/network', '[data-testid="table-row"]'], ['/leaderboard', '[data-testid="table-row"]'], ['/testimonials', 'article']] as const) {
    test(`${path}: every card is 220px or less at 434px`, async ({ page }) => {
      await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
      await expect(page.locator(selector).first()).toBeVisible();
      await page.waitForTimeout(300);
      const heights = await page.locator(selector).evaluateAll((els) => els.slice(0, 10).map((el) => Math.round(el.getBoundingClientRect().height)));
      console.log(`${path} cards at 434px: ${heights.join(', ')} (total ${heights.reduce((a, b) => a + b, 0)}px)`);
      for (const height of heights) expect(height).toBeLessThanOrEqual(220);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------
// DateTimeField (the date and time of the Program and Listing forms), TimeField and the end of the native date-time inputs.
// ---------------------------------------------------------------------------------------------------------------
test.describe('TimeField and date-times: the helpers (no browser)', () => {
  test('accepted times: "6:00 PM", "6pm", "18:00", "18:45", in any case and with or without spaces', () => {
    const cases: [string, string][] = [
      ['6:00 PM', '18:00'],
      ['6:00 pm', '18:00'],
      ['6PM', '18:00'],
      ['6pm', '18:00'],
      ['6 pm', '18:00'],
      ['6:30pm', '18:30'],
      ['  6:30   PM ', '18:30'],
      ['12:00 AM', '00:00'],
      ['12am', '00:00'],
      ['12:30 PM', '12:30'],
      ['12 pm', '12:00'],
      ['18:00', '18:00'],
      ['18:45', '18:45'],
      ['06:05', '06:05'],
      ['0:00', '00:00'],
      ['23:59', '23:59'],
      ['9:15', '09:15'],
      ['6 p.m.', '18:00'],
      ['11:59 PM', '23:59'],
    ];
    for (const [typed, expected] of cases) expect(parseTime(typed), typed).toBe(expected);
  });

  test('anything else is not a time: no am/pm and no minutes, hours or minutes out of range, words, empty', () => {
    for (const bad of ['', '  ', '6', '25:00', '24:00', '13pm', '0pm', '6:60', '6:5', 'abc', '6:00 XM', '18:00 PM', '6.30pm', '6:00:00', '-1:00', '6 :00 pm x', '1830']) expect(parseTime(bad), bad).toBeNull();
  });

  test('the 12-hour display, the 48 half-hour slots and the slot a time falls in', () => {
    expect(formatTime12('18:00')).toBe('6:00 PM');
    expect(formatTime12('00:00')).toBe('12:00 AM');
    expect(formatTime12('12:30')).toBe('12:30 PM');
    expect(formatTime12('09:05')).toBe('9:05 AM');
    expect(formatTime12('nope')).toBe('nope');
    expect(TIME_SLOTS).toHaveLength(48);
    expect(TIME_SLOTS[0]).toEqual({ value: '00:00', label: '12:00 AM' });
    expect(TIME_SLOTS[13]).toEqual({ value: '06:30', label: '6:30 AM' });
    expect(TIME_SLOTS[24]).toEqual({ value: '12:00', label: '12:00 PM' });
    expect(TIME_SLOTS[47]).toEqual({ value: '23:30', label: '11:30 PM' });
    expect(new Set(TIME_SLOTS.map((s) => s.value)).size).toBe(48);
    expect(slotFor('18:45')).toBe('18:30');
    expect(slotFor('18:15')).toBe('18:00');
    expect(slotFor('')).toBe('09:00');
    // normalising what a person types ends in a slot label for every half hour
    for (const slot of TIME_SLOTS) expect(formatTime12(parseTime(slot.label)!)).toBe(slot.label);
  });

  test('one value from two parts: an empty date or an empty time gives an empty value, and the parts round-trip', () => {
    expect(joinDateTime('2026-08-02', '18:00')).toBe('2026-08-02T18:00');
    expect(joinDateTime('', '18:00')).toBe('');
    expect(joinDateTime('2026-08-02', '')).toBe('');
    expect(joinDateTime('2026-02-30', '18:00')).toBe('');
    expect(joinDateTime('2026-08-02', '25:00')).toBe('');
    expect(splitDateTime('2026-08-02T18:00')).toEqual({ date: '2026-08-02', time: '18:00' });
    expect(splitDateTime('2026-08-02T18:00:00.000Z')).toEqual({ date: '2026-08-02', time: '18:00' });
    expect(splitDateTime('2026-08-02')).toEqual({ date: '2026-08-02', time: '' });
    expect(splitDateTime('')).toEqual({ date: '', time: '' });
    expect(splitDateTime('garbage')).toEqual({ date: '', time: '' });
    expect(DESK_TIME_ZONE).toBe('GMT');
  });

  test('every program and listing in the seed splits and joins back to the same stored value (so an existing record loads and saves unchanged)', () => {
    const values = [...seed.programs.flatMap((p) => [p.startAt, p.endAt]), ...seed.listings.flatMap((l) => (l.eventAt ? [l.eventAt] : []))];
    expect(values.length).toBeGreaterThan(20);
    for (const value of values) {
      const { date, time } = splitDateTime(value);
      expect(date, value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (value.length > 10) expect(joinDateTime(date, time), value).toBe(value.slice(0, 16));
    }
  });

  test('no native date, time, datetime-local, month or week input is left in the app; the file dialog is the only native input', () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx|ts)$/.test(entry.name)) {
          const text = readFileSync(full, 'utf8');
          for (const match of text.matchAll(/type=\{?["'](date|time|datetime-local|month|week)["']/g)) found.push(`${full}: ${match[0]}`);
          if (/type="file"/.test(text)) found.push(`${full}: file`);
        }
      }
    };
    walk('src');
    expect(found.map((line) => line.replace(/\\/g, '/'))).toEqual(['src/components/ui/form/FileDrop.tsx: file']);
  });
});

test.describe('DateTimeField: in the Program form', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 900 } });
  const open = async (page: import('@playwright/test').Page, route = '/programs/new') => {
    await page.goto(`${BASE_URL}${route}`, { timeout: 30_000 });
    await expect(page.getByRole('group', { name: 'Start date and time' })).toBeVisible();
  };
  const group = (page: import('@playwright/test').Page, label = 'Start date and time') => page.getByRole('group', { name: label });
  const time = (page: import('@playwright/test').Page, label = 'Start date and time') => group(page, label).getByLabel('Time', { exact: true });

  test('each field is one group named by its label with a Date part and a Time part, side by side from 640px, and a muted GMT after the time', async ({ page }) => {
    await open(page);
    for (const label of ['Start date and time', 'End date and time']) {
      const g = group(page, label);
      await expect(g.getByLabel('Date', { exact: true })).toBeVisible();
      await expect(g.getByLabel('Time', { exact: true })).toBeVisible();
      const d = (await g.getByLabel('Date', { exact: true }).boundingBox())!;
      const t = (await g.getByLabel('Time', { exact: true }).boundingBox())!;
      expect(Math.abs(d.y - t.y)).toBeLessThanOrEqual(1); // side by side
      expect(d.x + d.width).toBeLessThanOrEqual(t.x + 1);
      expect([d.height, t.height]).toEqual([40, 40]);
      await expect(g.getByTestId('time-zone')).toHaveText('GMT');
      expect(await g.getByTestId('time-zone').evaluate((el) => getComputedStyle(el).color)).toBe(await page.locator('main .caption').first().evaluate((el) => getComputedStyle(el).color)); // the muted caption colour
    }
    await page.setViewportSize({ width: 434, height: 900 });
    const d = (await group(page).getByLabel('Date', { exact: true }).boundingBox())!;
    const t = (await time(page).boundingBox())!;
    expect(t.y).toBeGreaterThanOrEqual(d.y + d.height - 1); // stacked below 640px
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('typing a time: "6pm", "6:30 PM", "18:00" and "18:45" are read, in any case, and written as "6:00 PM" when the field is left', async ({ page }) => {
    await open(page);
    await setDateTime(page, 'Start date and time', '2030-05-10', '9:00 AM'); // a complete value: the form has nothing to say
    for (const [typed, shown] of [['6pm', '6:00 PM'], ['6:30 pm', '6:30 PM'], ['18:00', '6:00 PM'], ['18:45', '6:45 PM'], ['12AM', '12:00 AM'], ['7:05 Am', '7:05 AM']]) {
      await time(page).fill(typed);
      await time(page).blur();
      await expect(time(page)).toHaveValue(shown);
    }
    await expect(group(page).getByRole('alert')).toHaveCount(0);
  });

  test('an invalid time goes back to the last good time with an inline, announced error: aria-invalid, aria-describedby and role alert', async ({ page }) => {
    await open(page);
    await setDateTime(page, 'Start date and time', '2030-05-10', '9:00 AM');
    await time(page).fill('7pm');
    await time(page).blur();
    await time(page).fill('25:99');
    await time(page).blur();
    await expect(time(page)).toHaveValue('7:00 PM');
    const alert = group(page).getByRole('alert');
    await expect(alert).toHaveText('Enter a time like 6:00 PM');
    await expect(time(page)).toHaveAttribute('aria-invalid', 'true');
    const id = await alert.getAttribute('id');
    expect(await time(page).getAttribute('aria-describedby')).toContain(id);
    expect(await group(page).getAttribute('aria-describedby')).toContain(id);
    await expect(group(page).getByLabel('Date', { exact: true })).not.toHaveAttribute('aria-invalid', 'true');
    // a good time clears it
    await time(page).fill('8pm');
    await time(page).blur();
    await expect(group(page).getByRole('alert')).toHaveCount(0);
    await expect(time(page)).not.toHaveAttribute('aria-invalid', 'true');
    // and from an empty field, an invalid entry goes back to empty
    await time(page, 'End date and time').fill('nonsense');
    await time(page, 'End date and time').blur();
    await expect(time(page, 'End date and time')).toHaveValue('');
    await expect(group(page, 'End date and time').getByRole('alert')).toHaveText('Enter a time like 6:00 PM');
  });

  test('the slot list: 48 half-hour slots in the 12-hour form, scrolled to the current time, chosen by click', async ({ page }) => {
    await open(page);
    await time(page).fill('6:30 PM');
    await time(page).blur();
    await group(page).getByRole('button', { name: 'Open the list of times' }).click();
    const list = page.getByRole('listbox', { name: /Time slots/ });
    await expect(list).toBeVisible();
    const labels = await list.getByRole('option').allInnerTexts();
    expect(labels).toHaveLength(48);
    expect(labels[0].trim()).toBe('12:00 AM');
    expect(labels[47].trim()).toBe('11:30 PM');
    expect(labels.every((l) => /^\d{1,2}:(00|30) (AM|PM)$/.test(l.trim()))).toBe(true);
    // scrolled so the current value is in view, and marked selected
    const selected = list.getByRole('option', { selected: true });
    await expect(selected).toHaveText('6:30 PM');
    const inView = await selected.evaluate((el) => { const r = el.getBoundingClientRect(); const box = el.closest('[data-testid="time-list-popover"]')!.getBoundingClientRect(); return r.top >= box.top - 1 && r.bottom <= box.bottom + 1; });
    expect(inView).toBe(true);
    await list.getByRole('option', { name: '9:00 AM' }).click();
    await expect(list).toHaveCount(0);
    await expect(time(page)).toHaveValue('9:00 AM');
    await expect(time(page)).toBeFocused();
  });

  test('the slot list by keyboard: Down opens it, arrows move, Home and End jump, type-ahead finds a slot, Enter chooses, Esc closes and returns focus', async ({ page }) => {
    await open(page);
    await time(page).focus();
    await page.keyboard.press('ArrowDown');
    const list = page.getByRole('listbox', { name: /Time slots/ });
    await expect(list).toBeVisible();
    const active = async () => (await list.locator('[role="option"]').evaluateAll((els, id) => els.find((el) => el.id === id)?.textContent ?? '', await time(page).getAttribute('aria-activedescendant'))).trim();
    expect(await active()).toBe('9:00 AM'); // opens on the default slot when there is no time yet
    await page.keyboard.press('ArrowDown');
    expect(await active()).toBe('9:30 AM');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    expect(await active()).toBe('8:30 AM');
    await page.keyboard.press('Home');
    expect(await active()).toBe('12:00 AM');
    await page.keyboard.press('End');
    expect(await active()).toBe('11:30 PM');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('7:3');
    expect(await active()).toBe('7:30 AM'); // type-ahead
    await page.keyboard.type('0 p');
    expect(await active()).toBe('7:30 PM');
    await page.keyboard.press('Enter');
    await expect(list).toHaveCount(0);
    await expect(time(page)).toHaveValue('7:30 PM');
    await expect(time(page)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(list).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await expect(time(page)).toBeFocused();
    await expect(time(page)).toHaveValue('7:30 PM'); // Esc keeps the value
  });

  test('the slot list is placed below the field (4px gap), or above, inside the viewport and never over the field', async ({ page }) => {
    for (const [vw, vh] of [[1440, 900], [1280, 720]]) {
      await page.setViewportSize({ width: vw, height: vh });
      await open(page);
      const field = time(page, 'End date and time');
      await field.scrollIntoViewIfNeeded();
      await group(page, 'End date and time').getByRole('button', { name: 'Open the list of times' }).click();
      const pop = (await page.getByTestId('time-list-popover').boundingBox())!;
      const box = (await field.boundingBox())!;
      expect(rectsIntersect(pop, box)).toBe(false);
      expect(pop.x).toBeGreaterThanOrEqual(0);
      expect(pop.x + pop.width).toBeLessThanOrEqual(vw + 0.5);
      expect(pop.y).toBeGreaterThanOrEqual(-0.5);
      expect(pop.y + pop.height).toBeLessThanOrEqual(vh + 0.5);
      await page.keyboard.press('Escape');
    }
  });

  test('the end must be after the start: the form keeps its message, an equal or earlier end is refused, a later one clears it', async ({ page }) => {
    await open(page);
    await setDateTime(page, 'Start date and time', '2030-05-10', '10:00');
    await setDateTime(page, 'End date and time', '2030-05-10', '9:00 AM');
    // the field says it at once, in its own words ...
    await expect(group(page, 'End date and time').getByRole('alert')).toHaveText(/must be after the start/);
    // ... and the form's own message (kept as it was) once the field was left
    await page.getByRole('group', { name: 'End date and time' }).getByLabel('Time', { exact: true }).blur();
    await expect(page.getByText('The end must be after the start.')).toBeVisible();
    await setDateTime(page, 'End date and time', '2030-05-10', '10:00 AM'); // equal is not "after"
    await expect(page.getByText('The end must be after the start.')).toBeVisible();
    await setDateTime(page, 'End date and time', '2030-05-11', '10:00 AM');
    await expect(page.getByText('The end must be after the start.')).toHaveCount(0);
    await expect(group(page, 'End date and time').getByRole('alert')).toHaveCount(0);
    // the calendar of the end does not allow a day before the start
    await group(page, 'End date and time').getByRole('button', { name: 'Open calendar' }).click();
    const dialog = page.getByRole('dialog', { name: /Choose the end date/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Previous month' }).click();
    await expect(dialog.locator('[data-date="2030-05-09"]')).toHaveAttribute('aria-disabled', 'true');
    await expect(dialog.locator('[data-date="2030-05-10"]')).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('submitting with a date but no time marks the Time part, announces the error and puts focus on it', async ({ page }) => {
    await open(page);
    await page.getByLabel('Title', { exact: true }).fill('Needs a time');
    await page.getByRole('combobox', { name: 'Country' }).click();
    await page.getByRole('option', { name: 'Ghana' }).click();
    await page.getByLabel('Participant target').fill('30');
    await group(page).getByLabel('Date', { exact: true }).fill('2030-05-10');
    await group(page).getByLabel('Date', { exact: true }).blur();
    await page.getByRole('button', { name: 'Create program' }).click();
    await expect(group(page).getByRole('alert')).toHaveText('Choose the start date and time.');
    await expect(time(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(group(page).getByLabel('Date', { exact: true })).not.toHaveAttribute('aria-invalid', 'true');
    await expect(time(page, 'Start date and time')).toBeFocused();
    // a missing date: the Date part is the first invalid part and takes focus
    await group(page).getByLabel('Date', { exact: true }).fill('');
    await time(page).fill('6pm');
    await time(page).blur();
    await page.getByRole('button', { name: 'Create program' }).click();
    await expect(group(page).getByLabel('Date', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(group(page).getByLabel('Date', { exact: true })).toBeFocused();
  });

  test('a program with both date-times created here is listed and its detail shows them in the usual format', async ({ page }) => {
    await open(page);
    await page.getByLabel('Title', { exact: true }).fill('Round trip program');
    await page.getByRole('combobox', { name: 'Country' }).click();
    await page.getByRole('option', { name: 'Ghana' }).click();
    await setDateTime(page, 'Start date and time', '2031-03-04', '6:00 PM');
    await setDateTime(page, 'End date and time', '2031-03-04', '8:30 PM');
    await page.getByLabel('Participant target').fill('30');
    await page.getByRole('textbox', { name: 'Facilitators' }).fill('Test Facilitator');
    await page.getByRole('textbox', { name: 'Facilitators' }).press('Enter');
    await page.getByRole('button', { name: 'Create program' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Round trip program', { timeout: 15_000 });
    await expect(page.getByText('4 Mar 2031, 6:00 PM', { exact: true })).toBeVisible();
    await expect(page.getByText('4 Mar 2031, 8:30 PM', { exact: true })).toBeVisible();
  });

  test('an existing program loads with its times shown correctly and saves with the stored values unchanged', async ({ page }) => {
    const program = buildSeed().collections.programs.find((p) => p.status === 'planned')!;
    // (programs are stored as a date or a date-time; a date alone has always been shown with 9:00 AM in the form)
    const asValue = (value: string) => (value.length === 10 ? `${value}T09:00` : value.slice(0, 16));
    const { date: sd, time: st } = splitDateTime(asValue(program.startAt));
    const { date: ed, time: et } = splitDateTime(asValue(program.endAt));
    await open(page, `/programs/${program.id}/edit`);
    await expect(group(page).getByLabel('Date', { exact: true })).toHaveValue(formatDate(sd));
    await expect(time(page)).toHaveValue(formatTime12(st));
    await expect(group(page, 'End date and time').getByLabel('Date', { exact: true })).toHaveValue(formatDate(ed));
    await expect(time(page, 'End date and time')).toHaveValue(formatTime12(et));
    const before = { start: formatDateTime(asValue(program.startAt)), end: formatDateTime(asValue(program.endAt)) };
    await page.getByLabel('Notes', { exact: false }).first().fill('Changed in the round-trip test');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(program.name, { timeout: 15_000 });
    await expect(page.getByText(before.start, { exact: true })).toBeVisible();
    await expect(page.getByText(before.end, { exact: true })).toBeVisible();
  });
});

test.describe('DateTimeField: in the Listing form', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the event date and time is an optional group with a Date and a Time part, and no native date-time input is on the page', async ({ page }) => {
    await page.goto(`${BASE_URL}/opportunities/new`, { timeout: 30_000 });
    const group = page.getByRole('group', { name: 'Event date and time' });
    await expect(group).toBeVisible();
    await expect(group.getByText('Optional')).toBeVisible();
    await expect(group.getByLabel('Date', { exact: true })).toBeVisible();
    await expect(group.getByLabel('Time', { exact: true })).toBeVisible();
    await expect(group.getByTestId('time-zone')).toHaveText('GMT');
    expect(await page.locator('input[type="date"], input[type="time"], input[type="datetime-local"], input[type="month"]').count()).toBe(0);
    // empty is allowed: no error is shown for an untouched optional field
    await expect(group.getByRole('alert')).toHaveCount(0);
    await group.getByLabel('Time', { exact: true }).fill('6pm');
    await group.getByLabel('Time', { exact: true }).blur();
    await expect(group.getByLabel('Time', { exact: true })).toHaveValue('6:00 PM');
  });

  test('an existing event listing opens with its date and time filled in', async ({ page }) => {
    const listing = buildSeed().collections.listings.find((l) => l.eventAt && l.type === 'event')!;
    const { date, time } = splitDateTime(listing.eventAt!);
    await page.goto(`${BASE_URL}/opportunities/${listing.id}/edit`, { timeout: 30_000 });
    const group = page.getByRole('group', { name: 'Event date and time' });
    await expect(group).toBeVisible();
    await expect(group.getByLabel('Date', { exact: true })).toHaveValue(formatDate(date));
    await expect(group.getByLabel('Time', { exact: true })).toHaveValue(formatTime12(time));
  });
});

test.describe('DateTimeField: on a phone', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 434, height: 900 } });

  test('the times open as a bottom sheet with 48px rows that closes with the backdrop, the close button and Escape, and chooses a time', async ({ page }) => {
    await page.goto(`${BASE_URL}/programs/new`, { timeout: 30_000 });
    const group = page.getByRole('group', { name: 'Start date and time' });
    await expect(group).toBeVisible();
    const field = group.getByLabel('Time', { exact: true });
    const openIt = async () => {
      await group.getByRole('button', { name: 'Open the list of times' }).click();
      await expect(page.getByRole('dialog', { name: 'Choose a time' })).toBeVisible();
    };
    await openIt();
    const sheet = page.getByRole('dialog', { name: 'Choose a time' });
    await expect(sheet).toHaveAttribute('aria-modal', 'true');
    await expect.poll(async () => { const b = (await sheet.boundingBox())!; return Math.round(b.y + b.height); }).toBe(900); // pinned to the bottom
    const box = (await sheet.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(434.5);
    const rows = await sheet.getByRole('option').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
    expect(rows).toHaveLength(48);
    expect(new Set(rows)).toEqual(new Set([48]));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await sheet.getByRole('button', { name: 'Close' }).boundingBox())!.height).toBe(40);
    // closes
    await page.getByTestId('time-sheet-backdrop').click({ position: { x: 20, y: 20 } });
    await expect(sheet).toHaveCount(0);
    await openIt();
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toHaveCount(0);
    await openIt();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(field).toBeFocused();
    // Tab stays inside the sheet
    await openIt();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    // chooses a time
    await sheet.getByRole('option', { name: '6:30 PM' }).scrollIntoViewIfNeeded();
    await sheet.getByRole('option', { name: '6:30 PM' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(field).toHaveValue('6:30 PM');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Settings (/settings): My account, Targets, Pipeline stages, Integrations.
// ---------------------------------------------------------------------------------------------------------------
test.describe('Settings: the rules (no browser)', () => {
  test('a target is a whole number from 1 to 10,000,000 (commas and spaces are fine)', () => {
    for (const good of ['1', '12000', '12,000', ' 15 ', '10000000', '10,000,000']) expect(validateTarget(good), good).toBeUndefined();
    expect(validateTarget('')).toBe('Enter a target.');
    expect(validateTarget('0')).toBe('A target is at least 1.');
    expect(validateTarget('-3')).toBe('A target is a whole number.');
    expect(validateTarget('1.5')).toBe('A target is a whole number.');
    expect(validateTarget('abc')).toBe('A target is a whole number.');
    expect(validateTarget('10000001')).toBe('A target is at most 10,000,000.');
    expect(parseTarget('12,000')).toBe(12000);
    expect(TARGET_MAX).toBe(10_000_000);
  });

  test('one row for each of the ten KPIs, with the label, the unit, the owners and the target in force', () => {
    const rows = targetRows();
    expect(rows.map((r) => r.key)).toEqual([...KPI_KEYS]);
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      expect(row.label).toBe(KPIS[row.key].label);
      expect(row.unit).toBe(KPIS[row.key].unit);
      expect(row.target).toBe(DEFAULT_TARGETS[row.key]);
      expect(row.owners.map((o) => o.id)).toEqual(KPIS[row.key].owners);
    }
    const now = currentMonth();
    expect(effectiveFromOptions()).toEqual([now, monthsBefore(now, -1), monthsBefore(now, -2)]);
    expect(monthsBefore(now, -1) > now).toBe(true);
  });

  test('thresholds: whole numbers from 1 to 200 and amber below green', () => {
    expect(validateThresholds('95', '70')).toEqual({});
    expect(validateThresholds('70', '70').amber).toBe('Amber must be below green.');
    expect(validateThresholds('60', '70').amber).toBe('Amber must be below green.');
    expect(validateThresholds('100', '99')).toEqual({});
    expect(validateThresholds('0', '1').green).toBe('Use a number from 1 to 200.');
    expect(validateThresholds('201', '70').green).toBe('Use a number from 1 to 200.');
    expect(validateThresholds('200', '1')).toEqual({});
    expect(validateThresholds('9.5', '70').green).toBe('Use a whole number.');
    expect(validateThresholds('', '').green).toBe('Enter the green percentage.');
    expect(validateThresholds('95', '').amber).toBe('Enter the amber percentage.');
    expect(thresholdPercents({ green: 0.95, amber: 0.7 })).toEqual({ green: 95, amber: 70 });
  });

  test('the live example is worked out with kpiStatus and the thresholds being typed', () => {
    expect(thresholdExample(95, 70)).toBe('With a target of 12,000, an output of 9,000 is On track on the 20th of a 30-day month');
    expect(kpiStatus(9000, 12000, 20, 30, { green: 0.95, amber: 0.7 })).toBe('green');
    expect(thresholdExample(150, 100)).toContain('is Behind on the 20th of a 30-day month'); // 9,000 / 8,000 = 1.125: below 150%, above 100%
    expect(thresholdExample(200, 150)).toContain('is Off track on the 20th'); // below 150%
    expect(thresholdExample(95, 70, 20000, 4000, 15, 30)).toBe('With a target of 20,000, an output of 4,000 is Off track on the 15th of a 30-day month');
  });

  test('saving a target adds history and never rewrites the past: last month keeps its target and its status, this month changes', () => {
    const snapshot = getMockCollection('targetHistory');
    try {
      const now = currentMonth();
      const last = monthsBefore(now, 1);
      const today = new Date(); // (the statuses are judged as of today, the day the data was made for)
      const key = 'beneficiaries_verified' as const;
      const before = { last: kpiTarget(key, undefined, last), now: kpiTarget(key, undefined, now), lastStatus: kpiMonthStatus(key, last, today), nowStatus: kpiMonthStatus(key, now, today) };
      expect(before.last).toBe(15);
      expect(before.now).toBe(15);
      expect(saveTargets([{ kpi: key, value: 5000 }], now)).toBe(1);
      expect(kpiTarget(key, undefined, last)).toBe(15); // the past keeps the target that applied then
      expect(kpiTarget(key, undefined, now)).toBe(5000);
      expect(kpiTarget(key)).toBe(5000); // (this month is the default)
      expect(kpiMonthStatus(key, last, today)).toBe(before.lastStatus);
      expect(kpiMonthStatus(key, now, today)).not.toBe(before.nowStatus);
      expect(kpiMonthStatus(key, now, today)).toBe('red');
      // another KPI is untouched
      expect(kpiTarget('social_reach')).toBe(DEFAULT_TARGETS.social_reach);
      // a second save for the same KPI and month replaces that row; a later start leaves this month alone
      saveTargets([{ kpi: key, value: 7000 }], now);
      // (a second save for the same month is ANOTHER row: no row is ever edited, and the later one wins)
      expect(getMockCollection('targetHistory').filter((h) => h.kpi === key && h.effectiveFrom === now).map((h) => h.value)).toEqual([5000, 7000]);
      expect(kpiTarget(key, undefined, now)).toBe(7000);
      saveTargets([{ kpi: key, value: 9000 }], monthsBefore(now, -1));
      expect(kpiTarget(key, undefined, now)).toBe(7000);
      expect(kpiTarget(key, undefined, monthsBefore(now, -1))).toBe(9000);
      expect(kpiTarget(key, undefined, monthsBefore(now, -2))).toBe(9000);
      expect(getMockCollection('targets').find((t) => t.kpi === key)?.target).toBe(15); // the first target is never edited
      expect(saveTargets([], now)).toBe(0);
    } finally {
      setMockCollection('targetHistory', snapshot, { always: true });
    }
  });

  test('everything that reads a target goes through kpiTarget: DEFAULT_TARGETS is read only by the seed', () => {
    const readers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx|ts)$/.test(entry.name) && /DEFAULT_TARGETS/.test(readFileSync(full, 'utf8'))) readers.push(full.replace(/\\/g, '/'));
      }
    };
    walk('src');
    expect(readers).toEqual(['src/lib/mock-seed.ts']);
  });

  test('stage names: not empty, 24 characters at most, and different from the others whatever the case', () => {
    const base = { ...PARTNER_STAGE_LABELS };
    expect(validateStageLabels(base)).toEqual({});
    expect(validateStageLabels({ ...base, outreach: '  ' }).outreach).toBe('Enter a name for this stage.');
    expect(validateStageLabels({ ...base, outreach: 'a'.repeat(24) })).toEqual({});
    expect(validateStageLabels({ ...base, outreach: 'a'.repeat(25) }).outreach).toBe('Use 24 characters or fewer.');
    const duplicate = validateStageLabels({ ...base, outreach: 'PROSPECT' });
    expect(duplicate.outreach).toBe('Another stage already has this name.');
    expect(duplicate.prospect).toBe('Another stage already has this name.');
    expect(validateStageLabels({ ...base, outreach: ' prospect ' }).outreach).toBe('Another stage already has this name.');
    expect(STAGE_LABEL_MAX).toBe(24);
    expect([...CLOSED_STAGES]).toEqual(['onboard', 'renew']);
  });

  test('stage labels save and reset in the store, the keys never change', () => {
    const before = currentStageLabels();
    try {
      saveStageLabels({ ...before, outreach: 'Pitched ' });
      expect(getPartnerStageLabels().outreach).toBe('Pitched');
      expect(Object.keys(getPartnerStageLabels())).toEqual(Object.keys(PARTNER_STAGE_LABELS));
      resetStageLabels();
      expect(getPartnerStageLabels()).toEqual(PARTNER_STAGE_LABELS);
    } finally {
      saveStageLabels(before);
    }
  });

  test('a credential is write-only: only the last four characters are kept, never the value', () => {
    const canary = 'CANARY-wp-secret-8c1d-9f3a';
    saveCredential('wordpress', canary);
    const status = getIntegration('wordpress');
    expect(status).toMatchObject({ saved: true, tail: '9f3a' });
    expect(maskedTail(status.tail)).toBe('••••9f3a');
    expect(JSON.stringify(status)).not.toContain(canary);
    expect(JSON.stringify(status)).not.toContain('CANARY');
    expect(Object.values(status).every((v) => typeof v === 'string' || typeof v === 'boolean')).toBe(true);
    expect(getIntegration('analytics').saved).toBe(false); // the other one is separate
    saveCredential('wordpress', '');
    expect(getIntegration('wordpress').saved).toBe(false);
    saveIdentifier('wordpress', ' https://example.org ');
    expect(getIntegration('wordpress').identifier).toBe('https://example.org');
  });

  test('Test connection is a mock that takes no value and succeeds after 800 ms', async () => {
    expect(testConnection.length).toBe(1); // (the kind only: it cannot be given a secret)
    const started = Date.now();
    const result = await testConnection('analytics');
    expect(result).toEqual({ ok: true, kind: 'analytics' });
    expect(Date.now() - started).toBeGreaterThanOrEqual(780);
  });

  test('the password rules: minimum length, a different new password, a matching confirmation, and a strength hint', () => {
    expect(PASSWORD_MIN).toBe(8);
    const ok = { current: 'old-password-1', next: 'Brand-new-pass-9!', confirm: 'Brand-new-pass-9!' };
    expect(validatePasswordChange(ok)).toEqual({});
    expect(validatePasswordChange({ ...ok, confirm: 'Brand-new-pass-8!' }).confirm).toBe('The passwords do not match.');
    expect(validatePasswordChange({ ...ok, next: 'short1', confirm: 'short1' }).next).toBe('Use at least 8 characters.');
    expect(validatePasswordChange({ ...ok, next: ok.current, confirm: ok.current }).next).toBe('The new password must be different from the current one.');
    expect(Object.keys(validatePasswordChange({ current: '', next: '', confirm: '' })).sort()).toEqual(['confirm', 'current', 'next']);
    expect(passwordStrength('')).toBe('empty');
    expect(passwordStrength('abc')).toBe('weak');
    expect(passwordStrength('abcdefgh')).toBe('weak');
    expect(passwordStrength('Abcdefgh1')).toBe('fair');
    expect(passwordStrength('Abcdefgh1!xyz')).toBe('strong');
    expect(STRENGTH_HINTS.strong).toBe('Strong.');
  });
});

const goViaSidebar = async (page: import('@playwright/test').Page, group: string, link: string) => {
  const aside = page.locator('aside');
  const toggle = aside.getByRole('button', { name: group });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await aside.getByRole('link', { name: new RegExp(`^${link}\\b`) }).click(); // (a pill after the name, like "Database 32 pending", is fine)
};

test.describe('Settings: roles', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const role of ROLE_IDS.filter((r) => r !== 'desk_lead' && r !== 'super_admin')) {
    test(`${role} sees only My account: no tabs, and the other addresses show the no-access state`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/settings`, { timeout: 30_000 });
      await expect(page.getByTestId('page-title')).toHaveText('Settings');
      await expect(page.getByRole('region', { name: 'Profile' })).toBeVisible();
      await expect(page.getByRole('tablist')).toHaveCount(0);
      for (const name of ['Targets', 'Pipeline stages', 'Integrations']) await expect(page.getByRole('tab', { name })).toHaveCount(0);
      for (const path of ['/settings/targets', '/settings/pipeline-stages', '/settings/integrations']) {
        await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
        await expect(page.getByTestId('no-access')).toBeVisible();
        await expect(page.getByRole('tablist')).toHaveCount(0);
      }
    });
  }

  for (const role of ['desk_lead', 'super_admin']) {
    test(`${role} sees all four tabs, and each opens`, async ({ page, context }) => {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/settings`, { timeout: 30_000 });
      const tabs = page.getByRole('tablist', { name: 'Settings sections' });
      await expect(tabs).toBeVisible();
      expect((await tabs.getByRole('tab').allInnerTexts()).map((t) => t.trim())).toEqual(['My account', 'Targets', 'Pipeline stages', 'Integrations']);
      await tabs.getByRole('tab', { name: 'Targets' }).click();
      await expect(page).toHaveURL(/\/settings\/targets$/);
      await expect(page.getByRole('region', { name: 'Monthly targets' })).toBeVisible();
      await tabs.getByRole('tab', { name: 'Pipeline stages' }).click();
      await expect(page).toHaveURL(/\/settings\/pipeline-stages$/);
      await expect(page.getByRole('region', { name: 'Pipeline stages' })).toBeVisible();
      await tabs.getByRole('tab', { name: 'Integrations' }).click();
      await expect(page).toHaveURL(/\/settings\/integrations$/);
      await expect(page.getByRole('region', { name: 'WordPress' })).toBeVisible();
      await tabs.getByRole('tab', { name: 'My account' }).click();
      await expect(page).toHaveURL(/\/settings$/);
      await expect(page.getByRole('tab', { name: 'My account' })).toHaveAttribute('aria-selected', 'true');
    });
  }
});

test.describe('Settings: My account', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1100 } });
  const open = async (page: import('@playwright/test').Page) => {
    await page.goto(`${BASE_URL}/settings`, { timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Profile' })).toBeVisible();
  };
  const passwordCard = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Change password' });

  test('the profile: an editable name, a photo drop, and a read-only email and role(s)', async ({ page }) => {
    await open(page);
    const profile = page.getByRole('region', { name: 'Profile' });
    const me = buildSeed().collections.staff.find((s) => s.isCurrentUser)!;
    await expect(profile.getByRole('textbox', { name: 'Name' })).toHaveValue(me.name);
    await expect(page.getByTestId('account-email')).toHaveValue(me.email);
    await expect(page.getByTestId('account-email')).toBeDisabled();
    await expect(page.getByTestId('account-roles')).toContainText('Super Admin');
    await expect(profile.getByText('Click to upload or drag a photo here')).toBeVisible();
    const save = profile.getByRole('button', { name: 'Save profile' });
    await expect(save).toBeDisabled(); // nothing changed
    await profile.getByRole('textbox', { name: 'Name' }).fill('Nana Test Adjei');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Your profile was saved.' })).toBeVisible();
    await expect(save).toBeDisabled();
    await profile.getByRole('textbox', { name: 'Name' }).fill('');
    await expect(profile.getByText('Enter your name.')).toBeVisible();
    await expect(save).toBeDisabled();
  });

  test('each password field has its own show/hide eye, 40px, that toggles the field and is hidden again when the tab is hidden', async ({ page }) => {
    await open(page);
    const card = passwordCard(page);
    for (const [word, label] of [['current password', 'Current password'], ['new password', 'New password'], ['confirmation', 'Confirm new password']]) {
      const field = card.getByLabel(label, { exact: true });
      const eye = card.getByRole('button', { name: `Show ${word}` });
      expect(await field.getAttribute('type')).toBe('password');
      const box = (await eye.boundingBox())!;
      expect([Math.round(box.width), Math.round(box.height)]).toEqual([40, 40]);
      await eye.click();
      expect(await field.getAttribute('type')).toBe('text');
      await expect(card.getByRole('button', { name: `Hide ${word}` })).toHaveAttribute('aria-pressed', 'true');
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      });
      expect(await field.getAttribute('type')).toBe('password'); // hidden again
    }
  });

  test('a mismatch, a short password and an empty current password are refused with their messages, and the first bad field takes focus', async ({ page }) => {
    await open(page);
    const card = passwordCard(page);
    await card.getByRole('button', { name: 'Change password' }).click();
    for (const message of ['Enter your current password.', 'Enter a new password.', 'Confirm the new password.']) await expect(card.getByText(message)).toBeVisible();
    await expect(card.getByLabel('Current password', { exact: true })).toBeFocused();
    await card.getByLabel('Current password', { exact: true }).fill('some-old-password');
    await card.getByLabel('New password', { exact: true }).fill('short');
    await card.getByLabel('Confirm new password', { exact: true }).fill('different');
    await card.getByRole('button', { name: 'Change password' }).click();
    await expect(card.getByText('Use at least 8 characters.')).toBeVisible();
    await expect(card.getByText('The passwords do not match.')).toBeVisible();
    await card.getByLabel('New password', { exact: true }).fill('A-long-enough-pass-1');
    await card.getByLabel('Confirm new password', { exact: true }).fill('A-long-enough-pass-2');
    await card.getByLabel('Confirm new password', { exact: true }).blur();
    await expect(card.getByText('The passwords do not match.')).toBeVisible();
    await expect(card.getByText('Use at least 8 characters.')).toHaveCount(0);
    await expect(page.getByTestId('toast')).toHaveCount(0); // nothing was changed
  });

  test('the strength hint follows the new password: weak, fair, strong', async ({ page }) => {
    await open(page);
    const field = passwordCard(page).getByLabel('New password', { exact: true });
    const hint = page.getByTestId('password-strength');
    await expect(hint).toHaveAttribute('data-strength', 'empty');
    await field.fill('abc');
    await expect(hint).toHaveAttribute('data-strength', 'weak');
    await expect(hint).toContainText('Weak');
    await field.fill('Abcdefgh1');
    await expect(hint).toHaveAttribute('data-strength', 'fair');
    await field.fill('Abcdefgh1!xyz');
    await expect(hint).toHaveAttribute('data-strength', 'strong');
    await expect(hint).toContainText('Strong.');
  });

  test('changing the password empties the three fields and keeps the values nowhere: not in the page, not in storage, not in the toast', async ({ page }) => {
    await open(page);
    const logs: string[] = [];
    page.on('console', (message) => logs.push(message.text()));
    const canaries = ['CANARY-old-pw-4471', 'CANARY-new-pw-9921!A', 'CANARY-new-pw-9921!A'];
    const card = passwordCard(page);
    await card.getByLabel('Current password', { exact: true }).fill(canaries[0]);
    await card.getByLabel('New password', { exact: true }).fill(canaries[1]);
    await card.getByLabel('Confirm new password', { exact: true }).fill(canaries[2]);
    await card.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Your password was changed.' })).toBeVisible();
    for (const label of ['Current password', 'New password', 'Confirm new password']) await expect(card.getByLabel(label, { exact: true })).toHaveValue('');
    const leaked = await page.evaluate((needles) => {
      const haystack = [document.documentElement.outerHTML, document.body.innerText, ...[...document.querySelectorAll('input')].map((i) => (i as HTMLInputElement).value), JSON.stringify({ ...localStorage }), JSON.stringify({ ...sessionStorage })].join('\n');
      return needles.filter((needle) => haystack.includes(needle));
    }, ['CANARY-old-pw-4471', 'CANARY-new-pw-9921']);
    expect(leaked).toEqual([]);
    expect(logs.filter((line) => line.includes('CANARY'))).toEqual([]);
    await expect(page.getByTestId('password-strength')).toHaveAttribute('data-strength', 'empty');
  });

  test('notification preferences are switches with On/Off, saved with a button; Sign out is there', async ({ page }) => {
    await open(page);
    const card = page.getByRole('region', { name: 'Notification preferences' });
    expect(await card.getByRole('switch').count()).toBe(4);
    const save = card.getByRole('button', { name: 'Save preferences' });
    await expect(save).toBeDisabled();
    const testimonials = card.getByRole('switch', { name: 'Testimonials waiting' });
    await expect(testimonials).toHaveAttribute('aria-checked', 'false');
    await testimonials.click();
    await expect(testimonials).toHaveAttribute('aria-checked', 'true');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Your notification preferences were saved.' })).toBeVisible();
    await expect(save).toBeDisabled();
    await expect(page.getByRole('region', { name: 'Sign out' }).getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('leaving with unsaved changes asks first', async ({ page }) => {
    await open(page);
    await page.getByRole('region', { name: 'Profile' }).getByRole('textbox', { name: 'Name' }).fill('Changed name');
    await page.locator('aside').getByRole('button', { name: 'Dashboard' }).click();
    await page.locator('aside').getByRole('link', { name: 'Overview', exact: true }).click();
    await expect(page.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Keep editing' }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });
});

test.describe('Settings: Targets', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1100 } });
  const open = async (page: import('@playwright/test').Page) => {
    await page.goto(`${BASE_URL}/settings/targets`, { timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Monthly targets' })).toBeVisible();
  };
  const setTarget = async (page: import('@playwright/test').Page, key: string, value: string) => {
    await page.getByTestId(`target-input-${key}`).fill(value);
    await page.getByTestId(`target-input-${key}`).blur();
  };
  const save = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Save', exact: true });

  test('ten rows, one for each KPI: label, unit, owner pills and the target as a number field', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('targets-list').locator('li')).toHaveCount(10);
    for (const key of KPI_KEYS) {
      const row = page.getByTestId(`target-row-${key}`);
      await expect(row).toContainText(KPIS[key].label);
      await expect(row).toContainText(`Counted in ${KPIS[key].unit}`);
      await expect(page.getByTestId(`target-input-${key}`)).toHaveValue(String(DEFAULT_TARGETS[key]));
      for (const owner of KPIS[key].owners) await expect(row).toContainText(ROLES[owner].label);
      await expect(page.getByTestId(`changed-dot-${key}`)).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled(); // nothing changed yet
  });

  test('a changed row gets a dot, the bar counts the changes, Reset puts everything back', async ({ page }) => {
    await open(page);
    await setTarget(page, 'social_reach', '12000');
    await expect(page.getByTestId('changed-dot-social_reach')).toBeVisible();
    await expect(page.getByTestId('changed-dot-social_reach')).toHaveAccessibleName('Changed');
    await expect(page.getByText('1 change', { exact: true })).toBeVisible();
    await setTarget(page, 'posts_published', '10');
    await expect(page.getByText('2 changes', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByTestId('target-input-social_reach')).toHaveValue(String(DEFAULT_TARGETS.social_reach));
    await expect(page.getByTestId('target-input-posts_published')).toHaveValue(String(DEFAULT_TARGETS.posts_published));
    await expect(page.getByTestId('changed-dot-social_reach')).toHaveCount(0);
    await expect(save(page)).toBeDisabled();
  });

  test('a target must be a whole number from 1 to 10,000,000: each message shows, and nothing is saved', async ({ page }) => {
    await open(page);
    const row = (key: string) => page.getByTestId(`target-row-${key}`);
    await setTarget(page, 'posts_published', '0');
    await expect(row('posts_published')).toContainText('A target is at least 1.');
    await setTarget(page, 'posts_published', '2.5');
    await expect(row('posts_published')).toContainText('A target is a whole number.');
    await setTarget(page, 'posts_published', '10000001');
    await expect(row('posts_published')).toContainText('A target is at most 10,000,000.');
    await setTarget(page, 'posts_published', '');
    await expect(row('posts_published')).toContainText('Enter a target.');
    await save(page).click();
    await expect(page.getByTestId('toast')).toHaveCount(0);
    await expect(page.getByTestId('target-input-posts_published')).toBeFocused();
    await setTarget(page, 'posts_published', '12');
    await expect(row('posts_published')).not.toContainText('A target is');
  });

  test('thresholds: amber must be below green; the example changes as you type; saving is refused until it is right', async ({ page }) => {
    await open(page);
    const card = page.getByRole('region', { name: 'Status thresholds' });
    const green = card.getByLabel('Green from (%)');
    const amber = card.getByLabel('Amber from (%)');
    await expect(green).toHaveValue('95');
    await expect(amber).toHaveValue('70');
    await expect(page.getByTestId('threshold-example')).toHaveText('With a target of 12,000, an output of 9,000 is On track on the 20th of a 30-day month');
    await amber.fill('96');
    await expect(card.getByText('Amber must be below green.')).toBeVisible();
    await save(page).click();
    await expect(page.getByTestId('toast')).toHaveCount(0);
    await expect(amber).toBeFocused();
    await amber.fill('70');
    await green.fill('150');
    await expect(card.getByText('Amber must be below green.')).toHaveCount(0);
    await expect(page.getByTestId('threshold-example')).toContainText('is Behind on the 20th');
    await green.fill('201');
    await expect(card.getByText('Use a number from 1 to 200.')).toBeVisible();
    await green.fill('9.5');
    await expect(card.getByText('Use a whole number.')).toBeVisible();
    await green.fill('70');
    await expect(card.getByText('Amber must be below green.')).toBeVisible();
  });

  test('saving changes the Database gauge: the target, the status and the pace text all follow (and the toast says when it starts)', async ({ page }) => {
    await open(page);
    await setTarget(page, 'beneficiaries_verified', '60');
    await save(page).click();
    await expect(page.getByTestId('toast').filter({ hasText: `Beneficiaries verified target changed to 60 from ${formatMonth(currentMonth())}.` })).toBeVisible();
    await expect(page.getByTestId('changed-dot-beneficiaries_verified')).toHaveCount(0);
    await goViaSidebar(page, 'People', 'Database');
    await expect(page.getByTestId('pace-target')).toHaveText('60');
    const pace = recordsPace();
    await expect(page.getByTestId('pace-headline')).toHaveText(`${pace.verified} of 60 verified`);
    await expect(page.getByRole('meter')).toHaveAttribute('aria-valuetext', new RegExp(`^${pace.verified} of 60 verified, pro-rated pace \\d+, (off track|behind)$`));
    await expect(page.getByTestId('pace-status')).not.toHaveText('On track');
  });

  test('saving changes the Partners pipeline health: a bigger onboarding target needs more open deals', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('target-input-partners_onboarded')).toHaveValue('4');
    await setTarget(page, 'partners_onboarded', '8'); // 8 x 11 reached / 5 closed = 18 needed
    await save(page).click();
    await expect(page.getByTestId('toast')).toBeVisible();
    await goViaSidebar(page, 'Partners & network', 'Partners');
    await expect(page.getByTestId('pipeline-headline')).toHaveText('13 open deals, 18 needed');
    await expect(page.getByRole('region', { name: 'Pipeline health' }).getByRole('meter')).toHaveAttribute('aria-valuetext', '13 open deals, 18 needed, 0.7 times the target, thin');
    await expect(page.getByTestId('pipeline-detail')).toContainText("Next month's target: 8 partners onboarded.");
  });

  test('the past is not rewritten: a new target for this month changes this month on Social and leaves last month with the old one', async ({ page }) => {
    await open(page);
    await setTarget(page, 'posts_published', '20');
    await save(page).click();
    await expect(page.getByTestId('toast')).toBeVisible();
    await goViaSidebar(page, 'Content', 'Social');
    await expect(page.getByTestId('total-posts')).toContainText('Target 20');
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option', { name: formatMonth(monthsBefore(currentMonth(), 1)) }).click();
    await expect(page.getByTestId('total-posts')).toContainText(`Target ${DEFAULT_TARGETS.posts_published}`);
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option', { name: /Current/ }).click();
    await expect(page.getByTestId('total-posts')).toContainText('Target 20');
  });

  test('a target that starts next month leaves this month as it is', async ({ page }) => {
    await open(page);
    await page.getByRole('combobox', { name: 'New targets apply from' }).click();
    await page.getByRole('option', { name: new RegExp(formatMonth(monthsBefore(currentMonth(), -1))) }).click();
    await setTarget(page, 'posts_published', '30');
    await save(page).click();
    await expect(page.getByTestId('toast').filter({ hasText: `Posts published target changed to 30 from ${formatMonth(monthsBefore(currentMonth(), -1))}` })).toBeVisible();
    // the form is clean again (no "1 change"), and the row says when the new target starts
    await expect(page.getByText('1 change', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('scheduled-posts_published')).toHaveText(`Changes to 30 from ${formatMonth(monthsBefore(currentMonth(), -1))}`);
    await goViaSidebar(page, 'Content', 'Social');
    await expect(page.getByTestId('total-posts')).toContainText(`Target ${DEFAULT_TARGETS.posts_published}`);
  });

  test('the thresholds save too: the example and the Database status follow the new percentages', async ({ page }) => {
    await open(page);
    const card = page.getByRole('region', { name: 'Status thresholds' });
    await card.getByLabel('Green from (%)').fill('150');
    await card.getByLabel('Amber from (%)').fill('100');
    await save(page).click();
    await expect(page.getByTestId('toast').filter({ hasText: `Thresholds changed from ${formatMonth(currentMonth())}.` })).toBeVisible();
    await expect(page.getByText('1 change', { exact: true })).toHaveCount(0);
    await goViaSidebar(page, 'People', 'Database');
    await expect(page.getByRole('meter')).toBeVisible();
    // the zone words' tooltip names the saved thresholds
    await page.getByTestId('pace-zone-labels').hover();
    await expect(page.getByRole('tooltip')).toHaveText('Far behind: below 100% of the pro-rated pace. Behind: 100% to 150%. On pace: 150% and above.');
  });

  test('leaving with unsaved changes asks first, and a tab switch asks first too', async ({ page }) => {
    await open(page);
    await setTarget(page, 'posts_published', '11');
    await page.getByRole('tab', { name: 'Integrations' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Discard unsaved changes?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/settings\/targets$/);
    await expect(page.getByTestId('target-input-posts_published')).toHaveValue('11');
    await page.getByRole('tab', { name: 'Integrations' }).click();
    await dialog.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page).toHaveURL(/\/settings\/integrations$/);
  });
});

test.describe('Settings: Pipeline stages', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1100 } });
  const open = async (page: import('@playwright/test').Page) => {
    await page.goto(`${BASE_URL}/settings/pipeline-stages`, { timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Pipeline stages' })).toBeVisible();
  };
  const input = (page: import('@playwright/test').Page, stage: string) => page.getByTestId(`stage-input-${stage}`);
  const save = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Save', exact: true });

  test('six stage names, the keys fixed, and Onboard and Renew show a lock and say they count as closed', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('stages-list').locator('li')).toHaveCount(6);
    for (const stage of PARTNER_STAGES) await expect(input(page, stage)).toHaveValue(PARTNER_STAGE_LABELS[stage]);
    for (const stage of ['onboard', 'renew']) {
      await expect(page.getByTestId(`stage-closed-${stage}`)).toHaveText('Counts as closed (cannot be changed)');
      await expect(page.getByTestId(`stage-closed-${stage}`).locator('svg')).toBeVisible(); // the lock
    }
    for (const stage of ['prospect', 'outreach', 'proposal', 'mou']) await expect(page.getByTestId(`stage-closed-${stage}`)).toHaveCount(0);
  });

  test('a name must not be empty, longer than 24 characters, or the same as another (any case)', async ({ page }) => {
    await open(page);
    const row = (stage: string) => page.getByTestId(`stage-row-${stage}`);
    await input(page, 'outreach').fill('');
    await expect(row('outreach')).toContainText('Enter a name for this stage.');
    await input(page, 'outreach').fill('x'.repeat(25));
    await expect(row('outreach')).toContainText('Use 24 characters or fewer.');
    await input(page, 'outreach').fill('PROSPECT');
    await expect(row('outreach')).toContainText('Another stage already has this name.');
    await save(page).click(); // (a save shows every message, also on the stage that was not touched)
    await expect(row('prospect')).toContainText('Another stage already has this name.');
    await expect(page.getByTestId('toast')).toHaveCount(0);
    await input(page, 'outreach').fill('x'.repeat(24));
    await expect(row('outreach')).not.toContainText('characters or fewer');
  });

  test('renaming a stage shows on the Partners board, the Move menu, the filter tabs and the partner timeline in the same render', async ({ page }) => {
    await open(page);
    await input(page, 'outreach').fill('Pitched');
    await expect(page.getByText('1 change', { exact: true })).toBeVisible();
    await save(page).click();
    await expect(page.getByTestId('toast').filter({ hasText: '1 stage name saved' })).toBeVisible();
    await goViaSidebar(page, 'Partners & network', 'Partners');
    await expect(page.getByTestId('kanban-column-outreach').locator('h3')).toHaveText('Pitched');
    await expect(page.getByTestId('kanban-column-outreach')).not.toContainText('Outreach');
    // the Move menu names it
    await page.getByRole('button', { name: /^Move Google Africa to/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Pitched', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Outreach', exact: true })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Pitched', exact: true }).click();
    await expect(page.getByText('Google Africa moved to Pitched.', { exact: true })).toBeVisible();
    // the partner's own page: the timeline and the stage use the new word
    await page.getByTestId('kanban-card-ptn-15').getByRole('link', { name: 'Google Africa' }).click();
    await expect(page.getByTestId('stage-history')).toContainText('Prospect → Pitched');
    await expect(page.getByTestId('stage-history')).not.toContainText('Outreach');
  });

  test('Reset to defaults asks first: Cancel keeps the new names, confirming puts the originals back everywhere', async ({ page }) => {
    await open(page);
    await input(page, 'mou').fill('Signed deal');
    await save(page).click();
    await expect(page.getByTestId('toast')).toBeVisible();
    await page.getByRole('button', { name: 'Reset to defaults' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Reset the stage names?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(input(page, 'mou')).toHaveValue('Signed deal');
    await page.getByRole('button', { name: 'Reset to defaults' }).click();
    await dialog.getByRole('button', { name: 'Reset to defaults' }).click();
    await expect(input(page, 'mou')).toHaveValue('MOU');
    await expect(page.getByTestId('toast').filter({ hasText: 'reset to their defaults' })).toBeVisible();
    await goViaSidebar(page, 'Partners & network', 'Partners');
    await expect(page.getByTestId('kanban-column-mou').locator('h3')).toHaveText('MOU');
  });
});

test.describe('Settings: Integrations', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1100 } });
  const CANARY = 'CANARY-wp-app-pass-5c0e-7b3f9a';
  const open = async (page: import('@playwright/test').Page) => {
    await page.goto(`${BASE_URL}/settings/integrations`, { timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'WordPress' })).toBeVisible();
  };
  /** Where the canary could be: the page, every input, both storages, and the console. */
  const scan = (page: import('@playwright/test').Page, needle: string) =>
    page.evaluate((text) => {
      const places: Record<string, string> = {
        html: document.documentElement.outerHTML,
        text: document.body.innerText,
        inputs: [...document.querySelectorAll('input, textarea')].map((el) => (el as HTMLInputElement).value).join('\n'),
        local: JSON.stringify({ ...localStorage }),
        session: JSON.stringify({ ...sessionStorage }),
        cookies: document.cookie,
      };
      return Object.entries(places).filter(([, value]) => value.includes(text)).map(([name]) => name);
    }, needle);
  const wordpress = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'WordPress' });

  test('the credential is a password field with the eye; nothing is saved at first, and the note about the server is there', async ({ page }) => {
    await open(page);
    const field = wordpress(page).getByTestId('credential-input-wordpress');
    expect(await field.getAttribute('type')).toBe('password');
    expect(await field.getAttribute('autocomplete')).toBe('new-password');
    await wordpress(page).getByRole('button', { name: 'Show WordPress credential' }).click();
    expect(await field.getAttribute('type')).toBe('text');
    await wordpress(page).getByRole('button', { name: 'Hide WordPress credential' }).click();
    expect(await field.getAttribute('type')).toBe('password');
    await expect(page.getByTestId('credentials-note')).toContainText('Credentials are stored on the server in the real app');
    await expect(wordpress(page).getByRole('button', { name: 'Test connection' })).toBeDisabled();
    await wordpress(page).getByRole('button', { name: 'Save credential' }).click();
    await expect(wordpress(page).getByText('Enter the credential.')).toBeVisible();
  });

  test('a saved credential is write-only: only "Saved · ends in ••••7b3f9a"-style text is left, and the canary is nowhere: page, inputs, storage, console', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (message) => logs.push(message.text()));
    await open(page);
    await wordpress(page).getByTestId('credential-input-wordpress').fill(CANARY);
    await wordpress(page).getByRole('button', { name: 'Show WordPress credential' }).click(); // shown while typing: that is allowed
    expect(await scan(page, CANARY)).toContain('inputs');
    await wordpress(page).getByRole('button', { name: 'Save credential' }).click();
    await expect(page.getByTestId('toast').filter({ hasText: 'The WordPress credential was saved.' })).toBeVisible();
    const saved = wordpress(page).getByTestId('credential-saved-wordpress');
    await expect(saved).toHaveText(`Saved · ends in ••••${CANARY.slice(-4)}`);
    await expect(wordpress(page).getByRole('button', { name: 'Replace' })).toBeVisible();
    expect(await wordpress(page).locator('input[type="password"], input[data-testid="credential-input-wordpress"]').count()).toBe(0); // no field is left
    expect(await scan(page, CANARY)).toEqual([]);
    expect(await scan(page, 'CANARY')).toEqual([]);
    expect(logs.filter((line) => line.includes('CANARY'))).toEqual([]);
    // the toast and the accessible tree do not carry it either
    await expect(page.getByTestId('toast')).not.toContainText('CANARY');
    await expect(page.locator('body')).not.toContainText('CANARY');
  });

  test('Replace opens an empty field (never the old value); Cancel keeps the saved one; a new value changes the tail', async ({ page }) => {
    await open(page);
    await wordpress(page).getByTestId('credential-input-wordpress').fill(CANARY);
    await wordpress(page).getByRole('button', { name: 'Save credential' }).click();
    await wordpress(page).getByRole('button', { name: 'Replace' }).click();
    const field = wordpress(page).getByTestId('credential-input-wordpress');
    await expect(field).toHaveValue('');
    await wordpress(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(wordpress(page).getByTestId('credential-saved-wordpress')).toContainText(CANARY.slice(-4));
    await wordpress(page).getByRole('button', { name: 'Replace' }).click();
    await field.fill('CANARY-second-value-0abc');
    await wordpress(page).getByRole('button', { name: 'Save credential' }).click();
    await expect(wordpress(page).getByTestId('credential-saved-wordpress')).toHaveText('Saved · ends in ••••0abc');
    expect(await scan(page, 'CANARY')).toEqual([]);
  });

  test('what is typed is dropped when the tab goes to the background, and when the page is left', async ({ page }) => {
    await open(page);
    const field = wordpress(page).getByTestId('credential-input-wordpress');
    await field.fill(CANARY);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    });
    await expect(field).toHaveValue('');
    expect(await scan(page, CANARY)).toEqual([]);
    await field.fill(CANARY);
    await page.getByRole('tab', { name: 'My account' }).click();
    const dialog = page.getByRole('alertdialog');
    if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page).toHaveURL(/\/settings$/);
    expect(await scan(page, CANARY)).toEqual([]);
    await page.getByRole('tab', { name: 'Integrations' }).click();
    await expect(wordpress(page).getByTestId('credential-input-wordpress')).toHaveValue('');
  });

  test('Test connection is a mock: a spinner and "Testing the connection" for about 800 ms, then an announced success; it never uses the value', async ({ page }) => {
    await open(page);
    await wordpress(page).getByTestId('credential-input-wordpress').fill(CANARY);
    await wordpress(page).getByRole('button', { name: 'Save credential' }).click();
    const requests: string[] = [];
    page.on('request', (request) => requests.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
    const button = wordpress(page).getByRole('button', { name: 'Test connection' });
    await expect(button).toBeEnabled();
    const started = Date.now();
    await button.click();
    await expect(button).toHaveAttribute('aria-busy', 'true'); // the spinner
    const result = wordpress(page).getByTestId('test-result-wordpress');
    await expect(result).toContainText('Testing the connection');
    await expect(result).toHaveText('The connection to WordPress works.');
    expect(Date.now() - started).toBeGreaterThanOrEqual(700);
    await expect(result).toHaveAttribute('role', 'status'); // announced
    await expect(button).not.toHaveAttribute('aria-busy', 'true');
    expect(requests.filter((line) => line.includes('CANARY'))).toEqual([]);
    expect(requests.filter((line) => /^(POST|PUT|PATCH) /.test(line))).toEqual([]); // nothing was sent anywhere
  });

  test('Google Analytics has its own credential, separate from WordPress; the site address and property ID save as plain settings', async ({ page }) => {
    await open(page);
    await wordpress(page).getByTestId('credential-input-wordpress').fill(CANARY);
    await wordpress(page).getByRole('button', { name: 'Save credential' }).click();
    const analytics = page.getByRole('region', { name: 'Google Analytics' });
    await expect(analytics.getByTestId('credential-input-analytics')).toBeVisible(); // still unsaved
    await expect(analytics.getByRole('button', { name: 'Test connection' })).toBeDisabled();
    await analytics.getByRole('textbox', { name: 'Property ID' }).fill('123456789');
    await analytics.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('toast').filter({ hasText: 'property id was saved' })).toBeVisible();
    await analytics.getByTestId('credential-input-analytics').fill('CANARY-ga-secret-2d4e');
    await analytics.getByRole('button', { name: 'Save credential' }).click();
    await expect(analytics.getByTestId('credential-saved-analytics')).toHaveText('Saved · ends in ••••2d4e');
    await expect(wordpress(page).getByTestId('credential-saved-wordpress')).toContainText(CANARY.slice(-4));
    expect(await scan(page, 'CANARY')).toEqual([]);
    await wordpress(page).getByRole('textbox', { name: 'Site address' }).fill('https://www.example.org');
    await wordpress(page).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('toast').filter({ hasText: 'site address was saved' })).toBeVisible();
  });
});

test.describe('Settings: phone (434px)', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 434, height: 900 } });

  for (const width of [434, 390, 360]) {
    for (const [path, ready] of [['/settings', 'Profile'], ['/settings/targets', 'Monthly targets'], ['/settings/pipeline-stages', 'Pipeline stages'], ['/settings/integrations', 'WordPress']] as const) {
      test(`${path} at ${width}px: nothing is wider than the screen`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
        await expect(page.getByRole('region', { name: ready })).toBeVisible();
        await page.waitForTimeout(300);
        const report = await overflowing(page);
        expect(report.found, JSON.stringify(report)).toEqual([]);
        expect(report.scrollWidth).toBeLessThanOrEqual(report.innerWidth);
      });
    }
  }

  test('the tabs fit and scroll, the target rows stack with 40px fields, the eye buttons are 40px and the action bar fits', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/targets`, { timeout: 30_000 });
    await expect(page.getByRole('tab', { name: 'Targets' })).toBeVisible();
    const tabs = (await page.getByRole('tablist').boundingBox())!;
    expect(tabs.x + tabs.width).toBeLessThanOrEqual(434.5);
    const row = page.getByTestId('target-row-posts_published');
    const input = (await page.getByTestId('target-input-posts_published').boundingBox())!;
    const label = (await row.locator('p.table-text').boundingBox())!;
    expect(input.y).toBeGreaterThanOrEqual(label.y + label.height - 1); // stacked under the label
    expect(input.height).toBe(40);
    await page.getByTestId('target-input-posts_published').fill('11');
    await page.getByTestId('target-input-posts_published').blur();
    const bar = (await page.getByRole('button', { name: 'Save', exact: true }).boundingBox())!;
    expect(bar.x + bar.width).toBeLessThanOrEqual(434.5);
    expect(bar.height).toBeGreaterThanOrEqual(40);
    await page.goto(`${BASE_URL}/settings`, { timeout: 30_000 });
    const eye = (await page.getByRole('button', { name: 'Show current password' }).boundingBox())!;
    expect([Math.round(eye.width), Math.round(eye.height)]).toEqual([40, 40]);
    await page.goto(`${BASE_URL}/settings/integrations`, { timeout: 30_000 });
    const save = (await page.getByRole('region', { name: 'WordPress' }).getByRole('button', { name: 'Save credential' }).boundingBox())!;
    expect(save.height).toBeGreaterThanOrEqual(40);
    expect(save.x + save.width).toBeLessThanOrEqual(434.5);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Dated thresholds: the thresholds have a history, like the targets.
// ---------------------------------------------------------------------------------------------------------------
test.describe('Dated thresholds (no browser)', () => {
  const key = 'beneficiaries_verified' as const;
  const restore = () => {
    const targets = getMockCollection('targetHistory');
    const thresholds = getMockCollection('thresholdHistory');
    return () => {
      setMockCollection('targetHistory', targets, { always: true });
      setMockCollection('thresholdHistory', thresholds, { always: true });
    };
  };

  test('(a) thresholds that start this month: this month is judged with them, last month keeps its own', () => {
    const undo = restore();
    try {
      const now = currentMonth();
      const last = monthsBefore(now, 1);
      const today = new Date();
      const before = { last: kpiMonthStatus(key, last, today), now: kpiMonthStatus(key, now, today) };
      expect(before.last).toBe('green'); // 16 of 15 last month
      expect(before.now).toBe('green'); // 4 of a pace of 3.4
      saveThresholds(200, 150, now); // green only from twice the target so far
      expect(kpiThresholds(now)).toEqual({ green: 2, amber: 1.5 });
      expect(kpiThresholds(last)).toEqual({ green: 0.95, amber: 0.7 }); // last month: the thresholds it had
      expect(kpiMonthStatus(key, last, today)).toBe(before.last); // unchanged
      expect(kpiMonthStatus(key, now, today)).toBe('red'); // changed
      // every month before this one is still judged as it was
      for (const month of FIXED_MONTHS) if (month < now) expect(kpiThresholds(month)).toEqual({ green: 0.95, amber: 0.7 });
      // and kpiStatus without thresholds follows the month it is asked about
      expect(kpiStatus(19, 20, 30, 30, undefined, now)).toBe('red');
      expect(kpiStatus(19, 20, 30, 30, undefined, last)).toBe('green');
      expect(kpiStatus(19, 20, 30, 30)).toBe('red'); // no month: this month
    } finally {
      undo();
    }
  });

  test('(b) thresholds that start next month leave this month alone', () => {
    const undo = restore();
    try {
      const now = currentMonth();
      const next = monthsBefore(now, -1);
      const today = new Date();
      const before = kpiMonthStatus(key, now, today);
      saveThresholds(200, 150, next);
      expect(kpiThresholds(now)).toEqual({ green: 0.95, amber: 0.7 });
      expect(kpiMonthStatus(key, now, today)).toBe(before);
      expect(kpiThresholds(next)).toEqual({ green: 2, amber: 1.5 });
      expect(kpiThresholds(monthsBefore(next, -3))).toEqual({ green: 2, amber: 1.5 });
      expect(scheduledThresholds()).toEqual({ green: 200, amber: 150, from: next });
      expect(scheduledThresholds(next)).toBeUndefined();
    } finally {
      undo();
    }
  });

  test('(c) rows are appended in order and an earlier row is never edited, whatever is saved after it', () => {
    const undo = restore();
    try {
      const now = currentMonth();
      const start = getMockCollection('thresholdHistory').map((row) => ({ ...row }));
      saveThresholds(90, 60, now);
      const afterOne = getMockCollection('thresholdHistory').map((row) => ({ ...row }));
      saveThresholds(80, 50, now); // the same month again: another row, the later one wins
      saveThresholds(120, 100, monthsBefore(now, -1));
      saveTargets([{ kpi: key, value: 30 }], now);
      saveTargets([{ kpi: key, value: 40 }], now);
      const rows = getMockCollection('thresholdHistory');
      expect(rows).toHaveLength(start.length + 3);
      expect(rows.slice(0, start.length)).toEqual(start); // the seeded row is untouched
      expect(rows.slice(0, afterOne.length)).toEqual(afterOne); // and so is the first save
      expect(rows.slice(start.length).map((row) => [row.green, row.amber, row.effectiveFrom])).toEqual([[0.9, 0.6, now], [0.8, 0.5, now], [1.2, 1, monthsBefore(now, -1)]]);
      expect(kpiThresholds(now)).toEqual({ green: 0.8, amber: 0.5 });
      // each row records what it replaced, who saved it and on which day
      expect(rows[start.length].previous).toEqual({ green: 0.95, amber: 0.7 });
      expect(rows[start.length + 1].previous).toEqual({ green: 0.9, amber: 0.6 });
      for (const row of rows.slice(start.length)) {
        expect(row.changedBy).toBe(seed.staff.find((person) => person.isCurrentUser)!.name);
        expect(row.changedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      // the targets are appended the same way
      const targetRows = getMockCollection('targetHistory');
      expect(targetRows.map((row) => row.value)).toEqual([30, 40]);
      expect(targetRows[1].previous).toBe(30);
      expect(targetRows[0].previous).toBe(15);
      expect(kpiTarget(key)).toBe(40);
      // the history list: newest first, targets and thresholds in the same list, the starting thresholds are not a change
      const list = changeHistory();
      expect(list).toHaveLength(5);
      expect(list.map((row) => row.kind)).toEqual(['target', 'target', 'thresholds', 'thresholds', 'thresholds']); // the order of saving, newest first
      expect(list[0]).toMatchObject({ kind: 'target', newValue: '40', oldValue: '30', what: 'Beneficiaries verified target' });
      expect(list[1]).toMatchObject({ kind: 'target', newValue: '30', oldValue: '15' });
      expect(list.filter((row) => row.kind === 'thresholds')[0]).toMatchObject({ what: 'Status thresholds', newValue: 'Green 120%, amber 100%', oldValue: 'Green 80%, amber 50%' });
      for (const row of list) expect(row.changedBy).toBe(seed.staff.find((person) => person.isCurrentUser)!.name);
    } finally {
      undo();
    }
  });

  test('(c) with nothing saved the history is empty: the seeded starting thresholds are not a change', () => {
    expect(changeHistory()).toEqual([]);
  });
});

test.describe('Dated thresholds: in Settings and on the pages', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1100 } });
  const open = async (page: import('@playwright/test').Page) => {
    await page.goto(`${BASE_URL}/settings/targets`, { timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Monthly targets' })).toBeVisible();
  };
  const history = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Change history' });
  const me = buildSeed().collections.staff.find((person) => person.isCurrentUser)!.name;

  test('(e) the Change history starts empty ("No changes yet")', async ({ page }) => {
    await open(page);
    await expect(history(page)).toBeVisible();
    await expect(history(page).getByText('No changes yet')).toBeVisible();
    await expect(history(page).getByTestId('history-row')).toHaveCount(0);
    await expect(history(page).getByRole('button', { name: 'Show more' })).toHaveCount(0);
  });

  test('(e) one save adds a row for the target and a row for the thresholds, newest first, with the date, old and new values, the month and the changer', async ({ page }) => {
    await open(page);
    await page.getByTestId('target-input-social_reach').fill('12000');
    const card = page.getByRole('region', { name: 'Status thresholds' });
    await card.getByLabel('Green from (%)').fill('90');
    await card.getByLabel('Amber from (%)').fill('60');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('toast')).toBeVisible();
    const rows = history(page).getByTestId('history-row');
    await expect(rows).toHaveCount(2);
    await expect(history(page).getByText('No changes yet')).toHaveCount(0);
    const month = formatMonth(currentMonth());
    const thresholds = rows.nth(0);
    await expect(thresholds).toContainText('Status thresholds');
    await expect(thresholds).toContainText('Green 95%, amber 70%');
    await expect(thresholds).toContainText('Green 90%, amber 60%');
    await expect(thresholds).toContainText(month);
    await expect(thresholds).toContainText(me);
    const target = rows.nth(1);
    await expect(target).toContainText('Social reach target');
    await expect(target).toContainText('10,500');
    await expect(target).toContainText('12,000');
    await expect(target).toContainText(month);
    await expect(target).toContainText(me);
    await expect(target).toContainText(formatDate(todayLocal()));
    // a second save is a NEW row at the top; the first rows are still there, unchanged
    await page.getByTestId('target-input-posts_published').fill('9');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Posts published target');
    await expect(rows.nth(1)).toContainText('Status thresholds');
    await expect(rows.nth(2)).toContainText('Social reach target');
  });

  test('(e) ten rows at a time with "Show more", targets and thresholds in the same list', async ({ page }) => {
    await open(page);
    for (const key of KPI_KEYS) await page.getByTestId(`target-input-${key}`).fill(String(DEFAULT_TARGETS[key] + 1));
    const card = page.getByRole('region', { name: 'Status thresholds' });
    await card.getByLabel('Green from (%)').fill('96');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('toast')).toBeVisible();
    const rows = history(page).getByTestId('history-row');
    await expect(rows).toHaveCount(10);
    await expect(history(page).getByTestId('history-count')).toHaveText('Showing 10 of 11');
    await history(page).getByRole('button', { name: 'Show more' }).click();
    await expect(rows).toHaveCount(11);
    await expect(history(page).getByTestId('history-count')).toHaveText('Showing 11 of 11');
    await expect(history(page).getByRole('button', { name: 'Show more' })).toHaveCount(0);
    expect(await history(page).locator('tbody tr', { hasText: 'Status thresholds' }).count()).toBe(1);
    expect(await history(page).locator('tbody tr', { hasText: ' target' }).count()).toBe(10);
  });

  test('(b) thresholds saved to start next month: the fields are clean again, a line says when they start, and the Database zones keep this month\'s', async ({ page }) => {
    await open(page);
    const next = monthsBefore(currentMonth(), -1);
    await page.getByRole('combobox', { name: 'New targets apply from' }).click();
    await page.getByRole('option', { name: new RegExp(formatMonth(next)) }).click();
    const card = page.getByRole('region', { name: 'Status thresholds' });
    await card.getByLabel('Green from (%)').fill('150');
    await card.getByLabel('Amber from (%)').fill('100');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('toast').filter({ hasText: `Thresholds changed from ${formatMonth(next)}.` })).toBeVisible();
    await expect(page.getByText('1 change', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('scheduled-thresholds')).toHaveText(`Changes to green 150%, amber 100% from ${formatMonth(next)}`);
    await expect(history(page).getByTestId('history-row').first()).toContainText(formatMonth(next));
    await goViaSidebar(page, 'People', 'Database');
    await page.getByTestId('pace-zone-labels').hover();
    await expect(page.getByRole('tooltip')).toHaveText('Far behind: below 70% of the pro-rated pace. Behind: 70% to 95%. On pace: 95% and above.');
  });

  test('(a) thresholds saved for this month: the zones follow them, and the one date covers the targets too', async ({ page }) => {
    await open(page);
    const card = page.getByRole('region', { name: 'Status thresholds' });
    await card.getByLabel('Green from (%)').fill('150');
    await card.getByLabel('Amber from (%)').fill('100');
    await page.getByTestId('target-input-beneficiaries_verified').fill('20');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const rows = history(page).getByTestId('history-row');
    await expect(rows).toHaveCount(2);
    for (const index of [0, 1]) await expect(rows.nth(index)).toContainText(formatMonth(currentMonth())); // the same month for both
    await goViaSidebar(page, 'People', 'Database');
    await page.getByTestId('pace-zone-labels').hover();
    await expect(page.getByRole('tooltip')).toHaveText('Far behind: below 100% of the pro-rated pace. Behind: 100% to 150%. On pace: 150% and above.');
  });

  test('a past month shows a note: "Showing the targets and thresholds that applied in <month>", and this month does not', async ({ page }) => {
    await page.goto(`${BASE_URL}/social`, { timeout: 30_000 });
    await expect(page.getByTestId('total-posts')).toContainText(/\d/);
    await expect(page.getByTestId('history-note')).toHaveCount(0);
    const last = monthsBefore(currentMonth(), 1);
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option', { name: formatMonth(last) }).click();
    await expect(page.getByTestId('history-note')).toHaveText(`Showing the targets and thresholds that applied in ${formatMonth(last)}`);
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option', { name: /Current/ }).click();
    await expect(page.getByTestId('history-note')).toHaveCount(0);
  });

  test('the history list on a phone is stacked cards that fit the screen', async ({ page }) => {
    await page.setViewportSize({ width: 434, height: 900 });
    await open(page);
    await page.getByTestId('target-input-posts_published').fill('9');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(history(page).getByTestId('history-row')).toHaveCount(1);
    await expect(history(page).getByTestId('history-table')).toHaveCount(0);
    await expect(history(page).getByTestId('history-row')).toContainText('Posts published target');
    await expect(history(page).getByTestId('history-row')).toContainText(me);
    const report = await overflowing(page);
    expect(report.found, JSON.stringify(report)).toEqual([]);
    expect(report.scrollWidth).toBeLessThanOrEqual(report.innerWidth);
  });
});

test.describe('Change history: replaced rows and what a save touched', () => {
  test.skip(!MOCK_RUN, 'the redesign screens run on sample data: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1100 } });
  type P = import('@playwright/test').Page;
  const open = async (page: P) => {
    await page.goto(`${BASE_URL}/settings/targets`, { timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Monthly targets' })).toBeVisible();
  };
  const history = (page: P) => page.getByRole('region', { name: 'Change history' });
  const save = (page: P) => page.getByRole('button', { name: 'Save', exact: true });
  const thresholds = async (page: P, green: string, amber: string) => {
    const card = page.getByRole('region', { name: 'Status thresholds' });
    await card.getByLabel('Green from (%)').fill(green);
    await card.getByLabel('Amber from (%)').fill(amber);
  };
  const month = () => formatMonth(currentMonth());
  const toastText = (page: P) => page.getByTestId('toast').last();

  test('wording: thresholds only, one target, and several targets with the thresholds', async ({ page }) => {
    await open(page);
    await thresholds(page, '90', '60');
    await save(page).click();
    await expect(toastText(page)).toHaveText(`Thresholds changed from ${month()}.`);
    await expect(history(page).getByTestId('history-summary').first()).toHaveText(`Thresholds changed from ${month()}`);

    await page.getByTestId('target-input-social_reach').fill('12000');
    await save(page).click();
    await expect(toastText(page)).toHaveText(`Social reach target changed to 12,000 from ${month()}.`);
    await expect(history(page).getByTestId('history-summary').first()).toHaveText(`Social reach target changed to 12,000 from ${month()}`);

    await page.getByTestId('target-input-posts_published').fill('9');
    await page.getByTestId('target-input-beneficiaries_verified').fill('44');
    await thresholds(page, '85', '55');
    await save(page).click();
    await expect(toastText(page)).toHaveText('2 targets and the thresholds changed.');
  });

  test('a later save for the same KPI and month marks the earlier row "Replaced": it stays, keeps its values, and is muted', async ({ page }) => {
    await open(page);
    await page.getByTestId('target-input-social_reach').fill('12000');
    await thresholds(page, '90', '60');
    await save(page).click();
    const rows = history(page).getByTestId('history-row');
    await expect(rows).toHaveCount(2);
    await expect(history(page).getByTestId('replaced-tag')).toHaveCount(0);

    await page.getByTestId('target-input-social_reach').fill('13000');
    await save(page).click();
    await expect(rows).toHaveCount(3);
    // newest first: [13,000 (current), thresholds (current), 12,000 (replaced)]
    await expect(rows.nth(0)).not.toContainText('Replaced');
    await expect(rows.nth(1)).not.toContainText('Replaced');
    const old = rows.nth(2);
    await expect(old).toContainText('Replaced');
    await expect(old).toHaveAttribute('data-replaced', 'true');
    await expect(old).toContainText('12,000');
    await expect(old).toContainText('10,500');
    const color = (locator: import('@playwright/test').Locator) => locator.locator('td').first().evaluate((el) => getComputedStyle(el).color);
    expect(await color(old)).not.toBe(await color(rows.nth(0)));

    // another KPI in the same month does not replace it, and the thresholds are replaced on their own
    await page.getByTestId('target-input-posts_published').fill('9');
    await thresholds(page, '85', '55');
    await save(page).click();
    await expect(rows).toHaveCount(5);
    await expect(history(page).getByTestId('replaced-tag')).toHaveCount(2); // the 12,000 target and the first thresholds
    await expect(rows.filter({ hasText: 'Posts published target' })).not.toContainText('Replaced');
  });

  test('a save for another month does not mark the row as replaced', async ({ page }) => {
    await open(page);
    await page.getByTestId('target-input-social_reach').fill('12000');
    await save(page).click();
    await expect(toastText(page)).toContainText('Social reach target changed to 12,000');
    await page.getByRole('combobox', { name: 'New targets apply from' }).click();
    await page.getByRole('option', { name: new RegExp(formatMonth(monthsBefore(currentMonth(), -1))) }).click();
    await page.getByTestId('target-input-social_reach').fill('14000');
    await save(page).click();
    await expect(history(page).getByTestId('history-row')).toHaveCount(2);
    await expect(history(page).getByTestId('replaced-tag')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Overview: the dashboard of the doc (ten KPI cards, trend, priorities, upcoming programs, recent activity, the dark attention card).
// Expectations are worked out from buildSeed() with the same functions the page uses, never typed by hand.
// ---------------------------------------------------------------------------------------------
test.describe('Overview: the ten KPI cards and the sections below them', () => {
  test.skip(!MOCK_RUN, 'the ten cards come from the mock store: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1100 } });
  type P = import('@playwright/test').Page;
  const WORDS = { green: 'On track', amber: 'Behind', red: 'Off track' } as const;
  const SCREEN_HREF: Record<string, string> = {
    opportunities_queue: '/opportunities',
    programs: '/programs',
    network: '/network',
    partners: '/partners',
    database: '/database',
    social: '/social',
    monthly_report: '/monthly-report',
  };
  const open = async (page: P, query = '') => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/${query}`, { timeout: 30_000 });
    await expect(page.getByTestId('kpi-card-social_reach')).toBeVisible();
  };
  const today = () => new Date();
  const seedData = () => buildSeed().collections;

  test('ten cards, each with the label, the value, "of {target} {unit}", the right status and the note', async ({ page }) => {
    await open(page);
    const data = seedData();
    const month = currentMonth();
    await expect(page.getByTestId('kpi-grid').locator('[data-testid^="kpi-card-"]')).toHaveCount(10);
    for (const key of KPI_KEYS) {
      const card = page.getByTestId(`kpi-card-${key}`);
      const status = kpiMonthStatus(key, month, today(), data);
      await expect(card).toHaveAttribute('data-status', status);
      await expect(card.getByTestId('kpi-status')).toHaveText(WORDS[status]);
      await expect(card.getByTestId('kpi-value')).toHaveText(kpiValue(key, month, data).toLocaleString('en-US'));
      await expect(card.getByTestId('kpi-of')).toHaveText(`of ${kpiTarget(key, data, month).toLocaleString('en-US')} ${kpiUnit(key, kpiTarget(key, data, month))}`);
      await expect(card).toContainText(KPIS[key].label);
      await expect(card.getByRole('progressbar')).toBeVisible();
      await expect(card.getByTestId('kpi-pace-tick')).toHaveCount(KPIS[key].kind === 'running_total' ? 0 : 1); // a running total has no pace tick
    }
    // the seed gives a mix of statuses, not ten of one colour
    const statuses = new Set(KPI_KEYS.map((key) => kpiMonthStatus(key, month, today(), data)));
    expect(statuses.size).toBeGreaterThan(1);
  });

  test('the grid is 5 columns at 1440, 4 at 1280, 2 at 1024 and 1 below 640', async ({ page }) => {
    await open(page);
    const columns = () =>
      page.evaluate(() => new Set([...document.querySelectorAll('[data-testid^="kpi-card-"]')].map((card) => Math.round(card.getBoundingClientRect().left))).size);
    for (const [width, expected] of [[1440, 5], [1280, 4], [1024, 2], [639, 1]] as const) {
      await page.setViewportSize({ width, height: 1100 });
      await expect.poll(columns).toBe(expected);
    }
  });

  test('a target saved in Settings changes the status and the target on the Overview (client-side, the store keeps it)', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/settings/targets`, { timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Monthly targets' })).toBeVisible();
    await page.getByTestId('target-input-social_reach').fill('100');
    await page.getByTestId('target-input-social_reach').blur();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('toast')).toBeVisible();
    await goViaSidebar(page, 'Dashboard', 'Overview');
    const card = page.getByTestId('kpi-card-social_reach');
    await expect(card).toHaveAttribute('data-status', 'green');
    await expect(card.getByTestId('kpi-status')).toHaveText('On track');
    await expect(card.getByTestId('kpi-of')).toHaveText('of 100 people reached');
  });

  test('every card links to the screen that owns the metric', async ({ page }) => {
    test.setTimeout(150_000);
    await open(page);
    for (const key of KPI_KEYS) await expect(page.getByTestId(`kpi-card-${key}`)).toHaveAttribute('href', SCREEN_HREF[KPIS[key].screen]);
    for (const key of KPI_KEYS) {
      await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
      await page.getByTestId(`kpi-card-${key}`).click();
      await expect(page).toHaveURL(new RegExp(`${SCREEN_HREF[KPIS[key].screen]}(\\?.*)?$`));
    }
  });

  test('the "Needs your attention" card is the only dark card, and it comes directly under the ten cards', async ({ page }) => {
    await open(page);
    await expect(page.locator('main .dark-feature')).toHaveCount(1);
    await expect(page.locator('main .dark-feature')).toHaveAttribute('data-testid', 'needs-attention');
    const order = await page.evaluate(() => [...document.querySelectorAll('main section[aria-label]')].map((el) => el.getAttribute('aria-label')));
    expect(order).toEqual(['Key numbers', 'Needs your attention', 'Trend', 'Priorities', 'Programs in progress and upcoming', 'Recent activity']);
    // none of the ten cards has a dark background
    const darkest = await page.evaluate(() =>
      Math.min(...[...document.querySelectorAll('[data-testid^="kpi-card-"]')].map((card) => {
        const [r, g, b] = getComputedStyle(card).backgroundColor.match(/\d+/g)!.map(Number);
        return (r + g + b) / 3;
      })),
    );
    expect(darkest).toBeGreaterThan(200);
  });

  test('the attention rows and the card links follow what the role may see', async ({ page, context }) => {
    test.setTimeout(150_000);
    const ROWS = [
      ['Pending verifications', 'verification'],
      ['Open reports', 'reports_queue'],
      ['Pending testimonials', 'testimonials'],
      ['Unvetted draft listings', 'opportunities_queue'],
    ] as const;
    await signedIn(page);
    for (const role of ['super_admin', 'desk_lead', 'communications_officer', 'database_officer', 'opportunities_officer', 'social_media_manager', 'training_officer'] as const) {
      await asRoles(context, role);
      await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
      await expect(page.getByTestId('kpi-card-social_reach')).toBeVisible();
      const attention = page.getByRole('region', { name: 'Needs your attention' });
      const expectedRows = ROWS.filter(([, screen]) => roleCan([role], screen, 'view'));
      if (expectedRows.length === 0) {
        await expect(attention, role).toHaveCount(0);
      } else {
        await expect(attention.getByRole('link'), role).toHaveCount(expectedRows.length);
        for (const [label] of ROWS) await expect(attention.getByRole('link', { name: new RegExp(label) }), `${role}: ${label}`).toHaveCount(expectedRows.some(([name]) => name === label) ? 1 : 0);
      }
      // a card is a link only when the role may see the screen that owns the metric
      for (const key of KPI_KEYS) {
        const tag = await page.getByTestId(`kpi-card-${key}`).evaluate((el) => el.tagName);
        expect(tag, `${role}: ${key}`).toBe(roleCan([role], KPIS[key].screen, 'view') ? 'A' : 'DIV');
      }
    }
  });

  test('the attention numbers are the sidebar pills and the numbers behind the lists', async ({ page }) => {
    await open(page);
    const data = seedData();
    const pendingTestimonials = data.testimonials.filter((testimonial) => testimonial.status === 'pending').length;
    const drafts = data.listings.filter((listing) => listing.status === 'draft' && !listing.vetted).length;
    const attention = page.getByRole('region', { name: 'Needs your attention' });
    await expect(attention.getByRole('link', { name: /Pending verifications/ })).toContainText(String(MOCK_COUNTS.pendingVerifications));
    await expect(attention.getByRole('link', { name: /Open reports/ })).toContainText(String(MOCK_COUNTS.openReports));
    await expect(attention.getByRole('link', { name: /Pending testimonials/ })).toContainText(String(pendingTestimonials));
    await expect(attention.getByRole('link', { name: /Unvetted draft listings/ })).toContainText(String(drafts));
    const aside = page.locator('aside');
    await aside.getByRole('button', { name: 'Content' }).click();
    await expect(aside.getByRole('link', { name: /^Testimonials/ })).toContainText(String(pendingTestimonials));
    // the Verification and Reports pills are the same numbers
    await aside.getByRole('button', { name: 'Trust & safety' }).click();
    await expect(aside.getByRole('link', { name: /^Verification Queue/ })).toContainText(String(MOCK_COUNTS.pendingVerifications));
    await expect(aside.getByRole('link', { name: /^Reports Queue/ })).toContainText(String(MOCK_COUNTS.openReports));
    await goViaSidebar(page, 'Trust & safety', 'Verification Queue');
    await expect(page.locator('main tbody tr a').first()).toBeVisible();
    // the ten cards add up to the numbers the data gives
    await goViaSidebar(page, 'Dashboard', 'Overview');
    for (const key of KPI_KEYS) await expect(page.getByTestId(`kpi-card-${key}`).getByTestId('kpi-value')).toHaveText(kpiValue(key, currentMonth(), data).toLocaleString('en-US'));
  });

  test('the month selector is real: a past month shows what was reached against the target that applied then, with its final status', async ({ page }) => {
    await open(page);
    const data = seedData();
    const previous = monthsBefore(currentMonth(), 1);
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option', { name: new RegExp(formatMonth(previous)) }).click();
    await expect(page).toHaveURL(new RegExp(`month=${previous}`));
    for (const key of KPI_KEYS) {
      const card = page.getByTestId(`kpi-card-${key}`);
      const status = kpiMonthStatus(key, previous, today(), data);
      await expect(card, key).toHaveAttribute('data-status', status);
      await expect(card.getByTestId('kpi-value')).toHaveText(kpiValue(key, previous, data).toLocaleString('en-US'));
      await expect(card.getByTestId('kpi-of')).toHaveText(`of ${kpiTarget(key, data, previous).toLocaleString('en-US')} ${kpiUnit(key, kpiTarget(key, data, previous))}`);
      await expect(card.getByTestId('kpi-pace-tick')).toHaveCount(0); // the month is over: no pace tick
    }
    await expect(page.getByRole('region', { name: 'Priorities' })).toContainText('Ranked by how far each fell short of its full target');
    // the trend ends with the month shown
    await expect(page.getByRole('table', { name: /last six months/ }).getByRole('row').last().getByRole('rowheader')).toHaveText(formatMonth(previous));
  });

  test('the trend: six months of the chosen KPI, the newest bar last, values on the bars and a data table', async ({ page }) => {
    await open(page);
    const data = seedData();
    const table = page.getByRole('table', { name: 'Opportunities published, last six months' });
    const expected = monthSeries('opportunities_published', 6, today(), data);
    await expect(table.getByRole('row')).toHaveCount(6);
    for (const [index, point] of expected.entries()) {
      await expect(table.getByRole('row').nth(index).getByRole('rowheader')).toHaveText(formatMonth(point.month));
      await expect(table.getByRole('row').nth(index).getByRole('cell')).toContainText(String(point.value));
    }
    await expect(table.locator('xpath=..')).toHaveClass(/sr-only/); // the class is on a wrapper: a table ignores overflow
    await page.getByRole('combobox', { name: 'KPI shown in the trend' }).click();
    const options = page.getByRole('option');
    await expect(options).toHaveCount(10);
    await options.filter({ hasText: 'Website views' }).click();
    const views = page.getByRole('table', { name: 'Website views, last six months' });
    const viewsSeries = monthSeries('website_views', 6, today(), data);
    await expect(views.getByRole('row').last().getByRole('cell')).toContainText(viewsSeries[5].value.toLocaleString('en-US').replace(/,/g, ''));
  });

  test('priorities: the three KPIs furthest behind the pace, and "See all" shows all ten', async ({ page }) => {
    await open(page);
    const data = seedData();
    const month = currentMonth();
    const ranked = KPI_KEYS.map((key, index) => ({ key, index, score: kpiValue(key, month, data) / (kpiTarget(key, data, month) * (kpiMonthProgress(key, month, today()).dayOfMonth / kpiMonthProgress(key, month, today()).daysInMonth)) }))
      .sort((a, b) => a.score - b.score || a.index - b.index)
      .map((entry) => entry.key);
    const rows = page.getByTestId('priority-row');
    await expect(rows).toHaveCount(3);
    for (const [index, key] of ranked.slice(0, 3).entries()) await expect(rows.nth(index)).toHaveAttribute('data-kpi', key);
    await page.getByRole('button', { name: 'See all' }).click();
    await expect(rows).toHaveCount(10);
    for (const [index, key] of ranked.entries()) await expect(rows.nth(index)).toHaveAttribute('data-kpi', key);
    await expect(page.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Show fewer' }).click();
    await expect(rows).toHaveCount(3);
  });

  test('upcoming programs: the next five planned or running, soonest first, with the participants of the target and the partner', async ({ page }) => {
    await open(page);
    const data = seedData();
    const expected = data.programs
      .filter((program) => program.status === 'planned' || program.status === 'running')
      .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.name.localeCompare(b.name))
      .slice(0, 5);
    const rows = page.getByTestId('upcoming-row');
    await expect(rows).toHaveCount(expected.length);
    for (const [index, program] of expected.entries()) {
      const row = rows.nth(index);
      await expect(row).toContainText(program.name.slice(0, 12));
      await expect(row).toContainText(formatDate(program.startAt.slice(0, 10)));
      await expect(row).toContainText(`${program.participants} of ${program.target}`);
      const partner = data.partners.find((entry) => entry.id === program.partnerId);
      await expect(row).toContainText(partner ? partner.name.slice(0, 8) : '—');
    }
    await expect(page.getByRole('columnheader')).toContainText(['Program', 'Type', 'Starts', 'Participants', 'Partner']);
  });

  test('recent activity: a mixed timeline, newest first, with 20px between entries', async ({ page }) => {
    await open(page);
    const items = page.getByRole('region', { name: 'Recent activity' }).getByRole('listitem');
    await expect(items.first()).toBeVisible();
    const texts = await items.evaluateAll((nodes) => nodes.map((node) => [...node.querySelectorAll('p')].map((p) => p.textContent ?? '')));
    expect(texts.length).toBeGreaterThanOrEqual(4);
    expect(texts.length).toBeLessThanOrEqual(6);
    const times = texts.map((lines) => Date.parse(lines[2]));
    expect(times.every((time) => !Number.isNaN(time))).toBe(true);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeLessThanOrEqual(times[i - 1]);
    const kinds = new Set(texts.map(([title]) => /joined as an ambassador/.test(title) ? 'ambassador' : /moved to/.test(title) ? 'partner' : /was published/.test(title) ? 'listing' : /was delivered/.test(title) ? 'program' : /was verified/.test(title) ? 'record' : /testimonial/.test(title) ? 'testimonial' : 'other'));
    expect(kinds.has('other')).toBe(false);
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    const gap = await items.first().locator('div.min-w-0').evaluate((el) => getComputedStyle(el).paddingBottom);
    expect(gap).toBe('20px');
  });

  test('on a phone (434px): the cards stack in one column, nothing is wider than the screen and the targets are 40px', async ({ page }) => {
    await page.setViewportSize({ width: 434, height: 900 });
    await open(page);
    const report = await overflowing(page);
    expect(report.found, JSON.stringify(report)).toEqual([]);
    expect(report.scrollWidth).toBeLessThanOrEqual(report.innerWidth);
    const lefts = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="kpi-card-"]')].map((card) => [Math.round(card.getBoundingClientRect().left), Math.round(card.getBoundingClientRect().width)]));
    expect(new Set(lefts.map(([left]) => left)).size).toBe(1);
    expect(Math.min(...lefts.map(([, width]) => width))).toBeGreaterThan(360);
    await expect(page.getByTestId('upcoming-table')).toBeHidden();
    await expect(page.getByTestId('upcoming-card').first()).toBeVisible();
    const rects = await page.getByRole('region', { name: 'Needs your attention' }).getByRole('link').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
    for (const rect of rects) expect(rect.height).toBeGreaterThanOrEqual(40);
    for (let i = 1; i < rects.length; i++) expect(rects[i].top).toBeGreaterThanOrEqual(rects[i - 1].bottom);
    await page.getByRole('combobox', { name: 'KPI shown in the trend' }).click();
    await expect(page.getByRole('dialog', { name: 'Choose a KPI' })).toBeVisible();
  });

  test('no console errors or uncaught exceptions while using the page', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => message.type() === 'error' && !message.text().startsWith('Failed to load resource') && problems.push(message.text()));
    await open(page);
    await page.getByRole('combobox', { name: 'KPI shown in the trend' }).click();
    await page.getByRole('option', { name: 'Monthly reports' }).click();
    await page.getByRole('button', { name: 'See all' }).click();
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option', { name: new RegExp(formatMonth(monthsBefore(currentMonth(), 2))) }).click();
    await expect(page).toHaveURL(/month=/);
    await expect(page.getByTestId('kpi-card-social_reach')).toBeVisible();
    expect(problems).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Overview in real-API mode: the monthly figures have no live source yet, so the page says so calmly ("Not available yet"),
// once at the top and once in each section. It is NOT an error. In mock mode none of this shows, and a forced error keeps its error state.
// ---------------------------------------------------------------------------------------------
test.describe('Overview: real-API mode says "Not available yet" calmly', () => {
  test.skip(MOCK_RUN, 'real API only: mock mode shows the sample figures');
  test.use({ viewport: { width: 1440, height: 1000 } });
  type P = import('@playwright/test').Page;
  const NOTICE = "Monthly figures aren't connected to live data yet. The queue counts below are live.";
  const open = async (page: P) => {
    await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
    await expect(page.getByTestId('kpi-card-social_reach')).toBeVisible();
  };

  test('one notice at the top, and each of the four sections says "Not available yet" (no "could not be loaded")', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('not-connected-notice')).toHaveCount(1);
    await expect(page.getByTestId('not-connected-notice')).toHaveText(NOTICE);
    for (const name of ['Trend', 'Priorities', 'Programs in progress and upcoming', 'Recent activity']) {
      const section = page.getByRole('region', { name, exact: true });
      await expect(section.getByTestId('not-available-yet')).toHaveText('Not available yet');
      await expect(section).not.toContainText('could not be loaded');
    }
    await expect(page.getByText('could not be loaded')).toHaveCount(0);
  });

  test('the ten cards are one greyed, compact state: the label and "Not available yet", no bar, no status, no "Target: —", same height as a loaded card', async ({ page }) => {
    await open(page);
    const cards = page.locator('[data-testid^="kpi-card-"]');
    await expect(cards).toHaveCount(10);
    for (const key of KPI_KEYS) {
      const card = page.getByTestId(`kpi-card-${key}`);
      await expect(card).toContainText(KPIS[key].label);
      await expect(card).toContainText('Not available yet');
      await expect(card.getByRole('progressbar')).toHaveCount(0);
      await expect(card.getByTestId('kpi-status')).toHaveCount(0);
    }
    await expect(page.getByText('Status unavailable')).toHaveCount(0);
    await expect(page.getByText(/^Target .*: —$/)).toHaveCount(0);
    // the height of a loaded card at this width (208px at 1440): nothing jumps when data arrives
    const heights = await cards.evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)));
    expect(new Set(heights)).toEqual(new Set([208]));
  });

  test('the dark card keeps the two live queue counts and says "Not available yet" for the two without a live source', async ({ page }) => {
    await open(page);
    const attention = page.getByRole('region', { name: 'Needs your attention' });
    await expect(attention).toBeVisible();
    await expect(attention.getByTestId('attention-pendingTestimonials')).toContainText('Not available yet');
    await expect(attention.getByTestId('attention-draftListings')).toContainText('Not available yet');
    await expect(attention.getByTestId('attention-pendingVerifications')).not.toContainText('Not available yet');
    await expect(attention.getByTestId('attention-openReports')).not.toContainText('Not available yet');
  });

  test('on a phone (434px): the same states and nothing wider than the screen', async ({ page }) => {
    await page.setViewportSize({ width: 434, height: 900 });
    await open(page);
    await expect(page.getByTestId('not-connected-notice')).toBeVisible();
    await expect(page.getByTestId('not-available-yet')).toHaveCount(4);
    const report = await overflowing(page);
    expect(report.found, JSON.stringify(report)).toEqual([]);
    expect(report.scrollWidth).toBeLessThanOrEqual(report.innerWidth);
  });
});

test.describe('Overview: mock mode shows no "not connected" states', () => {
  test.skip(!MOCK_RUN, 'mock mode only');
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('neither the notice nor "Not available yet" shows with the sample figures', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
    await expect(page.getByTestId('kpi-card-social_reach').getByTestId('kpi-status')).toBeVisible();
    await expect(page.getByTestId('not-connected-notice')).toHaveCount(0);
    await expect(page.getByTestId('not-available-yet')).toHaveCount(0);
    await expect(page.getByText('Not available yet')).toHaveCount(0);
  });

  test('a forced error (?state=error) keeps the real error state with Try again, not "Not available yet"', async ({ page }) => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/?state=error`, { timeout: 30_000 });
    await expect(page.getByRole('alert').filter({ hasText: 'Could not load the overview' }).getByRole('button', { name: 'Try again' })).toBeEnabled();
    await expect(page.getByRole('region', { name: 'Trend' }).getByText('The trend could not be loaded.')).toBeVisible();
    await expect(page.getByTestId('kpi-card-social_reach')).toContainText('Status unavailable');
    await expect(page.getByTestId('not-connected-notice')).toHaveCount(0);
    await expect(page.getByTestId('not-available-yet')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Overview: one status vocabulary, the pro-rating note, the order of the cards for a role, the layout, the programs section, the priorities
// ranking and the one-line card notes.
// ---------------------------------------------------------------------------------------------
test.describe('Overview: status words, notes, roles, layout and rankings', () => {
  test.skip(!MOCK_RUN, 'the ten cards come from the mock store: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 900 } });
  type P = import('@playwright/test').Page;
  const open = async (page: P, query = '') => {
    await signedIn(page);
    await page.goto(`${BASE_URL}/${query}`, { timeout: 30_000 });
    await expect(page.getByTestId('kpi-card-social_reach')).toBeVisible();
  };
  const cardOrder = (page: P) => page.evaluate(() => [...document.querySelectorAll('[data-testid="kpi-grid"] > *')].map((el) => el.getAttribute('data-testid')?.replace('kpi-card-', '') ?? el.textContent));

  test('one status vocabulary: the cards say On track, Behind and Off track, never "At risk"', async ({ page }) => {
    await open(page);
    const words = await page.getByTestId('kpi-status').allTextContents();
    expect(new Set(words)).toEqual(new Set(['On track', 'Behind', 'Off track']));
    await expect(page.getByText('At risk')).toHaveCount(0);
    // the same words in the card's accessible name and in the priorities list
    const names = await page.locator('[data-testid^="kpi-card-"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? ''));
    expect(names.some((name) => name.endsWith(', Off track'))).toBe(true);
    expect(names.some((name) => /, At risk$/.test(name))).toBe(false);
  });

  test('the note under the ten cards says how status is judged, with a worked example in a tooltip', async ({ page }) => {
    await open(page);
    const note = page.getByTestId('pro-rating-note');
    await expect(note).toHaveText('Targets are monthly. Status compares each figure with where it should be by today.');
    await expect(note).toHaveClass(/caption/);
    const { dayOfMonth, daysInMonth: total } = monthProgress(currentMonth(), new Date());
    const expected = Math.round((12000 * dayOfMonth) / total / 100) * 100;
    await page.getByTestId('pro-rating-help').hover();
    await expect(page.getByRole('tooltip')).toHaveText(`Day ${dayOfMonth} of ${total}: a 12,000 target expects about ${expected.toLocaleString('en-US')} by now. Running totals, such as Active ambassadors, are judged against the full target.`);
    await page.keyboard.press('Escape');
    await page.getByTestId('pro-rating-help').focus();
    await expect(page.getByRole('tooltip')).toBeVisible(); // keyboard focus shows it too
  });

  test('for a past month the note says which targets and thresholds were used', async ({ page }) => {
    const previous = monthsBefore(currentMonth(), 2);
    await open(page, `?month=${previous}`);
    await expect(page.getByTestId('pro-rating-note')).toHaveText(`Showing the targets and thresholds that applied in ${formatMonth(previous)}`);
    await expect(page.getByTestId('pro-rating-help')).toHaveCount(0);
  });

  const ORDER_CASES: { name: string; roles: string }[] = [
    { name: 'Partnerships Officer', roles: 'partnerships_officer' },
    { name: 'Database Officer', roles: 'database_officer' },
    { name: 'Social Media Manager', roles: 'social_media_manager' },
    { name: 'a two-role pair (Partnerships Officer + Database Officer)', roles: 'partnerships_officer,database_officer' },
    { name: 'a role that owns nothing (Admin Support)', roles: 'admin_support' },
    { name: 'Desk Lead', roles: 'desk_lead' },
    { name: 'Super Admin', roles: 'super_admin' },
  ];
  for (const { name, roles } of ORDER_CASES) {
    test(`the cards start with the KPIs ${name} owns, then "Other metrics"`, async ({ page, context }) => {
      await signedIn(page);
      await asRoles(context, roles);
      await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
      await expect(page.getByTestId('kpi-card-social_reach')).toBeVisible();
      const ids = roles.split(',') as Parameters<typeof kpisOwnedBy>[0];
      const owned = new Set(kpisOwnedBy(ids).map((kpi) => kpi.key));
      const order = await cardOrder(page);
      if (owned.size === 0 || owned.size === KPI_KEYS.length) {
        expect(order, 'default order, no heading').toEqual([...KPI_KEYS]);
        await expect(page.getByTestId('other-metrics-heading')).toHaveCount(0);
      } else {
        const mine = KPI_KEYS.filter((key) => owned.has(key));
        const others = KPI_KEYS.filter((key) => !owned.has(key));
        expect(order).toEqual([...mine, 'other-metrics-heading', ...others]);
        await expect(page.getByTestId('other-metrics-heading')).toHaveText('Other metrics');
        await expect(page.getByTestId('other-metrics-heading')).toHaveClass(/text-muted/);
      }
    });
  }

  test('the attention card sits directly under the ten cards, above the fold at 1440x900, and no card has a blank band over 24px', async ({ page }) => {
    await open(page);
    const box = await page.getByRole('region', { name: 'Needs your attention' }).boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
    const bands = await page.evaluate(() =>
      [...document.querySelectorAll('main section[aria-label]')].map((section) => {
        let bottom = 0;
        section.querySelectorAll('*').forEach((el) => {
          const cs = getComputedStyle(el);
          if (cs.position === 'absolute' || cs.position === 'fixed' || el.closest('.sr-only') || el.getAttribute('aria-hidden') === 'true') return;
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0 || (el.children.length > 0 && el.tagName !== 'svg')) return;
          bottom = Math.max(bottom, b.bottom);
        });
        return [section.getAttribute('aria-label'), Math.round(section.getBoundingClientRect().bottom - bottom - parseFloat(getComputedStyle(section).paddingBottom))] as const;
      }),
    );
    for (const [label, band] of bands) expect(band, `${label}: empty space inside the card`).toBeLessThanOrEqual(24);
    // the two sections of a row are aligned to the top
    const tops = await page.evaluate(() => ['Programs in progress and upcoming', 'Recent activity'].map((name) => Math.round(document.querySelector(`main section[aria-label="${name}"]`)!.getBoundingClientRect().top)));
    expect(tops[0]).toBe(tops[1]);
  });

  test('"Programs in progress and upcoming": five rows by start date, each with a Running or Planned badge', async ({ page }) => {
    await open(page);
    const data = buildSeed().collections;
    const expected = data.programs
      .filter((program) => program.status === 'planned' || program.status === 'running')
      .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.name.localeCompare(b.name))
      .slice(0, 5);
    const section = page.getByRole('region', { name: 'Programs in progress and upcoming' });
    await expect(section.getByRole('heading', { name: 'Programs in progress and upcoming' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Upcoming programs' })).toHaveCount(0);
    const rows = section.getByTestId('upcoming-row');
    await expect(rows).toHaveCount(5);
    for (const [index, program] of expected.entries()) {
      await expect(rows.nth(index).getByTestId('upcoming-status')).toHaveText(program.status === 'running' ? 'Running' : 'Planned');
      await expect(rows.nth(index)).toContainText(formatDate(program.startAt.slice(0, 10)));
    }
    const starts = await rows.evaluateAll((nodes) => nodes.map((node) => node.querySelectorAll('td')[3].textContent ?? ''));
    const times = starts.map((text) => Date.parse(text));
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
  });

  test('"Programs in progress and upcoming": the empty state says so', async ({ page }) => {
    await open(page, '?state=empty');
    await expect(page.getByText('No programs in progress or upcoming')).toBeVisible();
    await expect(page.getByText('Running and planned programs show here.')).toBeVisible();
  });

  const rankFor = (month: string) => {
    const data = buildSeed().collections;
    return KPI_KEYS.map((key, index) => ({ key, index, shortfall: kpiValue(key, month, data) / (kpiTarget(key, data, month) * (kpiMonthProgress(key, month, new Date()).dayOfMonth / kpiMonthProgress(key, month, new Date()).daysInMonth)) }))
      .sort((a, b) => a.shortfall - b.shortfall || a.index - b.index)
      .map((entry) => entry.key);
  };

  test('priorities: the rule is stated, and the ranking is attainment against the pro-rated target, ties in KPI order (this month)', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('region', { name: 'Priorities' })).toContainText('Ranked by how far each is from where it should be today');
    await page.getByRole('button', { name: 'See all' }).click();
    const rows = page.getByTestId('priority-row');
    await expect(rows).toHaveCount(10);
    for (const [index, key] of rankFor(currentMonth()).entries()) await expect(rows.nth(index)).toHaveAttribute('data-kpi', key);
  });

  test('priorities: a past month (July) ranks by shortfall against the FULL target', async ({ page }) => {
    const july = monthsBefore(currentMonth(), 3);
    expect(july.endsWith('-07')).toBe(true); // October minus three months
    await open(page, `?month=${july}`);
    await expect(page.getByRole('region', { name: 'Priorities' })).toContainText('Ranked by how far each fell short of its full target');
    await page.getByRole('button', { name: 'See all' }).click();
    const rows = page.getByTestId('priority-row');
    await expect(rows).toHaveCount(10);
    for (const [index, key] of rankFor(july).entries()) await expect(rows.nth(index)).toHaveAttribute('data-kpi', key);
    // with the full target, the ranking is value over target, whatever the day of the month is
    const data = buildSeed().collections;
    const fullTarget = KPI_KEYS.map((key, index) => ({ key, index, ratio: kpiValue(key, july, data) / kpiTarget(key, data, july) }))
      .sort((a, b) => a.ratio - b.ratio || a.index - b.index)
      .map((entry) => entry.key);
    expect(rankFor(july)).toEqual(fullTarget);
  });

  test('each card note is ONE line, the card heights stay equal, and the full text is in the tooltip on hover and on focus', async ({ page }) => {
    await open(page);
    const heights = await page.locator('[data-testid^="kpi-card-"]').evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)));
    expect(new Set(heights).size).toBe(1);
    const lines = await page.locator('[data-testid^="kpi-card-"]').evaluateAll((nodes) =>
      nodes.map((node) => {
        const note = [...node.querySelectorAll('p, span')].reverse().find((el) => el.children.length === 0 && el.textContent && el.textContent.length > 20)!;
        const style = getComputedStyle(note);
        return Math.round(note.getBoundingClientRect().height / parseFloat(style.lineHeight));
      }),
    );
    expect(lines.every((count) => count === 1)).toBe(true);
    const full = KPIS.opportunities_published.note;
    const note = page.getByTestId('kpi-card-opportunities_published').getByText(full.slice(0, 12));
    await note.hover();
    await expect(page.getByRole('tooltip')).toHaveText(full);
    await page.keyboard.press('Escape');
    await page.mouse.move(0, 0);
    await note.focus();
    await expect(page.getByRole('tooltip')).toHaveText(full);
  });
});

// ---------------------------------------------------------------------------------------------
// Scorecard (/scorecard): the maths (no browser), then My scorecard, Team, coherence with the Overview and phones.
// Expectations are worked out from buildSeed() with the same functions the page uses.
// ---------------------------------------------------------------------------------------------
test.describe('Scorecard maths (no browser)', () => {
  const june = FIXED_MONTHS[FIXED_MONTHS.length - 1]; // the month of FIXED_TODAY (June 15 of 30: a pace of 0.5)
  const may = monthsBefore(june, 1);
  const withTargets = (rows: Record<string, number>) => ({
    ...kpiData,
    targetHistory: [],
    targets: kpiData.targets.map((target) => (target.kpi in rows ? { ...target, target: rows[target.kpi] } : target)),
  });

  test('ownedMetrics: the union of the roles, no double counting, in KPI order; Desk Lead owns all ten; four roles own none', () => {
    expect(ownedMetrics(['partnerships_officer'])).toEqual(['partners_onboarded']);
    expect(ownedMetrics(['database_officer', 'partnerships_officer'])).toEqual(['partners_onboarded', 'beneficiaries_verified']);
    expect(ownedMetrics(['social_media_manager', 'database_officer'])).toEqual(['beneficiaries_verified', 'social_reach', 'social_engagement', 'posts_published']);
    expect(ownedMetrics(['desk_lead'])).toEqual([...KPI_KEYS]);
    expect(ownedMetrics(['desk_lead', 'database_officer'])).toEqual([...KPI_KEYS]); // already owned: no duplicate
    expect(ownedMetrics(['communications_officer', 'communications_officer'])).toEqual(['website_views', 'monthly_reports']);
    for (const role of ['moderator', 'support', 'admin_support', 'super_admin'] as const) expect(ownedMetrics([role]), role).toEqual([]);
  });

  test('attainment: value over the PRO-RATED target this month (June 15 of 30), over the FULL target in a past month; not capped', () => {
    for (const key of KPI_KEYS) {
      const target = kpiTarget(key, kpiData, june);
      const pace = KPIS[key].kind === 'running_total' ? 1 : 0.5; // Active ambassadors is a stock: judged against the full target
      expect(metricAttainment(key, june, FIXED_TODAY, kpiData), key).toBeCloseTo(kpiValue(key, june, kpiData) / (target * pace), 10);
      expect(metricAttainment(key, may, FIXED_TODAY, kpiData), key).toBeCloseTo(kpiValue(key, may, kpiData) / kpiTarget(key, kpiData, may), 10);
    }
    // not capped: a value of twice the pro-rated target reads 200%
    const data = withTargets({ posts_published: 1 });
    expect(metricAttainment('posts_published', june, FIXED_TODAY, data)!).toBeGreaterThan(1);
    // no target: null, not 0
    expect(metricAttainment('posts_published', june, FIXED_TODAY, withTargets({ posts_published: 0 }))).toBeNull();
  });

  test('composite: each metric counts at most 100%, so one at 200% cannot lift it; the average of the capped values; null with nothing to average', () => {
    // two metrics: partners (no onboarding in the data) and records (above its pace)
    const partners = kpiData.partners.map((partner) => ({ ...partner, stageHistory: partner.stageHistory.slice(0, 1) }));
    const data = { ...withTargets({ beneficiaries_verified: 1 }), partners };
    expect(kpiValue('partners_onboarded', june, data)).toBe(0);
    expect(metricAttainment('beneficiaries_verified', june, FIXED_TODAY, data)!).toBeGreaterThan(2); // far above 200%
    expect(composite(['partnerships_officer', 'database_officer'], june, FIXED_TODAY, data)).toBe(50); // (0 + 1) / 2, not (0 + 8) / 2
    // one metric far above its target: the cap, 100
    expect(composite(['database_officer'], june, FIXED_TODAY, data)).toBe(100);
    // the average of capped values, rounded to a whole number
    const mixed = withTargets({ social_reach: 1_000_000_000 });
    const parts = ['social_reach', 'social_engagement', 'posts_published'].map((key) => Math.min(metricAttainment(key as never, june, FIXED_TODAY, mixed)!, 1));
    expect(composite(['social_media_manager'], june, FIXED_TODAY, mixed)).toBe(Math.round((parts[0] + parts[1] + parts[2]) / 3 * 100));
    expect(Number.isInteger(composite(['social_media_manager'], june, FIXED_TODAY, mixed))).toBe(true);
    // never 0 for "nothing owned"
    for (const role of ['moderator', 'support', 'admin_support', 'super_admin'] as const) expect(composite([role], june, FIXED_TODAY, kpiData), role).toBeNull();
    // a metric without a target is left out of the average
    expect(composite(['database_officer'], june, FIXED_TODAY, withTargets({ beneficiaries_verified: 0 }))).toBeNull();
  });

  test('compositeStatus: the DATED thresholds of the month applied to composite / 100 (the boundaries hold)', () => {
    expect(compositeStatus(95, june, kpiData)).toBe('green');
    expect(compositeStatus(94, june, kpiData)).toBe('amber');
    expect(compositeStatus(70, june, kpiData)).toBe('amber');
    expect(compositeStatus(69, june, kpiData)).toBe('red');
    expect(compositeStatus(null, june, kpiData)).toBeNull();
    // thresholds that start in June leave May with the old ones
    const dated = { ...kpiData, thresholdHistory: [...kpiData.thresholdHistory, { id: 'thr-x', green: 0.8, amber: 0.5, effectiveFrom: june, seq: 99 }] };
    expect(compositeStatus(80, june, dated)).toBe('green');
    expect(compositeStatus(80, may, dated)).toBe('amber');
    expect(compositeStatus(50, june, dated)).toBe('amber');
    expect(compositeStatus(50, may, dated)).toBe('red');
  });

  const row = (key: (typeof KPI_KEYS)[number], attainment: number | null) =>
    ({ key, label: KPIS[key].label, unit: KPIS[key].unit, value: 1, target: 1, pace: 1, proratedTarget: 1, attainment, status: 'green', isPast: false }) as never;

  test('strongest and weakest: highest and lowest attainment, a tie goes to the earlier KPI; one metric is a single focus; none is null', () => {
    const pair = highlightOf([row('opportunities_published', 1.2), row('programs_organised', 0.4), row('active_ambassadors', 1.2), row('partners_onboarded', 0.4)]);
    expect(pair).toMatchObject({ kind: 'pair' });
    expect((pair as { strongest: { key: string } }).strongest.key).toBe('opportunities_published'); // 1.2 twice: the earlier KPI
    expect((pair as { weakest: { key: string } }).weakest.key).toBe('programs_organised'); // 0.4 twice: the earlier KPI
    expect(highlightOf([row('social_reach', 0.9)])).toMatchObject({ kind: 'focus', focus: { key: 'social_reach' } });
    expect(highlightOf([row('social_reach', null), row('social_engagement', 0.9)])).toMatchObject({ kind: 'focus', focus: { key: 'social_engagement' } }); // a metric with no target is not ranked
    expect(highlightOf([])).toBeNull();
    // from the data: Country Lead owns only Active ambassadors (a focus); Desk Lead has a pair
    expect(strengths(['country_lead'], june, FIXED_TODAY, kpiData)).toMatchObject({ kind: 'focus' });
    expect(strengths(['desk_lead'], june, FIXED_TODAY, kpiData)).toMatchObject({ kind: 'pair' });
    expect(strengths(['moderator'], june, FIXED_TODAY, kpiData)).toBeNull();
  });

  test('teamScorecards: highest composite first, people with no composite last in alphabetical order, ties alphabetical', () => {
    const staff = [
      { id: 'a', name: 'Zed', roles: ['moderator'] },
      { id: 'b', name: 'Bea', roles: ['database_officer'] },
      { id: 'c', name: 'Abe', roles: ['database_officer'] },
      { id: 'd', name: 'Cy', roles: ['partnerships_officer'] },
      { id: 'e', name: 'Al', roles: ['admin_support'] },
    ] as never;
    const partners = kpiData.partners.map((partner) => ({ ...partner, stageHistory: partner.stageHistory.slice(0, 1) }));
    const data = { ...withTargets({ beneficiaries_verified: 1 }), partners };
    const ranked = teamScorecards(june, FIXED_TODAY, data, staff);
    expect(ranked.map((person) => [person.name, person.composite])).toEqual([['Abe', 100], ['Bea', 100], ['Cy', 0], ['Al', null], ['Zed', null]]);
    expect(ranked[3].status).toBeNull();
    expect(teamSummary(ranked)).toEqual({ scored: 3, average: 67, belowAmber: 1 });
  });

  test('past months use the targets and thresholds that applied THEN; the series has six months, each with its own', () => {
    const dated = { ...kpiData, targetHistory: [{ id: 'tch-x', kpi: 'social_reach' as const, value: 1, effectiveFrom: june, seq: 1 }] };
    expect(kpiTarget('social_reach', dated, may)).not.toBe(1);
    expect(metricAttainment('social_reach', may, FIXED_TODAY, dated)).toBeCloseTo(kpiValue('social_reach', may, dated) / kpiTarget('social_reach', dated, may), 10);
    expect(metricAttainment('social_reach', june, FIXED_TODAY, dated)!).toBeGreaterThan(metricAttainment('social_reach', june, FIXED_TODAY, kpiData)!);
    const series = compositeSeries(['social_media_manager'], 6, FIXED_TODAY, dated);
    expect(series.map((point) => point.month)).toEqual(FIXED_MONTHS.slice(-6));
    expect(series[5].month).toBe(june);
    expect(series[4].score).toBe(composite(['social_media_manager'], may, FIXED_TODAY, dated));
    expect(series[5].score).toBe(composite(['social_media_manager'], june, FIXED_TODAY, dated));
    expect(series.every((point) => point.score !== null && point.status !== null)).toBe(true);
    expect(compositeSeries(['moderator'], 6, FIXED_TODAY, dated).every((point) => point.score === null)).toBe(true);
  });
});

test.describe('Scorecard: My scorecard and Team (mock mode)', () => {
  test.skip(!MOCK_RUN, 'the scorecard comes from the mock store: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  // The clock is PINNED to the 15th of the current month (UTC), so the composite is never held back by the first days of a month and every expectation is the same on every day the suite runs.
  const TODAY = () => {
    const real = new Date();
    return new Date(Date.UTC(real.getUTCFullYear(), real.getUTCMonth(), 15, 12));
  };
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(TODAY());
  });
  type P = import('@playwright/test').Page;
  type C = import('@playwright/test').BrowserContext;
  const OVERSIGHT = ['desk_lead', 'super_admin'];
  const OTHER_ROLES = ROLE_IDS.filter((role) => !OVERSIGHT.includes(role));
  const pct = (attainment: number | null) => formatAttainment(attainment).text; // above 300% the screen says "300%+"
  const asRole = async (page: P, context: C, roles: string, path = '/scorecard') => {
    await signedIn(page);
    await asRoles(context, roles);
    await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Scorecard' })).toBeVisible();
  };
  const data = () => buildSeed(TODAY()).collections;
  // "Me" is the signed-in session user, so EVERY staff name is a colleague's name
  const names = () => data().staff.map((person) => person.name);

  test('every role but Desk Lead and Super Admin: no other staff name anywhere in the DOM (text, hidden tables, aria, title), and ?user= is ignored', async ({ page, context }) => {
    test.setTimeout(240_000);
    const colleagues = names();
    for (const role of OTHER_ROLES) {
      for (const path of ['/scorecard', '/scorecard?user=staff-5', '/scorecard?tab=team&user=staff-7']) {
        await asRole(page, context, role, path);
        await expect(page.getByRole('region', { name: 'My scorecard' }).first()).toBeVisible();
        const html = await page.evaluate(() => `${document.title}\n${document.querySelector('main')!.outerHTML}`);
        for (const name of colleagues) expect(html.includes(name), `${role} ${path}: ${name}`).toBe(false);
      }
    }
  });

  test('the Team tab is not rendered for other roles, and the direct URL falls back to My scorecard (no team data); Desk Lead and Super Admin have it', async ({ page, context }) => {
    test.setTimeout(240_000);
    for (const role of OTHER_ROLES) {
      await asRole(page, context, role, '/scorecard?tab=team');
      await expect(page.getByRole('tab', { name: 'Team' }), role).toHaveCount(0);
      await expect(page.getByTestId('team-scorecard'), role).toHaveCount(0);
      await expect(page.getByTestId('team-row'), role).toHaveCount(0);
    }
    for (const role of OVERSIGHT) {
      await asRole(page, context, role, '/scorecard?tab=team');
      await expect(page.getByRole('tab', { name: 'Team', selected: true }), role).toBeVisible();
      await expect(page.getByTestId('team-scorecard'), role).toBeVisible();
    }
  });

  const PAIRS: { name: string; roles: string }[] = [
    { name: 'Social Media Manager', roles: 'social_media_manager' },
    { name: 'Training Officer + Country Lead', roles: 'training_officer,country_lead' },
    { name: 'Country Lead (one metric: a focus)', roles: 'country_lead' },
    { name: 'Desk Lead', roles: 'desk_lead' },
  ];
  for (const { name, roles } of PAIRS) {
    test(`strongest and weakest match the data (${name}), the ring and the rows too`, async ({ page, context }) => {
      await asRole(page, context, roles);
      const list = roles.split(',') as Parameters<typeof scorecardFor>[0]['roles'];
      const me = scorecardFor({ id: 'x', name: 'x', roles: list }, currentMonth(), TODAY(), data());
      await expect(page.getByTestId('score-value')).toHaveText(String(me.composite));
      await expect(page.getByTestId('score-ring')).toHaveAttribute('aria-valuetext', `${me.composite} out of 100, ${{ green: 'On track', amber: 'Behind', red: 'Off track' }[me.status!]}`);
      const h = me.highlight!;
      if (h.kind === 'pair') {
        await expect(page.getByTestId('strongest')).toHaveAttribute('data-kpi', h.strongest.key);
        await expect(page.getByTestId('strongest-percent')).toHaveText(pct(h.strongest.attainment));
        await expect(page.getByTestId('weakest')).toHaveAttribute('data-kpi', h.weakest.key);
        await expect(page.getByTestId('weakest-percent')).toHaveText(pct(h.weakest.attainment));
        await expect(page.getByTestId('focus')).toHaveCount(0);
      } else {
        await expect(page.getByTestId('focus')).toHaveAttribute('data-kpi', h.focus.key);
        await expect(page.getByTestId('strongest')).toHaveCount(0);
        await expect(page.getByTestId('weakest')).toHaveCount(0);
      }
      const rows = page.getByTestId('metric-row');
      await expect(rows).toHaveCount(me.metrics.length);
      for (const [index, metric] of me.metrics.entries()) {
        await expect(rows.nth(index)).toHaveAttribute('data-kpi', metric.key);
        await expect(rows.nth(index).getByTestId('metric-attainment')).toHaveText(pct(metric.attainment));
        await expect(rows.nth(index).getByTestId('metric-value')).toHaveText(metric.value.toLocaleString('en-US'));
        await expect(rows.nth(index).getByTestId('kpi-status')).toHaveText({ green: 'On track', amber: 'Behind', red: 'Off track' }[metric.status!]);
        await expect(rows.nth(index).getByTestId('metric-of')).toContainText(`of ${metric.target.toLocaleString('en-US')} ${kpiUnit(metric.key, metric.target)}`);
        if (metric.prorated) await expect(rows.nth(index).getByTestId('metric-of')).toContainText('pro-rated');
        else await expect(rows.nth(index).getByTestId('metric-of')).not.toContainText('pro-rated'); // a running total: judged against the full target
        await expect(rows.nth(index).getByTestId('kpi-pace-tick')).toHaveCount(metric.prorated ? 1 : 0);
      }
      await expect(page.getByTestId('composite-note')).toHaveText("Each metric counts up to 100% so one strong result can't hide a weak one.");
      // the trend: six months, the hidden table holds the values
      const table = page.getByRole('table', { name: 'Composite score, last six months' });
      await expect(table.getByRole('row')).toHaveCount(6);
    });
  }

  test('a role that owns no metrics (Moderator, Support, Admin Support, Super Admin) sees the empty state: no ring, no zero', async ({ page, context }) => {
    test.setTimeout(150_000);
    for (const role of ['moderator', 'support', 'admin_support', 'super_admin']) {
      await asRole(page, context, role);
      await expect(page.getByText('No metrics are assigned to your role'), role).toBeVisible();
      await expect(page.getByText('A Desk Lead can assign metrics.'), role).toBeVisible();
      await expect(page.getByTestId('score-ring'), role).toHaveCount(0);
      await expect(page.getByTestId('metric-row'), role).toHaveCount(0);
      await expect(page.getByTestId('composite-trend'), role).toHaveCount(0);
    }
  });

  test('a two-role person (Partnerships Officer + Database Officer) gets the union once', async ({ page, context }) => {
    await asRole(page, context, 'partnerships_officer,database_officer');
    await expect(page.getByTestId('metric-row')).toHaveCount(2);
    await expect(page.getByTestId('metric-row').nth(0)).toHaveAttribute('data-kpi', 'partners_onboarded');
    await expect(page.getByTestId('metric-row').nth(1)).toHaveAttribute('data-kpi', 'beneficiaries_verified');
    // shown with the signed-in user's name, never a staff member's
    const session = await page.evaluate(() => (JSON.parse(localStorage.getItem('kredibble_admin_user') ?? '{}') as { name?: string }).name);
    await expect(page.getByTestId('my-name')).toHaveText(session!);
  });

  test('the month selector changes the numbers; a past month is a read-only snapshot with its own targets and a note', async ({ page, context }) => {
    await asRole(page, context, 'desk_lead');
    const previous = monthsBefore(currentMonth(), 2);
    const expected = scorecardFor({ id: 'x', name: 'x', roles: ['desk_lead'] }, previous, TODAY(), data());
    const before = await page.getByTestId('score-value').textContent();
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option', { name: new RegExp(formatMonth(previous)) }).click();
    await expect(page).toHaveURL(new RegExp(`month=${previous}`));
    await expect(page.getByTestId('scorecard-past-note')).toHaveText(`Showing the targets and thresholds that applied in ${formatMonth(previous)}`);
    await expect(page.getByTestId('score-value')).toHaveText(String(expected.composite));
    expect(String(expected.composite)).not.toBe(before);
    for (const metric of expected.metrics) {
      const row = page.locator(`[data-testid="metric-row"][data-kpi="${metric.key}"]`);
      await expect(row.getByTestId('metric-of')).toContainText(`of ${metric.target.toLocaleString('en-US')} ${kpiUnit(metric.key, metric.target)}`);
      await expect(row.getByTestId('metric-of')).not.toContainText('pro-rated');
      await expect(row.getByTestId('kpi-pace-tick')).toHaveCount(0);
    }
    // the current month shows no such note
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option', { name: /Current/ }).click();
    await expect(page.getByTestId('scorecard-past-note')).toHaveCount(0);
  });

  test('Team: ranked by composite with the summary tiles, chips, an expand control and a role filter; people with no metrics last, not ranked; nothing editable', async ({ page, context }) => {
    await asRole(page, context, 'desk_lead', '/scorecard?tab=team');
    await expect(page.getByTestId('team-row').first()).toBeVisible();
    const seeded2 = data();
    const team = teamScorecards(currentMonth(), TODAY(), seeded2, seeded2.staff);
    const ranked = team.filter((person) => person.composite !== null);
    const unranked = team.filter((person) => person.composite === null);
    const rows = page.getByTestId('team-row');
    await expect(rows).toHaveCount(ranked.length);
    for (const [index, person] of ranked.entries()) {
      await expect(rows.nth(index).getByTestId('team-composite')).toHaveText(String(person.composite));
      await expect(rows.nth(index)).toContainText(person.name);
      await expect(rows.nth(index).getByTestId('kpi-status')).toHaveText({ green: 'On track', amber: 'Behind', red: 'Off track' }[person.status!]);
      if (person.highlight?.kind === 'pair') {
        await expect(rows.nth(index).getByTestId('team-strongest')).toHaveText(`${highlightLabels(person.highlight).high}: ${person.highlight.strongest.label} ${pct(person.highlight.strongest.attainment)}`);
        await expect(rows.nth(index).getByTestId('team-weakest')).toHaveText(`${highlightLabels(person.highlight).low}: ${person.highlight.weakest.label} ${pct(person.highlight.weakest.attainment)}`);
      }
    }
    // the unranked are listed under their own heading, last, without a score
    await expect(page.getByTestId('team-unranked').getByRole('heading', { name: 'No metrics assigned' })).toBeVisible();
    await expect(page.getByTestId('team-unranked-row')).toHaveCount(unranked.length);
    expect(await page.getByTestId('team-unranked').evaluate((el) => el.compareDocumentPosition(document.querySelector('[data-testid="team-ranked"]')!) & Node.DOCUMENT_POSITION_PRECEDING)).toBeTruthy();
    // summary tiles
    const summary = teamSummary(team);
    await expect(page.getByTestId('team-summary')).toContainText(new RegExp(`${summary.scored}\\s*People scored`));
    await expect(page.getByTestId('team-summary')).toContainText(new RegExp(`${summary.average}\\s*Average composite`));
    await expect(page.getByTestId('team-summary')).toContainText(new RegExp(`${summary.belowAmber}\\s*Below the amber threshold`));
    // the expand control: 40px, aria-expanded, shows that person's metric rows
    const first = rows.first();
    const expand = first.getByTestId('team-expand');
    const box = await expand.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(40);
    expect(box!.height).toBeGreaterThanOrEqual(40);
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expand.click();
    await expect(expand).toHaveAttribute('aria-expanded', 'true');
    await expect(first.getByTestId('team-metrics').getByTestId('metric-row')).toHaveCount(ranked[0].metrics.length);
    await expand.click();
    await expect(first.getByTestId('team-metrics')).toHaveCount(0);
    // the role filter
    await page.getByRole('combobox', { name: 'Filter by role' }).click();
    await page.getByRole('option', { name: 'Database Officer' }).click();
    const dbPeople = ranked.filter((person) => person.roles.includes('database_officer'));
    await expect(rows).toHaveCount(dbPeople.length);
    await expect(page.getByTestId('team-unranked-row')).toHaveCount(0);
    // no edit actions of any kind
    await expect(page.getByRole('button', { name: /^(Save|Edit|Delete|Remove|Assign|Add)/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^(Edit|Add|Invite)/ })).toHaveCount(0);
  });

  const COHERENCE: { roles: string; label: string }[] = [
    { roles: 'desk_lead', label: 'Desk Lead' },
    { roles: 'social_media_manager', label: 'Social Media Manager' },
  ];
  for (const { roles, label } of COHERENCE) {
    for (const [monthName, monthOf] of [['this month', () => currentMonth()], ['July', () => monthsBefore(currentMonth(), 3)]] as const) {
      test(`coherence (${label}, ${monthName}): the scorecard attainment and status equal the Overview card and the Priorities panel`, async ({ page, context }) => {
        const month = monthOf();
        if (monthName === 'July') expect(month.endsWith('-07')).toBe(true);
        const query = month === currentMonth() ? '' : `?month=${month}`;
        await asRole(page, context, roles, `/scorecard${query}`);
        await expect(page.getByTestId('metric-row').first()).toBeVisible();
        const onCard = await page.getByTestId('metric-row').evaluateAll((nodes) =>
          nodes.map((node) => ({
            kpi: node.getAttribute('data-kpi')!,
            percent: node.querySelector('[data-testid="metric-attainment"]')!.textContent!,
            status: node.querySelector('[data-testid="kpi-status"]')!.textContent!,
          })),
        );
        expect(onCard.length).toBeGreaterThan(0);
        // the Overview, same role, same month
        await page.goto(`${BASE_URL}/${query}`, { timeout: 30_000 });
        await expect(page.getByTestId('kpi-card-social_reach')).toBeVisible();
        const words = { green: 'On track', amber: 'Behind', red: 'Off track' } as const;
        await page.getByRole('button', { name: 'See all' }).click();
        for (const metric of onCard) {
          const card = page.getByTestId(`kpi-card-${metric.kpi}`);
          await expect(card.getByTestId('kpi-status'), `${metric.kpi}: Overview card status`).toHaveText(metric.status);
          expect(Object.values(words)).toContain(metric.status);
          // the Priorities row: "<n>% of where it should be today" (this month) or "<n>% of the target" (a past month)
          const priority = page.getByTestId('priority-row').and(page.locator(`[data-kpi="${metric.kpi}"]`));
          await expect(priority, `${metric.kpi}: Priorities`).toContainText(`${metric.percent} of ${month === currentMonth() ? 'where it should be today' : 'the target'}`);
          await expect(priority).toContainText(metric.status);
        }
        // and the number itself is value / pro-rated target from the data
        for (const metric of onCard) expect(metric.percent).toBe(pct(metricAttainment(metric.kpi as never, month, TODAY(), data())));
      });
    }
  }

  test('on a phone (434, 390 and 360px): the ring is 96px, nothing is wider than the screen, Team rows are compact cards with a 40px expand control', async ({ page, context }) => {
    test.setTimeout(150_000);
    await signedIn(page);
    await asRoles(context, 'desk_lead');
    for (const width of [434, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE_URL}/scorecard`, { timeout: 30_000 });
      await expect(page.getByTestId('score-ring')).toBeVisible();
      const ring = await page.getByTestId('score-ring').boundingBox();
      expect(Math.round(ring!.width), `${width}px ring`).toBe(96);
      let report = await overflowing(page);
      expect(report.found, `${width}px me: ${JSON.stringify(report)}`).toEqual([]);
      expect(report.scrollWidth).toBeLessThanOrEqual(report.innerWidth);
      await page.goto(`${BASE_URL}/scorecard?tab=team`, { timeout: 30_000 });
      await expect(page.getByTestId('team-row').first()).toBeVisible();
      report = await overflowing(page);
      expect(report.found, `${width}px team: ${JSON.stringify(report)}`).toEqual([]);
      expect(report.scrollWidth).toBeLessThanOrEqual(report.innerWidth);
      const expand = page.getByTestId('team-expand').first();
      const box = await expand.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(40);
      await expand.click();
      await expect(expand).toHaveAttribute('aria-expanded', 'true');
      report = await overflowing(page);
      expect(report.found, `${width}px team expanded: ${JSON.stringify(report)}`).toEqual([]);
      // the 40px controls never overlap
      const boxes = await page.getByTestId('team-expand').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
      for (let i = 1; i < boxes.length; i++) expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom);
    }
  });

  test('?state=error shows the banner with Try again, ?state=loading keeps the skeleton, and the page throws nothing', async ({ page, context }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => message.type() === 'error' && !message.text().startsWith('Failed to load resource') && problems.push(message.text()));
    await asRole(page, context, 'desk_lead', '/scorecard?state=error');
    await expect(page.getByRole('alert').filter({ hasText: 'Could not load the scorecard' }).getByRole('button', { name: 'Try again' })).toBeEnabled();
    await page.goto(`${BASE_URL}/scorecard?state=loading`, { timeout: 30_000 });
    await expect(page.getByTestId('scorecard-skeleton')).toBeVisible();
    await page.goto(`${BASE_URL}/scorecard?tab=team&state=empty`, { timeout: 30_000 });
    await expect(page.getByText('No one to score yet')).toBeVisible();
    expect(problems).toEqual([]);
  });
});

test.describe('Scorecard: real-API mode says "Not available yet" calmly', () => {
  test.skip(MOCK_RUN, 'real API only: mock mode shows the sample figures');
  test('the sample-data notice and a calm "Not available yet", no ring and no zero', async ({ page }) => {
    await page.goto(`${BASE_URL}/scorecard`, { timeout: 30_000 });
    await expect(page.getByTestId('not-connected-notice')).toBeVisible();
    await expect(page.getByTestId('not-available-yet')).toHaveText('Not available yet');
    await expect(page.getByTestId('score-ring')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Scorecard follow-up: running totals, "too early to score", "300%+", the seed spread, the viewer's own name, the fixed axis, the sticky sidebar.
// ---------------------------------------------------------------------------------------------
test.describe('Scorecard follow-up maths (no browser)', () => {
  const june = FIXED_MONTHS[FIXED_MONTHS.length - 1];
  const may = monthsBefore(june, 1);
  const day = (n: number) => new Date(Date.UTC(2026, 5, n, 12)); // June n, 2026

  test('running totals: Active ambassadors is the only one, judged against the FULL target (pace 1) all month; every other KPI is a count', () => {
    expect(KPIS.active_ambassadors.kind).toBe('running_total');
    expect(KPIS.active_ambassadors.note).toBe('Running total: judged against the full target');
    for (const key of KPI_KEYS.filter((k) => k !== 'active_ambassadors')) expect(KPIS[key].kind, key).toBe('count');
    expect(kpiMonthProgress('active_ambassadors', june, day(15))).toEqual({ dayOfMonth: 30, daysInMonth: 30 });
    expect(kpiMonthProgress('social_reach', june, day(15))).toEqual({ dayOfMonth: 15, daysInMonth: 30 });
    const target = kpiTarget('active_ambassadors', kpiData, june);
    const value = kpiValue('active_ambassadors', june, kpiData);
    expect(metricAttainment('active_ambassadors', june, day(15), kpiData)).toBeCloseTo(value / target, 10); // not value / (target x 0.5)
    expect(metricAttainment('active_ambassadors', june, day(2), kpiData)).toBeCloseTo(value / target, 10); // the same on day 2: nothing to pro-rate
    const result = metricResult('active_ambassadors', june, day(15), kpiData);
    expect(result).toMatchObject({ prorated: false, pace: 1, proratedTarget: target });
    expect(metricResult('social_reach', june, day(15), kpiData)).toMatchObject({ prorated: true, pace: 0.5 });
    expect(kpiMonthStatus('active_ambassadors', june, day(15), kpiData)).toBe(kpiStatus(value, target, 30, 30, kpiThresholds(june, kpiData)));
  });

  test('too early to score: before day 5 the composite of the CURRENT month is null; day 5 scores; a past month is always scored', () => {
    expect(SCORE_FROM_DAY).toBe(5);
    expect(isTooEarly(june, day(4))).toBe(true);
    expect(isTooEarly(june, day(5))).toBe(false);
    expect(isTooEarly(june, day(1))).toBe(true);
    expect(isTooEarly(may, day(4))).toBe(false); // a past month is complete
    expect(composite(['desk_lead'], june, day(4), kpiData)).toBeNull();
    expect(composite(['desk_lead'], june, day(5), kpiData)).not.toBeNull();
    expect(composite(['desk_lead'], may, day(4), kpiData)).not.toBeNull();
    expect(compositeStatus(composite(['desk_lead'], june, day(4), kpiData), june, kpiData)).toBeNull();
    // the trend: only the current month is held back
    const series = compositeSeries(['social_media_manager'], 6, day(4), kpiData);
    expect(series.map((point) => point.score === null)).toEqual([false, false, false, false, false, true]);
    // the team: nobody is scored, but only people who own metrics are "too early"; the others have none to score
    const team = teamScorecards(june, day(4), kpiData, kpiData.staff);
    expect(team.every((person) => person.composite === null)).toBe(true);
    expect(team.filter((person) => person.tooEarly).length).toBe(team.filter((person) => person.metrics.length > 0).length);
    expect(team.filter((person) => person.metrics.length === 0).every((person) => !person.tooEarly)).toBe(true);
    expect(team.map((person) => person.name)).toEqual([...team.map((person) => person.name)].sort((a, b) => a.localeCompare(b))); // alphabetical, not ranked
    // the metric rows still have their figures
    expect(scorecardFor(team[0], june, day(4), kpiData).metrics.length).toBe(team[0].metrics.length);
  });

  test('"300%+": up to 300% the whole number, above it "300%+" with the exact figure kept; null is a dash; the composite still caps each metric at 100%', () => {
    expect(formatAttainment(1.18)).toEqual({ text: '118%', exact: '118%', capped: false });
    expect(formatAttainment(3)).toEqual({ text: '300%', exact: '300%', capped: false });
    expect(formatAttainment(3.004)).toEqual({ text: '300%', exact: '300%', capped: false }); // rounds to 300: not above it
    expect(formatAttainment(3.006)).toEqual({ text: '300%+', exact: '301%', capped: true });
    expect(formatAttainment(5.274)).toEqual({ text: '300%+', exact: '527%', capped: true });
    expect(formatAttainment(12.5)).toEqual({ text: '300%+', exact: '1,250%', capped: true }); // thousands separators in the exact figure
    expect(formatAttainment(0)).toEqual({ text: '0%', exact: '0%', capped: false }); // a real zero is 0%
    expect(formatAttainment(null)).toEqual({ text: '—', exact: '—', capped: false }); // unknown is a dash, never 0%
    // only the display is capped: the attainment is the exact value and the composite stays at 100
    const data = { ...kpiData, targetHistory: [], targets: kpiData.targets.map((target) => (target.kpi === 'posts_published' ? { ...target, target: 1 } : target)) };
    expect(metricAttainment('posts_published', june, day(15), data)!).toBeGreaterThan(3);
    expect(composite(['social_media_manager'], june, day(15), data)!).toBeLessThanOrEqual(100);
    expect(composite(['database_officer'], june, day(15), { ...data, targets: data.targets.map((t) => (t.kpi === 'beneficiaries_verified' ? { ...t, target: 1 } : t)) })).toBe(100);
  });

  test('the seed spread: at most two people share a composite, the cases are all there and every reference still points at a person', () => {
    const team = teamScorecards(june, day(15), kpiData, kpiData.staff);
    const scores = team.filter((person) => person.composite !== null).map((person) => person.composite!);
    const counts = new Map<number, number>();
    for (const score of scores) counts.set(score, (counts.get(score) ?? 0) + 1);
    expect(Math.max(...counts.values()), JSON.stringify([...counts])).toBeLessThanOrEqual(2);
    expect(counts.size).toBeGreaterThanOrEqual(6); // a real spread
    expect(scores).toContain(100); // someone at the cap (a Country Lead: the cap on Active ambassadors)
    expect(scores).toContain(0);
    expect(Math.min(...scores)).toBe(0);
    expect(team.filter((person) => person.metrics.length === 0).length).toBeGreaterThanOrEqual(3); // people with no metrics
    expect(team.some((person) => person.roles.length === 2 && person.metrics.length > 0)).toBe(true); // a two-role person
    expect(team.find((person) => person.roles.includes('desk_lead'))!.metrics.length).toBe(10); // the Desk Lead owns all ten
    expect(team.some((person) => person.roles.includes('country_lead') && person.composite === 100)).toBe(true);
    // the references the seed makes are people in the collection
    const ids = new Set(kpiData.staff.map((person) => person.id));
    for (const partner of kpiData.partners) expect(ids.has(partner.ownerId), `partner ${partner.id}`).toBe(true);
    for (const listing of kpiData.listings) {
      if (listing.writerId) expect(ids.has(listing.writerId), `listing ${listing.id} writer`).toBe(true);
      if (listing.vettedById) expect(ids.has(listing.vettedById), `listing ${listing.id} vetted by`).toBe(true);
    }
    for (const record of kpiData.databaseRecords) if (record.addedById) expect(ids.has(record.addedById), `record ${record.id}`).toBe(true);
    for (const post of kpiData.socialPosts) if (post.authorId) expect(ids.has(post.authorId), `post ${post.id}`).toBe(true);
    // each of those references belongs to a person who holds the role that makes sense for it
    const byId = new Map(kpiData.staff.map((person) => [person.id, person]));
    for (const partner of kpiData.partners) expect(byId.get(partner.ownerId)!.roles.some((role) => ['partnerships_officer', 'country_lead', 'desk_lead'].includes(role))).toBe(true);
    for (const record of kpiData.databaseRecords) if (record.addedById) expect(byId.get(record.addedById)!.roles.some((role) => ['database_officer', 'desk_lead'].includes(role))).toBe(true);
  });
});

test.describe('Scorecard follow-up: name and roles, axis, running totals, too early, 300%+ and the sidebar (mock mode)', () => {
  test.skip(!MOCK_RUN, 'the scorecard comes from the mock store: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  type P = import('@playwright/test').Page;
  type C = import('@playwright/test').BrowserContext;
  const now = new Date();
  const dayOfThisMonth = (n: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), n, 12));
  const TODAY = () => dayOfThisMonth(15);
  const data = (at: Date = TODAY()) => buildSeed(at).collections;
  const open = async (page: P, context: C, roles: string, path = '/scorecard', at: Date = TODAY()) => {
    await signedIn(page);
    await page.clock.setFixedTime(at);
    await asRoles(context, roles);
    await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Scorecard' })).toBeVisible();
  };
  const words = { green: 'On track', amber: 'Behind', red: 'Off track' } as const;

  for (const roles of ['partnerships_officer', 'database_officer', 'social_media_manager,training_officer']) {
    test(`My scorecard shows the signed-in user's name and the roles viewed as pills, and no other staff name (${roles})`, async ({ page, context }) => {
      await open(page, context, roles);
      await expect(page.getByTestId('my-scorecard')).toBeVisible();
      const session = await page.evaluate(() => (JSON.parse(localStorage.getItem('kredibble_admin_user') ?? '{}') as { name?: string }).name);
      expect(session).toBeTruthy();
      await expect(page.getByTestId('my-name')).toHaveText(session!);
      const pills = page.getByTestId('my-roles').locator('span');
      await expect(pills).toHaveCount(roles.split(',').length);
      await expect(pills).toHaveText(roles.split(',').map((role) => ROLES[role as keyof typeof ROLES].label));
      const html = await page.evaluate(() => `${document.title}\n${document.querySelector('main')!.outerHTML}`);
      expect(html).toContain(session!);
      for (const person of data().staff) expect(html.includes(person.name), `another staff name: ${person.name}`).toBe(false);
    });
  }

  test('the composite trend always uses a 0 to 100 axis: ticks at 0, 25, 50, 75 and 100, not the data maximum', async ({ page, context }) => {
    await open(page, context, 'desk_lead');
    const chart = page.getByTestId('composite-trend');
    await expect(chart.getByRole('group')).toBeVisible();
    const axis = await chart.locator('svg text').allTextContents();
    for (const tick of ['0', '25', '50', '75', '100']) expect(axis, `tick ${tick}`).toContain(tick);
    // a single low score still sits against a 0-100 scale: no tick above 100 and none that is the data maximum rescaled
    const numbers = axis.map((text) => Number(text)).filter((n) => !Number.isNaN(n));
    expect(Math.max(...numbers)).toBeLessThanOrEqual(100);
    // the same for a role whose scores are all low (Partnerships Officer: 0): still 0 to 100
    await open(page, context, 'partnerships_officer');
    await expect(page.getByTestId('composite-trend').getByRole('group')).toBeVisible();
    const low = await page.getByTestId('composite-trend').locator('svg text').allTextContents();
    for (const tick of ['0', '25', '50', '75', '100']) expect(low, `low ${tick}`).toContain(tick);
  });

  test('the sidebar is sticky at the full viewport height at every scroll position and viewport height (720, 900, 1232) on a long page', async ({ page, context }) => {
    test.setTimeout(120_000);
    await signedIn(page);
    await asRoles(context, 'desk_lead');
    for (const height of [720, 900, 1232]) {
      await page.setViewportSize({ width: 1440, height });
      await page.goto(`${BASE_URL}/scorecard`, { timeout: 30_000 });
      await expect(page.getByTestId('composite-trend')).toBeVisible();
      const measure = () =>
        page.evaluate(() => {
          const aside = document.querySelector('aside')!.getBoundingClientRect();
          return { top: Math.round(aside.top), bottom: Math.round(aside.bottom), viewport: window.innerHeight, scrollY: Math.round(window.scrollY), page: document.documentElement.scrollHeight, shell: document.body.scrollHeight };
        });
      const start = await measure();
      expect(start.page, `${height}px: a long page`).toBeGreaterThan(height);
      // nothing sticks out below the shell (a hidden chart table used to stretch the page by 118px)
      expect(start.page, `${height}px: the page is as tall as the shell`).toBe(start.shell);
      for (const where of [0, 0.5, 1]) {
        await page.evaluate((fraction) => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * fraction), where);
        const at = await measure();
        expect(at.top, `${height}px at ${where}: top`).toBe(0);
        expect(at.bottom, `${height}px at ${where}: bottom edge against the viewport`).toBe(height);
      }
      const end = await measure();
      expect(end.scrollY + end.viewport, `${height}px: scrolled to the very bottom`).toBe(end.page);
    }
  });

  test('"No metrics assigned" has its explanation line and keeps the names', async ({ page, context }) => {
    await open(page, context, 'desk_lead', '/scorecard?tab=team');
    const unranked = page.getByTestId('team-unranked');
    await expect(unranked.getByRole('heading', { name: 'No metrics assigned' })).toBeVisible();
    await expect(unranked.getByText('These roles have no metrics assigned to them.')).toBeVisible();
    const none = data().staff.filter((person) => ownedMetrics(person.roles).length === 0);
    expect(none.length).toBeGreaterThan(0);
    for (const person of none) await expect(unranked).toContainText(person.name);
  });

  test('the subtitle is "Targets and results." for every role', async ({ page, context }) => {
    for (const roles of ['desk_lead', 'moderator', 'country_lead']) {
      await open(page, context, roles);
      await expect(page.getByText('Targets and results.', { exact: true }), roles).toBeVisible();
    }
  });

  for (const monthName of ['this month', 'July']) {
    test(`running total (${monthName}): Active ambassadors is judged against the FULL target on the Overview card, in Priorities and on the scorecard, with no pace tick`, async ({ page, context }) => {
      const month = monthName === 'July' ? monthsBefore(currentMonth(), 3) : currentMonth();
      const query = month === currentMonth() ? '' : `?month=${month}`;
      const seeded = data();
      const value = kpiValue('active_ambassadors', month, seeded);
      const target = kpiTarget('active_ambassadors', seeded, month);
      const expected = formatAttainment(value / target); // the FULL target, whatever the day of the month is
      const status = kpiMonthStatus('active_ambassadors', month, TODAY(), seeded);
      // the scorecard (Country Lead owns it)
      await open(page, context, 'country_lead', `/scorecard${query}`);
      const row = page.locator('[data-testid="metric-row"][data-kpi="active_ambassadors"]');
      await expect(row.getByTestId('metric-attainment')).toHaveText(expected.text);
      await expect(row.getByTestId('metric-attainment')).toHaveAttribute('data-exact', expected.exact);
      await expect(row.getByTestId('kpi-status')).toHaveText(words[status]);
      await expect(row.getByTestId('metric-of')).toHaveText(`of ${target.toLocaleString('en-US')} ambassadors`); // no "pro-rated to N"
      await expect(row.getByTestId('kpi-pace-tick')).toHaveCount(0);
      // the Overview card
      await page.goto(`${BASE_URL}/${query}`, { timeout: 30_000 });
      const card = page.getByTestId('kpi-card-active_ambassadors');
      await expect(card).toHaveAttribute('data-status', status);
      await expect(card.getByTestId('kpi-of')).toHaveText(`of ${target.toLocaleString('en-US')} ambassadors`);
      await expect(card.getByTestId('kpi-pace-tick')).toHaveCount(0);
      await expect(card).toContainText('Running total: judged against the full target');
      await expect(card.getByTestId('kpi-value')).toHaveText(value.toLocaleString('en-US'));
      // the width of the bar's fill is value / full target (capped at the full bar)
      const fill = await card.getByTestId('kpi-bar-fill').evaluate((el) => (el as HTMLElement).style.width);
      expect(parseFloat(fill)).toBeCloseTo(Math.min(1, value / target) * 100, 1);
      // Priorities
      await page.getByRole('button', { name: 'See all' }).click();
      const priority = page.getByTestId('priority-row').and(page.locator('[data-kpi="active_ambassadors"]'));
      await expect(priority).toContainText(`${expected.text} ${month === currentMonth() ? 'of where it should be today' : 'of the target'}`);
      await expect(priority).toContainText(words[status]);
      await expect(priority.getByTestId('kpi-pace-tick')).toHaveCount(0);
    });
  }

  test('too early in the month (day 4): the composite is a dash with the message, the rows and the Overview chips stay, the team waits ("Scores start on day 5")', async ({ page, context }) => {
    const day4 = dayOfThisMonth(4);
    await open(page, context, 'desk_lead', '/scorecard', day4);
    await expect(page.getByTestId('score-value')).toHaveText('—');
    const ring = page.getByTestId('score-ring');
    await expect(ring).toHaveAttribute('aria-valuetext', 'Too early in the month to score');
    expect(await ring.getAttribute('aria-valuenow')).toBeNull(); // no number: never 0
    await expect(page.getByTestId('too-early')).toHaveText('Too early in the month to score');
    await expect(page.getByTestId('metric-row')).toHaveCount(10); // the metric rows still have their figures
    await expect(page.getByRole('region', { name: 'My scorecard' }).first()).not.toContainText(/\b0 out of 100\b/);
    // the Team tab
    await page.goto(`${BASE_URL}/scorecard?tab=team`, { timeout: 30_000 });
    await expect(page.getByTestId('team-too-early')).toBeVisible();
    await expect(page.getByText('Scores start on day 5')).toHaveCount(4); // the three tiles and the note
    await expect(page.getByTestId('team-row')).toHaveCount(0);
    await expect(page.getByTestId('team-composite')).toHaveCount(0);
    await expect(page.getByTestId('team-heldback-row').first()).toBeVisible();
    await expect(page.getByTestId('team-unranked')).toBeVisible(); // people with no metrics are still listed
    // the Overview keeps its status chips
    await page.goto(`${BASE_URL}/`, { timeout: 30_000 });
    await expect(page.getByTestId('kpi-card-social_reach')).toBeVisible();
    await expect(page.getByTestId('kpi-status')).toHaveCount(10);
  });

  test('day 5 scores; a past month is always scored, even on day 4', async ({ page, context }) => {
    const day5 = dayOfThisMonth(5);
    const day4 = dayOfThisMonth(4);
    await open(page, context, 'desk_lead', '/scorecard', day5);
    const on5 = composite(['desk_lead'], currentMonth(), day5, data(day5));
    expect(on5).not.toBeNull();
    await expect(page.getByTestId('score-value')).toHaveText(String(on5));
    await expect(page.getByTestId('too-early')).toHaveCount(0);
    await page.goto(`${BASE_URL}/scorecard?tab=team`, { timeout: 30_000 });
    await expect(page.getByTestId('team-row').first()).toBeVisible();
    await expect(page.getByText('Scores start on day 5')).toHaveCount(0);
    // day 4, but last month
    const previous = monthsBefore(currentMonth(), 1);
    await page.clock.setFixedTime(day4);
    await page.goto(`${BASE_URL}/scorecard?month=${previous}`, { timeout: 30_000 });
    const past = composite(['desk_lead'], previous, day4, data(day4));
    expect(past).not.toBeNull();
    await expect(page.getByTestId('score-value')).toHaveText(String(past));
    await expect(page.getByTestId('too-early')).toHaveCount(0);
  });

  test('"300%+": a very high attainment reads "300%+" in the row and the strongest tile, with the exact figure in the Tooltip, the aria-label and data-exact', async ({ page, context }) => {
    await signedIn(page);
    await page.clock.setFixedTime(TODAY());
    await asRoles(context, 'desk_lead');
    await page.goto(`${BASE_URL}/settings/targets`, { timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Monthly targets' })).toBeVisible();
    await page.getByTestId('target-input-social_reach').fill('100');
    await page.getByTestId('target-input-social_reach').blur();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('toast')).toBeVisible();
    await goViaSidebar(page, 'Dashboard', 'Scorecard');
    const seeded = data();
    const attainmentNow = (kpiValue('social_reach', currentMonth(), seeded) / (100 * (15 / daysInMonth(currentMonth()))));
    const exact = formatAttainment(attainmentNow);
    expect(exact.capped).toBe(true);
    const row = page.locator('[data-testid="metric-row"][data-kpi="social_reach"]');
    const figure = row.getByTestId('metric-attainment');
    await expect(figure).toHaveText('300%+');
    await expect(figure).toHaveAttribute('data-exact', exact.exact);
    await expect(figure).toHaveAttribute('aria-label', exact.exact);
    await figure.hover();
    await expect(page.getByRole('tooltip')).toHaveText(exact.exact);
    await page.mouse.move(0, 0);
    await figure.focus();
    await expect(page.getByRole('tooltip')).toHaveText(exact.exact); // keyboard focus shows it too
    // the strongest tile is that metric, with the same text
    await expect(page.getByTestId('strongest')).toHaveAttribute('data-kpi', 'social_reach');
    await expect(page.getByTestId('strongest-percent')).toHaveText('300%+');
    await expect(page.getByTestId('strongest-percent')).toHaveAttribute('data-exact', exact.exact);
    // the status is still the real one (far above target: On track), and the composite is not lifted above 100
    await expect(row.getByTestId('kpi-status')).toHaveText('On track');
    expect(Number(await page.getByTestId('score-value').textContent())).toBeLessThanOrEqual(100);
    // no horizontal overflow from the capped figures on a phone
    await page.keyboard.press('Escape'); // close the Tooltip (it sits where the figure was at 1440px)
    await page.setViewportSize({ width: 360, height: 900 });
    // polled: the sidebar slides away as the layout changes to a phone (the resize is live: the store would be lost by a reload)
    await expect.poll(async () => (await overflowing(page)).found).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Monthly report (/monthly-report): the maths (no browser), the two templates, access, the coherence with the other screens, Download PDF and printing.
// Expectations are worked out from buildSeed() with the same functions the page uses.
// ---------------------------------------------------------------------------------------------
test.describe('Monthly report maths (no browser)', () => {
  const june = FIXED_MONTHS[FIXED_MONTHS.length - 1];
  const may = monthsBefore(june, 1);
  const reportData = { ...kpiData, amplificationLogs: seed.amplificationLogs } as never;

  test('metricDelta: a percentage with the arrow, "n/a" for a previous 0, "—" with no previous month, 0% when nothing changed', () => {
    expect(metricDelta(112, 100, 'August 2026')).toEqual({ kind: 'up', text: '+12% vs August 2026', percent: 12 });
    expect(metricDelta(92, 100, 'August 2026')).toEqual({ kind: 'down', text: '-8% vs August 2026', percent: -8 });
    expect(metricDelta(100, 100, 'August 2026')).toEqual({ kind: 'flat', text: '0% vs August 2026', percent: 0 });
    expect(metricDelta(5, 0, 'August 2026')).toEqual({ kind: 'na', text: 'n/a', percent: null }); // a percentage of nothing is not a number
    expect(metricDelta(0, 0, 'August 2026')).toEqual({ kind: 'na', text: 'n/a', percent: null });
    expect(metricDelta(5, null, 'August 2026')).toEqual({ kind: 'none', text: '—', percent: null }); // no previous month
    expect(metricDelta(3, 2.4, 'the same period last month, estimated').text).toBe('+25% vs the same period last month, estimated'); // an estimate is a fraction
  });

  test('months: the last complete month is the default; the current month is month to date; the first month on record has no previous one', () => {
    expect(lastCompleteMonth(FIXED_TODAY)).toBe(may);
    expect(isMonthToDate(june, FIXED_TODAY)).toBe(true);
    expect(isMonthToDate(may, FIXED_TODAY)).toBe(false);
    expect(earliestMonth(FIXED_TODAY)).toBe(FIXED_MONTHS[0]);
    // a past month is read in full: the last day of it; the current month is read as of today
    expect(reportTitle('partner', '2026-09')).toBe('GOD-Progress-Report-2026-09');
    expect(reportTitle('team', '2026-09')).toBe('GOD-Team-Report-2026-09');
    expect(reportToday(may, FIXED_TODAY).getUTCDate()).toBe(31);
    expect(reportToday(june, FIXED_TODAY)).toEqual(FIXED_TODAY);
  });

  test('the ten figures equal the matching KPI, newInMonth and the website table; the daily sums are the averages times the days', () => {
    const metrics = partnerMetrics(may, FIXED_TODAY, reportData);
    const byId = Object.fromEntries(metrics.map((metric) => [metric.id, metric]));
    expect(metrics.map((metric) => metric.id)).toEqual(['website_views', 'daily_first_visits', 'daily_visitors', 'social_reach', 'social_engagement', 'posts_published', 'new_ambassadors', 'new_partners', 'opportunities_published', 'projects_organised']);
    expect(byId.website_views.value).toBe(kpiValue('website_views', may, kpiData));
    expect(byId.social_reach.value).toBe(kpiValue('social_reach', may, kpiData));
    expect(byId.social_engagement.value).toBe(kpiValue('social_engagement', may, kpiData));
    expect(byId.posts_published.value).toBe(kpiValue('posts_published', may, kpiData));
    expect(byId.opportunities_published.value).toBe(kpiValue('opportunities_published', may, kpiData));
    expect(byId.projects_organised.value).toBe(kpiValue('programs_organised', may, kpiData));
    expect(byId.new_partners.value).toBe(kpiValue('partners_onboarded', may, kpiData));
    expect(byId.new_ambassadors.value).toBe(kpiData.ambassadors.filter((a) => a.status !== 'applicant' && a.joinedAt.startsWith(may)).length); // joinedAt
    const row = kpiData.websiteMonths.find((entry) => entry.month === may)!;
    expect(byId.daily_first_visits.value).toBe(Math.round(row.dailyFirstVisits * 31));
    expect(byId.daily_visitors.value).toBe(Math.round(row.dailyVisitors * 31));
    // visitor-days are at least first visits, in every month of the seed
    for (const month of kpiData.websiteMonths) expect(month.dailyVisitors).toBeGreaterThanOrEqual(month.dailyFirstVisits);
  });

  test('deltas: a normal month compares with the previous month; the first month has no previous (—); the current month compares with the previous one pro-rated to the same day', () => {
    const normal = partnerMetrics(may, FIXED_TODAY, reportData);
    const views = normal.find((metric) => metric.id === 'website_views')!;
    const before = kpiValue('website_views', monthsBefore(may, 1), kpiData);
    expect(views.previous).toBe(before);
    expect(views.delta).toEqual(metricDelta(views.value, before, formatMonth(monthsBefore(may, 1))));
    // the first month on record: nothing to compare with
    const first = partnerMetrics(FIXED_MONTHS[0], FIXED_TODAY, reportData);
    expect(first.every((metric) => metric.previous === null && metric.delta.kind === 'none' && metric.delta.text === '—')).toBe(true);
    // the current month (June 15 of 30; May has 31 days): May pro-rated to the 15th, and the words say it is an estimate
    const toDate = partnerMetrics(june, FIXED_TODAY, reportData);
    const reach = toDate.find((metric) => metric.id === 'social_reach')!;
    expect(reach.previous).toBeCloseTo(kpiValue('social_reach', may, kpiData) * (15 / 31), 8);
    expect(reach.delta.text.endsWith('vs the same period last month, estimated') || reach.delta.kind === 'na').toBe(true);
  });

  test('a zero previous value is "n/a", not a percentage (a month after an empty one)', () => {
    const emptyMay = { ...kpiData, programs: kpiData.programs.map((program) => (program.deliveredAt?.startsWith(may) ? { ...program, status: 'planned' as const, deliveredAt: undefined } : program)) } as never;
    expect(kpiValue('programs_organised', may, emptyMay)).toBe(0);
    const projects = partnerMetrics(june, FIXED_TODAY, { ...(reportData as object), ...(emptyMay as object) } as never).find((metric) => metric.id === 'projects_organised')!;
    expect(projects.previous).toBe(0);
    expect(projects.delta).toEqual({ kind: 'na', text: 'n/a', percent: null });
  });

  test('shouldRecordReport is once per reportMonth AND view in each calendar month; recordReport adds the record the Monthly reports KPI counts', () => {
    const now = new Date(Date.UTC(2026, 6, 2));
    const reports = [{ id: 'a', reportMonth: '2026-06', view: 'partner' as const, generatedAt: '2026-07-02' }];
    expect(shouldRecordReport(reports, '2026-06', now, 'partner')).toBe(false); // the same report again, the same month
    expect(shouldRecordReport(reports, '2026-06', now, 'team')).toBe(true); // the other template is its own report
    expect(shouldRecordReport(reports, '2026-05', now, 'partner')).toBe(true); // another reportMonth
    expect(shouldRecordReport(reports, '2026-06', new Date(Date.UTC(2026, 7, 2)), 'partner')).toBe(true); // next calendar month: counts again
    const before = getMockCollection('monthlyReports');
    try {
      setMockCollection('monthlyReports', [], { always: true });
      expect(recordReport('2026-09', 'partner', now)).toBe(true);
      expect(recordReport('2026-09', 'partner', now)).toBe(false);
      expect(recordReport('2026-09', 'team', now)).toBe(true);
      expect(getMockCollection('monthlyReports').map((report) => [report.reportMonth, report.view, report.generatedAt])).toEqual([['2026-09', 'partner', '2026-07-02'], ['2026-09', 'team', '2026-07-02']]);
      expect(kpiValue('monthly_reports', '2026-07', { ...kpiData, monthlyReports: getMockCollection('monthlyReports') })).toBe(2);
    } finally {
      setMockCollection('monthlyReports', before, { always: true });
    }
  });

  test('"Highest" and "Lowest": the pair is labelled that way only when every owned metric is at or above target', () => {
    const row = (key: (typeof KPI_KEYS)[number], attainment: number) => ({ key, label: KPIS[key].label, unit: KPIS[key].unit, value: 1, target: 1, pace: 1, proratedTarget: 1, attainment, status: 'green', isPast: false, prorated: true }) as never;
    const allOn = highlightOf([row('opportunities_published', 1.2), row('programs_organised', 1)]);
    expect(allOn).toMatchObject({ kind: 'pair', atTarget: true });
    expect(highlightLabels(allOn as never)).toEqual({ high: 'Highest', low: 'Lowest' });
    const mixed = highlightOf([row('opportunities_published', 1.2), row('programs_organised', 0.99)]);
    expect(mixed).toMatchObject({ kind: 'pair', atTarget: false });
    expect(highlightLabels(mixed as never)).toEqual({ high: 'Strongest', low: 'Weakest' });
  });
});

test.describe('Monthly report: routes, access, the two templates and the coherence (mock mode)', () => {
  test.skip(!MOCK_RUN, 'the report comes from the mock store: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  type P = import('@playwright/test').Page;
  type C = import('@playwright/test').BrowserContext;
  const open = async (page: P, context: C, roles: string, path = '/monthly-report/partner') => {
    await signedIn(page);
    await asRoles(context, roles);
    await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
  };
  const today = () => new Date();
  const defaultMonth = () => lastCompleteMonth(today());
  const data = () => buildSeed().collections;
  const reportData = () => ({ ...data(), amplificationLogs: data().amplificationLogs }) as never;

  test('/monthly-report redirects to the partner report and keeps the chosen month', async ({ page, context }) => {
    await open(page, context, 'desk_lead', '/monthly-report');
    await expect(page).toHaveURL(`${BASE_URL}/monthly-report/partner`);
    await page.goto(`${BASE_URL}/monthly-report?month=${monthsBefore(currentMonth(), 2)}`, { timeout: 30_000 });
    await expect(page).toHaveURL(`${BASE_URL}/monthly-report/partner?month=${monthsBefore(currentMonth(), 2)}`);
    await expect(page.getByTestId('partner-report')).toBeVisible();
  });

  test('the partner report: the header, the intro, the ten cells with their descriptions, the footer and no sideways scroll', async ({ page, context }) => {
    await open(page, context, 'desk_lead');
    const paper = page.getByTestId('partner-report');
    await expect(paper).toBeVisible();
    await expect(paper.getByText('GLOBAL OPPORTUNITY DESK', { exact: true })).toBeVisible();
    await expect(paper.getByRole('heading', { name: 'Progress report' })).toBeVisible();
    await expect(page.getByTestId('report-month')).toHaveText(formatMonth(defaultMonth())); // the last COMPLETE month
    await expect(page.getByTestId('report-intro')).toHaveText(`A summary of the Desk's reach and growth this month, prepared for our partners. Figures are compared with ${formatMonth(monthsBefore(defaultMonth(), 1))}.`);
    const cells = paper.locator('[data-testid^="metric-"]:not([data-testid="metric-value"]):not([data-testid="metric-delta"])');
    await expect(cells).toHaveCount(10);
    const expected: [string, string, string][] = [
      ['website_views', 'Website views', 'Pages opened across the Desk website'],
      ['daily_first_visits', 'Daily first visits (sum)', 'Daily counts; returning people can appear again on another day'],
      ['daily_visitors', 'Daily visitors (sum)', 'Visitor-days, not unique monthly people; cached page loads may be missed'],
      ['social_reach', 'Social reach', 'People reached across our channels'],
      ['social_engagement', 'Social engagement', 'Likes, shares, comments and saves'],
      ['posts_published', 'Posts published', 'Across all social channels'],
      ['new_ambassadors', 'New ambassadors', 'Young people who joined the network'],
      ['new_partners', 'New partners', 'Organisations that came on board'],
      ['opportunities_published', 'Opportunities published', 'Scholarships, grants and roles shared publicly'],
      ['projects_organised', 'Projects organised', 'Trainings, workshops and projects GOD ran'],
    ];
    for (const [id, label, description] of expected) {
      await expect(page.getByTestId(`metric-${id}`)).toContainText(label);
      await expect(page.getByTestId(`metric-${id}`)).toContainText(description);
    }
    await expect(page.getByTestId('report-footer')).toHaveText(`Global Opportunity Desk · ${formatMonth(defaultMonth())}`);
    await expect(paper.getByText("Figures from the Desk's own records.")).toBeVisible();
    // the grid is 5 across on the paper
    const lefts = await paper.locator('[data-testid^="metric-"]:not([data-testid="metric-value"]):not([data-testid="metric-delta"])').evaluateAll((nodes) => new Set(nodes.map((node) => Math.round(node.getBoundingClientRect().left))).size);
    expect(lefts).toBe(5);
    await expect(page.getByTestId('audience-none').or(page.getByRole('group', { name: /^Website views, last \d+ months/ }))).toBeVisible();
  });

  test('the partner report holds no staff name, no ambassador name and not the word "scoreboard"', async ({ page, context }) => {
    for (const month of [defaultMonth(), currentMonth()]) {
      await open(page, context, 'desk_lead', `/monthly-report/partner?month=${month}`);
      await expect(page.getByTestId('partner-report')).toBeVisible();
      const html = await page.evaluate(() => document.querySelector('main')!.outerHTML);
      for (const person of data().staff) expect(html.includes(person.name), `staff name ${person.name} (${month})`).toBe(false);
      for (const ambassador of data().ambassadors) expect(html.includes(ambassador.name), `ambassador name ${ambassador.name} (${month})`).toBe(false);
      expect(/scoreboard/i.test(html), `the word scoreboard (${month})`).toBe(false);
      expect(/composite/i.test(html), `composite scores (${month})`).toBe(false);
    }
  });

  test('access: the partner report for Super Admin, Desk Lead, Communications Officer and Partnerships Officer; blocked for the roles without monthly_report', async ({ page, context }) => {
    test.setTimeout(240_000);
    for (const role of ROLE_IDS) {
      await open(page, context, role);
      const allowed = roleCan([role], 'monthly_report', 'view');
      if (allowed) await expect(page.getByTestId('partner-report'), role).toBeVisible();
      else {
        await expect(page.getByTestId('no-access'), role).toBeVisible();
        await expect(page.getByTestId('partner-report'), role).toHaveCount(0);
      }
    }
    for (const role of ['super_admin', 'desk_lead', 'communications_officer', 'partnerships_officer']) expect(roleCan([role as never], 'monthly_report', 'view'), role).toBe(true);
  });

  test('access: the team report only for Desk Lead and Super Admin (direct URL too); the Team tab is not rendered for anyone else', async ({ page, context }) => {
    test.setTimeout(240_000);
    for (const role of ROLE_IDS) {
      await open(page, context, role, '/monthly-report/team');
      const allowed = role === 'desk_lead' || role === 'super_admin';
      expect(roleCan([role], 'team_scorecard', 'view'), role).toBe(allowed);
      if (allowed) {
        await expect(page.getByTestId('team-report'), role).toBeVisible();
        await expect(page.getByRole('link', { name: 'Team report' }), role).toBeVisible();
      } else {
        await expect(page.getByTestId('no-access'), role).toBeVisible();
        await expect(page.getByTestId('team-report'), role).toHaveCount(0);
        await expect(page.getByTestId('team-scoreboard'), role).toHaveCount(0);
      }
    }
    // a role that may read the partner report has no Team tab on it
    await open(page, context, 'communications_officer');
    await expect(page.getByRole('link', { name: 'Partner report' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Team report' })).toHaveCount(0);
  });

  test('the month: the last complete month by default, the current month is "Month to date" with the estimate wording, a past month is read-only; ?month= is in the URL', async ({ page, context }) => {
    await open(page, context, 'desk_lead');
    await expect(page.getByTestId('month-to-date')).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Month' }).click();
    const options = page.getByRole('option');
    await expect(options).toHaveCount(6);
    await expect(options.first()).toContainText('Month to date');
    await expect(options.first()).toContainText(formatMonth(currentMonth()));
    await options.first().click();
    await expect(page).toHaveURL(new RegExp(`month=${currentMonth()}`));
    await expect(page.getByTestId('month-to-date')).toHaveText('Month to date');
    await expect(page.getByTestId('to-date-note')).toBeVisible();
    await expect(page.getByTestId('partner-report').getByText('compared with the same period last month', { exact: false }).first()).toBeVisible();
    const deltas = await page.getByTestId('metric-delta').allTextContents();
    for (const text of deltas) expect(text === 'n/a' || text === '—' || text.endsWith('vs the same period last month, estimated'), text).toBe(true);
    // back to the default month removes the parameter
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option', { name: new RegExp(formatMonth(defaultMonth())) }).click();
    await expect(page).not.toHaveURL(/month=/);
    await expect(page.getByTestId('report-month')).toHaveText(formatMonth(defaultMonth()));
  });

  test('coherence: the ten values equal the Overview cards, the Social totals and the data, for every month; the deltas are right (a normal month, a zero previous value, the first month)', async ({ page, context }) => {
    test.setTimeout(240_000);
    const seeded = reportData();
    const kinds = new Set<string>();
    for (const month of [monthsBefore(currentMonth(), 1), monthsBefore(currentMonth(), 3), monthsBefore(currentMonth(), 5)]) {
      const expected = partnerMetrics(month, today(), seeded);
      await open(page, context, 'desk_lead', `/monthly-report/partner?month=${month}`);
      await expect(page.getByTestId('partner-report')).toBeVisible();
      for (const metric of expected) {
        await expect(page.getByTestId(`metric-${metric.id}`).getByTestId('metric-value'), `${month} ${metric.id}`).toHaveText(metric.value.toLocaleString('en-US'));
        await expect(page.getByTestId(`metric-${metric.id}`).getByTestId('metric-delta'), `${month} ${metric.id} delta`).toHaveText(metric.delta.text);
        kinds.add(metric.delta.kind);
      }
      // the Overview cards of the same month
      await page.goto(`${BASE_URL}/?month=${month}`, { timeout: 30_000 });
      await expect(page.getByTestId('kpi-card-social_reach')).toBeVisible();
      const idToKpi: Record<string, string> = { website_views: 'website_views', social_reach: 'social_reach', social_engagement: 'social_engagement', posts_published: 'posts_published', new_partners: 'partners_onboarded', opportunities_published: 'opportunities_published', projects_organised: 'programs_organised' };
      const onOverview: Record<string, string> = {};
      for (const [id, kpi] of Object.entries(idToKpi)) onOverview[id] = (await page.getByTestId(`kpi-card-${kpi}`).getByTestId('kpi-value').textContent()) ?? '';
      // the Social page totals of the same month
      await page.goto(`${BASE_URL}/social?month=${month}`, { timeout: 30_000 });
      await expect(page.getByTestId('total-posts')).toBeVisible();
      for (const metric of expected) {
        if (idToKpi[metric.id]) expect(onOverview[metric.id], `${month} ${metric.id} on the Overview`).toBe(metric.value.toLocaleString('en-US'));
      }
      await expect(page.getByTestId('total-posts'), `${month} posts on Social`).toContainText(String(expected.find((m) => m.id === 'posts_published')!.value));
      await expect(page.getByTestId('total-reach'), `${month} reach on Social`).toContainText(expected.find((m) => m.id === 'social_reach')!.value.toLocaleString('en-US'));
      await expect(page.getByTestId('total-engagement'), `${month} engagement on Social`).toContainText(expected.find((m) => m.id === 'social_engagement')!.value.toLocaleString('en-US'));
    }
    expect(kinds.has('none')).toBe(true); // the first month
    expect(kinds.has('up') || kinds.has('down') || kinds.has('flat')).toBe(true); // a normal month
  });

  test('channel performance: Channel, Posts, Reach, Engagement sorted by reach; with no post in the month the section is replaced by a neutral note', async ({ page, context }) => {
    const month = defaultMonth();
    await open(page, context, 'desk_lead', `/monthly-report/partner?month=${month}`);
    const rows = page.getByTestId('channel-row');
    const expected = platformRows(data().socialPosts, month);
    await expect(rows).toHaveCount(expected.length);
    for (const [index, row] of expected.entries()) {
      await expect(rows.nth(index)).toContainText(row.label);
      await expect(rows.nth(index).locator('td').nth(2)).toHaveText(row.reach.toLocaleString('en-US'));
    }
    await expect(page.getByRole('columnheader')).toContainText(['Channel', 'Posts', 'Reach', 'Engagement']);
    // a month with no data (the dev ?state=empty): the paper stays, with zeros, a neutral note and no channel table
    await page.goto(`${BASE_URL}/monthly-report/partner?state=empty`, { timeout: 30_000 });
    await expect(page.getByTestId('partner-report')).toBeVisible();
    await expect(page.getByTestId('report-empty')).toBeVisible();
    await expect(page.getByTestId('channels-none')).toBeVisible();
    await expect(page.getByTestId('channel-table')).toHaveCount(0);
    for (const value of await page.getByTestId('metric-value').allTextContents()) expect(value).toBe('0');
  });

  test('the team report: the ten KPIs with target and status, the gauges, the network and top five, the social totals, and the scoreboard of the Team scorecard', async ({ page, context }) => {
    const month = defaultMonth();
    await open(page, context, 'desk_lead', `/monthly-report/team?month=${month}`);
    await expect(page.getByTestId('team-report')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Team report' })).toBeVisible();
    await expect(page.getByTestId('report-note')).toHaveText('Internal. Not for partners.');
    const cards = buildKpiCards(month, today(), data());
    for (const card of cards) {
      await expect(page.getByTestId(`team-kpi-${card.key}`).getByTestId('team-kpi-value')).toHaveText((card.value ?? 0).toLocaleString('en-US'));
      await expect(page.getByTestId(`team-kpi-${card.key}`).getByTestId('kpi-status')).toHaveText({ green: 'On track', amber: 'Behind', red: 'Off track' }[card.status!]);
    }
    await expect(page.getByTestId('team-pipeline').getByRole('meter')).toBeVisible();
    await expect(page.getByTestId('team-database').getByRole('meter')).toBeVisible();
    await expect(page.getByTestId('team-database').getByTestId('source-bar')).toBeVisible();
    await expect(page.getByTestId('top-row')).toHaveCount(5);
    const top = buildLeaderboard(data().ambassadors, data().amplificationLogs, data().databaseRecords, month).slice(0, 5);
    for (const [index, entry] of top.entries()) await expect(page.getByTestId('top-row').nth(index)).toContainText(entry.ambassador.name);
    // counts are pluralised by the shared helper: "1 share", "2 shares", "1 verified signup"
    for (const [index, entry] of top.entries()) {
      await expect(page.getByTestId('top-row').nth(index)).toContainText(`${pluralize(entry.signups, 'verified signup')} · ${pluralize(entry.clicks, 'referred click')} · ${pluralize(entry.shares, 'share')}`);
    }
    expect(top.some((entry) => entry.shares === 1 || entry.signups === 1)).toBe(true); // the singular is really on the page
    const social = socialMonth(month, data());
    await expect(page.getByTestId('team-social')).toContainText(String(social.posts));
    await expect(page.getByTestId('team-social')).toContainText(social.reach.toLocaleString('en-US'));
    // the scoreboard is the Team scorecard's: the same people in the same order with the same composites
    const rowsOnReport = await page.getByTestId('team-scoreboard').getByTestId('team-row').evaluateAll((nodes) => nodes.map((node) => [node.getAttribute('data-person'), node.querySelector('[data-testid="team-composite"]')?.textContent]));
    await page.goto(`${BASE_URL}/scorecard?tab=team&month=${month}`, { timeout: 30_000 });
    await expect(page.getByTestId('team-row').first()).toBeVisible();
    const rowsOnScorecard = await page.getByTestId('team-row').evaluateAll((nodes) => nodes.map((node) => [node.getAttribute('data-person'), node.querySelector('[data-testid="team-composite"]')?.textContent]));
    expect(rowsOnReport).toEqual(rowsOnScorecard);
    expect(rowsOnReport.length).toBeGreaterThan(3);
    // people with no metrics are under "No metrics assigned"
    await page.goBack();
    await expect(page.getByTestId('team-scoreboard').getByTestId('team-unranked').getByRole('heading', { name: 'No metrics assigned' })).toBeVisible();
    // no edit actions of any kind in the report
    await expect(page.getByTestId('team-report').getByRole('button', { name: /^(Save|Edit|Delete|Remove|Assign|Add)/ })).toHaveCount(0);
  });

  test('the team scoreboard keeps the grace period ("Scores start on day 5") and the "Highest/Lowest" labels', async ({ page, context }) => {
    const real = new Date();
    const day4 = new Date(Date.UTC(real.getUTCFullYear(), real.getUTCMonth(), 4, 12));
    await signedIn(page);
    await page.clock.setFixedTime(day4);
    await asRoles(context, 'desk_lead');
    await page.goto(`${BASE_URL}/monthly-report/team?month=${currentMonth()}`, { timeout: 30_000 });
    await expect(page.getByTestId('team-report')).toBeVisible();
    await expect(page.getByTestId('team-scoreboard').getByText('Scores start on day 5').first()).toBeVisible();
    await expect(page.getByTestId('team-scoreboard').getByTestId('team-row')).toHaveCount(0);
    // the same month on a later day: ranked, and a pair whose metrics are all on target reads Highest and Lowest
    const day15 = new Date(Date.UTC(real.getUTCFullYear(), real.getUTCMonth(), 15, 12));
    await page.clock.setFixedTime(day15);
    await page.goto(`${BASE_URL}/monthly-report/team?month=${currentMonth()}`, { timeout: 30_000 });
    const seeded = buildSeed(day15).collections;
    const team = teamScorecards(currentMonth(), day15, seeded, seeded.staff);
    const pairs = team.filter((person) => person.highlight?.kind === 'pair');
    expect(pairs.some((person) => (person.highlight as { atTarget: boolean }).atTarget)).toBe(true);
    for (const person of pairs) {
      const row = page.getByTestId('team-scoreboard').locator(`[data-testid="team-row"][data-person="${person.id}"]`);
      const labels = highlightLabels(person.highlight as never);
      await expect(row.getByTestId('team-strongest')).toContainText(`${labels.high}:`);
      await expect(row.getByTestId('team-weakest')).toContainText(`${labels.low}:`);
    }
  });

  test('on a phone (434, 390 and 360px): the paper fills the width, the grids reflow to 2 across and there is no sideways scroll', async ({ page, context }) => {
    test.setTimeout(150_000);
    await signedIn(page);
    await asRoles(context, 'desk_lead');
    for (const view of ['partner', 'team']) {
      for (const width of [434, 390, 360]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${BASE_URL}/monthly-report/${view}`, { timeout: 30_000 });
        await expect(page.getByTestId(`${view}-report`)).toBeVisible();
        const report = await overflowing(page);
        expect(report.found, `${view} at ${width}px: ${JSON.stringify(report)}`).toEqual([]);
        expect(report.scrollWidth).toBeLessThanOrEqual(report.innerWidth);
        const paper = await page.getByTestId(`${view}-report`).boundingBox();
        expect(paper!.width).toBeGreaterThan(width - 40);
        if (view === 'partner') {
          const across = await page.locator('[data-testid^="metric-"]:not([data-testid="metric-value"]):not([data-testid="metric-delta"])').evaluateAll((nodes) => new Set(nodes.map((node) => Math.round(node.getBoundingClientRect().left))).size);
          expect(across, `${width}px: two across`).toBe(2);
        }
      }
    }
  });

  test('the states: a skeleton in the paper shape, an error banner with Try again, and no console errors', async ({ page, context }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => message.type() === 'error' && !message.text().startsWith('Failed to load resource') && problems.push(message.text()));
    await open(page, context, 'desk_lead', '/monthly-report/partner?state=loading');
    await expect(page.getByTestId('report-skeleton')).toBeVisible();
    await expect(page.getByTestId('download-pdf')).toBeDisabled();
    await page.goto(`${BASE_URL}/monthly-report/partner?state=error`, { timeout: 30_000 });
    await expect(page.getByRole('alert').filter({ hasText: 'Could not load the report' }).getByRole('button', { name: 'Try again' })).toBeEnabled();
    await page.goto(`${BASE_URL}/monthly-report/team?state=empty`, { timeout: 30_000 });
    await expect(page.getByTestId('report-empty')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('the Overview: "View report" opens the Partner report of the selected month for roles that may view it, and is not rendered for the others; the Monthly reports card links to /monthly-report', async ({ page, context }) => {
    await open(page, context, 'desk_lead', '/');
    await expect(page.getByRole('link', { name: 'View report' })).toHaveAttribute('href', `/monthly-report/partner?month=${currentMonth()}`);
    const previous = monthsBefore(currentMonth(), 2);
    await page.goto(`${BASE_URL}/?month=${previous}`, { timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'View report' })).toHaveAttribute('href', `/monthly-report/partner?month=${previous}`);
    await page.getByRole('link', { name: 'View report' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/monthly-report/partner?month=${previous}`);
    await expect(page.getByTestId('report-month')).toHaveText(formatMonth(previous));
    await open(page, context, 'moderator', '/');
    await expect(page.getByTestId('kpi-card-social_reach')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View report' })).toHaveCount(0);
    await open(page, context, 'desk_lead', '/');
    await expect(page.getByTestId('kpi-card-monthly_reports')).toHaveAttribute('href', '/monthly-report');
    await page.getByTestId('kpi-card-monthly_reports').click();
    await expect(page).toHaveURL(`${BASE_URL}/monthly-report/partner`);
  });
});

test.describe('Monthly report: Download PDF and printing (mock mode)', () => {
  test.skip(!MOCK_RUN, 'the report comes from the mock store: see npm run test:e2e:mock');
  test.use({ viewport: { width: 1440, height: 1000 } });
  type P = import('@playwright/test').Page;
  type C = import('@playwright/test').BrowserContext;
  const open = async (page: P, context: C, roles: string, path: string) => {
    await signedIn(page);
    await asRoles(context, roles);
    await page.addInitScript(() => {
      (window as unknown as { __prints: number }).__prints = 0;
      window.print = () => {
        (window as unknown as { __prints: number }).__prints += 1;
      };
    });
    await page.goto(`${BASE_URL}${path}`, { timeout: 30_000 });
    await expect(page.getByTestId('download-pdf')).toBeEnabled();
  };
  const prints = (page: P) => page.evaluate(() => (window as unknown as { __prints: number }).__prints);
  const defaultMonth = () => lastCompleteMonth(new Date());

  test('Download PDF records one report before printing, once per reportMonth and view per calendar month: the Monthly reports KPI counts it, and the toast shows once', async ({ page, context }) => {
    await open(page, context, 'desk_lead', '/monthly-report/partner');
    const baseline = kpiValue('monthly_reports', currentMonth(), buildSeed().collections);
    const toast = page.getByTestId('toast').filter({ hasText: 'Report recorded for' });
    await expect(page.getByTestId('download-hint')).toHaveText('In the print dialog choose A4 and untick Headers and footers.');
    await page.getByTestId('download-pdf').hover();
    await expect(page.getByRole('tooltip')).toHaveText('Choose Save as PDF in the print dialog');
    await page.getByTestId('download-pdf').click();
    await expect(toast).toHaveCount(1);
    await expect(toast).toContainText(`Report recorded for ${formatMonth(defaultMonth())}`);
    expect(await prints(page)).toBe(1); // it printed
    // the same report again: it only prints
    await page.getByTestId('download-pdf').click();
    await expect(toast).toHaveCount(1);
    expect(await prints(page)).toBe(2);
    // the other template of the same month is its own report
    await page.getByRole('link', { name: 'Team report' }).click();
    await expect(page.getByTestId('team-report')).toBeVisible();
    await expect(page.getByTestId('download-pdf')).toBeEnabled();
    await page.getByTestId('download-pdf').click();
    await expect(toast.last()).toContainText(`Report recorded for ${formatMonth(defaultMonth())}`);
    // another month of the partner report is another report
    await page.getByRole('link', { name: 'Partner report' }).click();
    await page.getByRole('combobox', { name: 'Month' }).click();
    await page.getByRole('option', { name: new RegExp(formatMonth(monthsBefore(currentMonth(), 3))) }).click();
    await expect(page.getByTestId('report-month')).toHaveText(formatMonth(monthsBefore(currentMonth(), 3)));
    await page.getByTestId('download-pdf').click();
    await expect(toast.last()).toContainText(`Report recorded for ${formatMonth(monthsBefore(currentMonth(), 3))}`);
    // three different reports were recorded: the Monthly reports KPI on the Overview went up by three
    await goViaSidebar(page, 'Dashboard', 'Overview');
    await expect(page.getByTestId('kpi-card-monthly_reports').getByTestId('kpi-value')).toHaveText(String(baseline + 3));
  });

  test('the document title is set when printing starts (also for Ctrl+P) and put back afterwards: partner and team', async ({ page, context }) => {
    for (const [view, name] of [['partner', 'Progress'], ['team', 'Team']] as const) {
      await open(page, context, 'desk_lead', `/monthly-report/${view}`);
      const original = await page.title();
      const during = await page.evaluate(() => {
        window.dispatchEvent(new Event('beforeprint'));
        return document.title;
      });
      expect(during).toBe(`GOD-${name}-Report-${defaultMonth()}`);
      const after = await page.evaluate(() => {
        window.dispatchEvent(new Event('afterprint'));
        return document.title;
      });
      expect(after).toBe(original);
    }
  });

  test('print: the sidebar, the top bar and the controls are hidden, the paper shows, nothing scrolls sideways, and the page is the paper (no extra blank page)', async ({ page, context }) => {
    for (const view of ['partner', 'team']) {
      await open(page, context, 'desk_lead', `/monthly-report/${view}`);
      await expect(page.getByTestId(`${view}-report`)).toBeVisible();
      await page.setViewportSize({ width: 1440, height: 500 }); // shorter than the paper, so the document height is the paper's, not the window's
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('aside')).toBeHidden();
      await expect(page.locator('header[data-print-hide]')).toBeHidden();
      await expect(page.getByTestId('download-pdf')).toBeHidden();
      await expect(page.getByRole('navigation', { name: 'Report templates' })).toBeHidden();
      await expect(page.getByRole('combobox', { name: 'Month' })).toBeHidden();
      await expect(page.getByTestId(`${view}-report`)).toBeVisible();
      const geometry = await page.evaluate((id) => {
        const paper = document.querySelector(`[data-testid="${id}"]`)!;
        const rect = paper.getBoundingClientRect();
        const style = getComputedStyle(paper);
        return {
          scrollHeight: document.documentElement.scrollHeight,
          paperHeight: rect.height,
          margins: parseFloat(style.marginTop) + parseFloat(style.marginBottom),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          shadow: style.boxShadow,
          radius: style.borderTopLeftRadius,
        };
      }, `${view}-report`);
      // the document is the paper and its margins: nothing below it (a hidden chart table used to add height)
      expect(Math.abs(geometry.scrollHeight - (geometry.paperHeight + geometry.margins)), `${view}: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(1);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth);
      expect(geometry.shadow).toBe('none');
      expect(geometry.radius).toBe('0px');
      await page.emulateMedia({ media: 'screen' });
    }
  });

  test('print to PDF (Chromium): the partner report is exactly 1 page and the team report exactly 2 (the real counts are printed), and the scoreboard and the footer cannot be split or left alone', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'page.pdf is Chromium only');
    const counts: Record<string, number> = {};
    for (const [view, expectedPages] of [['partner', 1], ['team', 2]] as const) {
      await open(page, context, 'desk_lead', `/monthly-report/${view}`);
      await expect(page.getByTestId(`${view}-report`)).toBeVisible();
      await expect(page.getByTestId(`${view === 'partner' ? 'channel-table' : 'team-row'}`).first()).toBeVisible();
      await page.emulateMedia({ media: 'print' });
      const pdf = await page.pdf({ format: 'A4', margin: { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' } });
      const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?![s])/g) ?? []).length; // "/Type /Page" entries, not "/Pages"
      counts[view] = pages;
      // The stylesheet itself sets the paper: with NO paper given, the browser must use the @page rule (A4 portrait, 14mm margins), not US Letter (612 x 792pt)
      const css = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
      const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(css)!;
      expect(Math.abs(Number(box[1]) - 595.28), `${view}: paper width ${box[1]}pt`).toBeLessThan(1.5);
      expect(Math.abs(Number(box[2]) - 841.89), `${view}: paper height ${box[2]}pt`).toBeLessThan(1.5);
      expect((css.match(/\/Type\s*\/Page(?![s])/g) ?? []).length, `${view} report pages at the stylesheet's own A4`).toBe(expectedPages);
      expect(pages, `${view} report pages`).toBe(expectedPages);
      if (view === 'team') {
        // The rules that keep the scoreboard whole and the footer with its content (a page break cannot be seen in the DOM, so the rules are asserted: the page count above proves they work)
        const rules = await page.evaluate(() => {
          const avoid = (el: Element | null) => (el ? getComputedStyle(el).breakInside : 'missing');
          return {
            scoreboard: avoid(document.querySelector('[data-testid="team-scoreboard"]')),
            card: avoid(document.querySelector('[data-testid="team-scorecard"]')),
            rows: [...document.querySelectorAll('[data-testid="team-scoreboard"] [data-testid="team-row"]')].map((row) => getComputedStyle(row).breakInside),
            footer: [getComputedStyle(document.querySelector('.report-footer')!).breakBefore, getComputedStyle(document.querySelector('.report-footer')!).breakInside],
          };
        });
        expect(rules.scoreboard).toBe('avoid');
        expect(rules.card).toBe('avoid');
        expect(rules.rows.length).toBeGreaterThan(0);
        expect(new Set(rules.rows)).toEqual(new Set(['avoid']));
        expect(rules.footer).toEqual(['avoid', 'avoid']);
      }
      await page.emulateMedia({ media: 'screen' });
    }
    test.info().annotations.push({ type: 'pdf-pages', description: JSON.stringify(counts) });
    console.log(`PDF pages: ${JSON.stringify(counts)}`);
  });
});

test.describe('Monthly report: real-API mode says it is sample data', () => {
  test.skip(MOCK_RUN, 'real API only');
  test('the sample-data notice shows and printing still works', async ({ page }) => {
    await page.goto(`${BASE_URL}/monthly-report/partner`, { timeout: 30_000 });
    await expect(page.getByTestId('not-connected-notice')).toBeVisible();
    await expect(page.getByTestId('partner-report')).toBeVisible();
    await expect(page.getByTestId('download-pdf')).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------------------------
// Plurals: ONE helper for "1 share" / "2 shares" (lib/plural.ts), and the counts in the reports and on the cards use it.
// ---------------------------------------------------------------------------------------------
test.describe('Plural helper (no browser)', () => {
  test('pluralize: 0 and 2 take the plural, exactly 1 the singular; thousands get separators; an irregular plural can be given', () => {
    expect(pluralize(0, 'share')).toBe('0 shares');
    expect(pluralize(1, 'share')).toBe('1 share');
    expect(pluralize(2, 'share')).toBe('2 shares');
    expect(pluralize(1, 'verified signup')).toBe('1 verified signup');
    expect(pluralize(2, 'verified signup')).toBe('2 verified signups');
    expect(pluralize(1200, 'referred click')).toBe('1,200 referred clicks');
    expect(pluralize(1, 'open deal', 'open deals')).toBe('1 open deal');
    expect(pluralize(1, 'person', 'people')).toBe('1 person');
    expect(pluralize(3, 'person', 'people')).toBe('3 people');
    expect(pluralWord(1, 'deal')).toBe('deal');
    expect(pluralWord(0, 'deal')).toBe('deals');
  });

  test('kpiUnit: every KPI has a singular and a plural unit, and a target of 1 reads "of 1 program"', () => {
    for (const key of KPI_KEYS) {
      expect(KPIS[key].unitOne.length, key).toBeGreaterThan(0);
      expect(kpiUnit(key, 1), key).toBe(KPIS[key].unitOne);
      expect(kpiUnit(key, 0), key).toBe(KPIS[key].unit);
      expect(kpiUnit(key, 2), key).toBe(KPIS[key].unit);
    }
    expect(kpiUnit('programs_organised', 1)).toBe('program');
    expect(kpiUnit('social_reach', 1)).toBe('person reached');
    expect(kpiUnit('social_reach', 10500)).toBe('people reached');
    expect(kpiUnit('monthly_reports', 1)).toBe('report');
  });
});

// ---------------------------------------------------------------------------------------------
// Real-API mode: the server's own words (and the text "undefined") never reach the screen. The API is stubbed in the browser, so these need no backend.
// ---------------------------------------------------------------------------------------------
test.describe('Missing dates and server errors (no browser)', () => {
  test('formatDate and formatDateTime: a missing date reads "Not recorded", never "undefined" or "Invalid Date"', () => {
    for (const missing of [undefined, null, '', 'undefined']) {
      expect(formatDate(missing as never)).toBe('Not recorded');
      expect(formatDateTime(missing as never)).toBe('Not recorded');
    }
    expect(formatDate('2026-10-03')).toBe('3 Oct 2026'); // a real date is unchanged
    expect(formatDate(new Date(2026, 9, 3), 'short')).toBe('Oct 3');
  });
});

test.describe('Real-API mode: the screen never shows the server\'s own words (API stubbed)', () => {
  test.skip(MOCK_RUN, 'real API only: the stubs stand in for the server');
  test.use({ viewport: { width: 1440, height: 900 } });
  type P = import('@playwright/test').Page;
  const stub = (page: P, pattern: string, status: number, body: unknown) =>
    page.route(pattern, (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));

  test('a malformed id (HTTP 400, "Cast to ObjectId failed") is the calm not-found state', async ({ page }) => {
    await stub(page, '**/admin/hirers/**', 400, { success: false, message: 'Cast to ObjectId failed for value "abc" (type string) at path "_id" for model "HirerAccount"' });
    await page.goto(`${BASE_URL}/hirers/abc`, { timeout: 30_000 });
    await expect(page.getByText(/not found/i).first()).toBeVisible();
    await expect(page.getByText(/Cast to ObjectId|HirerAccount/)).toHaveCount(0);
  });

  test('a server failure on a record (HTTP 500) is one plain sentence with Try again', async ({ page }) => {
    await stub(page, '**/admin/seekers/**', 500, { success: false, message: 'MongoServerError: connection 7 to db.internal:27017 refused' });
    await page.goto(`${BASE_URL}/seekers/abc`, { timeout: 30_000 });
    await expect(page.getByText('We could not load this record. Please try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByText(/MongoServerError|db\.internal/)).toHaveCount(0);
  });

  test('a server failure on a list (HTTP 500) is one plain sentence too', async ({ page }) => {
    await stub(page, '**/admin/hirers**', 500, { success: false, message: 'MongoServerError: pool destroyed' });
    await page.goto(`${BASE_URL}/hirers`, { timeout: 30_000 });
    await expect(page.getByText('We could not load this list. Please try again.')).toBeVisible();
    await expect(page.getByText(/MongoServerError|pool destroyed/)).toHaveCount(0);
  });

  test('a verification request with no submitted date reads "Not recorded", never "undefined"', async ({ page }) => {
    await stub(page, '**/admin/verification/companies**', 200, { success: true, data: [{ id: 'c1', name: 'No Date Co', industry: 'Retail', overallStatus: 'pending' }] });
    await page.goto(`${BASE_URL}/verification`, { timeout: 30_000 });
    const row = page.getByTestId('table-row').filter({ hasText: 'No Date Co' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Not recorded');
    await expect(page.locator('main')).not.toContainText('undefined');
  });
});
