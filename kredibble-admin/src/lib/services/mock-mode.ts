/**
 * Mock-mode switch for the data services.
 *
 * NEXT_PUBLIC_USE_MOCKS=true   -> services return mock data
 * NEXT_PUBLIC_USE_MOCKS=false  -> services call the real API
 * unset                        -> mock data in development, real API otherwise
 *
 * (`process.env.NEXT_PUBLIC_*` must be written literally so Next can inline it.)
 */
export const isMockMode = (): boolean => {
  const flag = process.env.NEXT_PUBLIC_USE_MOCKS;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "development";
};

/** Unread notification count shown as a dot on the bell. Mock mode only: the API has no such endpoint. */
export const MOCK_UNREAD_COUNT = 3;

// The sidebar / breadcrumb / KPI counts live in ./mock-counts (derived from the mock lists).

export const getUnreadCount = (): number | null => (isMockMode() ? MOCK_UNREAD_COUNT : null);
