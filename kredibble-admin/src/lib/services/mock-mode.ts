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
/** The browser-side choice made with the "Mock data" switch in the top bar (see MockDataToggle). */
const OVERRIDE_KEY = "kredibble-admin-mock-data";

const envDefault = (): boolean => process.env.NEXT_PUBLIC_USE_MOCKS === "true";

/**
 * True when pages should show mock data. The switch in the top bar wins over NEXT_PUBLIC_USE_MOCKS: it is stored in this
 * browser (localStorage) and read on the client only. The dashboard shell renders its pages after it has mounted, so
 * reading it during render does not cause a hydration mismatch.
 */
export const isMockMode = (): boolean => {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(OVERRIDE_KEY);
      if (stored === "on") return true;
      if (stored === "off") return false;
    } catch {
      // Storage can be blocked (private window): fall back to the environment setting.
    }
  }
  return envDefault();
};

/** Saves the switch and reloads, so every page and the sidebar counts load their data again in the new mode. */
export const setMockMode = (on: boolean): void => {
  try {
    window.localStorage.setItem(OVERRIDE_KEY, on ? "on" : "off");
  } catch {
    // Without storage the switch cannot be remembered; the page still reloads with the environment setting.
  }
  window.location.reload();
};

/** Unread notification count shown as a dot on the bell. Mock mode only: the API has no such endpoint. */
export const MOCK_UNREAD_COUNT = 3;

// The sidebar / breadcrumb / KPI counts live in ./mock-counts (derived from the mock lists).

export const getUnreadCount = (): number | null => (isMockMode() ? MOCK_UNREAD_COUNT : null);
