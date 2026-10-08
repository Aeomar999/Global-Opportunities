/**
 * Shapes returned by the Overview service (see dashboard.ts). Kept in their own file so the mock and real builders can both import
 * them without a cycle.
 */
import type { KpiKey } from "@/config/kpis";
import type { KpiStatus } from "@/lib/kpi";
import type { MonthKey, ProgramType } from "@/lib/mock-entities";

export type { KpiKey };

/** One of the ten KPI cards. `null` = unknown (the request failed): the card shows "—", never 0. */
export interface KpiCardData {
  key: KpiKey;
  value: number | null;
  /** The monthly target that applied in the month shown (0 = none set). */
  target: number | null;
  status: KpiStatus | null;
  /** How far into the month we are, 0..1: the share of the target the month has earned so far (1 for a past month and for a running total). */
  pace: number | null;
  /** false for a running total (judged against the full target): the bar has no pace tick. Missing means true. */
  prorated?: boolean;
  /** value / target, not capped (1.2 = 120%). null when there is no target or no value. */
  attainment: number | null;
}

/** One point of the six-month trend of a KPI. */
export interface TrendPoint {
  month: MonthKey;
  /** "Oct" */
  label: string;
  /** "October 2026" */
  tooltipLabel: string;
  value: number;
}

export interface UpcomingProgram {
  id: string;
  title: string;
  type: ProgramType;
  /** The start day or date-time as stored. */
  startAt: string;
  participants: number;
  target: number;
  partner: string | null;
  status: "planned" | "running";
}

export type FeedKind = "ambassador" | "partner" | "listing" | "program" | "record" | "testimonial";

export interface FeedItem {
  key: string;
  kind: FeedKind;
  title: string;
  description: string;
  /** The day it happened ("2026-10-05"): the feed is sorted on it, newest first. */
  at: string;
  /** Formatted for display. */
  time: string;
}

/** The four queues that wait on a person. `null` = unknown (shown as "—"). */
export interface AttentionCounts {
  pendingVerifications: number | null;
  openReports: number | null;
  pendingTestimonials: number | null;
  draftListings: number | null;
}

export interface OverviewData {
  source: "mock" | "api";
  month: MonthKey;
  /**
   * Real-API mode: the monthly figures (the ten cards, the trend, the programs, the feed) have no live source yet. This is NOT an error:
   * the page says "Not available yet". Only the queue counts are live.
   */
  notConnected: boolean;
  /** The month is in the past: the cards show what was reached against the target that applied then. */
  isPast: boolean;
  /** The ten cards in KPI order, or null when they could not be loaded. */
  kpis: KpiCardData[] | null;
  /** The last six months of every KPI, oldest first, ending with `month`. null = unavailable. */
  trend: Record<KpiKey, TrendPoint[]> | null;
  /** The next five planned or running programs. null = unavailable. */
  programs: UpcomingProgram[] | null;
  /** Newest first. null = unavailable. */
  activity: FeedItem[] | null;
  attention: AttentionCounts | null;
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
