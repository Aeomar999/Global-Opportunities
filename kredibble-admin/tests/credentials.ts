/**
 * The admin test account, read from the environment.
 *
 * playwright.config.ts loads E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD from .env.test.local (gitignored).
 * There are NO fallback values: if either is missing this throws a message that names the variables
 * and never contains their values. Never log, print or write the password anywhere.
 */
export function getAdminCredentials(): { email: string; password: string } {
  const email = process.env.E2E_ADMIN_EMAIL?.trim();
  const password = process.env.E2E_ADMIN_PASSWORD;
  const missing = [!email && 'E2E_ADMIN_EMAIL', !password && 'E2E_ADMIN_PASSWORD'].filter(Boolean);
  if (missing.length > 0 || !email || !password) {
    throw new Error(
      `Missing ${missing.join(' and ')}. Set it in .env.test.local in the project root ` +
        '(gitignored), or in the shell, before running the Playwright suite.',
    );
  }
  return { email, password };
}
