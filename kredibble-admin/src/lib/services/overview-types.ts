/**
 * Shapes returned by the Overview service (see overview.ts). Kept in their own
 * file so the real and mock builders can both import them without a cycle.
 */
/** 60 days = the longest tab (30) plus an equally long previous period for the delta. */
export const SERIES_DAYS = 60;

export type KpiKey = "pendingVerifications" | "activeSeekers" | "activeHirers" | "openReports";

export interface KpiValue {
  /** null = unknown (request failed); the UI renders "—", never 0. */
  value: number | null;
  /** Only present when the data source provides a series (mock mode). */
  series?: number[];
  /** Only present when the data source provides a comparison, e.g. "+8%". */
  delta?: {
    label: string;
    /** The real direction of the change (drives the arrow). */
    direction: "up" | "down";
    /** Which direction is an improvement for this metric (drives the colour). */
    goodDirection: "up" | "down";
    caption?: string;
  };
}

export interface SeriesPoint {
  /** ISO date of the day this point covers (formatted by lib/format.ts where shown). */
  date: string;
  /** Short axis label, e.g. "Sep 18". */
  label: string;
  value: number;
}

export interface QueueProgress {
  key: string;
  label: string;
  /** 0-100, or null when the queue is empty / unknown. */
  percent: number | null;
  caption: string;
}

export interface LatestOpportunity {
  id: string;
  title: string;
  company: string;
  type: string;
  status: string;
  posted: string;
}

export interface ActivityEntry {
  key: string;
  kind: "verification" | "opportunity" | "report" | "user";
  title: string;
  description: string;
  time: string;
}

export interface OverviewData {
  source: "mock" | "api";
  kpis: Record<KpiKey, KpiValue>;
  /** Oldest first, SERIES_DAYS points ending today. null = unavailable. */
  submissions: SeriesPoint[] | null;
  queues: QueueProgress[] | null;
  /** One-line summary shown under the queues (mock mode only: the real API has no such figure, so it is null). */
  queuesNote: string | null;
  latestOpportunities: LatestOpportunity[] | null;
  activity: ActivityEntry[] | null;
}

export type OverviewIssueKind = "unauthorized" | "rate_limited" | "failed" | "partial";

export interface OverviewIssue {
  kind: OverviewIssueKind;
  message: string;
  /** Seconds to wait before retrying (429 only; from Retry-After, else 30). */
  retryAfter?: number;
}

export interface OverviewResult {
  data: OverviewData;
  issue: OverviewIssue | null;
}
