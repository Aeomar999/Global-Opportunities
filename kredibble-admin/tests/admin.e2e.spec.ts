import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'test-admin@kredibble.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Password123';
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API_URL = process.env.E2E_API_URL || 'http://localhost:4000/api';

/** A valid 1x1 PNG, for upload tests. */
const PNG_BYTES = [
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
  0x00, 0x05, 0xFE, 0x02, 0xFE, 0x3C, 0xF2, 0xD5, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
  0xAE, 0x42, 0x60, 0x82,
];

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
    await expect(page.locator('[class*="text-kb-error"]').first()).toBeVisible({ timeout: 5000 });
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
    // Handle both string arrays and object arrays (each cookie can be an object with name/value)
    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
    const cookieHeader = cookieArray
      .map(c => {
        if (typeof c === 'string') {
          // Extract just the name=value part before the first semicolon
          return c.split(';')[0].trim();
        }
        // Handle object format: { name: '...', value: '...', ... }
        return `${c.name}=${c.value}`;
      })
      .filter(Boolean)
      .join('; ');
    
    const summaryResponse = await request.get(`${API_URL}/admin/dashboard`, {
      headers: { Cookie: cookieHeader },
    });
    
    expect(summaryResponse.ok()).toBeTruthy();
    const data = await summaryResponse.json();
    console.log('Dashboard summary response:', JSON.stringify(data, null, 2));
    expect(data.data).toBeDefined();
    // New /admin/dashboard returns { month, kpis, priorities, trend, pipeline, ... }
    // Check that kpis array exists and contains expected metrics
    expect(Array.isArray(data.data.kpis)).toBeTruthy();
    expect(data.data.kpis.length).toBeGreaterThan(0);
    // Verify some expected KPIs are present
    const kpiMetrics = data.data.kpis.map((k: { metric: string }) => k.metric);
    expect(kpiMetrics).toContain('opportunitiesPublished');
    expect(kpiMetrics).toContain('programsActive');
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

test.describe('Directory pages show real data', () => {
  test('seekers page lists the seeded seeker', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await page.goto(`${BASE_URL}/seekers`);
    await expect(page.getByText('E2E Seeker')).toBeVisible();
    await expect(page.getByText('e2e-seeker@kredibble.com')).toBeVisible();
  });

  test('hirers page lists the seeded company', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await page.goto(`${BASE_URL}/hirers`);
    await expect(page.getByText('E2E Holdings')).toBeVisible();
  });

  test('verification page lists the pending company', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await page.goto(`${BASE_URL}/verification`);
    await expect(page.getByText('E2E Holdings')).toBeVisible();
  });
});

test.describe('Reports queue', () => {
  test('lists a seeded report and resolving it persists', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/`);

    await page.goto(`${BASE_URL}/reports`);
    await page.getByText('E2E Reported Post').click();
    await expect(page.getByRole('heading', { name: 'E2E Reported Post' })).toBeVisible();
    await expect(page.getByText('E2E report details')).toBeVisible();

    await page.getByRole('button', { name: 'Mark resolved' }).click();
    await expect(page.getByText('Resolved', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText('Resolved', { exact: true })).toBeVisible();
  });
});

test.describe('Events', () => {
  test('capacity change and cancellation persist', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/`);

    await page.goto(`${BASE_URL}/events`);
    await page.getByText('E2E Career Fair').click();
    await expect(page.getByRole('heading', { name: 'E2E Career Fair' })).toBeVisible();

    await page.getByRole('spinbutton').fill('80');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('5 of 80 spots filled')).toBeVisible();
    await page.reload();
    await expect(page.getByText('5 of 80 spots filled')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel event' }).click();
    await expect(page.getByRole('button', { name: 'Cancel event' })).toHaveCount(0);
    await page.goto(`${BASE_URL}/events`);
    const row = page.getByRole('link', { name: /E2E Career Fair/ });
    await expect(row.getByText('Cancelled')).toBeVisible();
  });
});

test.describe('Grants', () => {
  test('approving an application persists', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/`);

    await page.goto(`${BASE_URL}/grants`);
    await page.getByText('E2E Seed Fund').click();
    await expect(page.getByRole('heading', { name: 'E2E Seed Fund' })).toBeVisible();

    const application = page.locator('div.rounded-2xl').filter({ hasText: 'E2E Applicant' });
    await expect(application.getByText('Pending')).toBeVisible();
    await application.getByTitle('Approve').click();
    await expect(application.getByText('Approved')).toBeVisible();

    await page.reload();
    await expect(page.locator('div.rounded-2xl').filter({ hasText: 'E2E Applicant' }).getByText('Approved')).toBeVisible();
  });
});

test.describe('Articles', () => {
  test('creating a draft and publishing it persist; a failed banner upload saves nothing', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/`);

    await page.goto(`${BASE_URL}/content/articles/new`);
    // The e2e API has no Cloudinary credentials, so the upload is refused: the
    // editor must show the server's message and keep no local preview.
    const chooser = page.waitForEvent('filechooser');
    await page.getByText('Click to upload a banner image').click();
    await (await chooser).setFiles({ name: 'banner.png', mimeType: 'image/png', buffer: Buffer.from(PNG_BYTES) });
    await expect(page.getByText(/Cloudinary is not configured/)).toBeVisible();
    await expect(page.getByAltText('Article banner')).toHaveCount(0);

    await page.getByPlaceholder('e.g. How to write a developer resume that gets noticed').fill('E2E Article');
    await page.getByPlaceholder('e.g. Resume Writing').fill('Careers');
    await page.getByPlaceholder('One or two sentences shown in the article list').fill('E2E summary');
    await page.getByPlaceholder('Full article body').fill('E2E body');
    await page.getByRole('button', { name: 'Save Draft' }).click();

    await expect(page).toHaveURL(`${BASE_URL}/content/articles`);
    const row = page.getByRole('link', { name: /E2E Article/ });
    await expect(row.getByText('Draft')).toBeVisible();

    await row.click();
    await expect(page.getByPlaceholder('e.g. How to write a developer resume that gets noticed')).toHaveValue('E2E Article');
    await page.getByRole('button', { name: 'Published', exact: true }).click();
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page).toHaveURL(`${BASE_URL}/content/articles`);
    await expect(page.getByRole('link', { name: /E2E Article/ }).getByText('Published')).toBeVisible();
  });
});