/**
 * Which Playwright run this is.
 *
 * - `npm run test:e2e`       (default): the admin dev server talks to the real API (the in-memory e2e API),
 *   on port 3000. This is what ships.
 * - `npm run test:e2e:mock`  (E2E_MOCKS=1): the dev server runs with NEXT_PUBLIC_USE_MOCKS=true on port 3100,
 *   for the checks that need the mock records, the mock store or the dev-only ?state= switch.
 *
 * The two runs use different ports and saved sessions, so a reused server or session never crosses modes.
 */
export const MOCK_RUN = process.env.E2E_MOCKS === '1';

/** The admin dev server's port for this run. */
export const ADMIN_PORT = MOCK_RUN ? 3100 : 3000;

/** The admin base URL, unless E2E_BASE_URL points the suite at a deployed environment. */
export const defaultBaseUrl = () => process.env.E2E_BASE_URL || `http://localhost:${ADMIN_PORT}`;

/** Where the global setup saves the signed-in session for this run. */
export const AUTH_FILE = MOCK_RUN ? 'playwright/.auth/admin-mock.json' : 'playwright/.auth/admin.json';
