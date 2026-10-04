/**
 * Mock-mode switch for the data services.
 *
 * NEXT_PUBLIC_USE_MOCKS=true   -> services return mock data (opt-in, for designing and reviewing layouts)
 * anything else, or unset      -> services call the real API
 *
 * Mock data is opt-in on purpose (SEC-077): a forgotten setting must never ship sample data as if it were real.
 *
 * (`process.env.NEXT_PUBLIC_*` must be written literally so Next can inline it.)
 */
export const isMockMode = (): boolean => process.env.NEXT_PUBLIC_USE_MOCKS === "true";

/** Unread notification count shown as a dot on the bell. Mock mode only: the API has no such endpoint. */
export const MOCK_UNREAD_COUNT = 3;

// The sidebar / breadcrumb / KPI counts live in ./mock-counts (derived from the mock lists).

export const getUnreadCount = (): number | null => (isMockMode() ? MOCK_UNREAD_COUNT : null);
