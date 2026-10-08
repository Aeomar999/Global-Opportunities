/**
 * Overview data service: ONE `getOverview(month)` returns everything the Overview page shows, so the page makes a single call.
 *
 * - Mock mode (see mock-mode.ts): everything is worked out from the shared in-memory store, with the same functions the
 *   Database, Social and Programs pages use (kpiValue, kpiTarget, kpiThresholds, kpiStatus), so a card, a gauge and a list
 *   always agree, and a target saved in Settings changes the status here. The queue counts come from mock-counts.ts: the SAME
 *   numbers as the sidebar pills and the breadcrumb pill.
 * - Real mode: the API has no monthly targets yet, so the ten cards, the trend, the programs and the feed are "not available yet"
 *   (notConnected: true, not an error) and only the two queue counts from GET /dashboard/summary are live.
 *
 * Design rules:
 * - It never throws for expected failures. It resolves with `issue` set, and every section that could not be loaded is `null`
 *   (the UI shows "—").
 * - Dev only: in mock mode, ?state=loading|error|429|401|partial|empty on the page URL forces that state (see FORCED_STATES).
 *   It is ignored in production builds and in real-API mode.
 * - The first load takes a moment (skeletons show); every later one is instant, so a change shows at once.
 * - A PAST month is a read-only snapshot: the value reached against the target and thresholds that applied THEN (the final status).
 */
import { KPI_KEYS, isRunningTotal } from "@/config/kpis";
import { ApiError, getDashboardSummary } from "@/lib/api";
import { formatDate, formatMonth } from "@/lib/format";
import { attainment, currentMonth, isPastMonth, kpiStatus, kpiTarget, kpiMonthProgress, kpiThresholds, kpiValue, monthsBefore, storeData, type KpiData } from "@/lib/kpi";
import { getMockCollection, getPartnerStageLabels } from "@/lib/mock-store";
import type { MonthKey } from "@/lib/mock-entities";
import { getMockCounts } from "./mock-counts";
import { isMockMode } from "./mock-mode";
import type { AttentionCounts, FeedItem, KpiCardData, KpiKey, OverviewData, OverviewIssue, OverviewResult, TrendPoint, UpcomingProgram } from "./dashboard-types";

export * from "./dashboard-types";

/** Values accepted by the ?state= switch (mock mode, never in production). "loading" never resolves. */
export const FORCED_STATES = ["loading", "error", "429", "401", "partial", "empty"] as const;
export type ForcedState = (typeof FORCED_STATES)[number];

/** The ?state= value on the current page URL, or null. Mock mode and non-production only. */
function readForcedState(): ForcedState | null {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production" || !isMockMode()) return null;
  const value = new URLSearchParams(window.location.search).get("state");
  return FORCED_STATES.find((state) => state === value) ?? null;
}

const DEFAULT_RETRY_SECONDS = 30;
const MOCK_DELAY_MS = 400;
export const TREND_MONTHS = 6;
export const UPCOMING_COUNT = 5;
export const FEED_COUNT = 6;
/** At most this many of one kind in the feed, so one busy kind (verified records) never crowds out the others. */
const FEED_PER_KIND = 2;

// ---- the ten cards -----------------------------------------------------------------------------------------------------

/** The ten KPI cards for a month: the value, the target that applied THEN, the status and how far into the month we are. */
export function buildKpiCards(month: MonthKey, today: Date = new Date(), data: KpiData = storeData()): KpiCardData[] {
  const thresholds = kpiThresholds(month, data);
  return KPI_KEYS.map((key) => {
    // A running total (Active ambassadors) is judged against the FULL target: no pro-rating, no pace tick.
    const { dayOfMonth, daysInMonth: total } = kpiMonthProgress(key, month, today);
    const value = kpiValue(key, month, data);
    const target = kpiTarget(key, data, month);
    return {
      key,
      value,
      target,
      // No target set: nothing to judge against, so no status (the card says "No target").
      status: target > 0 ? kpiStatus(value, target, dayOfMonth, total, thresholds, month) : null,
      pace: dayOfMonth / total,
      prorated: !isRunningTotal(key),
      attainment: attainment(value, target),
    };
  });
}

/** value / the target earned so far (the pro-rated target; the full target in a past month). The number the Priorities panel ranks by and the Scorecard shows. */
export const paceAttainment = (card: KpiCardData): number | null => (card.value === null || !card.target ? null : card.value / (card.target * (card.pace ?? 1)));

/** The three KPIs furthest behind their pace (lowest value against the target earned so far), worst first. Only KPIs with a target. */
export function furthestBehind(cards: KpiCardData[], count = 3): KpiCardData[] {
  return rankByPace(cards).slice(0, count);
}

/** Every KPI with a target, worst against its pace first (a tie keeps the KPI order). */
export function rankByPace(cards: KpiCardData[]): KpiCardData[] {
  const score = (card: KpiCardData) => (card.value ?? 0) / Math.max(1e-9, (card.target ?? 0) * (card.pace ?? 1));
  return cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.value !== null && (card.target ?? 0) > 0)
    .sort((a, b) => score(a.card) - score(b.card) || a.index - b.index)
    .map(({ card }) => card);
}

// ---- the trend ---------------------------------------------------------------------------------------------------------

/** The last six months of every KPI, oldest first, ending with `month`. */
export function buildTrend(month: MonthKey, data: KpiData = storeData()): Record<KpiKey, TrendPoint[]> {
  const months = Array.from({ length: TREND_MONTHS }, (_, i) => monthsBefore(month, TREND_MONTHS - 1 - i));
  return Object.fromEntries(
    KPI_KEYS.map((key) => [key, months.map((m) => ({ month: m, label: formatMonth(m).slice(0, 3), tooltipLabel: formatMonth(m), value: kpiValue(key, m, data) }))]),
  ) as Record<KpiKey, TrendPoint[]>;
}

// ---- upcoming programs -------------------------------------------------------------------------------------------------

/** The next five programs that are planned or running, soonest start first. */
export function buildUpcomingPrograms(): UpcomingProgram[] {
  const partners = getMockCollection("partners");
  return getMockCollection("programs")
    .filter((program) => program.status === "planned" || program.status === "running")
    .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.name.localeCompare(b.name))
    .slice(0, UPCOMING_COUNT)
    .map((program) => ({
      id: program.id,
      title: program.name,
      type: program.type,
      startAt: program.startAt,
      participants: program.participants,
      target: program.target,
      partner: partners.find((partner) => partner.id === program.partnerId)?.name ?? null,
      status: program.status as "planned" | "running",
    }));
}

// ---- recent activity ---------------------------------------------------------------------------------------------------

const day = (iso: string) => iso.slice(0, 10);

/**
 * A mixed timeline from the stores, newest first: a new ambassador, a partner moved to a stage, a listing published, a program
 * delivered, a record verified, a testimonial approved. At most three of each kind go in, then the newest eight of those show.
 */
export function buildActivity(): FeedItem[] {
  const labels = getPartnerStageLabels();
  const items: FeedItem[] = [];
  const add = (kind: FeedItem["kind"], events: { key: string; title: string; description: string; at: string }[]) => {
    const newest = [...events].sort((a, b) => day(b.at).localeCompare(day(a.at)) || b.key.localeCompare(a.key)).slice(0, FEED_PER_KIND);
    for (const event of newest) items.push({ ...event, kind, time: formatDate(day(event.at)) });
  };

  add(
    "ambassador",
    getMockCollection("ambassadors")
      .filter((ambassador) => ambassador.status !== "applicant" && !!ambassador.joinedAt)
      .map((ambassador) => ({ key: `amb-${ambassador.id}`, title: `${ambassador.name} joined as an ambassador`, description: ambassador.campus, at: ambassador.joinedAt })),
  );
  add(
    "partner",
    getMockCollection("partners").flatMap((partner) =>
      partner.stageHistory.slice(1).map((entry, index) => ({
        key: `par-${partner.id}-${index}`,
        title: `${partner.name} moved to ${labels[entry.stage]}`,
        description: partner.sector,
        at: entry.at,
      })),
    ),
  );
  add(
    "listing",
    getMockCollection("listings")
      .filter((listing) => listing.status === "published" && listing.vetted && !!listing.publishedAt)
      .map((listing) => ({ key: `lst-${listing.id}`, title: `${listing.title} was published`, description: listing.organisation, at: listing.publishedAt! })),
  );
  add(
    "program",
    getMockCollection("programs")
      .filter((program) => program.status === "delivered" && !!program.deliveredAt)
      .map((program) => ({ key: `prg-${program.id}`, title: `${program.name} was delivered`, description: `${program.participants} of ${program.target} participants`, at: program.deliveredAt! })),
  );
  add(
    "record",
    getMockCollection("databaseRecords")
      .filter((record) => record.verified && !!record.verifiedAt)
      .map((record) => ({ key: `rec-${record.id}`, title: `${record.name} was verified`, description: record.institution, at: record.verifiedAt! })),
  );
  add(
    "testimonial",
    getMockCollection("testimonials")
      .filter((testimonial) => testimonial.status === "approved")
      .map((testimonial) => ({ key: `tes-${testimonial.id}`, title: `A testimonial from ${testimonial.author} was approved`, description: testimonial.role, at: testimonial.submittedAt })),
  );

  return items.sort((a, b) => day(b.at).localeCompare(day(a.at)) || a.key.localeCompare(b.key)).slice(0, FEED_COUNT);
}

// ---- needs your attention ----------------------------------------------------------------------------------------------

/** The four waiting queues, from the SAME numbers as the sidebar pills (mock-counts.ts). */
export function buildAttention(): AttentionCounts {
  const { pendingVerifications, openReports, pendingTestimonials, draftListings } = getMockCounts();
  return { pendingVerifications, openReports, pendingTestimonials, draftListings };
}

// ---- mock mode ---------------------------------------------------------------------------------------------------------

/** Everything for one month, worked out from the shared store. Pure and instant: the page wraps it in the first-load delay. */
export function buildMockOverview(month: MonthKey, today: Date = new Date()): OverviewData {
  const data = storeData();
  return {
    source: "mock",
    month,
    notConnected: false,
    isPast: isPastMonth(month, today),
    kpis: buildKpiCards(month, today, data),
    trend: buildTrend(month, data),
    programs: buildUpcomingPrograms(),
    activity: buildActivity(),
    attention: buildAttention(),
  };
}

const unavailable = (month: MonthKey): OverviewData => ({ source: "mock", month, notConnected: false, isPast: false, kpis: null, trend: null, programs: null, activity: null, attention: null });

function buildForcedMockOverview(state: Exclude<ForcedState, "loading">, month: MonthKey): OverviewResult {
  switch (state) {
    case "error":
      return { data: unavailable(month), issue: { kind: "failed", message: "Could not load the overview. (forced: ?state=error)" } };
    case "429":
      return { data: unavailable(month), issue: { kind: "rate_limited", message: "Too many requests. Please wait before trying again.", retryAfter: DEFAULT_RETRY_SECONDS } };
    case "401":
      return { data: unavailable(month), issue: { kind: "unauthorized", message: "Your session has expired." } };
    case "partial":
      // The cards and the queues load; the trend, the programs and the feed do not.
      return {
        data: { ...buildMockOverview(month), trend: null, programs: null, activity: null },
        issue: { kind: "partial", message: "Some sections could not be loaded. (forced: ?state=partial)" },
      };
    default: {
      // "empty": the request worked and there is simply nothing yet.
      const cards = buildKpiCards(month).map((card): KpiCardData => ({ ...card, value: 0, status: card.target ? "red" : null, attainment: card.target ? 0 : null }));
      const trend = Object.fromEntries(KPI_KEYS.map((key) => [key, buildTrend(month)[key].map((point) => ({ ...point, value: 0 }))])) as OverviewData["trend"];
      return {
        data: {
          source: "mock",
          month,
          notConnected: false,
          isPast: false,
          kpis: cards,
          trend,
          programs: [],
          activity: [],
          attention: { pendingVerifications: 0, openReports: 0, pendingTestimonials: 0, draftListings: 0 },
        },
        issue: null,
      };
    }
  }
}

// ---- real API ----------------------------------------------------------------------------------------------------------

async function fetchRealOverview(month: MonthKey): Promise<OverviewResult> {
  const [summary] = await Promise.allSettled([getDashboardSummary() as Promise<unknown> as Promise<Record<string, number>>]);
  const count = (key: string): number | null => (summary.status === "fulfilled" && typeof summary.value[key] === "number" ? summary.value[key] : null);
  const data: OverviewData = {
    ...unavailable(month),
    source: "api",
    notConnected: true,
    // The API has no verified testimonials queue or drafts yet: only the two counts it does report.
    attention: { pendingVerifications: count("pendingVerifications"), openReports: count("openReports"), pendingTestimonials: null, draftListings: null },
  };
  return { data, issue: classifyIssue(summary) };
}

/** Turns the settled request into at most one banner-worthy issue. */
function classifyIssue(result: PromiseSettledResult<unknown>): OverviewIssue | null {
  if (result.status === "fulfilled") return null;
  const error = result.reason as unknown;
  if (error instanceof ApiError && error.status === 401) return { kind: "unauthorized", message: "Your session has expired." };
  if (error instanceof ApiError && error.status === 429) {
    return { kind: "rate_limited", message: "Too many requests. Please wait before trying again.", retryAfter: error.retryAfter ?? DEFAULT_RETRY_SECONDS };
  }
  return { kind: "failed", message: `Could not load the overview. ${error instanceof Error ? error.message : "Something went wrong."}` };
}

// ---- public ------------------------------------------------------------------------------------------------------------

// The first mock load takes a moment (skeletons); later ones are instant.
let loadedOnce = false;
let inflight: { key: string; promise: Promise<OverviewResult> } | null = null;

/** The Overview for a month (default: this month). The in-flight call is shared, so React Strict Mode causes one round trip. */
export function getOverview(month: MonthKey = currentMonth()): Promise<OverviewResult> {
  const forced = readForcedState();
  const key = `${forced ?? "live"}:${month}`;
  if (inflight?.key === key) return inflight.promise;

  // ?state=loading: never resolve, so the skeletons stay on screen for review.
  if (forced === "loading") return new Promise<OverviewResult>(() => {});

  const build = (): OverviewResult => (forced ? buildForcedMockOverview(forced, month) : { data: buildMockOverview(month), issue: null });
  const run: Promise<OverviewResult> = isMockMode()
    ? loadedOnce
      ? Promise.resolve(build())
      : new Promise<OverviewResult>((resolve) =>
          setTimeout(() => {
            loadedOnce = true;
            resolve(build());
          }, MOCK_DELAY_MS),
        )
    : fetchRealOverview(month);

  const promise = run.finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  inflight = { key, promise };
  return promise;
}

