/**
 * Realistic mock data for the Overview page (used when mock mode is on).
 * Deterministic: no Math.random, so reloads look the same and there is no
 * flicker between server and client renders.
 */
import { formatDate } from "@/lib/format";
import { getMockCounts, getMockQueues } from "./mock-counts";
import { postedOpportunities } from "@/lib/mock-opportunities";
import {
  SERIES_DAYS,
  type KpiKey,
  type KpiValue,
  type OverviewData,
  type OverviewResult,
  type SeriesPoint,
} from "./overview-types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "30 Sep 2026"-style date `n` days before today (matches the Opportunities Queue format). */
const daysAgo = (n: number) => formatDate(new Date(Date.now() - n * DAY_MS));

/** SERIES_DAYS daily submission counts ending today, trending gently upward. */
function mockSubmissions(): SeriesPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: SERIES_DAYS }, (_, i) => {
    const day = new Date(today.getTime() - (SERIES_DAYS - 1 - i) * DAY_MS);
    // trend + weekly rhythm + a little wobble, always a whole number >= 0
    const value = Math.max(0, Math.round(2 + i / 15 + 2 * Math.sin(i / 2.3) + (i % 7 === 0 ? 2 : 0)));
    return { date: day.toISOString(), label: formatDate(day, "short"), value };
  });
}

/** A 12-point monthly series that ends exactly on `end` (earlier points are `end` plus a fixed wobble). */
const seriesEndingAt = (end: number, wobble: number[]) => [...wobble.map((offset) => Math.max(0, end + offset)), end];

/** Absolute change between the last two points, shown as a delta like "-1" or "+2". */
const deltaFrom = (series: number[], goodDirection: "up" | "down", caption: string) => {
  const change = series[series.length - 1] - series[series.length - 2];
  return {
    label: change > 0 ? `+${change}` : change < 0 ? `${change}` : "0",
    direction: change >= 0 ? ("up" as const) : ("down" as const),
    goodDirection,
    caption,
  };
};

export function buildMockOverview(): OverviewData {
  // The two counts that come from the mock LISTS (see mock-counts.ts), with trends ending on them.
  const counts = getMockCounts();
  const pendingSeries = seriesEndingAt(counts.pendingVerifications, [3, 2, 4, 3, 1, 2, 1, 3, 2, 1, 1]);
  const reportsSeries = seriesEndingAt(counts.openReports, [1, 2, 2, 3, 5, 4, 6, 5, 4, 5, 3]);

  return {
    source: "mock",
    kpis: {
      pendingVerifications: {
        value: counts.pendingVerifications,
        series: pendingSeries,
        delta: deltaFrom(pendingSeries, "down", "vs. last month"),
      },
      // Scale placeholders: the only counts that intentionally differ from their lists (mock-counts.ts).
      activeSeekers: {
        value: counts.activeSeekers,
        series: [1020, 1050, 1080, 1110, 1130, 1170, 1190, 1210, 1230, 1250, 1270, 1284],
        delta: { label: "+12%", direction: "up", goodDirection: "up", caption: "vs. last month" },
      },
      activeHirers: {
        value: counts.activeHirers,
        series: [120, 122, 125, 127, 128, 131, 133, 135, 137, 139, 141, 142],
        delta: { label: "+5%", direction: "up", goodDirection: "up", caption: "vs. last month" },
      },
      openReports: {
        value: counts.openReports,
        series: reportsSeries,
        delta: deltaFrom(reportsSeries, "down", "vs. last month"),
      },
    },
    submissions: mockSubmissions(),
    queues: getMockQueues(),
    queuesNote: "Median review time is 1.8 days, down from 2.4 last month.",
    // Same records as the Opportunities Queue mock, so the links resolve to real detail pages.
    // Dates are relative to today (1, 3 and 6 days ago) so the mock never looks stale.
    latestOpportunities: postedOpportunities.slice(0, 3).map((o, i) => ({
      id: o.id,
      title: o.title,
      company: o.company,
      type: o.type,
      status: o.moderationStatus,
      posted: daysAgo([1, 3, 6][i]),
    })),
    activity: [
      { key: "a1", kind: "verification", title: "Verification requested", description: "Acme Capital submitted 4 documents", time: "2h ago" },
      { key: "a2", kind: "opportunity", title: "Opportunity posted", description: "Senior Product Designer · Google LLC", time: "5h ago" },
      { key: "a3", kind: "report", title: "Report resolved", description: "Spam post removed from Career Chat", time: "Yesterday" },
      { key: "a4", kind: "user", title: "New seeker joined", description: "Ama Boateng · University of Ghana", time: "Yesterday" },
    ],
  };
}

/* ------------------------------------------------------------------ dev-only forced states */

/** Values accepted by the ?state= switch (mock mode, never in production). "loading" is handled by the service. */
export const FORCED_STATES = ["loading", "error", "429", "401", "partial", "empty"] as const;
export type ForcedState = (typeof FORCED_STATES)[number];

const KPI_KEYS: KpiKey[] = ["pendingVerifications", "activeSeekers", "activeHirers", "openReports"];
const withKpis = (make: (key: KpiKey) => KpiValue): OverviewData["kpis"] =>
  Object.fromEntries(KPI_KEYS.map((key) => [key, make(key)])) as OverviewData["kpis"];

/** Every section unavailable: what the page gets when the whole request fails. */
const allUnavailable = (): OverviewData => ({
  source: "mock",
  kpis: withKpis(() => ({ value: null })),
  submissions: null,
  queues: null,
  queuesNote: null,
  latestOpportunities: null,
  activity: null,
});

/** Mock data for one of the forced dev states (everything except "loading"). */
export function buildForcedMockOverview(state: ForcedState): OverviewResult {
  switch (state) {
    case "error":
      return { data: allUnavailable(), issue: { kind: "failed", message: "Could not load the overview. (forced: ?state=error)" } };
    case "429":
      return {
        data: allUnavailable(),
        issue: { kind: "rate_limited", message: "Too many requests. Please wait before trying again.", retryAfter: 30 },
      };
    case "401":
      return { data: allUnavailable(), issue: { kind: "unauthorized", message: "Your session has expired." } };
    case "partial": {
      // KPIs, latest opportunities and activity load; the chart and the queues do not.
      const full = buildMockOverview();
      return {
        data: { ...full, submissions: null, queues: null },
        issue: { kind: "partial", message: "Some sections could not be loaded. (forced: ?state=partial)" },
      };
    }
    default: {
      // "empty": the request worked and there is simply nothing yet.
      const quiet = buildMockOverview().submissions!.map((point) => ({ ...point, value: 0 }));
      return {
        data: {
          source: "mock",
          kpis: withKpis(() => ({ value: 0 })),
          submissions: quiet,
          queues: [
            { key: "verification", label: "Verification reviewed", percent: null, caption: "No requests yet" },
            { key: "opportunities", label: "Opportunities moderated", percent: null, caption: "No postings yet" },
            { key: "reports", label: "Reports resolved", percent: null, caption: "No reports yet" },
          ],
          queuesNote: null,
          latestOpportunities: [],
          activity: [],
        },
        issue: null,
      };
    }
  }
}
