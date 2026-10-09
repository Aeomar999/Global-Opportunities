/**
 * Counts for the sidebar pills and rail dots.
 *
 * - Mock mode: fixed demo values (see mock-mode.ts).
 * - Real mode: the existing GET /dashboard/summary response.
 *
 * A count that is unknown (request failed, field missing) is simply absent
 * from the result, so the UI hides the pill instead of showing 0. The
 * in-flight request is shared, so several callers cause one round trip.
 */
import { getDashboardSummary } from "@/lib/api";
import type { CountKey } from "@/lib/nav";
import { getMockNavCounts } from "./mock-counts";
import { isMockMode } from "./mock-mode";

export type NavCounts = Partial<Record<CountKey, number>>;

const COUNT_KEYS: CountKey[] = ["pendingVerifications", "openReports", "pendingAmbassadorRequests"];

let inflight: Promise<NavCounts> | null = null;

export function getNavCounts(): Promise<NavCounts> {
  if (inflight) return inflight;

  const run: Promise<NavCounts> = isMockMode()
    ? Promise.resolve(getMockNavCounts())
    : getDashboardSummary()
        .then((summary) => {
          const counts: NavCounts = {};
          for (const key of COUNT_KEYS) {
            const value = summary[key];
            if (typeof value === "number") counts[key] = value;
          }
          return counts;
        })
        // Failure means "unknown": no pills, no error (the Overview reports its own errors).
        .catch(() => ({}));

  inflight = run.finally(() => {
    inflight = null;
  });
  return inflight;
}
