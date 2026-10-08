/**
 * Monthly report maths (/monthly-report): pure functions over the desk's data. Nothing here renders or loads anything, and nothing is calculated a second
 * way: every figure comes from the functions the other screens use (kpiValue, kpiTarget and the dated thresholds, newInMonth, pipelineHealth, recordsPace,
 * the leaderboard ranking, the scorecard composite), so a report always agrees with the Overview, the lists and Social for the same month.
 *
 * Two reports, two audiences:
 * - PARTNER report: aggregate only (ten headline figures with their change, the website audience, the channels). No person appears in it.
 * - TEAM report (internal): the ten KPIs against their targets, pipeline health, database pace, records by source, the network, the top five ambassadors,
 *   social totals and the team scoreboard of the Scorecard.
 *
 * Months: the report is for the LAST COMPLETE month by default. The current month can be chosen ("Month to date"): its figures are compared with the previous
 * month pro-rated to the same day, and that is said ("vs. the same period last month, estimated"). A past month is a read-only snapshot.
 *
 * Known limit: the desk keeps no history of partner stages or record counts, so the pipeline gauge counts partners as they are NOW and the records-by-source bar
 * counts the records verified in the month. Everything else is dated.
 */
import type { KpiKey } from "@/config/kpis";
import { daysInMonth, isPastMonth, kpiTarget, kpiValue, monthsBefore, storeData, currentMonth, type KpiData, newInMonth } from "@/lib/kpi";
import type { AmplificationLog, MonthKey, StaffMember } from "@/lib/mock-entities";
import { pipelineHealth, type PipelineHealth } from "@/lib/pipeline-health";
import { isTooEarly, teamScorecards, type ScorecardPerson } from "@/lib/scorecard";
import { buildKpiCards } from "@/lib/services/dashboard";
import type { KpiCardData } from "@/lib/services/dashboard-types";
import { recordsPace, sourceBreakdown, type RecordsPace, type SourceCount } from "@/lib/services/database";
import { buildLeaderboard, networkSummary, type LeaderboardRow, type NetworkSummaryData } from "@/lib/services/network";
import { flattenMoves } from "@/lib/services/partners";
import { socialMonth, type SocialMonth } from "@/lib/services/social";
import { getMockCollection } from "@/lib/mock-store";
import { SERIES_MONTHS } from "@/lib/mock-seed";
import { formatMonth } from "@/lib/format";

export type ReportView = "partner" | "team";

/** The data a report is built from: the KPI collections plus the people and the shares. `data` is for tests; the default is the shared store. */
export type ReportData = KpiData & { amplificationLogs: AmplificationLog[]; staff: StaffMember[] };

export const storeReportData = (): ReportData => ({ ...storeData(), amplificationLogs: getMockCollection("amplificationLogs"), staff: getMockCollection("staff") });

// ---- months ------------------------------------------------------------------------------------------------------------

/** The default month of the report: the last complete month. */
export const lastCompleteMonth = (today: Date = new Date()): MonthKey => monthsBefore(currentMonth(today), 1);

/** The current month: its figures are month to date. */
export const isMonthToDate = (month: MonthKey, today: Date = new Date()): boolean => month === currentMonth(today);

/** The first month the desk has figures for (the oldest of the selectable months). Nothing before it can be compared with. */
export const earliestMonth = (today: Date = new Date()): MonthKey => monthsBefore(currentMonth(today), SERIES_MONTHS - 1);

/** The day to read "as of" for a month: today for the current month, the last day for a past one (so a past month is read in full). */
export function reportToday(month: MonthKey, today: Date = new Date()): Date {
  if (!isPastMonth(month, today)) return today;
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1, daysInMonth(month), 12));
}

/** The document title while printing: "GOD-Progress-Report-2026-09" (partner) or "GOD-Team-Report-2026-09" (team). */
export const reportTitle = (view: ReportView, month: MonthKey): string => `GOD-${view === "partner" ? "Progress" : "Team"}-Report-${month}`;

// ---- the change since the previous month ---------------------------------------------------------------------------------

export interface Delta {
  /** up / down / flat: a percentage; "na": the previous value was 0; "none": there is no previous month to compare with. */
  kind: "up" | "down" | "flat" | "na" | "none";
  /** The words: "+12% vs August 2026", "n/a" or "—". */
  text: string;
  /** The rounded percentage, or null for "na" and "none". */
  percent: number | null;
}

/**
 * The change of a figure against the previous month. `previous` is null when there is no previous month (the first month the desk has figures for): "—".
 * A previous value of 0 gives "n/a" (a percentage of nothing is not a number). Otherwise "+12% vs August 2026", "-8% vs August 2026" or "0% vs August 2026".
 * For the current month, `previous` is the previous month pro-rated to the same day and `against` says so.
 */
export function metricDelta(value: number, previous: number | null, against: string): Delta {
  if (previous === null) return { kind: "none", text: "—", percent: null };
  if (previous === 0) return { kind: "na", text: "n/a", percent: null };
  const percent = Math.round(((value - previous) / previous) * 100);
  const sign = percent > 0 ? "+" : "";
  return { kind: percent > 0 ? "up" : percent < 0 ? "down" : "flat", text: `${sign}${percent}% vs ${against}`, percent };
}

// ---- the ten figures of the partner report ----------------------------------------------------------------------------------

export type PartnerMetricId = "website_views" | "daily_first_visits" | "daily_visitors" | "social_reach" | "social_engagement" | "posts_published" | "new_ambassadors" | "new_partners" | "opportunities_published" | "projects_organised";

export interface PartnerMetric {
  id: PartnerMetricId;
  label: string;
  value: number;
  /** The previous month's value (pro-rated to the same day for the current month); null when there is no previous month. */
  previous: number | null;
  delta: Delta;
  description: string;
}

const METRICS: { id: PartnerMetricId; label: string; description: string }[] = [
  { id: "website_views", label: "Website views", description: "Pages opened across the Desk website" },
  { id: "daily_first_visits", label: "Daily first visits (sum)", description: "Daily counts; returning people can appear again on another day" },
  { id: "daily_visitors", label: "Daily visitors (sum)", description: "Visitor-days, not unique monthly people; cached page loads may be missed" },
  { id: "social_reach", label: "Social reach", description: "People reached across our channels" },
  { id: "social_engagement", label: "Social engagement", description: "Likes, shares, comments and saves" },
  { id: "posts_published", label: "Posts published", description: "Across all social channels" },
  { id: "new_ambassadors", label: "New ambassadors", description: "Young people who joined the network" },
  { id: "new_partners", label: "New partners", description: "Organisations that came on board" },
  { id: "opportunities_published", label: "Opportunities published", description: "Scholarships, grants and roles shared publicly" },
  { id: "projects_organised", label: "Projects organised", description: "Trainings, workshops and projects GOD ran" },
];

/** A daily average of the website table, summed over the days the month has had: the whole month for a past one, the days gone for the current one. */
const dailySum = (data: Pick<KpiData, "websiteMonths">, month: MonthKey, field: "dailyFirstVisits" | "dailyVisitors", today: Date): number => {
  const row = data.websiteMonths.find((entry) => entry.month === month);
  if (!row) return 0;
  const days = isMonthToDate(month, today) ? today.getUTCDate() : daysInMonth(month);
  return Math.round(row[field] * days);
};

/** One figure of the partner report in one month (a count, a daily sum, or a KPI). Equal to the matching KPI where there is one. */
export function partnerFigure(id: PartnerMetricId, month: MonthKey, today: Date = new Date(), data: ReportData = storeReportData()): number {
  const kpi: Partial<Record<PartnerMetricId, KpiKey>> = {
    website_views: "website_views",
    social_reach: "social_reach",
    social_engagement: "social_engagement",
    posts_published: "posts_published",
    new_partners: "partners_onboarded",
    opportunities_published: "opportunities_published",
    projects_organised: "programs_organised",
  };
  const key = kpi[id];
  if (key) return kpiValue(key, month, data);
  if (id === "new_ambassadors") return newInMonth("ambassadors", month, data);
  return dailySum(data, month, id === "daily_first_visits" ? "dailyFirstVisits" : "dailyVisitors", isMonthToDate(month, today) ? today : reportToday(month, today));
}

/**
 * The ten figures of the partner report with their change. For a past month the comparison is the previous month; for the current month it is the previous
 * month pro-rated to the same day (the report says it is an estimate). With no previous month (the first month on record) the change is "—".
 */
export function partnerMetrics(month: MonthKey, today: Date = new Date(), data: ReportData = storeReportData()): PartnerMetric[] {
  const previousMonth = monthsBefore(month, 1);
  const hasPrevious = previousMonth >= earliestMonth(today);
  const toDate = isMonthToDate(month, today);
  // the share of the previous month that has gone by the same day of this month
  const share = toDate ? Math.min(1, today.getUTCDate() / daysInMonth(previousMonth)) : 1;
  const against = toDate ? "the same period last month, estimated" : formatMonth(previousMonth);
  return METRICS.map((metric) => {
    const value = partnerFigure(metric.id, month, today, data);
    const previous = hasPrevious ? partnerFigure(metric.id, previousMonth, today, data) * share : null;
    return { ...metric, value, previous, delta: metricDelta(value, previous, against) };
  });
}

/** True when the month recorded nothing at all (every figure is 0): the report says so in a neutral note. */
export const isEmptyMonth = (metrics: readonly PartnerMetric[]): boolean => metrics.every((metric) => metric.value === 0);

/** The previous month in words ("August 2026"): what the partner report is compared with. */
export const previousMonthLabel = (month: MonthKey): string => formatMonth(monthsBefore(month, 1));

/** The month as the report prints it in its footer: "Global Opportunity Desk . October 2026" is built from this. */
export const reportMonthLabel = (month: MonthKey): string => formatMonth(month);

// ---- the team report ----------------------------------------------------------------------------------------------------

export interface TeamReportData {
  month: MonthKey;
  /** The ten KPIs with their target, value and status: the same cards as the Overview. */
  kpis: KpiCardData[];
  /** Partner pipeline health (the gauge of Partners) and the target it is judged against. */
  pipeline: PipelineHealth;
  pipelineTarget: number;
  /** Database pace (the gauge of Database) and the records verified in the month, by source. */
  pace: RecordsPace;
  sources: SourceCount[];
  /** The network: size and activity rate for the month. */
  network: NetworkSummaryData;
  /** The five ambassadors at the top of the month's leaderboard. */
  top: LeaderboardRow[];
  /** Posts, reach and engagement of the month, with the platforms. */
  social: SocialMonth;
  /** The team scoreboard: exactly what the Team scorecard shows for the month (not recalculated). */
  people: ScorecardPerson[];
  /** The month is too young for the scoreboard (before SCORE_FROM_DAY): "Scores start on day 5". */
  tooEarly: boolean;
}

/** Everything the team report shows for a month. */
export function teamReport(month: MonthKey, today: Date = new Date(), data: ReportData = storeReportData()): TeamReportData {
  const asOf = reportToday(month, today);
  const end = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const members = data.ambassadors.filter((ambassador) => ambassador.joinedAt <= end);
  const verifiedInMonth = data.databaseRecords.filter((record) => record.verified && record.verifiedAt?.startsWith(month));
  const target = kpiTarget("partners_onboarded", data, month);
  return {
    month,
    kpis: buildKpiCards(month, today, data),
    pipeline: pipelineHealth(data.partners, flattenMoves(data.partners), target, asOf),
    pipelineTarget: target,
    pace: recordsPace(asOf, data),
    sources: sourceBreakdown(verifiedInMonth),
    network: networkSummary(members, data.amplificationLogs, month),
    top: buildLeaderboard(data.ambassadors, data.amplificationLogs, data.databaseRecords, month).slice(0, 5),
    social: socialMonth(month, data),
    people: teamScorecards(month, today, data, data.staff),
    tooEarly: isTooEarly(month, today),
  };
}
