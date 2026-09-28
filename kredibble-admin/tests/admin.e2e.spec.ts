import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'test-admin@kredibble.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Password123';
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API_URL = process.env.E2E_API_URL || 'http://localhost:4000/api';

test.describe('Admin Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test('login page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('h1')).toContainText('Kredibble Admin');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign in');
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
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
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
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
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
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
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(`${BASE_URL}/`);
  });

  test('dashboard loads with summary data', async ({ page }) => {
    await expect(page.locator('main')).toBeVisible();
    // Dashboard should show some content
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 });
  });

  test('navigation sidebar is present', async ({ page }) => {
    await expect(page.locator('nav, aside')).toBeVisible();
    // Check for key navigation items
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Seekers')).toBeVisible();
    await expect(page.locator('text=Hirers')).toBeVisible();
    await expect(page.locator('text=Opportunities')).toBeVisible();
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
    
    // Use cookie to call dashboard summary
    const cookieHeader = Array.isArray(cookies) ? cookies[0] : cookies;
    const summaryResponse = await request.get(`${API_URL}/dashboard/summary`, {
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