/**
 * Scorecard maths: pure functions over the desk's data (no rendering, no network). The Scorecard screen (/scorecard) and its tests use them.
 *
 * - ownedMetrics(roles)           the KPIs the roles own: the union over the roles, no duplicates, in the default KPI order (config/kpis.ts)
 * - metricAttainment(kpi, month)  value divided by the PRO-RATED target for the current month and by the FULL target for a past month.
 *                                 The same definition as the Overview's Priorities panel. Not capped (it can exceed 100%).
 * - composite(roles, month)       the average of min(attainment, 1) over the owned metrics, times 100, rounded to a whole number. Each
 *                                 metric counts at most 100%, so one strong result cannot hide a neglected one. null (never 0) when
 *                                 no metric is owned (or none has a target).
 * - compositeStatus(c, month)     that month's DATED thresholds applied to composite / 100: "green" | "amber" | "red"
 * - strengths(roles, month)       the strongest and the weakest owned metric (ties go to the earlier KPI); with ONE owned metric a single
 *                                 "focus" metric instead of a pair
 * - compositeSeries(roles, n)     the last n months of the composite, each month with its own values, targets and thresholds
 * - teamScorecards(month)         every person in the staff collection, scored, ranked
 *
 * People who share a role share a score: the KPIs are desk-wide counts (how many listings the desk published), not counts of what one
 * person did. Telling two people with the same role apart (individual attribution) needs data the backend does not provide yet.
 *
 * RUNNING TOTALS (Active ambassadors, config/kpis.ts kind "running_total") are judged against the FULL monthly target all month, never pro-rated.
 * TOO EARLY: before SCORE_FROM_DAY (config/scorecard.ts) the composite of the CURRENT month is null ("Too early in the month to score"); a past month is always scored.
 *
 * Targets and thresholds always come from kpiTarget(key, data, month) and kpiThresholds(month, data), so a target changed in Settings, or
 * thresholds that start in a later month, never rewrite a past month. Every function takes an optional `data` (and `today`) so a test can
 * pass its own; the default is the shared mock store and the real clock.
 */
import { KPIS, isRunningTotal, kpisOwnedBy, type KpiKey } from "@/config/kpis";
import { ATTAINMENT_DISPLAY_CAP, SCORE_FROM_DAY } from "@/config/scorecard";
import type { Role } from "@/config/roles";
import {
  currentMonth,
  isPastMonth,
  kpiMonthProgress,
  kpiStatus,
  kpiTarget,
  kpiThresholds,
  kpiValue,
  monthsBefore,
  storeData,
  type KpiData,
  type KpiStatus,
} from "@/lib/kpi";
import type { MonthKey, StaffMember } from "@/lib/mock-entities";
import { getMockCollection } from "@/lib/mock-store";

// ---- one metric ---------------------------------------------------------------------------------------------------------

/** One owned metric in one month: what a row of the scorecard shows. */
export interface MetricResult {
  key: KpiKey;
  label: string;
  unit: string;
  value: number;
  /** The monthly target that applied in the month (0 = none set). */
  target: number;
  /** The share of the target the month has earned so far, 0..1 (1 for a past month). */
  pace: number;
  /** The target earned so far (target x pace, NOT rounded: the screen shows a decimal when it is small): the number the value is compared with. Equal to the target in a past month. */
  proratedTarget: number;
  /** value / pro-rated target, not capped. null when there is no target. */
  attainment: number | null;
  status: KpiStatus | null;
  /** The month is in the past: the full target applies (no pro-rating). */
  isPast: boolean;
  /** false for a running total: judged against the full target all month, so no "pro-rated to N" and no pace tick. */
  prorated: boolean;
}

/** The KPIs the roles own, de-duplicated, in the default KPI order. Desk Lead owns all ten; Moderator, Support, Admin Support and Super Admin own none. */
export const ownedMetrics = (roles: readonly Role[]): KpiKey[] => kpisOwnedBy(roles).map((kpi) => kpi.key);

/** value / pro-rated target (current month) or value / full target (past month). null when the KPI has no target. Not capped. */
export function metricAttainment(key: KpiKey, month: MonthKey, today: Date = new Date(), data: KpiData = storeData()): number | null {
  const target = kpiTarget(key, data, month);
  if (target <= 0) return null;
  const { dayOfMonth, daysInMonth } = kpiMonthProgress(key, month, today);
  return kpiValue(key, month, data) / (target * (dayOfMonth / daysInMonth));
}

/** The full result of one metric in one month (value, target, pro-rated target, attainment and status). */
export function metricResult(key: KpiKey, month: MonthKey, today: Date = new Date(), data: KpiData = storeData()): MetricResult {
  const { dayOfMonth, daysInMonth } = kpiMonthProgress(key, month, today);
  const value = kpiValue(key, month, data);
  const target = kpiTarget(key, data, month);
  const pace = dayOfMonth / daysInMonth;
  return {
    key,
    label: KPIS[key].label,
    unit: KPIS[key].unit,
    value,
    target,
    pace,
    proratedTarget: target * pace,
    attainment: metricAttainment(key, month, today, data),
    status: target > 0 ? kpiStatus(value, target, dayOfMonth, daysInMonth, kpiThresholds(month, data), month) : null,
    isPast: isPastMonth(month, today),
    prorated: !isRunningTotal(key),
  };
}

/** The rows for the metrics the roles own, in the default KPI order. */
export const metricRows = (roles: readonly Role[], month: MonthKey, today: Date = new Date(), data: KpiData = storeData()): MetricResult[] =>
  ownedMetrics(roles).map((key) => metricResult(key, month, today, data));

// ---- the composite ------------------------------------------------------------------------------------------------------

/**
 * True in the first days of the CURRENT month (before SCORE_FROM_DAY, UTC): too early for a fair composite. A past month is complete, so it is
 * never too early.
 */
export const isTooEarly = (month: MonthKey, today: Date = new Date()): boolean => !isPastMonth(month, today) && today.getUTCDate() < SCORE_FROM_DAY;

/**
 * The composite score: the average of min(attainment, 1) over the owned metrics that have a target, times 100, as a whole number.
 * Each metric counts at most 100%. null (never 0) when there is nothing to average.
 */
export function composite(roles: readonly Role[], month: MonthKey, today: Date = new Date(), data: KpiData = storeData()): number | null {
  if (isTooEarly(month, today)) return null;
  const capped = ownedMetrics(roles)
    .map((key) => metricAttainment(key, month, today, data))
    .filter((value): value is number => value !== null)
    .map((value) => Math.min(value, 1));
  if (capped.length === 0) return null;
  return Math.round((capped.reduce((sum, value) => sum + value, 0) / capped.length) * 100);
}

/** The month's dated thresholds applied to composite / 100. null when there is no composite. */
export function compositeStatus(score: number | null, month: MonthKey, data: Pick<KpiData, "thresholdHistory"> = storeData()): KpiStatus | null {
  if (score === null) return null;
  const limits = kpiThresholds(month, data);
  const ratio = score / 100;
  return ratio >= limits.green ? "green" : ratio >= limits.amber ? "amber" : "red";
}

// ---- strongest and weakest ----------------------------------------------------------------------------------------------

/**
 * `atTarget` on a pair: EVERY owned metric is at or above target (attainment of 100% or more), so nothing is weak. The pair is then labelled "Highest" and "Lowest"
 * instead of "Strongest" and "Weakest" (see highlightLabels).
 */
export type Highlight = { kind: "pair"; strongest: MetricResult; weakest: MetricResult; atTarget: boolean } | { kind: "focus"; focus: MetricResult };

/** The words for the pair: "Strongest" and "Weakest", or "Highest" and "Lowest" when every owned metric is at or above target. */
export const highlightLabels = (highlight: Extract<Highlight, { kind: "pair" }>): { high: string; low: string } => (highlight.atTarget ? { high: "Highest", low: "Lowest" } : { high: "Strongest", low: "Weakest" });

/**
 * The strongest (highest attainment) and the weakest (lowest) of the owned metrics that have a target; a tie goes to the earlier KPI. With
 * exactly one such metric: one "focus" metric. null when there is none.
 */
export function strengths(roles: readonly Role[], month: MonthKey, today: Date = new Date(), data: KpiData = storeData()): Highlight | null {
  return highlightOf(metricRows(roles, month, today, data));
}

/** The same rule over rows that are already worked out (rows are in KPI order, so the first of a tie wins). */
export function highlightOf(rows: readonly MetricResult[]): Highlight | null {
  const scored = rows.filter((row) => row.attainment !== null);
  if (scored.length === 0) return null;
  if (scored.length === 1) return { kind: "focus", focus: scored[0] };
  let strongest = scored[0];
  let weakest = scored[0];
  for (const row of scored) {
    if (row.attainment! > strongest.attainment!) strongest = row;
    if (row.attainment! < weakest.attainment!) weakest = row;
  }
  return { kind: "pair", strongest, weakest, atTarget: scored.every((row) => row.attainment! >= 1) };
}

// ---- the trend ----------------------------------------------------------------------------------------------------------

export interface CompositePoint {
  month: MonthKey;
  /** "Oct" */
  label: string;
  /** "October 2026" (the tooltip and the hidden table) */
  tooltipLabel: string;
  score: number | null;
  status: KpiStatus | null;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (month: MonthKey) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** The last `months` months of the composite, oldest first, ending with the month of `today`. Each month uses ITS targets and thresholds. */
export function compositeSeries(roles: readonly Role[], months = 6, today: Date = new Date(), data: KpiData = storeData()): CompositePoint[] {
  const now = currentMonth(today);
  return Array.from({ length: months }, (_, i) => {
    const month = monthsBefore(now, months - 1 - i);
    const score = composite(roles, month, today, data);
    return { month, label: monthName(month).slice(0, 3), tooltipLabel: monthName(month), score, status: compositeStatus(score, month, data) };
  });
}

// ---- the team -----------------------------------------------------------------------------------------------------------

/** One person on the scorecard: who they are and how the roles they hold are doing in the month. */
export interface ScorecardPerson {
  id: string;
  name: string;
  roles: Role[];
  composite: number | null;
  status: KpiStatus | null;
  highlight: Highlight | null;
  metrics: MetricResult[];
  /** The person owns metrics but the month is too young to score them (composite is null for that reason only). */
  tooEarly: boolean;
}

/** One person's scorecard for a month. */
export function scorecardFor(person: { id: string; name: string; roles: Role[] }, month: MonthKey, today: Date = new Date(), data: KpiData = storeData()): ScorecardPerson {
  const metrics = metricRows(person.roles, month, today, data);
  const score = composite(person.roles, month, today, data);
  return { id: person.id, name: person.name, roles: [...person.roles], composite: score, status: compositeStatus(score, month, data), highlight: highlightOf(metrics), metrics, tooEarly: metrics.length > 0 && isTooEarly(month, today) };
}

/**
 * Every person in the staff collection, scored, ranked by composite (highest first). People with no composite (they own no metric) come
 * last, in alphabetical order; a tie between two scores is broken alphabetically too, so the order never jumps.
 */
export function teamScorecards(month: MonthKey, today: Date = new Date(), data: KpiData = storeData(), staff: StaffMember[] = getMockCollection("staff")): ScorecardPerson[] {
  return staff
    .map((person) => scorecardFor(person, month, today, data))
    .sort((a, b) => {
      if (a.composite === null && b.composite === null) return a.name.localeCompare(b.name);
      if (a.composite === null) return 1;
      if (b.composite === null) return -1;
      return b.composite - a.composite || a.name.localeCompare(b.name);
    });
}

/** The team in numbers: people scored, the average composite (null with nobody scored) and how many are below the amber threshold. */
export function teamSummary(people: readonly ScorecardPerson[]): { scored: number; average: number | null; belowAmber: number } {
  const scored = people.filter((person) => person.composite !== null);
  return {
    scored: scored.length,
    average: scored.length === 0 ? null : Math.round(scored.reduce((sum, person) => sum + person.composite!, 0) / scored.length),
    belowAmber: scored.filter((person) => person.status === "red").length,
  };
}

// ---- showing a large attainment ------------------------------------------------------------------------------------------

/** How an attainment is SHOWN: the text, the exact figure and whether the text is a cap. */
export interface AttainmentText {
  /** What the screen prints: "118%", or "300%+" above 300%. */
  text: string;
  /** The exact figure ("527%"): the Tooltip and the aria-label of a capped figure; equal to `text` otherwise. */
  exact: string;
  /** The figure is above the display cap (ATTAINMENT_DISPLAY_CAP, 300%): the text reads "300%+". */
  capped: boolean;
}

/**
 * Attainment as text. Up to 300% the whole number ("118%"); above it "300%+" with the exact figure kept in `exact` (the Tooltip and the aria-label).
 * Only the display is capped: the value is not, and the composite counts each metric at 100% at most. null is "—", never 0%.
 */
export function formatAttainment(value: number | null): AttainmentText {
  if (value === null) return { text: "—", exact: "—", capped: false };
  const percent = Math.round(value * 100);
  const exact = `${percent.toLocaleString("en-US")}%`;
  if (percent > ATTAINMENT_DISPLAY_CAP * 100) return { text: `${(ATTAINMENT_DISPLAY_CAP * 100).toLocaleString("en-US")}%+`, exact, capped: true };
  return { text: exact, exact, capped: false };
}
