import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'test-admin@kredibble.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Password123';
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API_URL = process.env.E2E_API_URL || 'http://localhost:4000/api';

/**
 * Fill the login form and submit it. Text typed before React hydrates never
 * reaches component state, which leaves the submit button disabled on a cold dev
 * server, so the fill is retried until the form reacts.
 */
const signIn = async (page: Page, email: string, password: string) => {
  await page.goto(`${BASE_URL}/login`);
  const submit = page.locator('button[type="submit"]');
  await expect(async () => {
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await expect(submit).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await submit.click();
};

// Each test gets a fresh browser context, so there is no session to clear between tests.
test.describe('Admin Authentication', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('h1')).toContainText('Kredibble Admin');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign in');
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Should redirect to dashboard
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect(page.locator('main')).toBeVisible();
  });

  test('failed login shows error message', async ({ page }) => {
    await signIn(page, 'wrong@email.com', 'wrongpassword');

    // Should show error and stay on login page
    await expect(page.locator('text=Invalid admin credentials').first()).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });

  test('empty form shows validation', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Submit button should be disabled when empty
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    
    // Retried for the same hydration reason as signIn().
    await expect(async () => {
      await page.fill('input[type="password"]', '');
      await page.fill('input[type="email"]', 'test@test.com');
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
      await page.fill('input[type="password"]', 'password');
      await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
  });
});

test.describe('Admin Session Protection', () => {
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
      '/notifications/compose',
      '/notifications/history',
      '/roles',
      '/analytics',
      '/staff',
      '/content/articles',
      '/taxonomy/seeker',
      '/taxonomy/grants',
      '/taxonomy/hirer',
    ];

    for (const route of protectedRoutes) {
      await page.goto(`${BASE_URL}${route}`);
      await expect(page).toHaveURL(`${BASE_URL}/login`);
    }
  });
});

test.describe('Admin Logout', () => {
  test('logout clears session and redirects to login', async ({ page }) => {
    // First login
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // Find and click logout button (typically in sidebar or user menu)
    // The exact selector depends on the UI - looking for a logout button
    const logoutButton = page.locator('button:has-text("Sign out"), button:has-text("Logout"), a:has-text("Sign out"), a:has-text("Logout")');
    
    if (await logoutButton.isVisible({ timeout: 3000 })) {
      await logoutButton.click();
      await expect(page).toHaveURL(`${BASE_URL}/login`);
      
      // Verify session is cleared - accessing dashboard should redirect
      await page.goto(`${BASE_URL}/`);
      await expect(page).toHaveURL(`${BASE_URL}/login`);
    }
  });
});

test.describe('Admin Dashboard Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/`);
  });

  test('dashboard loads with summary data', async ({ page }) => {
    const main = page.locator('main');
    await expect(main.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    // Stat cards render from /dashboard/summary.
    await expect(main.getByText('Pending Verification', { exact: true })).toBeVisible();
  });

  test('navigation sidebar is present', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    // Check for key navigation items
    for (const label of ['Dashboard', 'Seekers', 'Hirers', 'Opportunities Queue']) {
      await expect(sidebar.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
  });
});

test.describe('Admin API Integration', () => {
  test('dashboard summary API returns data for authenticated admin', async ({ request }) => {
    // First get admin cookie by calling login API
    const loginResponse = await request.post(`${API_URL}/auth/admin/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    
    expect(loginResponse.ok()).toBeTruthy();
    const cookies = loginResponse.headers()['set-cookie'];
    expect(cookies).toBeDefined();
    
    // Use cookie to call dashboard summary (now at /admin/dashboard)
    // Playwright expects Cookie header as a single string; join array with semicolon
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;
    const summaryResponse = await request.get(`${API_URL}/admin/dashboard`, {
      headers: { Cookie: cookieHeader },
    });
    
    expect(summaryResponse.ok()).toBeTruthy();
    const data = await summaryResponse.json();
    expect(data.data).toBeDefined();
    expect(data.data.totalUsers).toBeDefined();
    expect(data.data.totalOpportunities).toBeDefined();
  });

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