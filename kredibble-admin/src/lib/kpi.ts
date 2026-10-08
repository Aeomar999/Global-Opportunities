/**
 * KPI maths: pure functions over the desk's data. Nothing here renders anything or touches the network.
 *
 * - kpiValue(key, month)      the number for one KPI in one month ("2026-10"), counted from the collections
 * - kpiTarget(key)            the monthly target stored for that KPI (Settings edits it)
 * - kpiStatus(...)            "green" | "amber" | "red" from value, target, how far into the month we are and the
 *                             stored thresholds
 * - attainment(value, target) value / target (null when there is no target)
 * - monthSeries(key, 6)       the last six months of a KPI, oldest first
 *
 * Every function reads its data from the shared mock store by default, and takes an optional `data` argument so a
 * test (or a service) can pass its own. All dates are UTC and months are "YYYY-MM" strings.
 *
 * Pro-rating: the CURRENT month is judged against the part of the target the month has earned so far (day 10 of
 * 30 = a third of the target); a PAST month is judged against the full target. To get that, callers pass
 * dayOfMonth = daysInMonth for a past month (see monthProgress).
 */
import { KPI_KEYS, KPIS, type KpiKey } from "@/config/kpis";
import { partnerClosedAt, type EntityCollections, type KpiThresholds, type MonthKey, type MonthlyReport, type TargetChange, type ThresholdChange } from "@/lib/mock-entities";
import { getMockCollection } from "@/lib/mock-store";

export type KpiStatus = "green" | "amber" | "red";

// ------------------------------------------------------------------------------------------------ months
const pad = (n: number) => String(n).padStart(2, "0");

/** The month of `today` as "YYYY-MM" (UTC). */
export const currentMonth = (today: Date = new Date()): MonthKey => `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}`;

/** The month `back` months before `month` ("2026-03", 4 -> "2025-11"). */
export function monthsBefore(month: MonthKey, back: number): MonthKey {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 - back, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

export function daysInMonth(month: MonthKey): number {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0)).getUTCDate();
}

/** True when `month` is before the month of `today`. Past months are read-only snapshots. */
export const isPastMonth = (month: MonthKey, today: Date = new Date()): boolean => month < currentMonth(today);

/** How far into the month we are: today's day for the current month, the whole month for a past one. */
export function monthProgress(month: MonthKey, today: Date = new Date()): { dayOfMonth: number; daysInMonth: number } {
  const total = daysInMonth(month);
  return { dayOfMonth: isPastMonth(month, today) ? total : Math.min(today.getUTCDate(), total), daysInMonth: total };
}

/**
 * How far into the month a KPI is judged: monthProgress for a "count" KPI, the WHOLE month for a "running_total" (Active ambassadors is a stock, so it is
 * compared with the full monthly target from day 1 and never pro-rated). Everything that judges a KPI in the current month goes through this.
 */
export function kpiMonthProgress(key: KpiKey, month: MonthKey, today: Date = new Date()): { dayOfMonth: number; daysInMonth: number } {
  const progress = monthProgress(month, today);
  return KPIS[key].kind === "running_total" ? { dayOfMonth: progress.daysInMonth, daysInMonth: progress.daysInMonth } : progress;
}

const inMonth = (iso: string | undefined, month: MonthKey): boolean => !!iso && iso.slice(0, 7) === month;
const lastDayOf = (month: MonthKey): string => `${month}-${pad(daysInMonth(month))}`;

// ------------------------------------------------------------------------------------------------ data
/** The collections the KPIs are counted from. */
export type KpiData = Pick<
  EntityCollections,
  "listings" | "programs" | "ambassadors" | "partners" | "databaseRecords" | "socialPosts" | "websiteMonths" | "monthlyReports" | "targets" | "targetHistory" | "thresholdHistory"
>;

/** The shared mock store's current collections. */
export const storeData = (): KpiData => ({
  listings: getMockCollection("listings"),
  programs: getMockCollection("programs"),
  ambassadors: getMockCollection("ambassadors"),
  partners: getMockCollection("partners"),
  databaseRecords: getMockCollection("databaseRecords"),
  socialPosts: getMockCollection("socialPosts"),
  websiteMonths: getMockCollection("websiteMonths"),
  monthlyReports: getMockCollection("monthlyReports"),
  targets: getMockCollection("targets"),
  targetHistory: getMockCollection("targetHistory"),
  thresholdHistory: getMockCollection("thresholdHistory"),
});

/** The value of one KPI in one month, counted from the data. */
export function kpiValue(key: KpiKey, month: MonthKey, data: KpiData = storeData()): number {
  const published = (post: { status: string; postedAt: string }) => post.status === "published" && inMonth(post.postedAt, month);
  switch (key) {
    case "opportunities_published":
      return data.listings.filter((listing) => listing.status === "published" && listing.vetted && inMonth(listing.publishedAt, month)).length;
    case "programs_organised":
      return data.programs.filter((program) => program.status === "delivered" && inMonth(program.deliveredAt, month)).length;
    case "active_ambassadors": {
      // A running total: active at the END of the month (joined by then, and not gone dormant yet).
      const end = lastDayOf(month);
      return data.ambassadors.filter(
        (ambassador) =>
          (ambassador.status === "active" || ambassador.status === "dormant") &&
          ambassador.joinedAt <= end &&
          !(ambassador.dormantSince && ambassador.dormantSince <= end),
      ).length;
    }
    case "partners_onboarded":
      return data.partners.filter((partner) =>
        partner.stageHistory.some((entry) => (entry.stage === "onboard" || entry.stage === "renew") && inMonth(entry.at, month)),
      ).length;
    case "beneficiaries_verified":
      return data.databaseRecords.filter((record) => record.verified && inMonth(record.verifiedAt, month)).length;
    case "social_reach":
      return data.socialPosts.filter(published).reduce((sum, post) => sum + post.reach, 0);
    case "social_engagement":
      return data.socialPosts.filter(published).reduce((sum, post) => sum + post.engagement, 0);
    case "posts_published":
      return data.socialPosts.filter(published).length;
    case "website_views":
      return data.websiteMonths.find((row) => row.month === month)?.views ?? 0;
    case "monthly_reports":
      // Counted by the calendar month the report was GENERATED in (generatedAt), not the month it covers.
      return data.monthlyReports.filter((report) => inMonth(report.generatedAt, month)).length;
  }
}

/**
 * The monthly target of a KPI IN A MONTH (0 when none is set; default: the current month). Targets have a history: the latest change
 * whose effectiveFrom is that month or earlier applies, otherwise the first target. So a change saved in Settings never rewrites the
 * past: an earlier month keeps the target that applied then. Everything that reads a target (the gauges, the pace card, the pipeline health,
 * the Social captions, the KPI statuses) goes through this function.
 */
export const kpiTarget = (key: KpiKey, data: Pick<KpiData, "targets"> & Partial<Pick<KpiData, "targetHistory">> = storeData(), month: MonthKey = currentMonth()): number => {
  // The row with the latest effectiveFrom that has started; of two for the same month, the one saved later (later in the list) wins.
  const change = (data.targetHistory ?? []).reduce<TargetChange | undefined>(
    (best, entry) => (entry.kpi === key && entry.effectiveFrom <= month && (!best || entry.effectiveFrom >= best.effectiveFrom) ? entry : best),
    undefined,
  );
  return change ? change.value : (data.targets.find((target) => target.kpi === key)?.target ?? 0);
};

/**
 * The status thresholds IN A MONTH (default: the current month), exactly like kpiTarget: the row of the thresholdHistory with the latest
 * effectiveFrom that has started (of two for one month, the later one). A month before the first row uses the first row. Settings appends
 * rows and never edits one, so a past month keeps the thresholds that applied then. Nothing else reads the default thresholds.
 */
export function kpiThresholds(month: MonthKey = currentMonth(), data: Pick<KpiData, "thresholdHistory"> = storeData()): KpiThresholds {
  const rows = data.thresholdHistory;
  const started = rows.reduce<ThresholdChange | undefined>((best, row) => (row.effectiveFrom <= month && (!best || row.effectiveFrom >= best.effectiveFrom) ? row : best), undefined);
  const row = started ?? rows.reduce<ThresholdChange | undefined>((first, entry) => (!first || entry.effectiveFrom < first.effectiveFrom ? entry : first), undefined);
  return row ? { green: row.green, amber: row.amber } : { green: 1, amber: 1 };
}

// ------------------------------------------------------------------------------------------------ status
/**
 * "green" | "amber" | "red".
 *
 * The target is PRO-RATED to how far into the month we are: target x dayOfMonth / daysInMonth. For a past month
 * pass dayOfMonth = daysInMonth, which makes it the full target. Then attainment = value / pro-rated target:
 * at or above thresholds.green is green, at or above thresholds.amber is amber, below that is red. The thresholds are the ones that
 * applied in `month` (kpiThresholds; a call without a month uses the current month), unless a `thresholds` object is given. A KPI with no
 * target (0) is always green. The comparison is done on whole numbers (value x days against target x day), so a
 * value exactly on a threshold is never pushed over or under it by rounding.
 */
export function kpiStatus(
  value: number,
  target: number,
  dayOfMonth: number,
  daysInTheMonth: number,
  thresholds?: KpiThresholds,
  month: MonthKey = currentMonth(),
): KpiStatus {
  if (target <= 0) return "green";
  const limits = thresholds ?? kpiThresholds(month);
  const earned = target * Math.max(1, Math.min(dayOfMonth, daysInTheMonth));
  const ratio = (value * daysInTheMonth) / earned;
  if (ratio >= limits.green) return "green";
  if (ratio >= limits.amber) return "amber";
  return "red";
}

/** value / target, or null when there is no target. Not capped: 120 of 100 is 1.2. */
export const attainment = (value: number, target: number): number | null => (target > 0 ? value / target : null);

/** The status of a KPI in a month, judged the way the dashboard does (pro-rated now, full target for the past). */
export function kpiMonthStatus(key: KpiKey, month: MonthKey, today: Date = new Date(), data: KpiData = storeData()): KpiStatus {
  const { dayOfMonth, daysInMonth: total } = kpiMonthProgress(key, month, today);
  return kpiStatus(kpiValue(key, month, data), kpiTarget(key, data, month), dayOfMonth, total, kpiThresholds(month, data));
}

// ------------------------------------------------------------------------------------------------ monthly reports
/**
 * Should "Download PDF" add a report record now? The Monthly reports KPI counts reports GENERATED in a calendar month, so
 * the download step records one report for the month being viewed (`reportMonth`) with generatedAt = now, but at most
 * ONCE for each reportMonth AND view (partner or team) in each calendar month of generation: viewing or downloading the same report again in the
 * same month adds nothing, while generating it again next month does count.
 */
export function shouldRecordReport(reports: MonthlyReport[], reportMonth: MonthKey, now: Date = new Date(), view?: MonthlyReport["view"]): boolean {
  const thisMonth = currentMonth(now);
  return !reports.some((report) => report.reportMonth === reportMonth && (view === undefined || report.view === view) && inMonth(report.generatedAt, thisMonth));
}

// ------------------------------------------------------------------------------------------------ new in a month
/** The kinds of thing the partner report counts as "new" in a month. */
export type NewEntity = "ambassadors" | "partners" | "programs" | "listings" | "records";

/**
 * How many of an entity are NEW in a month, for the partner-report metrics. Each entity has its own date:
 * - ambassadors  joinedAt, applicants not counted (they have not joined yet)
 * - partners     the day the partner was first closed (it first reached onboard or renew), derived from its history
 * - programs     deliveredAt (delivered programs only)
 * - listings     publishedAt (published, vetted listings only)
 * - records      verifiedAt (verified database records only)
 */
export function newInMonth(entity: NewEntity, month: MonthKey, data: Pick<EntityCollections, "ambassadors" | "partners" | "programs" | "listings" | "databaseRecords"> = {
  ambassadors: getMockCollection("ambassadors"),
  partners: getMockCollection("partners"),
  programs: getMockCollection("programs"),
  listings: getMockCollection("listings"),
  databaseRecords: getMockCollection("databaseRecords"),
}): number {
  switch (entity) {
    case "ambassadors":
      return data.ambassadors.filter((ambassador) => ambassador.status !== "applicant" && inMonth(ambassador.joinedAt, month)).length;
    case "partners":
      return data.partners.filter((partner) => inMonth(partnerClosedAt(partner), month)).length;
    case "programs":
      return data.programs.filter((program) => program.status === "delivered" && inMonth(program.deliveredAt, month)).length;
    case "listings":
      return data.listings.filter((listing) => listing.status === "published" && listing.vetted && inMonth(listing.publishedAt, month)).length;
    case "records":
      return data.databaseRecords.filter((record) => record.verified && inMonth(record.verifiedAt, month)).length;
  }
}

// ------------------------------------------------------------------------------------------------ series
/** The last `months` months of a KPI, oldest first, ending with the month of `today`. */
export function monthSeries(key: KpiKey, months = 6, today: Date = new Date(), data: KpiData = storeData()): { month: MonthKey; value: number }[] {
  const now = currentMonth(today);
  return Array.from({ length: months }, (_, i) => {
    const month = monthsBefore(now, months - 1 - i);
    return { month, value: kpiValue(key, month, data) };
  });
}

/** Every KPI key, for callers that loop over them. */
export const ALL_KPI_KEYS = KPI_KEYS;
